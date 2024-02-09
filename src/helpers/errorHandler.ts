/* eslint-disable @typescript-eslint/no-base-to-string */
import { DiscordAPIError, Collection } from 'discord.js';
import { IErrorPack } from '../types/error';

export function errorHandler(err: unknown) {
    // unpack the error message if it's a slash command error
    const errObj = isErrPack(err) ? err.err : err;

    const swallowedErrors = [
        'Missing Permissions',
        'Missing Access',
        'exceeds maximum size',
        'Thread is locked',
        'Thread is archived',
        'IMAGE_INVALID',
        'Unknown Emoji',
        'Unknown Role',
        'Members didn\'t arrive in time',
        'Collector received no interactions before ending with reason: time',
    ];

    // some errors we don't want to log, so make sure it's not in the list above
    if (errObj instanceof DiscordAPIError || errObj instanceof Error) {
        if (swallowedErrors.some(str => errObj.message.includes(str))) {
            return;
        }
    }
    
    // if it's a collector timeout error, don't log to console
    else if (errObj instanceof Collection && errObj.size === 0) {
        return;
    }
    // if it's a custom error packet (command failed), print out the interaction info as well
    else if (isErrPack(err)) {
        console.error(err.err);

        if (err.int) {
            // form the err message
            const intInfo = `This error occurred in the following interaction:
            Command: ${err.int.toString()}
            Guild: ${err.int.guild ? err.int.guild.name : 'None'}
            User: ${err.int.user.tag} (${err.int.id})`;
            
            // log it
            console.error(intInfo);
        }
    }
    // otherwise, just print the error message
    else {
        console.error(errObj);
    }
}

/**
 * Type guard to determine whether the passed object is the custom error interface containing the interaction data. See error.d.ts and interactionCreate.ts
 * @param errPack Object passed to the error handler
 * @returns Boolean 
 */
function isErrPack(errPack: unknown): errPack is IErrorPack {
    return (errPack as IErrorPack).err !== undefined;
}