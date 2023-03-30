import { SlashCommand } from './slash-command-base';
import { RESTPostAPIApplicationCommandsJSONBody } from 'discord.js';

/**
 * Interfaces used when defining the current state of the commands
 * See usage in ../helpers/hashCommahds.ts and ../helpers/deployCommands.ts
 */

/**
 * Interface to entend the RESTPostAPIApplicationCommandsJSONBody class
 * to include the custom guild and global fields
 * so we can hash them together
 */
export type IJSONBody = RESTPostAPIApplicationCommandsJSONBody & {global: boolean, guilds: string[] };

/**
 * Interface that contains the command definitions (not API payload) and hash values
 */
export interface IState {
    command: SlashCommand,
    hash: number,
}


/**
 * Interface for the state database query
 */

export interface IStateRes {
    name: string,
    global: boolean,
    guilds: string[],
    hash: number,
}