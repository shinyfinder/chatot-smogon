import { AutocompleteInteraction, ChatInputCommandInteraction } from 'discord.js';

/**
 * Interface used in packaging errors for logging
 * @param err Error
 * @param int Discord interaction object
 */
export interface IErrorPack {
    err: unknown,
    int?: ChatInputCommandInteraction | AutocompleteInteraction
}