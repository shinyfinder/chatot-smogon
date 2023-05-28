import { AuditLogEvent, GuildMember, EmbedBuilder, User, ChannelType } from 'discord.js';
import { eventHandler } from '../types/event-base';
import { sleep } from '../helpers/sleep.js';
import { pool } from '../helpers/createPool.js';
import config from '../config.js';

/**
 * Add member handler
 *
 * Event handler for when a user joins a guild
 */

export const clientEvent: eventHandler = {
    // define the name of the trigger event
    name: 'guildMemberAdd',
    // execute the code for this event
    async execute(member: GuildMember) {
        // ignore DMs and events pertaining to the bot
        if (!member.guild || member.user.id === config.CLIENT_ID) {
            return;
        }
        // check if the user is pending (needs to accept the rule screening)
        // if they are, return
        // otherwise, give them the new user role
        // TODO: add in check for verified
        if (member.pending) {
            return;
        }

        // check if verification is used in the server
        const reqPG = await pool.query('SELECT roleid, age FROM chatot.verifyreqs WHERE serverid=$1', [member.guild.id]);
        const dbmatches: { roleid: string, age: number }[] | [] = reqPG.rows;
        
        // if the array isn't empty, this server uses verification
        if (dbmatches.length) {
            // get the unverified role
            const role = member.guild.roles.cache.get(dbmatches[0].roleid);
            if (role === undefined) {
                return;
            }

            // see if they meet the reqs
            // case 1: the server requires a link but doesn't care about account age
            if (dbmatches[0].age === 0) {
                // check if they've linked their profile
                const idPG = await pool.query('SELECT * FROM chatot.identities WHERE discordid=$1', [member.id]);
                // if there's a row, they've linked
                const hasLinked = idPG.rowCount;

                // if they haven't linked a forum profile, give them the verification role
                if (!hasLinked) {
                    await member.roles.add(role);
                }
            }
            // case 2: the server requires a linked forum profile and set a minimum age limit
            else if (dbmatches[0].age !== 0) {
                // get their account age from the forum table
                const acntAge = 9999;

                // compare against the server req
                // if their account isn't old enough, give them the role
                if (dbmatches[0].age < acntAge) {
                    await member.roles.add(role);
                }
            }
        }
    },
};
