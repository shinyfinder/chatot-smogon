import { Message } from 'discord.js';
import { eventHandler } from '../types/event-base';
import config from '../config.js';
import { buildEmbed, postLogEvent, embedField } from '../helpers/logging.js';
import { pool } from '../helpers/createPool.js';
import { stripDiscrim } from '../helpers/stripDiscrim.js';

/**
 * Update member handler
 *
 * Event handler for has their roles,  nickname, status, etc changed.
 * This includes boosting.
 */

export const clientEvent: eventHandler = {
    // define the name of the trigger event
    name: 'messageUpdate',
    // execute the code for this event
    async execute(oldMsg: Message, newMsg: Message) {
        // ignore DMs and uncached messages
        if (!newMsg.guild || !oldMsg.author) {
            return;
        }

        // ignore bot messages
        if (newMsg.author.bot === true) {
            return;
        }

        // make sure the content was edited
        if (oldMsg.content === newMsg.content) {
            return;
        }
        
        // check if the server wants to log these
        /*
        const editPG = await pool.query(`
            SELECT logedits, channelid
            FROM chatot.logprefs
            INNER JOIN chatot.logchan USING (serverid)
            WHERE serverid=$1`, [newMessage.guildId]);

        const dbmatches: { logedits: boolean, logchan: string }[] | [] = editPG.rows;
        */
        const editPG = await pool.query('SELECT ignoreid, logedits FROM chatot.logprefs WHERE serverid=$1', [newMsg.guildId]);
        const dbmatches: { ignoreid: string, logedits: boolean }[] | [] = editPG.rows;

        // if you didn't get a match, return (default false)
        if (!dbmatches.length) {
            return;
        }
        // else if they specifically don't want to log edits, return
        else if (dbmatches[0].logedits === false) {
            return;
        }

        // make sure the channel isn't being ignored
        const isIgnored = dbmatches.some(row => row.ignoreid === newMsg.channelId);

        // if it is, return because we don't want to log it
        if (isIgnored) {
            return;
        }
        
        // build the log embed
        // make sure the content is short enough for us to log it
        let oldContent = '';
        let newContent = '';

        // make sure there's actually content in the messages. If there isn't, insert something so it's non-zero length
        // also make sure the content is less than the max field length of 1024 char
        if (oldMsg.content.length < 1025 && newMsg.content.length < 1025) {
            oldContent = oldMsg.content.length ? oldMsg.content : '\u200b';
            newContent = newMsg.content.length ? newMsg.content : '\u200b';
        }
        else if (oldMsg.content.length + newMsg.content.length > 5800 && oldMsg.content.length < 1025) {
            oldContent = oldMsg.content;
            newContent = 'Message too long to output';
        }
        else {
            oldContent = 'Message too long to output';
            newContent = 'Message too long to output';
        }
        
        const title = 'Message Edited';
        const fields: embedField[] = [
            { name: 'Old Content', value: `${oldContent}` },
            { name: 'New Content', value: `${newContent}` },
            { name: 'Name', value: `<@${newMsg.author.id}>`, inline: true },
            { name: 'Message', value: `${newMsg.url}`, inline: true },
        ];
        const embed = buildEmbed(title, { fields: fields });
        
        // try to post it
        await postLogEvent(embed, newMsg.guild);
    },
};
