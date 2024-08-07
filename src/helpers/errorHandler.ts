import { DiscordAPIError, Collection, ChatInputCommandInteraction } from 'discord.js';
import { IErrorPack } from '../types/error';
import { startupFlags } from './constants.js';

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
        'Unknown Ban',
        'Unknown Message',
        'Members didn\'t arrive in time',
        'collector received no interactions',
        'Unknown Member',
        'Unknown Interaction',
    ];

    // some errors we don't want to log, so make sure it's not in the list above
    if (errObj instanceof DiscordAPIError || errObj instanceof Error) {
        if (swallowedErrors.some(str => errObj.message.toLowerCase().includes(str.toLowerCase()))) {
            return;
        }
    }
    
    // if it's a collector timeout error, don't log to console
    else if (errObj instanceof Collection && errObj.size === 0) {
        return;
    }
    // if it's a custom error packet (command failed), print out the interaction info as well
    if (isErrPack(err)) {
        console.error(err.err);

        if (err.int) {
            let cmdStr = '';

            if (err.int instanceof ChatInputCommandInteraction) {
                cmdStr = err.int.toString();
            }
            else {
                cmdStr = err.int.commandName;
            }
            // form the err message
            const intInfo = `This error occurred in the following interaction:
            Command: ${cmdStr}
            Guild: ${err.int.guild ? err.int.guild.name : 'None'}
            User: ${err.int.user.tag} (${err.int.user.id})`;
            
            // log it
            console.error(intInfo);
        }

        if (!startupFlags.success) {
            process.exit(1);
        }
    }
    // otherwise, just print the error message
    else {
        console.error(errObj);
        if (!startupFlags.success) {
            process.exit(1);
        }
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