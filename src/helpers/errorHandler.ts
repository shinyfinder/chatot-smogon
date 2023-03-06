import { DiscordAPIError, Collection } from 'discord.js';

export function errorHandler(err: unknown) {
    // if it's a missing permission error, don't log to console
    if (err instanceof DiscordAPIError) {
        if (err.message === 'Missing Permissions' || err.message === 'Missing Access') {
            return;
        }
    }
    // if it's a collector timeout error, don't log to console
    else if ((err instanceof Error && err.message === 'Collector received no interactions before ending with reason: time') || err instanceof Collection && err.size === 0) {
        return;
    }

    console.error(err);
}