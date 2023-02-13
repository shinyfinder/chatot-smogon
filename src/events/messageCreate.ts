import { Message } from 'discord.js';
import { eventHandler } from '../types/event-base';
import { rmtMonitor } from '../helpers/rmt-monitor.js';
import { rmtMonitor2 } from '../helpers/rmt-monitor-postgres.js';

/**
 * messageCreate handler
 *
 * On message, this checks whether the contents is something the bot needs to act on.
 *
 * This triggers on each message, so the once parameter is left out (alternatively could be set to false)
 */

export const clientEvent: eventHandler = {
    // define the name of the trigger event
    name: 'messageCreate',
    // execute the command
    async execute(msg: Message) {
        // if the message is a bot or in a DM, ignore it
        if (msg.author.bot || !msg.guild) {
            return;
        }
        // wrap the execution in a try/catch so that errors are handled and won't cause the bot to crash
        try {
            // try to execute
            await rmtMonitor2(msg);
        }
        catch (error) {
            // if there's an error, log it
            console.error(error);
        }
    },
};