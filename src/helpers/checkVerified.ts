import { pool, sqlPool } from './createPool.js';
import { GuildMember } from 'discord.js';

export async function checkVerified(member: GuildMember) {
    // check if verification is used in the server
    const reqPG = await pool.query('SELECT roleid, age FROM chatot.verifyreqs WHERE serverid=$1', [member.guild.id]);
    const reqMatches: { roleid: string, age: number }[] | [] = reqPG.rows;
    
    // if the array isn't empty, this server uses verification
    if (reqMatches.length) {
        // get the unverified role
        const role = member.guild.roles.cache.get(reqMatches[0].roleid);
        if (role === undefined) {
            return;
        }

        // see if they linked their profile
        const idPG = await pool.query('SELECT discordid, forumid FROM chatot.identities WHERE discordid=$1', [member.id]);
        const idmatches: { discordid: string, forumid: number }[] | [] = idPG.rows;

        // if they haven't linked a forum profile, give them the verification role
        if (!idmatches.length) {
            await member.roles.add(role);
            return;
        }

        // see if they meet the reqs
        // case 1: the server requires a link but doesn't care about account age
        if (reqMatches[0].age === 0) {
            // if here, they linked their profile and we don't care about its age, so nothing to do
            return;
        }
        // case 2: the server requires a linked forum profile and set a minimum account age
        else if (reqMatches[0].age !== 0) {
            // get their account age from the forum table
            // there should only be at most 1 value
            const [sqlMatch] = await sqlPool.execute('SELECT register_date FROM xenforo.xf_user WHERE user_id = ?', [idmatches[0].forumid]);

            // cast the result as a meaningful array
            const joinDate = sqlMatch as { register_date: number }[] | [];

            // compute the number of days since registered
            const daysRegistered = Math.floor(((Date.now() / 1000) - joinDate[0].register_date) / 86400);

            // compare against the server req
            // if their account isn't old enough, give them the role
            if (daysRegistered < reqMatches[0].age) {
                await member.roles.add(role);
            }
        }
    }
}