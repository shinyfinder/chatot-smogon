import { loadSpriteDex, loadAllDexNames, loadMoves, loadItems } from './loadDex.js';
import { errorHandler } from './errorHandler.js';
import { cacheInterval } from './constants.js';
/**
 * Recursively creates a timer to update the local cache of names/info fetched from the db and PS used in autocompletes
 */
export function createDexCacheTimer() {
    setTimeout(() => {
        void updateDexCache()
            .catch(e => (errorHandler(e)))
            .finally(() => createDexCacheTimer());
    }, cacheInterval);
    
}

/**
 * Polls the database and PS to update the cache of mon names, moves, items, etc
 */
async function updateDexCache() {
    await Promise.all([
        loadSpriteDex(),
        loadAllDexNames(),
        loadMoves(),
        loadItems(),
    ]);
}