import { BaseInteraction } from 'discord.js';
import { eventHandler } from '../types/event-base';
import { SlashCommand } from '../types/slash-command-base';

/**
 * interactionCreate handler
 *
 * On interaction, this checks whether the interaction is a command and is registered to the bot.
 * If it it registered, it compares against the list of commands and fires the appropriate one
 *
 * This triggers on interaction, so the once parameter is left out (alternatively could be set to false)
 */

export const clientEvent: eventHandler = {
    // define the name of the trigger event
    name: 'interactionCreate',
    // execute the command
    async execute(interaction: BaseInteraction) {
        // check whether the interaction is a slash command. If not, return
        if (interaction.isChatInputCommand()) {
            // try to fetch the command the user used from the list of commands the bot has
            // is undefined if it is not this bot's command
            const command = interaction.client.commands.get(interaction.commandName) as SlashCommand;

            // if it's not a command of this bot, return
            if (!command) return;

            // by here, it's one of this bot's commands, so do it.
            // wrap the execution in a try/catch so that errors are handled and won't cause the bot to crash
            try {
                // try to execute
                await command.execute(interaction);
            }
            catch (error) {
                // if there's an error, log it
                console.error(error);
                // and let the user know there was a problem
                // keep errors ephemeral so it doesn't clog the chat and only the person who initiated can see the error
                try {
                    await interaction.followUp({ content: 'There was an error while executing this command!', ephemeral: true });
                }
                catch (err) {
                    console.error(err);
                }
            }
        }
        // autocomplete handler
        else if (interaction.isAutocomplete()) {
            const command = interaction.client.commands.get(interaction.commandName) as SlashCommand;

            // if it's not a command of this bot, return
            if (!command) return;

            // by here, it's one of this bot's commands, so do it.
            // wrap the execution in a try/catch so that errors are handled and won't cause the bot to crash
            try {
                // try to execute
                if (command.autocomplete) {
                    await command.autocomplete(interaction);
                }
            }
            catch (error) {
                // if there's an error, log it
                console.error(error);
            }

        }

    },
};
