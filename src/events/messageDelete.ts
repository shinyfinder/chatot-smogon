import { AuditLogEvent, Message } from 'discord.js';
import { eventHandler } from '../types/event-base.js';
import { sleep } from '../helpers/sleep.js';
import { pool } from '../helpers/createPool.js';
import { buildEmbed, buildMsgDeleteEmbedParams, postLogEvent, loggedEventTypes } from '../helpers/logging.js';
/**
 * messageDelete handler
 *
 * Event handler for when a message is deleted.
 * Deleted messages have their author, content, and person who deleted the message logged to the specified channel in the config file.
 * Content information is supplied by the audit log.
 *
 * Note that there is no guarantee when the audit log is populated, nor an event when it is.
 * If the person who deleted the message is a bot or the author, no audit log event is created.
 *
 * Deleting a bot message does not trigger the event
 */

export const clientEvent: eventHandler = {
    // define the name of the trigger event
    name: 'messageDelete',
    // execute the code for this event
    async execute(message: Message) {
        // ignore DMs and uncached messages
        if (!message.guild || !message.author) {
            return;
        }

        // determine if the channel is ignored from logging in the server by first querying the db
        const ignorePG = await pool.query('SELECT ignoreid, deletescope from chatot.logprefs WHERE serverid=$1', [message.guildId]);
        const dbmatches: { ignoreid: string, deletescope: string }[] | [] = ignorePG.rows;

        // check if the channel is ignored
        const isIgnored = dbmatches.some(row => row.ignoreid === message.channelId);

        // if it is, return because we don't want to log it
        if (isIgnored) {
            return;
        }

        // default to mod scope
        let scope = '';
        if (!dbmatches.length) {
            scope = 'mod';
        }
        else {
            scope = dbmatches[0].deletescope;
        }
        
        // get the current timestamp of when this event was triggered, in ms since the epoch
        const currentTime = Date.now();

        // wait a bit for the audit log to update
        await sleep(1500);

        // since we're only deleteing 1 message at a time, fetch the latest event from the audit log of type message deleted
        const fetchedLogs = await message.guild.fetchAuditLogs({
            limit: 1,
            type: AuditLogEvent.MessageDelete,
        });

        // Since there's only 1 audit log entry in this collection, grab the first one
        const deletionLog = fetchedLogs.entries.first();

        
        // If there's nothing in the audit log, see if this server wants to log every message delete
        // but also check to make sure this isn't an old post (> 2 weeks)
        const old = Math.abs(currentTime - message.createdTimestamp) > 1000 * 60 * 60 * 24 * 7 * 2;
        if (!deletionLog && scope === 'all' && !old) {
            // build the embed params
            const [title, description, color, fields] = buildMsgDeleteEmbedParams('Self', message);

            // build the embed itself
            const embed = buildEmbed(title, { description: description, color: color, fields: fields });

            // post it to the log chan
            await postLogEvent(embed, message.guild, loggedEventTypes.SelfDelete, message);
            return;
        }

        // if there's no audit log and they don't want to log everything, return
        else if (!deletionLog) {
            return;
        }

        // get the time the audit log entry was created
        const auditTime = deletionLog.createdTimestamp;

        /**
         * Check the difference between the audit log creation time and the time this event was triggered.
         * If that time difference is > 5 min, then it's an old audit log entry and we don't want to use it
         *
         * Known bug:
         *
         * The audit log creates a stack of similar events that persists for 5 minutes (300000 ms), meaning new events can be logged under old data.
         * This creates problems when the target deletes one of their own messages within 5 mins of a mod deleting it
         * As well as when two mods delete messages, followed by a self delete or another delete by the first mod of the first target within those 5 minutes
         * Either of these cases will falsely attribute the executor to the mod (the more recent audit executor in the latter case)
         * A way around this would be to store the stack count after each call to it. If the stack count increased since the last call, then that mod deleted it
         * Alternatively, you could loop through the stacks and compile the list of possible exectors for output.
         */
        if (Math.abs(currentTime - auditTime) > 300000) {
            // if it's an old audit log this is probably a self delete
            // so see if they want to log those and if it's not too old
            if (scope === 'all' && !old) {
                // build the embed params
                const [title, description, color, fields] = buildMsgDeleteEmbedParams('Self', message);

                // build the embed
                const embed = buildEmbed(title, { description: description, color: color, fields: fields });

                // post it to the log chan
                await postLogEvent(embed, message.guild, loggedEventTypes.SelfDelete, message);
                return;
            }
            else {
                return;
            }
            
        }

        // Now grab the user object of the person who deleted the message
        // Also grab the target of this action to double-check things
        const { executor, target } = deletionLog;

        // make sure executor isn't null to make TS happy. It shouldn't be
        if (!executor) {
            return;
        }

        // if the author of this deleted message is a bot, don't log it
        if (message.author.bot === true) {
            return;
        }

        // check to make sure that the log returned was for the same author's message
        if (target.id === message.author.id) {
            // build the embed params
            const [title, description, color, fields] = buildMsgDeleteEmbedParams(executor, message);
                
            // build the embed
            const embed = buildEmbed(title, { description: description, color: color, fields: fields });

            // post it to the log chan
            await postLogEvent(embed, message.guild, loggedEventTypes.ModDelete, message);
            return;
        }
        // if you got a new audit log but it was for a different user, this is probably a self delete
        // so check to see if it's a valid log case
        else if (scope === 'all' && !old) {
            // build the embed params
            const [title, description, color, fields] = buildMsgDeleteEmbedParams('Self', message);
            
            // build the embed
            const embed = buildEmbed(title, { description: description, color: color, fields: fields });

            // post it to the log chan
            await postLogEvent(embed, message.guild, loggedEventTypes.SelfDelete, message);
            return;
        }

    },
};
