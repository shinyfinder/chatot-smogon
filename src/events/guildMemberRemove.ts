import { GuildMember } from 'discord.js';
import { eventHandler } from '../types/event-base';
import config from '../config.js';
import { pool } from '../helpers/createPool.js';
import { errorHandler } from '../helpers/errorHandler.js';
/**
 * Add member handler
 *
 * Event handler for when a user leaves a guild
 */

export const clientEvent: eventHandler = {
    // define the name of the trigger event
    name: 'guildMemberRemove',
    // execute the code for this event
    async execute(member: GuildMember) {
        // ignore DMs
        if (!member.guild) {
            return;
        }
        
        // delete any preferences they saved and their position as a team rater from the main cord
         // transaction the deletions
         const pgClient = await pool.connect();
         try {
            // start
            await pgClient.query('BEGIN');
            // delete
            // raters are only in the main discord
            if (member.guild.id === config.GUILD_ID) {
                await pgClient.query('DELETE FROM chatot.raters WHERE userid=$1', [member.id]);
            }
            
            // if this server is a fc server, remove their friend codes because it is no longer needed
            // first get the fc command definition
            const fcDef = member.client.commands.filter(cdef => cdef.data.name === 'fc');
            // ... and the list of giulds the fc command is in
            const fcGuilds = fcDef.map(fcdef => fcdef.guilds).flat();

            if (fcGuilds.length) {
                // remove the server they left from in the list
                const leftIndex = fcGuilds.indexOf(member.guild.id);
                if (leftIndex > -1) {
                    fcGuilds.splice(leftIndex, 1);
                }

                let isStillMember = false;
                
                for (const guild of fcGuilds) {
                    // fetch their member object in the other guild
                    const memberList = await member.client.guilds.cache.get(guild)?.members.fetch(member.id);
                    // if it resolves, they're still in a FC guild
                    if (memberList) {
                        isStillMember = true;
                    }
                }

                // if they aren't a member of a FC guild anymore, remove their fc from the db
                if (!isStillMember) {
                    await pgClient.query('DELETE FROM chatot.fc WHERE userid=$1', [member.id]);
                }
            }

            // get the channel list of the server they left from so we can see if they have a pending reminder
            const guildObj = await member.client.guilds.fetch(member.guild.id);
            const guildChans = guildObj.channels.cache.map(chan => chan.id);

            await pgClient.query('DELETE FROM chatot.reminders WHERE userid=$1 AND channelid=ANY($2)', [member.id, guildChans]);

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
