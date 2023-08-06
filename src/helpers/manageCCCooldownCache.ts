import { getCCAlertCooldowns } from './ccQueries.js';
import { ICCCooldown } from '../types/cc';

/**
 * Collection of commands used to manage the memory cache of C&C alert cooldowns
 */


/**
 * C&C integration cooldown
 * Prevents spamming of QC teams if there are a lot of updates at once.
 */
export let ccCooldowns: ICCCooldown[];

/**
 * Queries the database to load the cooldowns into memory
 */
export async function loadCCCooldowns() {
    ccCooldowns = await getCCAlertCooldowns();
}

/**
 * Updates the object in memory for new cooldown data
 */
export function updateCCCooldownMem(chanid: string, id: string) {
    const i = ccCooldowns.findIndex(elem => elem.channelid === chanid && elem.identifier === id);
    // if you found a match, update
    if (i > -1) {
        ccCooldowns[i].date = new Date();
    }
    else {
        ccCooldowns.push({
            channelid: chanid,
            identifier: id,
            date: new Date(),
        });
    }
}