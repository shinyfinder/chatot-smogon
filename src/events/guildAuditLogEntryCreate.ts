import { AuditLogEvent, Guild, GuildAuditLogsEntry } from 'discord.js';
import { eventHandler } from '../types/event-base';
import { pool } from '../helpers/createPool.js';
import config from '../config.js';
import { buildEmbed, postLogEvent, echoPunishment, embedField, loggedEventTypes } from '../helpers/logging.js';

/**
 * Ban handler
 *
 * Event handler for when a user is banned.
 * Ban events are logged with the user, the mod, and the reason to the specified channel in the config file.
 * Content information is supplied by the audit log.
 *
 * Note that there is no guarantee when the audit log is populated, nor an event when it is.
 * If the person who deleted the message is a bot or the author, no audit log event is created.
 */

export const clientEvent: eventHandler = {
    // define the name of the trigger event
    name: 'guildAuditLogEntryCreate',
    // execute the code for this event
    async execute(auditLog: GuildAuditLogsEntry, guild: Guild) {
        // ignore DMs and return if the bot is the one getting modded
        if (!guild || auditLog.targetId === config.CLIENT_ID) {
            return;
        }

        /**
         * BAN ADD
         */

        if (auditLog.action === AuditLogEvent.MemberBanAdd) {
            // make sure you have the executor and target
            if (!auditLog.executorId || !auditLog.targetId) {
                return;
            }
            // ensure the user obj for the exec and target are cached
            const executor = await guild.client.users.fetch(auditLog.executorId);
            const target = await guild.client.users.fetch(auditLog.targetId);
            const reason = auditLog.reason ?? 'None';

            // set the inputs needed to build the embed
            const title = 'User Banned';
            const description = `${target.tag} was banned from the server by ${executor.tag}.`;
            const color = 0xED4245;
            const fields: embedField[] = [
                { name: 'User', value: `<@${target.id}>` },
                { name: 'Banned by', value: `<@${executor.id}>` },
                { name: 'Reason', value: `${reason}` },
            ];

            // build the discord embed
            const embed = buildEmbed(title, { description: description, color: color, fields: fields });

            // save to modlog for the server
            await pool.query('INSERT INTO chatot.modlog (serverid, executor, target, action, reason) VALUES ($1, $2, $3, $4, $5)', [guild.id, executor.id, target.id, 'Ban', reason]);

            // post the log to the logging channel
            await postLogEvent(embed, guild, loggedEventTypes.Ban);

            // if this is smogcord, echo to the log-punishments chan
            await echoPunishment(guild, target, reason, loggedEventTypes.Ban);

        }


        /**
         * BAN REMOVE
         */

        else if (auditLog.action === AuditLogEvent.MemberBanRemove) {
            // make sure you have the executor and target
            if (!auditLog.executorId || !auditLog.targetId) {
                return;
            }
            // ensure the user obj for the exec and target are cached
            const executor = await guild.client.users.fetch(auditLog.executorId);
            const target = await guild.client.users.fetch(auditLog.targetId);
            const reason = auditLog.reason ?? 'None';

            // set the inputs needed to build the embed
            const title = 'User Unbanned';
            const description = `${target.tag} was unbanned from the server by ${executor.tag}.`;
            const color = 0x57F287;
            const fields: embedField[] = [
                { name: 'User', value: `<@${target.id}>` },
                { name: 'Unbanned by', value: `<@${executor.id}>` },
                { name: 'Reason', value: `${reason}` },
            ];

            // build the discord embed
            const embed = buildEmbed(title, { description: description, color: color, fields: fields });

            // save to modlog for the server
            await pool.query('INSERT INTO chatot.modlog (serverid, executor, target, action, reason) VALUES ($1, $2, $3, $4, $5)', [guild.id, executor.id, target.id, 'Unban', reason]);

            // post the log to the logging channel
            await postLogEvent(embed, guild, loggedEventTypes.Ban);

        }


        /**
         * KICK
         */
        else if (auditLog.action === AuditLogEvent.MemberKick) {
            // make sure you have the executor and target
            if (!auditLog.executorId || !auditLog.targetId) {
                return;
            }
            // ensure the user obj for the exec and target are cached
            const executor = await guild.client.users.fetch(auditLog.executorId);
            const target = await guild.client.users.fetch(auditLog.targetId);
            const reason = auditLog.reason ?? 'None';

            // set the inputs needed to build the embed
            const title = 'User Kicked';
            const description = `${target.tag} was kicked from the server by ${executor.tag}.`;
            const color = 0xE67E22;
            const fields: embedField[] = [
                { name: 'User', value: `<@${target.id}>` },
                { name: 'Kicked by', value: `<@${executor.id}>` },
                { name: 'Reason', value: `${reason}` },
            ];

            // build the discord embed
            const embed = buildEmbed(title, { description: description, color: color, fields: fields });

            // save to modlog for the server
            await pool.query('INSERT INTO chatot.modlog (serverid, executor, target, action, reason) VALUES ($1, $2, $3, $4, $5)', [guild.id, executor.id, target.id, 'Kick', reason]);

            // post the log to the logging channel
            await postLogEvent(embed, guild, loggedEventTypes.Kick);

            // if this is smogcord, echo to the log-punishments chan
            await echoPunishment(guild, target, reason, loggedEventTypes.Kick);

        }


        /**
         * TIMEOUT
         */
        
        else if (auditLog.action === AuditLogEvent.MemberUpdate) {
            // make sure you have the executor and target
            if (!auditLog.executorId || !auditLog.targetId || !auditLog.changes) {
                return;
            }
            
            // extract the differences in the updated user from the audit log entry
            const changes = auditLog.changes;

            // we only want to log timeouts, so check if the changes are communication_disabled_until
            if (changes[0].key !== 'communication_disabled_until') {
                return;
            }

            // ensure the user obj for the exec and target are cached
            const executor = await guild.client.users.fetch(auditLog.executorId);
            const target = await guild.client.users.fetch(auditLog.targetId);
            const reason = auditLog.reason ?? 'None';

            // get the current timestamp and the timestamp of the timeout
            // if the new time is undefined, the timeout is being removed
            if (changes[0].new === undefined) {
                // set the inputs needed to build the embed
                const title = 'Timeout Removed';
                const description = `${target.tag}'s timeout was removed by ${executor.tag}.`;
                const color = 0xa29863;
                const fields: embedField[] = [
                    { name: 'User', value: `<@${target.id}>`, inline: true },
                    { name: 'Performed by', value: `<@${executor.id}>`, inline: true },
                ];
                // build the embed
                const embed = buildEmbed(title, { description: description, color: color, fields: fields });
                // save to modlog for the server
                await pool.query('INSERT INTO chatot.modlog (serverid, executor, target, action, reason) VALUES ($1, $2, $3, $4, $5)', [guild.id, executor.id, target.id, 'Untimeout', reason]);
                // log it
                await postLogEvent(embed, guild, loggedEventTypes.Timeout);
                return;
            }
            // else, determine how long the timeout is for
            // eslint-disable-next-line @typescript-eslint/no-base-to-string
            const newTimeOut = new Date(changes[0].new.toString()).getTime();
            const currentTime = Date.now();

            // if the disabled timestamp is less than the current one, they were timed out in the past
            // do nothing
            if (newTimeOut < currentTime) {
                return;
            }

            // else determine how long they were timed out for
            /* timeout options are:
                60 sec = 60000 ms
                5 min = 300000 ms
                10 min = 600000 ms
                1 hour = 3600000 ms
                6 hour = 21600000 ms
                12 hour = 43200000 ms
                18 hour = 64800000 ms
                1 day = 86400000 ms
                1 week = 604800000 ms
            */
            const timeDiff = newTimeOut - currentTime;

            // output the length of the timeout based on the differential
            // because if statements are short circuited, we don't need to check the lower bound on each test
            // discord sometimes glitches out and returns a number larger than these cutoffs (rounding?), so add a buffer to each one
            let duration = '';
            const buffer = 1.2;
            if (timeDiff <= 60000 * 3) {
                // 1 minute
                duration = '1 minute';
            }
            else if (timeDiff <= 300000 * buffer) {
                // 5 min
                duration = '5 minutes';
            }
            else if (timeDiff <= 600000 * buffer) {
                // 10 min
                duration = '10 minutes';
            }
            else if (timeDiff <= 3600000 * buffer) {
                // 1 hour
                duration = '1 hour';
            }
            else if (timeDiff <= 21600000 * buffer) {
                // 6 hour
                duration = '6 hours';
            }
            else if (timeDiff <= 43200000 * buffer) {
                // 12 hours
                duration = '12 hours';
            }
            else if (timeDiff <= 64800000 * buffer) {
                // 18 hours
                duration = '18 hours';
            }
            else if (timeDiff <= 86400000 * buffer) {
                // 1 day
                duration = '1 day';
            }
            else {
                // 1 week
                duration = '1 week';
            }


            // set the inputs needed to build the embed
            const title = 'User Timed Out';
            const description = `${target.tag} was timed out by ${executor.tag}.`;
            const color = 0xFFDB00;
            const fields: embedField[] = [
                { name: 'User', value: `<@${target.id}>`, inline: true },
                { name: 'Duration', value: `${duration}`, inline: true },
                { name: 'Performed by', value: `<@${executor.id}>` },
                { name: 'Reason', value: `${reason}` },
            ];

            // build the discord embed
            const embed = buildEmbed(title, { description: description, color: color, fields: fields });

            // save to modlog for the server
            await pool.query('INSERT INTO chatot.modlog (serverid, executor, target, action, reason) VALUES ($1, $2, $3, $4, $5)', [guild.id, executor.id, target.id, 'Timeout', reason]);

            // post the log to the logging channel
            await postLogEvent(embed, guild, loggedEventTypes.Timeout);

            // if this is smogcord, echo to the log-punishments chan
            await echoPunishment(guild, target, reason, `timeout for ${duration}`);

        }

        /**
         * Message deletes would be nice to add here but discord stacking similar entries only makes this fire for the first one and not the subsequents
         * It also doesn't give you access to the message content
         */
    },
};
