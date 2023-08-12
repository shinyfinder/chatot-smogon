import { Message, Collection, GuildTextBasedChannel } from 'discord.js';
import { eventHandler } from '../types/event-base.js';

/**
 * messageDeleteBulk handler
 *
 * Event handler for when messages are deleted in bulk.
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
    name: 'messageDeleteBulk',
    // execute the code for this event
    async execute(messages: Collection<string, Message>, channel: GuildTextBasedChannel) {
        await channel.send(`Deleted ${messages.size} messages`);
    },
};
