import { IPSDex, IPSMoves, IPSItems } from '../types/ps';
import { alcremieFormes, genderDiffs } from './constants.js';
import { variablePool } from './createPool.js';
import { res2JSON } from './res2JSON.js';
import { IDtNameDump, IDexNameDump, IPokedexDB, IChatotAssetHash } from '../types/dex';
import { overwriteTier } from './overwriteTier.js';
import { INVPair } from '../types/discord';
import { toAlias, toPSAlias } from './autocomplete.js';

/** 
 * db dump of dex.pokemon
 */ 
export let dexMondb: IPokedexDB[] | [];
/**
 * mon names, using dex.pokemon syntax
 */
export const monNames: INVPair[] = [];
/**
 * mon names + Alcremie + gender diff formes, using dex.pokemon syntax
 */
export let spriteNames: INVPair[];
/**
 * move names, in PS alias syntax
 */
export let moveNames: INVPair[];
/**
 * PS API pokemon.json dump
 */
export let pokedex: IPSDex = {};
/**
 * PS items.json dump
 */
export let items: IPSItems = {};
/**
 * All names retrieved from the dex db dump, in dex syntax (used for /dt)
 */ 
export const allNames: INVPair[] = [];
/**
 * all data from dex db dump
 */
export let fullDexNameQuery: IDexNameDump;
/**
 * PS API moves.json dump
 */
export let moves: IPSMoves = {};
/**
 * formats from PS, using PS alias syntax
 */
export let psFormats: INVPair[];
/**
 * list of formats from dex.formats, with VGC/BS modified to be a single alias (for raters/C&C integration)
 */
export let modifiedDexFormats: INVPair[];
/**
 *  dex.format names, in dex syntax
 */ 
export let dexFormats: INVPair[];
/**
 * dex.gens names, in dex syntax
 */ 
export let dexGens: INVPair[];
/**
 * current gen alias, in dex syntax
 */
export let latestGen: string = '';
/**
 * map between the dex gen alias and the gen number
 */
export let dexGenNumAbbrMap: { abbr: string, num: number }[];
/**
 * current chatot-asset repo commit hash
 */
export let commitHash = '';
/**
 * nv pair array of PS formats, in PS syntax, retrieved from the dex (for tourpings)
 */
export let psFormatAliases: INVPair[];

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
    spriteNames = psNames.map(n => ({ name: n, value: toAlias(n) }));
}

/**
 * Dumps the data from the dex and forms the objects we need throughout the code
 */
export async function loadAllDexNames() {
    // poll the db
    const dexNameDump = await variablePool.query(`
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
        (SELECT dex.types.name, dex.types.alias, dex.types.description FROM dex.types),

        formats AS
        (SELECT DISTINCT dex.formats.shorthand, dex.formats.alias, dex.formats.psname FROM dex.formats),

        gens AS
        (SELECT dex.gens.shorthand, dex.gens.alias, dex.gens.order FROM dex.gens ORDER BY dex.gens.order DESC)

        SELECT json_build_object(
            'pokemon', (SELECT COALESCE(JSON_AGG(pokemon.*), '[]') FROM pokemon),
            'items', (SELECT COALESCE(JSON_AGG(items.*), '[]') FROM items),
            'abilities', (SELECT COALESCE(JSON_AGG(abilities.*), '[]') FROM abilities),
            'moves', (SELECT COALESCE(JSON_AGG(moves.*), '[]') FROM moves),
            'natures', (SELECT COALESCE(JSON_AGG(natures.*), '[]') FROM natures),
            'types', (SELECT COALESCE(JSON_AGG(types.*), '[]') FROM types),
            'formats', (SELECT COALESCE(JSON_AGG(formats.*), '[]') FROM formats),
            'gens', (SELECT COALESCE(JSON_AGG(gens.*), '[]') FROM gens)
        ) AS data`);
    
    // unpack and update cache
    fullDexNameQuery = dexNameDump.rows.map((row: { data: IDexNameDump }) => row.data)[0];

    // create another obj array for just the pokemon so we can reference just those
    dexMondb = fullDexNameQuery.pokemon;

    // extract the gens because we don't need those for /dt
    const { gens, ...dtNames } = fullDexNameQuery;

    // formulate their auto pairs
    // by returning psname, the formats will be duplicated for each gen
    // so we need to filter out the unique shorthand/alias pairs
    const allDexFormats = dtNames.formats.map(f => ({ name: f.shorthand, value: f.alias }));
    dexFormats = allDexFormats.filter((format, idx) => idx === allDexFormats.findIndex(f => f.name === format.name && f.value === format.value));
    
    // we want all the ps ladders, so we reference the original query and not the uniq'd array of formats
    // some of the values are null, so we need to filter those out
    psFormatAliases = dtNames.formats.map(psn => ({ name: psn.psname, value: psn.psname })).filter(psn => psn.name);

    // BSS and VGC are weird in that they have a bunch of different names for the same meta
    // for the purposes of C&C (and raters), the names don't change to whom/where it applies
    // so map the different names to have the same value
    modifiedDexFormats = dtNames.formats.map(f => {
        if (/^(?:Battle |BSS)/m.test(f.shorthand)) {
            return { name: f.shorthand, value: 'bss' };
        }
        else if (/^VGC/m.test(f.shorthand)) {
            return { name: f.shorthand, value: 'vgc' };
        }
        else {
            return { name: f.shorthand, value: f.alias };
        }
    });

    // make sure they're unique
    modifiedDexFormats = modifiedDexFormats.filter((format, idx) => idx === modifiedDexFormats.findIndex(f => f.name === format.name && f.value === format.value));
    
    // map the gens
    dexGens = gens.map(g => ({ name: g.shorthand, value: g.alias }));
    dexGenNumAbbrMap = gens.map(g => ({ abbr: g.alias, num: g.order + 1 }));

    if (gens.length) {
        latestGen = gens[0].alias;
    }
    

    // people may wany to use the gen numbers instead of the names, so add those as well
    // the order = gen - 1
    // just reuse the alias for the values
    const dexGenNumbers = gens.map(g => ({ name: (g.order + 1).toString(), value: g.alias }));
    dexGens = dexGens.concat(dexGenNumbers);


    // map the unique name alias pairs so we can use them for autocomplete separately
    // loop over the entire array of objects from the query
    dexMondb.forEach(obj => {
        // try to find an obj in the unique array where the name and alias are the same as the row in the query
        const i = monNames.findIndex(uniqObj => uniqObj.name === obj.name && uniqObj.value === obj.alias);
        // if no matches are found, add the entry to the unique array
        if (i === -1) {
            monNames.push({ name: obj.name, value: obj.alias });
        }
    });

    // similarly, create a name/alias map for everything so we can autocomplete /dt
    for (const table in dtNames) {
        const tableData = dtNames[table as keyof IDtNameDump];
        tableData.forEach(obj => {
            if ('name' in obj) {
                const i = allNames.findIndex(uniqObj => uniqObj.name === obj.name && uniqObj.value === obj.alias);
                if (i === -1) {
                    allNames.push({ name: obj.name, value: obj.alias });
                }
            }
            else if ('shorthand' in obj) {
                const i = allNames.findIndex(uniqObj => uniqObj.name === obj.shorthand && uniqObj.value === obj.alias);
                if (i === -1) {
                    allNames.push({ name: obj.shorthand, value: obj.alias });
                }
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
    moveNames = moveArr.map(m => ({ name: m, value: toPSAlias(m) }));
    
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
 * Over time, it would be nice to move this onto just the dex
 * But we don't have a nice way of getting the full type-cased name at the moment
 */
export async function loadPSFormats() {
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

    psFormats = uniqMatchArr.map(format => ({ name: format, value: format.replace(/[^a-z0-9]/gi, '').toLowerCase() }));
}

/**
 * gets the latest commit hash on the chatot-assets repo
 */
export async function getImageCommitHash() {
    const res = await fetch('https://api.github.com/repos/shinyfinder/chatot-assets/branches/main');
    const json = await res.json() as IChatotAssetHash;
    commitHash = json.commit.sha;
}