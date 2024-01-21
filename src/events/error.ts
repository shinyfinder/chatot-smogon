import { errorHandler } from '../helpers/errorHandler.js';
import { eventHandler } from '../types/event-base';
/**
 * on Error handler
 *
 */

export const clientEvent: eventHandler = {
    // trigger event name
    name: 'error',
    // execute
    execute(err: unknown) {
        errorHandler(err);
        return;
    },
};