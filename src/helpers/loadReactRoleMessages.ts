import { Client } from 'discord.js';
import { pool } from './createPool.js';

/**
 * Helper file to instantiate the connection to the postgres pool
 */
interface rrdb {
    serverid: string,
    channelid: string,
    messageid: string,
}

export let rrMessages: string[];

/**
 * Caches the messages users react to in order to receive their roles.
 * Because the bot may have restarted since the messages were initialized, we need to recache them.
 * If partials are not used, the bot does not listen for reactions on uncached messages.
 * 
 * Once the messages are cached, this returns an array containing the message IDs so we can quickly filter
 * out reactions on messages we don't care about without having to poll the db.
 * @param client Bot client
 * @returns Array containing react role message ids
 */
export async function loadRRMessages(client: Client) {
    // poll the db
    // /reactrole init creates a unique entry for each server, indicated with a roleid = bot / user. 
    // so we can get the unique combinations by getting all of the rows with those roleids
    const rrPostgres = await pool.query('SELECT serverid, channelid, messageid FROM chatot.reactroles WHERE roleid=$1 OR roleid=$2', ['bot', 'user']);
    const dbmatches: rrdb[] | [] = rrPostgres.rows;

    // loop over the combinations to fetch the message and cache it
    for (const msg of dbmatches) {
        // get the server
        const server = client.guilds.cache.get(msg.serverid);

        if (server === undefined) {
            continue;
        }

        // fetch the channel
        // I'm pretty sure this draws from the cache if it exists there
        const chan = await server.channels.fetch(msg.channelid);

        if (chan === null || !chan.isTextBased()) {
            continue;
        }

        // fetch the message so it is cached
        await chan.messages.fetch(msg.messageid);
    }

    // save a cache of the message IDs so we can compare new reactions against it without having to poll the db
    rrMessages = dbmatches.map(row => row.messageid);

    return rrMessages;
    
}

/**
 * Appends an ID to the react role message cache.
 * The /reactrole init function automatically caches the relevant message,
 * so we just need to update the local id cache
 * @param newRRMessage Message ID of the message users react to in order to receive a role
 * @returns Array containing all of the react role message IDs
 */
export function addRRMessage(newRRMessage: string) {
    return rrMessages.push(newRRMessage);
}

/**
 * Removes a message ID from the cache so that we don't continue to monitor it for reactions.
 * @param oldRRMessage Message id of the message users react to in order to receive a role
 * @returns Array containing all of the react role message IDs
 */
export function removeRRMessage(oldRRMessage: string) {
    // search for the row which has the same name, prefix, and serverid
    const index = rrMessages.findIndex(msg => msg === oldRRMessage);
    return rrMessages.splice(index, 1);
}