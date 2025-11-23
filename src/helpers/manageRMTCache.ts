import { pool } from './createPool.js';

/**
 * Helper file to manage the memory cache of custom commands
 */
interface IRMTChans {
    channelid: string,
    meta: string,
}

export let rmtChannels: IRMTChans[] = [];

/**
 * Caches the rmt channel table so we don't query it on every message
 * @returns Rows from custom command db query
 */
export async function loadRMTChans() {
    // poll the db
    rmtChannels = (await pool.query('SELECT channelid, meta FROM chatot.rmtchans')).rows as IRMTChans[];
}

export function addRMTCache(id: string, meta: string) {
    if (!rmtChannels.some(chan => chan.channelid === id && chan.meta === meta)) {
        rmtChannels.push({ channelid: id, meta: meta });
    }
}

export function removeRMTCache(id: string, meta: string) {
    const idx = rmtChannels.findIndex(chan => chan.channelid === id && chan.meta === meta);
    if (idx > -1) {
        rmtChannels.splice(idx, 1);
    }
}

export function removeAllRMTCache(id: string) {
    rmtChannels = rmtChannels.filter(chan => chan.channelid !== id);
}