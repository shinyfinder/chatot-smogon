import { Role } from 'discord.js';
import { eventHandler } from '../types/event-base';
import { pool } from '../helpers/createPool.js';
import { errorHandler } from '../helpers/errorHandler.js';

/**
 * Channel deletion handler
 *
 * Used to delete the information from the database if this channel is used for something.
 */

export const clientEvent: eventHandler = {
    // define the name of the trigger event
    name: 'roleDelete',
    // execute the code for this event
    async execute(role: Role) {
        // transaction the deletions
        const pgClient = await pool.connect();
        try {
            // start
            await pgClient.query('BEGIN');
            // delete
            await pgClient.query('DELETE FROM chatot.reactroles WHERE roleid=$1', [role.id]);
            await pgClient.query('DELETE FROM chatot.verifyreqs WHERE roleid=$1', [role.id]);
            await pgClient.query('DELETE FROM chatot.fun_permitted_roles WHERE roleid=$1', [role.id]);
            await pgClient.query('DELETE FROM chatot.fun_exemptions WHERE roleid=$1', [role.id]);
            // tickets are a bit trickier, because if we delete the staff role we don't want to lose total functionality of the button
            // so first we delete the staff role, and if we do we try to insert a row with a staff id of '-' in its place
            // if this already exists (because they somehow did this twice), then just deleting the row is sufficient
            // ...would this actually ever happen? Idk, but the code handles it
            await pgClient.query('DELETE FROM chatot.ccprefs WHERE role=$1', [role.id]);
            const oldRowsPG = await pgClient.query('DELETE FROM chatot.tickets WHERE staffid=$1 RETURNING serverid, messageid, threadchanid, logchanid', [role.id]);
            const oldRows: { serverid: string, messageid: string, threadchanid: string, logchanid: string}[] | [] = oldRowsPG.rows;

            if (oldRows.length) {
                // (serverid, staffid) is the PK so there should only be 1 row max
                // therefore it's safe to just take the first row
                await pgClient.query(
                    'INSERT INTO chatot.tickets (serverid, messageid, threadchanid, staffid, logchanid) VALUES ($1, $2, $3, \'-\', $4) ON CONFLICT DO NOTHING',
                    [oldRows[0].serverid, oldRows[0].messageid, oldRows[0].threadchanid, oldRows[0].logchanid]);
            }
            // end
            await pgClient.query('COMMIT');
        }
        catch (e) {
            await pgClient.query('ROLLBACK');
            errorHandler(e);
        }
        finally {
            pgClient.release();
        }
    },
};
