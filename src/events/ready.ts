import { Client } from 'discord.js';
import { eventHandler } from '../types/event-base';
import { Modes, botConfig } from '../config.js';
/**
 * on Ready handler
 *
 * When the app has initialized, this code is run.
 * It is run once to log that the bot is up and running.
 *
 */

export const clientEvent: eventHandler = {
    // trigger event name
    name: 'ready',
    // tell the code to run this only once on trigger
    once: true,
    // execute
    execute(client: Client) {
        // console.log('Logging in...');
        // if there wasn an issue logging in. let the user know
        if (!client.user || !client.application) {
            throw new Error('There was an issue logging in');
        }
        // success!
        if (botConfig.MODE === Modes.Dev) {
            console.log(`<6>Ready! Logged in as ${client.user.tag}`);
        }
        
        return;
    },
};