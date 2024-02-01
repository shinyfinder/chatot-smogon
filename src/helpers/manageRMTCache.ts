import { pool } from './createPool.js';

/**
 * Helper file to manage the memory cache of custom commands
 */
interface IRMTChans {
    channelid: string,
}

export let rmtChannels: IRMTChans[] | [];

/**
 * Caches the custom commands table so we don't query it on every message
 * @returns Rows from custom command db query
 */
export async function loadRMTChans() {
    // poll the db
    rmtChannels = (await pool.query('SELECT DISTINCT channelid FROM chatot.rmts')).rows;
}
