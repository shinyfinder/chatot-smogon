import { Client } from 'discord.js';
import { pool } from './createPool.js';

export async function resetVerificationRoles(uid: string, client: Client) {
    // poll the db
    const verifyServersPG = await pool.query('SELECT serverid, roleid, method FROM chatot.verifyreqs');
    const verifyServers: { serverid: string, roleid: string, method: string }[] | [] = verifyServersPG.rows;

    for (const ids of verifyServers) {
        try {
            // fetch the guild so we can get their member object
            const guild = await client.guilds.fetch(ids.serverid);
            // get their member object
            // if this fails, (probably) they aren't in the guild anymore
            // it'll throw, which is fine since there's nothing we'd have to do with roles anyway
            const member = await guild.members.fetch(uid);

            // undo their verification
            // if the server adds a role when verified, remove it
            if (ids.method === 'add') {
                await member.roles.remove(ids.roleid);
            }
            // similarly, if a server removes a role when verified, add it back
            else if (ids.method === 'remove') {
                await member.roles.add(ids.roleid);
            }

        }
        catch (e) {
            continue;
        }
        
    }
}
