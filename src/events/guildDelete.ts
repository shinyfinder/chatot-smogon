import { Guild } from 'discord.js';
import { eventHandler } from '../types/event-base';
import { pool } from '../helpers/createPool.js';
import { errorHandler } from '../helpers/errorHandler.js';

/**
 * Guild deletion/left handler
 *
 * Used to delete the information from the database if this guild is used for something.
 * This event is triggered when the bot leaves a guild
 */

export const clientEvent: eventHandler = {
    // define the name of the trigger event
    name: 'guildDelete',
    // execute the code for this event
    async execute(guild: Guild) {
        // get the list of channel IDs the bot has access to
        // upon removal of a guild, the guild info is uncached
        const chanIDs = guild.client.channels.cache.map(chan => chan.id);

        // transaction the deletions
        const pgClient = await pool.connect();
        try {
            // start
            await pgClient.query('BEGIN');
            // delete
            await pgClient.query('DELETE FROM chatot.cooldown WHERE NOT channelid=ANY($1)', [chanIDs]);
            // raters are only in the main discord
            // we hardcode this because we don't want to accidentally do it
            if (guild.id === '192713314399289344') {
                await pgClient.query('TRUNCATE TABLE chatot.raters');
            }
            await pgClient.query('DELETE FROM chatot.customs WHERE serverid=$1', [guild.id]);
            await pgClient.query('DELETE FROM chatot.logchan WHERE serverid=$1', [guild.id]);
            await pgClient.query('DELETE FROM chatot.modlog WHERE serverid=$1', [guild.id]);
            await pgClient.query('DELETE FROM chatot.keepalives WHERE NOT id=ANY($1)', [chanIDs]);
            await pgClient.query('DELETE FROM chatot.reactroles WHERE serverid=$1', [guild.id]);
            await pgClient.query('DELETE FROM chatot.dexdefaults WHERE serverid=$1', [guild.id]);
            await pgClient.query('DELETE FROM chatot.verifyreqs WHERE serverid=$1', [guild.id]);
            await pgClient.query('DELETE FROM chatot.logprefs WHERE serverid=$1', [guild.id]);
            await pgClient.query('DELETE FROM chatot.ccprefs WHERE serverid=$1', [guild.id]);
            await pgClient.query('DELETE FROM chatot.reminders WHERE NOT channelid=ANY($1)', [chanIDs]);
            await pgClient.query('DELETE FROM chatot.stickies WHERE serverid=$1', [guild.id]);
            await pgClient.query('DELETE FROM chatot.tickets WHERE serverid=$1', [guild.id]);
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
