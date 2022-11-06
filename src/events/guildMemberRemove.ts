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
    name: 'guildMemberRemove',
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
                type: AuditLogEvent.MemberKick,
            });

            // Since there's only 1 audit log entry in this collection, grab the first one
            const kickLog = fetchedLogs.entries.first();

            // If there's nothing in the audit log, output what we can
            if (!kickLog) {
                await buildEmbed('Self', null);
                return;
            }

            // Now grab the user object of the person who kicked the member
            // Also grab the target of this action to double-check things
            const { executor, target, reason } = kickLog;

            // make sure executor and target isn't null to make TS happy. It shouldn't be
            if (!executor || !target) {
                await buildEmbed('Inconclusive. No audit log entry at this time.', null);
                return;
            }

            // Update the output with a bit more information
            // Also run a check to make sure that the log returned was for the same kicked member
            if (target.id === member.id) {
                await buildEmbed(executor, reason);
            }
            else {
                await buildEmbed('Inconclusive. No audit log entry at this time.', null);
                return;
            }

        }

        catch (error) {
             // if there's an error, log it
             console.error(error);
             return;
        }

        async function buildEmbed(executor: User | string, reason: string | null) {
            // if the executor is a User type, that means we found an audit log entry
            // we only care about their id, so grab that.
            // Otherwise output the string we passed
            let executorOut = '';
            if (executor instanceof User) {
                executorOut = `<@${executor.id}>`;
            }
            else {
                executorOut = executor;
            }

            // typecheck reason
            if (reason === null) {
                reason = 'N/A';
            }
            // build the embed for output
            const embed = new EmbedBuilder()
                .setColor(0x0099FF)
                .setTitle('User Left')
                .addFields(
                    { name: 'User', value: `<@${member.id}>` },
                    { name: 'Removed by', value: `${executorOut}` },
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
