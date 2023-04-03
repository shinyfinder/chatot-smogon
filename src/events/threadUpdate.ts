import { ThreadChannel } from 'discord.js';
import { eventHandler } from '../types/event-base';
import { pool } from '../helpers/createPool.js';

/**
 * threadUpdate handler
 *
 * Emits when a thread is updated
 * e.g. name change, archive state change, locked state change.
 *
 */

export const clientEvent: eventHandler = {
    // trigger event name
    name: 'threadUpdate',
    // execute
    async execute(oldThread: ThreadChannel, newThread: ThreadChannel) {
        // check to see if this is an archive event
        if (!oldThread.archived && newThread.archived) {
            // poll the db to get the list of threads to be kept alive
            const KAPostgres = await pool.query('SELECT id FROM chatot.keepalives WHERE id = $1', [newThread.id]);
            const chan: { id: string}[] | [] = KAPostgres.rows;

            // if this channel is there, unarchive it
            if (chan.length) {
                await newThread.setArchived(false);
            }
            
        }
    },
};