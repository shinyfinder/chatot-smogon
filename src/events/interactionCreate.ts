import { BaseInteraction, DiscordAPIError, Collection } from 'discord.js';
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
                // let the user know there was a problem
                // try to keep errors ephemeral so it doesn't clog the chat and only the person who initiated can see the error
                if (error instanceof DiscordAPIError && (error.message === 'Missing Permissions' || error.message === 'Missing Access')) {
                    // if we already replied, send a new one
                    if (interaction.replied) {
                        await interaction.channel?.send('I do not have permissions to run that command');
                    }
                    // if we haven't replied yet, but we deferred a reply, follow up
                    else if (!interaction.replied && interaction.deferred && interaction.isRepliable()) {
                        await interaction.followUp('I do not have permissions to run that command');
                    }
                    // if we haven't defferred or replied, reply
                    else if (!interaction.replied && interaction.isRepliable()) {
                        await interaction.reply({ content: 'I do not have permissions to run that command', ephemeral: true });
                    }
                    throw error;
                }
                // if it's a collector timeout error, just return without letting them know
                 else if (error instanceof Error && error.message === 'Collector received no interactions before ending with reason: time') {
                    throw error;
                }
                else if (error instanceof Collection && error.size === 0) {
                    await interaction.channel?.send('Collector timed out without receiving an interation');
                    throw error;
                }
                // if we already replied, send a new one
                else if (interaction.replied) {
                    await interaction.channel?.send('There was en error while executing this command');
                }
                // if we haven't replied yet, but we deferred a reply, follow up
                else if (!interaction.replied && interaction.deferred && interaction.isRepliable()) {
                    await interaction.followUp('There was an error while executing this command');
                }
                // if we haven't deferred or replied, reply
                else if (!interaction.replied && interaction.isRepliable()) {
                    await interaction.reply({ content: 'There was an error while executing this command', ephemeral: true });
                }
                
                throw error;
                
            }
        }
        // autocomplete handler
        else if (interaction.isAutocomplete()) {
            const command = interaction.client.commands.get(interaction.commandName) as SlashCommand;

            // if it's not a command of this bot, return
            if (!command) return;

            // by here, it's one of this bot's commands, so do it.
            // wrap the execution in a try/catch so that errors are handled and won't cause the bot to crash
            // eslint-disable-next-line no-useless-catch
            try {
                // try to execute
                if (command.autocomplete) {
                    await command.autocomplete(interaction);
                }
            }
            catch (error) {
                // if there's an error, log it
                throw error;
            }

        }

    },
};
