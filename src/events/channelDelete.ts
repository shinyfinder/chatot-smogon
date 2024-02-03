import { DMChannel, GuildChannel } from 'discord.js';
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
    name: 'channelDelete',
    // execute the code for this event
    async execute(channel: GuildChannel | DMChannel) {
        // ignroe dms and voice because we never use those anyway
        if (channel.isDMBased() || channel.isVoiceBased()) {
            return;
        }
        
        // transaction the deletions
        const pgClient = await pool.connect();
        try {
            // start
            await pgClient.query('BEGIN');
            // delete
            await pgClient.query('DELETE FROM chatot.cooldown WHERE channelid=$1', [channel.id]);
            await pgClient.query('DELETE FROM chatot.logchan WHERE channelid=$1', [channel.id]);
            await pgClient.query('DELETE FROM chatot.reactroles WHERE channelid=$1', [channel.id]);
            await pgClient.query('DELETE FROM chatot.logprefs WHERE ignoreid=$1', [channel.id]);
            await pgClient.query('DELETE FROM chatot.ccprefs WHERE channelid=$1', [channel.id]);
            await pgClient.query('DELETE FROM chatot.reminders WHERE channelid=$1', [channel.id]);
            await pgClient.query('DELETE FROM chatot.stickies WHERE channelid=$1', [channel.id]);
            await pgClient.query('DELETE FROM chatot.tickets WHERE threadchanid=$1 OR logchanid=$1', [channel.id]);
            await pgClient.query('DELETE FROM chatot.livetours WHERE announcechanid=$1 OR interactionchanid=$1', [channel.id]);
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
