import { Guild, EmbedBuilder } from 'discord.js';
import { eventHandler } from '../types/event-base';
import { pool } from '../helpers/createPool.js';
import { errorHandler } from '../helpers/errorHandler.js';
import { ServerClass } from '../helpers/constants.js';
import { botConfig, Modes } from '../config.js';
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
        // return the guild info that got deleted so we can make sure this wasn't an official guild
        let serverInfo: { serverid: string, class: ServerClass }[] | [] = [];
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
                await pgClient.query('TRUNCATE TABLE chatot.raterlists');
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
            await pgClient.query('DELETE FROM chatot.gbanignores WHERE serverid=$1', [guild.id]);
            await pgClient.query('DELETE FROM chatot.livetours WHERE NOT interactionchanid=ANY($1) OR NOT announcechanid=ANY($1)', [chanIDs]);
            await pgClient.query('DELETE FROM chatot.rmtchans WHERE NOT channelid=ANY($1)', [chanIDs]);
            await pgClient.query('DELETE FROM chatot.fun_settings WHERE serverid=$1', [guild.id]);
            serverInfo = (await pgClient.query('DELETE FROM chatot.servers WHERE serverid=$1 RETURNING serverid, class', [guild.id])).rows;
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

        if (serverInfo.length) {
            // if the guild was an official server, send an alert to the guild join channel
            if (serverInfo[0].class === ServerClass.Official) {
                // get the output channel and guild
                const logChanID = botConfig.MODE === Modes.Dev ? '1040378543626002445' : '1219382359929917490';

                const logChan = await guild.client.channels.fetch(logChanID);
                if (logChan && logChan.isTextBased()) {
                    // build the embed
                    const embed = new EmbedBuilder()
                    .setTitle('Official Guild Left')
                    .setDescription(`I just left an official guild! ${guild.name} (${guild.id})`)
                    .setColor(0xED4245);
                    
                    await logChan.send({ embeds: [embed] });
                }
            }
        }
    },
};

