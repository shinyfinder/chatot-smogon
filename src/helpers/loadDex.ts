import { pool } from './createPool.js';

/**
 * Helper file to instantiate the connection to the postgres pool
 */
interface dexdb {
    alias: string,
}

export let dexNames: string[];

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
export async function loadDexNames() {
    // poll the db
    const dexPostgres = await pool.query('SELECT alias FROM dex.pokemon');
    const dbmatches: dexdb[] | [] = dexPostgres.rows;

    // save a cache of the pokemon names so we can autocomplete it
    dexNames = dbmatches.map(row => row.alias);

    return dexNames;
    
}