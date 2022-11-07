import { AuditLogEvent, GuildMember, EmbedBuilder, User, ChannelType } from 'discord.js';
import config from '../config';

/**
 * Kick handler
 *
 * Event handler for when a user is kicked.
 * Kick events are logged with the user, the mod, and the reason to the specified channel in the config file.
 * Content information is supplied by the audit log.
 *
 * Note that there is no guarantee when the audit log is populated, nor an event when it is.
 * If the person who deleted the message is a bot or the author, no audit log event is created.
 */

export = {
    // define the name of the trigger event
    name: 'guildMemberUpdate',
    // execute the code for this event
    async execute(member: GuildMember) {
        // ignore DMs
        if (!member.guild) {
            return;
        }

        // wrap the execution in a try/catch so that errors are handled and won't cause the bot to crash
        try {
            // since we're only kicking 1 user at a time, fetch the latest event from the audit log of type kick
            const fetchedLogs = await member.guild.fetchAuditLogs({
                limit: 1,
                type: AuditLogEvent.MemberUpdate,
            });

            // Since there's only 1 audit log entry in this collection, grab the first one
            const updateLog = fetchedLogs.entries.first();

            // If there's nothing in the audit log, return
            if (!updateLog) {
                // await buildEmbed('Self', null);
                return;
            }

            // Now grab the user object of the person who updated the member
            // Also grab the target of this action to double-check things
            const { executor, target, reason, changes } = updateLog;

            // make sure executor and target isn't null to make TS happy. It shouldn't be
            if (!executor || !target) {
                await buildEmbed('Inconclusive. No audit log entry at this time.', null, 'N/A');
                return;
            }

            // if the executor is the same as the person who was updated, they modified it on their own, so don't log it.
            if (target.id === executor.id) {
                return;
            }

            // Also run a check to make sure that the log returned was for the same kicked member
            if (target.id !== member.id) {
                return;
            }

            // we only want to log timeouts, so check if the changes are the communication_disabled_until
            if (changes[0].key !== 'communication_disabled_until') {
                return;
            }

            // get the current timestamp and the timestamp of the timeout
            // if the new time is undefined, the timeout is being removed
            if (changes[0].new === undefined) {
                await buildEmbed(executor, reason, 'Removed');
                return;
            }

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
                1 day = 86400000 ms
                1 week = 604800000 ms
            */
           const timeDiff = newTimeOut - currentTime;

           // output the length of the timeout based on the differential
           // because if statements are short circuited, we don't need to check the lower bound on each test
           let duration = '';
           if (timeDiff <= 60000) {
                // 1 minute
                duration = '1 minute';
            }
            else if (timeDiff <= 300000) {
                // 5 min
                duration = '5 minutes';
            }
            else if (timeDiff <= 600000) {
                // 10 min
                duration = '10 minutes';
            }
            else if (timeDiff <= 3600000) {
                // 1 hour
                duration = '1 hour';
            }
            else if (timeDiff <= 86400000) {
                // 1 day
                duration = '1 day';
            }
            else {
                // 1 week
                duration = '1 week';
            }

            // log the timeout
            await buildEmbed(executor, reason, duration);

        }

        catch (error) {
             // if there's an error, log it
             console.error(error);
             return;
        }

        /**
         * Builds the discord embed logging the mod action
         * @param executor Person who initiated the mod action
         * @param reason Provided reason for the mod action
         * @param duration How long the timeout lasts for
         * @returns void. Posts embed to log channel
         */
        async function buildEmbed(executor: User | string, reason: string | null, duration: string) {
            // if the executor is a User type, that means we found an audit log entry
            // we only care about their id, so grab that.
            // Otherwise output the string we passed
            let executorOut = '';
            let executorName = '';
            if (executor instanceof User) {
                executorOut = `<@${executor.id}>`;
                executorName = executor.tag;
            }
            else {
                executorOut = executor;
                executorName = 'Unknown';
            }

            // typecheck reason
            if (reason === null) {
                reason = 'N/A';
            }

            // build the title and description based on whether the timeout was removed or not
            let titleOut = '';
            let descOut = '';
            if (duration === 'Removed') {
                titleOut = 'Timeout Removed';
                descOut = `${member.user.tag}'s timeout was removed by ${executorName}.`;
            }
            else {
                titleOut = 'User Timed Out';
                descOut = `${member.user.tag} was timed out by ${executorName}.`;
            }
            // build the embed for output
            const embed = new EmbedBuilder()
                .setColor(0x0099FF)
                .setTitle(`${titleOut}`)
                .setDescription(`${descOut}`)
                .addFields(
                    { name: 'User', value: `<@${member.id}>`, inline: true },
                    { name: 'Duration', value: `${duration}`, inline: true },
                    { name: 'Performed by', value: `${executorOut}` },
                    { name: 'Reason', value: `${reason}` },
                );

            // log to the logging channel specified in the config file
            const channel = member.client.channels.cache.get(config.LOG_CHANNEL_ID);
            if (channel?.type !== ChannelType.GuildText) {
                return;
            }
            await channel.send({ embeds: [embed] });
        }

    },
};
