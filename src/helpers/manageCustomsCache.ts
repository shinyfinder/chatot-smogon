import { pool } from './createPool.js';

/**
 * Helper file to manage the memory cache of custom commands
 */
interface customdb {
    serverid: string,
    cmd: string,
    txt: string,
    prefix: string,
}

export let dbmatches: customdb[] | [] = [];

/**
 * Caches the custom commands table so we don't query it on every message
 * @returns Rows from custom command db query
 */
export async function loadCustoms() {
    // poll the db
    const customsPostgres = await pool.query('SELECT serverid, cmd, txt, prefix FROM chatot.customs');
    dbmatches = customsPostgres.rows;
    return dbmatches;
}

/**
 * Adds a newly created custom prefix command to the local cache
 * @param newCustom Custom prefix command
 * @returns Custom prefix cache
 */
export function addCustoms(newCustom: customdb) {
    return (dbmatches as customdb[]).push(newCustom);
}

/**
 * Removes a custom prefix command from the local cache
 * @param oldCustom Custom prefix command
 * @returns Custom prefix cache
 */
export function removeCustom(oldCustom: customdb) {
    // search for the row which has the same name, prefix, and serverid
    const index = dbmatches.findIndex(row => row.cmd === oldCustom.cmd && row.txt === oldCustom.txt && row.serverid === oldCustom.serverid);
    return dbmatches.splice(index, 1);
}

/**
 * Modifies the existing row in the custom prefix cache to the new values
 * @param newCustom Custom prefix command
 * @returns custom prefix cache
 */
export function editCustom(newCustom: customdb) {
    // get the index of the updated row
    const index = dbmatches.findIndex(row => row.cmd === newCustom.cmd && row.serverid === newCustom.serverid);

    // mutate the row
    dbmatches[index].prefix = newCustom.prefix;
    dbmatches[index].txt = newCustom.txt;

    // return
    return dbmatches;
}