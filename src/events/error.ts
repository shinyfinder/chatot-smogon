import { errorHandler } from '../helpers/errorHandler.js';
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
    name: 'error',
    // execute
    execute(err: unknown) {
        errorHandler(err);
        return Promise.resolve();
    },
};