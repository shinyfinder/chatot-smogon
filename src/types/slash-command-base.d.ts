import { SlashCommandBuilder, AutocompleteInteraction, CommandInteraction } from 'discord.js';

/**
 * Slash command class definition
 * All slash commands conform to this form factor
 * A list of events can be found in the discord documentation: https://discordjs.guide/interactions/slash-commands.html#registering-slash-commands
 *
 * @param data Slash Command Builder intance.
 *
 * Slash commands are a subset of application commands within the discord documentation.
 * See here for a list of methods: https://discord.js.org/#/docs/discord.js/14.5.0/class/ApplicationCommand
 * And here for a discussion on application commands: https://discord.com/developers/docs/interactions/application-commands
 *
 * Execute takes the interaction (command) as input.
 *
 * @returns Promise<void>
 */

export interface SlashCommand {
    global: boolean;
    guilds: string[];
    // in seconds
    cooldown?: number;
    data: SlashCommandBuilder;
    autocomplete? (interaction: AutocompleteInteraction): Promise<void>;
    execute (interaction: CommandInteraction): Promise<void>;
}