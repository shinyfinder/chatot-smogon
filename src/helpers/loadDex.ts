import { IPSDex, IPSMoves, IPSItems } from '../types/ps';
import { alcremieFormes, genderDiffs } from './constants.js';
import { pool } from './createPool.js';
import fetch from 'node-fetch';
import { res2JSON } from './res2JSON.js';
import { IDexNameDump, IPokedexDB } from '../types/dex';
import { overwriteTier } from './overwriteTier.js';


export let dexMondb: IPokedexDB[] | [];
export const monNames: { name: string, value: string }[] = [];
export let spriteNames: { name: string, value: string}[];
export let moveNames: {name: string, value: string}[];
export let pokedex: IPSDex = {};
export let items: IPSItems = {};
export const allNames: { name: string, value: string}[] = [];
export let fullDexNameQuery: IDexNameDump;
export let moves: IPSMoves = {};
export let formats: { name: string, value: string }[];

/**
 * Queries the info we need from the dex tables
 */


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

export async function loadAllDexNames() {
    // poll the db
    const dexNameDump = await pool.query(`
        WITH pokemon AS
        (SELECT dex.pokemon.name, dex.pokemon.alias, dex.pokemon.gen_id, dex.pokemon.isNonstandard FROM dex.pokemon JOIN dex.gens ON dex.pokemon.gen_id = dex.gens.gen_id ORDER BY dex.pokemon.alias, dex.gens.order),

        items AS
        (SELECT dex.items.name, dex.items.alias FROM dex.items),

        abilities AS
        (SELECT dex.abilities.name, dex.abilities.alias FROM dex.abilities),

        moves AS
        (SELECT dex.moves.name, dex.moves.alias FROM dex.moves),

        natures AS
        (SELECT dex.natures.name, dex.natures.alias FROM dex.natures),

        types AS
        (SELECT dex.types.name, dex.types.alias, dex.types.description FROM dex.types)

        SELECT json_build_object(
            'pokemon', (SELECT COALESCE(JSON_AGG(pokemon.*), '[]') FROM pokemon),
            'items', (SELECT COALESCE(JSON_AGG(items.*), '[]') FROM items),
            'abilities', (SELECT COALESCE(JSON_AGG(abilities.*), '[]') FROM abilities),
            'moves', (SELECT COALESCE(JSON_AGG(moves.*), '[]') FROM moves),
            'natures', (SELECT COALESCE(JSON_AGG(natures.*), '[]') FROM natures),
            'types', (SELECT COALESCE(JSON_AGG(types.*), '[]') FROM types)
        ) AS data`);
    
    // unpack and update cache
    fullDexNameQuery = dexNameDump.rows.map((row: { data: IDexNameDump }) => row.data)[0];

    dexMondb = fullDexNameQuery.pokemon;

    // map the unique name alias pairs so we can use them for autocomplete
    // loop over the entire array of objects from the query
    fullDexNameQuery.pokemon.forEach(obj => {
        // try to find an obj in the unique array where the name and alias are the same as the row in the query
        const i = monNames.findIndex(uniqObj => uniqObj.name === obj.name && uniqObj.value === obj.alias);
        // if no matches are found, add the entry to the unique array
        if (i === -1) {
            monNames.push({ name: obj.name, value: obj.alias });
        }
    });

    // similarly, create a name/alias map for everything so we can autocompletee /dt
    for (const table in fullDexNameQuery) {
        const tableData = fullDexNameQuery[table as keyof IDexNameDump];
        tableData.forEach(obj => {
            const i = allNames.findIndex(uniqObj => uniqObj.name === obj.name && uniqObj.value === obj.alias);
            if (i === -1) {
                allNames.push({ name: obj.name, value: obj.alias });
            }
        });
    }
}

/**
 * Loads the moves json from PS
 */
export async function loadMoves() {
    // fetch the json from the PS API
    const res = await fetch('https://play.pokemonshowdown.com/data/moves.json');
    moves = await res.json() as IPSMoves;

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

/**
 * Loads items
 */
export async function loadItems() {
    // fetch the json from the PS API
    const res = await fetch('https://raw.githubusercontent.com/smogon/pokemon-showdown/master/data/items.ts');
    const itemsRes = await res.text();

    // convert to JSON
    items = res2JSON(itemsRes) as IPSItems;
}

/**
 * Loads the list of perma format names from PS
 */
export async function loadFormats() {
    // fetch the json from the PS API
    const res = await fetch('https://raw.githubusercontent.com/smogon/pokemon-showdown/master/config/formats.ts');
    const formatsRes = await res.text();

    // extract all of the names
    const matchArr = formatsRes.match(/(?<=^\s*name:\s*["']).*(?=['"],$)/gm);

    if (!matchArr) {
        throw 'Unable to load formats from PS!';
    }

    // combine stuff like vgc and bss into 1 category per gen
    const storedTiers: string[] = [];
    for (const tier of matchArr) {
        const fixedTier = overwriteTier(tier);
        storedTiers.push(fixedTier);

    }

    // remove any repeats from the match array
    const uniqMatchArr = [...new Set(storedTiers)];

    formats = uniqMatchArr.map(format => ({ name: format, value: format.replace(/[^a-z0-9]/gi, '').toLowerCase() }));
}