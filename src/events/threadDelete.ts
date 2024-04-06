import { ThreadChannel } from 'discord.js';
import { eventHandler } from '../types/event-base';
import { pool } from '../helpers/createPool.js';
import { botConfig } from '../config.js';
import { errorHandler } from '../helpers/errorHandler.js';

/**
 * Channel deletion handler
 *
 * Used to delete the information from the database if this channel is used for something.
 */

export const clientEvent: eventHandler = {
    // define the name of the trigger event
    name: 'threadDelete',
    // execute the code for this event
    async execute(thread: ThreadChannel) {
        // transaction the deletions
        const pgClient = await pool.connect();
        try {
            // start
            await pgClient.query('BEGIN');
            // delete
            await pgClient.query('DELETE FROM chatot.cooldown WHERE channelid=$1', [thread.id]);
            // raters are only in the main discord
            if (thread.guildId === botConfig.GUILD_ID) {
                await pgClient.query('DELETE FROM chatot.rmtchans WHERE channelid=$1', [thread.id]);
            }
            await pgClient.query('DELETE FROM chatot.logchan WHERE channelid=$1', [thread.id]);
            await pgClient.query('DELETE FROM chatot.keepalives WHERE id=$1', [thread.id]);
            await pgClient.query('DELETE FROM chatot.reactroles WHERE channelid=$1', [thread.id]);
            await pgClient.query('DELETE FROM chatot.logprefs WHERE ignoreid=$1', [thread.id]);
            await pgClient.query('DELETE FROM chatot.ccprefs WHERE channelid=$1', [thread.id]);
            await pgClient.query('DELETE FROM chatot.reminders WHERE channelid=$1', [thread.id]);
            await pgClient.query('DELETE FROM chatot.stickies WHERE channelid=$1', [thread.id]);
            await pgClient.query('DELETE FROM chatot.tickets WHERE threadchanid=$1 OR logchanid=$1', [thread.id]);
            await pgClient.query('DELETE FROM chatot.fun_permitted_channels WHERE channelid=$1', [thread.id]);
            await pgClient.query('DELETE FROM chatot.crossping_subs WHERE channelid=$1', [thread.id]);
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
