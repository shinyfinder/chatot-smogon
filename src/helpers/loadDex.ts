import { IPSDex, IPSMoves } from '../types/ps';
import { alcremieFormes, genderDiffs } from './constants.js';
import { pool } from './createPool.js';
import fetch from 'node-fetch';
/**
 * Helper file to populate the dex db information
 */
export interface IDexDB {
    name: string,
    alias: string,
    gen_id: string,
    isnonstandard: string,
}

export let dexdb: IDexDB[] | [];

export let dexNames: { name: string, value: string }[];

export let spriteNames: { name: string, value: string}[];

export let moveNames: {name: string, value: string}[];

export let pokedex: IPSDex;

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

/**
 * Extends the SmogDex names to include alt formes
 */
export async function loadSpriteDex() {
    // call the PS api to get the dex
    const res = await fetch('https://play.pokemonshowdown.com/data/pokedex.json');
    pokedex = await res.json() as IPSDex;

    // extract the names
    const psNames: string[] = [];
    for (const mon in pokedex) {
        const data = pokedex[mon];

        // skip alcremie because we're going to build it ourselves
        if (data.name.includes('Alcremie')) {
            continue;
        }

        // add cosmetic formes
        psNames.push(data.name);
        if (data.cosmeticFormes) {
            for (const forme of data.cosmeticFormes) {
                psNames.push(forme);
            }
        }
    }

    // extend Alcremie in particular
    for (const aforme of alcremieFormes) {
        const aTitleCase = aforme.split('-').map(f => f[0].toUpperCase() + f.slice(1)).join('-');
        psNames.push(aTitleCase);
    }
    
    // add in the female differences
    for (const female of genderDiffs) {
        const femaleTitleCase = female.split('-').map(f => f[0].toUpperCase() + f.slice(1)).join('-');
        // concat if not exist
        if (!psNames.some(n => n === femaleTitleCase)) {
            psNames.push(femaleTitleCase);
        }
    }

    // conert everything to lower case and remvove special chars so we can build the exported pair array
    // the format should match the dex
    spriteNames = psNames.map(n => ({ name: n, value: n.toLowerCase().replace(/[ _]+/g, '-').replace(/[^a-z0-9-]/g, '') }));
}

/**
 * Loads the moves json from PS
 */
export async function loadMoves() {
    // fetch the json from the PS API
    const res = await fetch('https://play.pokemonshowdown.com/data/moves.json');
    const moves = await res.json() as IPSMoves;

    // extract the names from the moves
    // this results in an array of readable move names (i.e. Air Slash)
    const moveArr: string[] = [];
    for (const move in moves) {
        if (!moves[move].isZ) {
            moveArr.push(moves[move].name);
        }
    }

    // convert everything to lower case and remvove special chars so we can build the exported pair array
    moveNames = moveArr.map(m => ({ name: m, value: m.toLowerCase().replace(/[^a-z0-9]/g, '') }));
}