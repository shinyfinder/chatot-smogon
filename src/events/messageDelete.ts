import { AuditLogEvent, Message, EmbedBuilder, User, ChannelType } from 'discord.js';
import config from '../config';

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

export = {
    // define the name of the trigger event
    name: 'messageDelete',
    // execute the code for this event
    async execute(message: Message) {
        // ignore DMs
        if (!message.guild) {
            return;
        }

        // wrap the execution in a try/catch so that errors are handled and won't cause the bot to crash
        try {
            // since we're only deleteing 1 message at a time, fetch the latest event from the audit log of type message deleted
            const fetchedLogs = await message.guild.fetchAuditLogs({
                limit: 1,
                type: AuditLogEvent.MessageDelete,
            });

            // Since there's only 1 audit log entry in this collection, grab the first one
            const deletionLog = fetchedLogs.entries.first();

            // If there's nothing in the audit log, don't do anything.
            if (!deletionLog) {
                // await buildEmbed('Unknown. Possibly a bot or self.');
                return;
            }

            // Now grab the user object of the person who deleted the message
            // Also grab the target of this action to double-check things
            const { executor, target } = deletionLog;

            // make sure executor isn't null to make TS happy. It shouldn't be
            if (!executor) {
                await buildEmbed('Unknown. Possibly a bot or self.');
                return;
            }

            // if the target is a bot, don't log it
            if (target.bot === true) {
                return;
            }

            // Update the output with a bit more information
            // Also run a check to make sure that the log returned was for the same author's message
            if (target.id === message.author.id) {
                await buildEmbed(executor);
            }
            else {
                // await buildEmbed('Unknown. Possibly a bot or self.');
                // we don't know what it is, so do nothing
                return;
            }

        }

        catch (error) {
             // if there's an error, log it
             console.error(error);
             return;
        }

        /**
         * Builds a discord embed to log the mod action.
         * @param executor User who deleted the message
         * @returns void. Posts embed to log channel
         */
        async function buildEmbed(executor: User | string) {
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
            // build the embed for output
            const embed = new EmbedBuilder()
                .setColor(0x0099FF)
                .setTitle('Message Deleted')
                .setDescription(`${message.author.tag}'s message was deleted by ${executorName}.`)
                .addFields(
                    { name: 'Content', value: `${message.content}` || 'No text' },
                    // blank space
                    // { name: '\u200B', value: '\u200B' },
                    { name: 'Author', value: `<@${message.author.id}>`, inline: true },
                    { name: 'Channel', value: `<#${message.channelId}>`, inline: true },
                    { name: 'Deleted By', value: `${executorOut}` },
                    { name: 'Attachments', value: message.attachments.map((a) => a.url).join(' ') || 'No Attachments' },
                );

            // log to the logging channel specified in the config file
            const channel = message.client.channels.cache.get(config.LOG_CHANNEL_ID);
            if (channel?.type !== ChannelType.GuildText) {
                return;
            }
            await channel.send({ embeds: [embed] });
        }

    },
};
