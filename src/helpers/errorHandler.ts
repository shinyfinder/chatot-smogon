import { DiscordAPIError, Collection, CommandInteractionOption } from 'discord.js';
import { IErrorPack } from '../types/error';
import { stripDiscrim } from './stripDiscrim.js';

export function errorHandler(err: unknown) {
    // unpack the error message if it's a slash command error
    const errObj = isErrPack(err) ? err.err : err;

    // if it's a missing permission error, don't log to console
    if (errObj instanceof DiscordAPIError) {
        const swallowedErrors = [
            'Missing Permissions',
            'Missing Access',
            'exceeds maximum size',
            'Thread is locked',
            'Thread is archived',
            'IMAGE_INVALID',
            'Unknown Emoji',
            'Unknown Role',
        ];

        if (swallowedErrors.some(str => errObj.message.includes(str))) {
            return;
        }
    }
    // if it's a collector timeout error, don't log to console
    else if ((errObj instanceof Error && errObj.message === 'Collector received no interactions before ending with reason: time') || errObj instanceof Collection && errObj.size === 0) {
        return;
    }
    // if it's a custom error packet (command failed), print out the interaction info as well
    else if (isErrPack(err)) {
        console.error(err.err);

        if (err.int) {
            // form the err message
            const intInfo = `This error occurred in the following interaction:
            Command: ${err.int.toString()}
            Guild: ${err.int.guild?.name}
            User: ${stripDiscrim(err.int.user)} (${err.int.id})`;
            
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
function isErrPack(errPack: IErrorPack | unknown): errPack is IErrorPack {
    return (errPack as IErrorPack).err !== undefined;
}