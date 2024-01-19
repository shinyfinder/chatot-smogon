import { Guild } from 'discord.js';
import { eventHandler } from '../types/event-base';
import { pool } from '../helpers/createPool.js';
import config from '../config.js';
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
        // determine the list of channel ids within the guild
        // these will be cached by the client if we ever had access to them
        // so we can just look in the cache since we are no longer in the guild
        const chanIDs = guild.channels.cache.map(chan => chan.id);

        // transaction the deletions
        const pgClient = await pool.connect();
        try {
            // start
            await pgClient.query('BEGIN');
            // delete
            await pgClient.query('DELETE FROM chatot.cooldown WHERE channelid=ANY($1)', [chanIDs]);
            // raters are only in the main discord
            if (guild.id === config.GUILD_ID) {
                await pgClient.query('DELETE FROM chatot.raters WHERE channelid=ANY($1)', [chanIDs]);
            }
            await pgClient.query('DELETE FROM chatot.customs WHERE serverid=$1', [guild.id]);
            await pgClient.query('DELETE FROM chatot.logchan WHERE guildid=$1', [guild.id]);
            await pgClient.query('DELETE FROM chatot.modlog WHERE serverid=$1', [guild.id]);
            await pgClient.query('DELETE FROM chatot.keepalives WHERE id=ANY($1)', [chanIDs]);
            await pgClient.query('DELETE FROM chatot.reactroles WHERE serverid=$1', [guild.id]);
            await pgClient.query('DELETE FROM chatot.dexdefaults WHERE serverid=$1', [guild.id]);
            await pgClient.query('DELETE FROM chatot.verifyreqs WHERE serverid=$1', [guild.id]);
            await pgClient.query('DELETE FROM chatot.logprefs WHERE serverid=$1', [guild.id]);
            await pgClient.query('DELETE FROM chatot.ccprefs WHERE serverid=$1', [guild.id]);
            await pgClient.query('DELETE FROM chatot.reminders WHERE channelid=ANY($1)', [chanIDs]);
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
