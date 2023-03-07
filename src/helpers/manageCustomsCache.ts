import { pool } from './createPool.js';

/**
 * Helper file to instantiate the connection to the postgres pool
 */
interface customdb {
    serverid: string,
    cmd: string,
    txt: string,
    prefix: string,
}

export let dbmatches: customdb[] | [];

export async function loadCustoms() {
    // poll the db
    const customsPostgres = await pool.query('SELECT serverid, cmd, txt, prefix FROM chatot.customs');
    dbmatches = customsPostgres.rows;
    return dbmatches;
}

export function addCustoms(newCustom: customdb) {
    return (dbmatches as customdb[]).push(newCustom);
}

export function removeCustom(oldCustom: customdb) {
    // search for the row which has the same name, prefix, and serverid
    const index = dbmatches.findIndex(row => row.cmd === oldCustom.cmd && row.txt === oldCustom.txt && row.serverid === oldCustom.serverid);
    return dbmatches.splice(index, 1);
}

export function editCustom(newCustom: customdb) {
    // get the index of the updated row
    const index = dbmatches.findIndex(row => row.cmd === newCustom.cmd && row.serverid === newCustom.serverid);

    // mutate the row
    dbmatches[index].prefix = newCustom.prefix;
    dbmatches[index].txt = newCustom.txt;

    // return
    return dbmatches;
}