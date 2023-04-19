import { pool } from './createPool.js';

/**
 * Helper file to instantiate the connection to the postgres pool
 */
interface dexdb {
    alias: string,
}

export let dexNames: string[];

/**
 * Loads the names of Pokemon from the dex db
 */
export async function loadDexNames() {
    // poll the db
    const dexPostgres = await pool.query('SELECT alias FROM dex.pokemon');
    const dbmatches: dexdb[] | [] = dexPostgres.rows;

    // save a cache of the pokemon names so we can autocomplete it
    dexNames = dbmatches.map(row => row.alias);

    return dexNames;
    
}