import { Client } from 'discord.js';
import { eventHandler } from '../types/event-base';
/**
 * on Ready handler
 *
 * When the app has initialized, this code is run.
 * It is run once to log that the bot is up and running.
 *
 * Because our template requires a promise, return a dummy promise resolution
 */

export const clientEvent: eventHandler = {
    // trigger event name
    name: 'ready',
    // tell the code to run this only once on trigger
    once: true,
    // execute
    execute(client: Client) {
        console.log('Logging in...');
        // if there wasn an issue logging in. let the user know
        if (!client.user || !client.application) {
            console.error('There was an issue during start up');
            return Promise.resolve();
        }
        // success!
        console.log(`Ready! Logged in as ${client.user.tag}`);
        return Promise.resolve();
    },
};