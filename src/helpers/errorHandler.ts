import { DiscordAPIError } from 'discord.js';

export function errorHandler(err: unknown) {
    // if it's a missing permission error, don't log to console
    if (err instanceof DiscordAPIError) {
        if (err.message === 'Missing Permissions' || err.message === 'Missing Access') {
            return;
        }
    }
    console.error(err);
}