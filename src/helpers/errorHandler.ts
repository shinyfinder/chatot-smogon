import { DiscordAPIError, Collection } from 'discord.js';

export function errorHandler(err: unknown) {
    // if it's a missing permission error, don't log to console
    if (err instanceof DiscordAPIError) {
        const swallowedErrors = [
            'Missing Permissions',
            'Missing Access',
            'exceeds maximum size',
            'Thread is locked',
        ];

        if (swallowedErrors.some(str => err.message.includes(str))) {
            return;
        }
    }
    // if it's a collector timeout error, don't log to console
    else if ((err instanceof Error && err.message === 'Collector received no interactions before ending with reason: time') || err instanceof Collection && err.size === 0) {
        return;
    }

    console.error(err);
}