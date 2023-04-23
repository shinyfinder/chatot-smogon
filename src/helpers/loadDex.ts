import { pool } from './createPool.js';

/**
 * Helper file to instantiate the connection to the postgres pool
 */
export interface IDexDB {
    alias: string,
    gen_id: string,
    isnonstandard: string,
}

export let dexdb: IDexDB[] | [];

export let dexNames: string[];
/**
 * Queries the info we need from the dex table
 */
export async function loadDex() {
    // poll the db
    // get the unique pokemon names
    // const dexPostgres = await pool.query('SELECT DISTINCT alias FROM dex.pokemon');
    
    // get the alias and gen for each mon, ordered by mon then by gen in ascending order (gen 1 -> gen current)
    // to do this we need to join the pokemon table with the gens table
    const dexPostgres = await pool.query('SELECT dex.pokemon.alias, dex.pokemon.gen_id, dex.pokemon.isNonstandard FROM dex.pokemon JOIN dex.gens ON dex.pokemon.gen_id = dex.gens.gen_id ORDER BY dex.pokemon.alias, dex.gens.order');
    // extract the array of info we care about
    dexdb = dexPostgres.rows;

    // map just the names so we can use them for autocomplete
    dexNames = dexdb.map(row => row.alias);
    // get the unique values
    dexNames = [...new Set(dexNames)];

    return;
    
}