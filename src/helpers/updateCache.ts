import { loadSpriteDex, loadAllDexNames, loadMoves, loadItems, getImageCommitHash } from './loadDex.js';
import { errorHandler } from './errorHandler.js';
import { cacheInterval } from './constants.js';
import { loadRRMessages } from './loadReactRoleMessages.js';
import { Client } from 'discord.js';
/**
 * Recursively creates a timer to update the local cache of names/info fetched from the db and PS used in autocompletes
 */
export function createCacheTimer(client: Client) {
    setTimeout(() => {
        void updateDexCache(client)
            .catch(e => (errorHandler(e)))
            .finally(() => createCacheTimer(client));
    }, cacheInterval);
    
}

/**
 * Polls the database and PS to update the cache of mon names, moves, items, etc
 */
async function updateDexCache(client: Client) {
    await Promise.all([
        loadSpriteDex(),
        loadAllDexNames(),
        loadMoves(),
        loadItems(),
        loadRRMessages(client),
        getImageCommitHash(),
    ]);
}