import { pool } from './createPool.js';

/**
 * Helper file to instantiate the connection to the postgres pool
 */
export interface IDexDB {
    name: string,
    alias: string,
    gen_id: string,
    isnonstandard: string,
}

export let dexdb: IDexDB[] | [];

export let dexNames: { name: string, value: string }[];
/**
 * Queries the info we need from the dex table
 */
export async function loadDex() {
    // poll the db
    // get the unique pokemon names
    // const dexPostgres = await pool.query('SELECT DISTINCT alias FROM dex.pokemon');
    
    // get the alias and gen for each mon, ordered by mon then by gen in ascending order (gen 1 -> gen current)
    // to do this we need to join the pokemon table with the gens table
    const dexPostgres = await pool.query('SELECT dex.pokemon.name, dex.pokemon.alias, dex.pokemon.gen_id, dex.pokemon.isNonstandard FROM dex.pokemon JOIN dex.gens ON dex.pokemon.gen_id = dex.gens.gen_id ORDER BY dex.pokemon.alias, dex.gens.order');
    // extract the array of info we care about
    dexdb = dexPostgres.rows;

    // map the name alias pairs so we can use them for autocomplete
    // first, get the unique names/aliases
    const uniqDexNames: IDexDB[] = [];
    // loop over the entire array of objects from the query
    dexdb.filter(obj => {
        // try to find an obj in the unique array where the name and alias are the same as the row in the query
        const i = uniqDexNames.findIndex(uniqObj => uniqObj.name === obj.name && uniqObj.alias === obj.alias);
        // if no matches are found, add the entry to the unique array
        if (i === -1) {
            uniqDexNames.push(obj);
        }
    });
    // create a map of the names and aliases for discord autocomplete
    dexNames = uniqDexNames.map(n => ({ name: n.name, value: n.alias }));

    return;
    
}