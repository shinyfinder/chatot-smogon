import { ChannelType, EmbedBuilder, Message, SnowflakeUtil } from 'discord.js';
import { eventHandler } from '../types/event-base';
import { buildEmbed, postLogEvent, embedField, loggedEventTypes } from '../helpers/logging.js';
import { pool } from '../helpers/createPool.js';
import { botConfig } from '../config.js';
import { errorHandler } from '../helpers/errorHandler.js';

/**
 * Update message handler
 *
 * Event handler when a user edits a message
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

        // ignore bot messages, unless they're modposts
        if (newMsg.author.bot === true) {
            if (!/Last modpost edit: /.test(newMsg.content)) {
                return;
            }
            // do we really need this check? idk. But *technically* there could be another bot's post with this text
            else if (newMsg.author.id === botConfig.CLIENT_ID) {
                // strip the sig from the old mod post
                // and get the previous and current editors
                const oldEditor = oldMsg.content.match(/(?<=Last modpost edit: )[\w.#]+/)![0];
                const newEditor = newMsg.content.match(/(?<=Last modpost edit: )[\w.#]+/)![0];
                const oldUnsignedText = oldMsg.content.replace(/\n\nLast modpost edit:.*/, '');

                // check to see if they want logging
                const logScopes = ['all', 'edits', 'modex', 'msgtarget'];
                const logChanIDs: { channelid: string}[] = (await pool.query('SELECT channelid FROM chatot.logchan WHERE serverid=$1 AND logtype=ANY($2)', [oldMsg.guildId, logScopes])).rows;

                for (const chans of logChanIDs) {
                    try {
                        const chan = await newMsg.client.channels.fetch(chans.channelid);
                        if (chan && (chan.type === ChannelType.GuildText || chan.type === ChannelType.PrivateThread || chan.type === ChannelType.PublicThread)) {
                            const embed = new EmbedBuilder()
                                .setTitle('Modpost Edited')
                                .setDescription(`A modpost was edited. The previous content was:\n\`\`\`${oldUnsignedText}\`\`\``)
                                .setURL(oldMsg.url)
                                .addFields(
                                    { name: 'Old edit by', value: oldEditor, inline: true },
                                    { name: 'Current edit by', value: newEditor, inline: true },
                                );
                            await chan.send({ embeds: [embed], enforceNonce: true, nonce: SnowflakeUtil.generate().toString() });
                            await chan.send({ content: oldUnsignedText, enforceNonce: true, nonce: SnowflakeUtil.generate().toString() });
                        }
                        
                    }
                    catch (e) {
                        errorHandler(e);
                        continue;
                    }
                }
            }
            return;
        }

        // make sure the content was edited
        if (oldMsg.content === newMsg.content) {
            return;
        }
        
        // check if the server wants to log these
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
        let oldBuffer = Buffer.from('');
        let newBuffer = Buffer.from('');

        // make sure there's actually content in the messages. If there isn't, insert something so it's non-zero length
        // also make sure the content is less than the max field length of 1024 char
        if (oldMsg.content.length < 1025 && newMsg.content.length < 1025) {
            oldContent = oldMsg.content.length ? oldMsg.content : '\u200b';
            newContent = newMsg.content.length ? newMsg.content : '\u200b';
        }
        else if (oldMsg.content.length + newMsg.content.length < 5800 && oldMsg.content.length < 1025 && newMsg.content.length > 1025) {
            oldContent = oldMsg.content;
            newContent = 'Message too long to output';

            newBuffer = Buffer.from(newMsg.content);
        }
        else if (oldMsg.content.length + newMsg.content.length < 5800 && oldMsg.content.length > 1025 && newMsg.content.length < 1025) {
            oldContent = 'Message too long to output';
            newContent = newMsg.content;

            newBuffer = Buffer.from(oldMsg.content);
        }
        else {
            oldContent = 'Message too long to output';
            newContent = 'Message too long to output';

            oldBuffer = Buffer.from(oldMsg.content);
            newBuffer = Buffer.from(newMsg.content);
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
        await postLogEvent(embed, newMsg.guild, loggedEventTypes.Edit, { oldBuf: oldBuffer, newBuf: newBuffer });
    },
};
