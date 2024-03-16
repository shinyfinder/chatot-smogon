import { DiscordAPIError, Collection, BaseInteraction } from 'discord.js';
import { eventHandler } from '../types/event-base';
import { SlashCommand } from '../types/slash-command-base';
import { createTicket } from '../helpers/createTicket.js';
import { errorHandler } from '../helpers/errorHandler.js';
import { markOfficial } from '../helpers/markOfficial.js';

/**
 * interactionCreate handler
 *
 * On interaction, this checks whether the interaction is a command and is registered to the bot.
 * If it it registered, it compares against the list of commands and fires the appropriate one
 *
 */

export const clientEvent: eventHandler = {
    // define the name of the trigger event
    name: 'interactionCreate',
    // execute the command
    async execute(interaction: BaseInteraction) {
        // check whether the interaction is a slash/context menu command
        if (interaction.isCommand()) {
            // try to fetch the command the user used from the list of commands the bot has
            // is undefined if it is not this bot's command
            const command = interaction.client.commands.get(interaction.commandName);

            // if it's not a command of this bot, return
            if (!command) return;

            // check for any cooldowns
            // first unpack, the Collection from the client
            const { cmdCooldowns } = interaction.client;

            // if this command has a cooldown parameter, 
            // see if this command is keyed in the collection (is on CD)
            // if it's not, create a new entry
            if (command.cooldown) {
                const now = Date.now();

                if (!cmdCooldowns.has(command.data.name)) {
                    // create a collection to contain the serverID / last-used-time pairs
                    const serverCD: Collection<string, number> = new Collection();
                    // populate the collection
                    serverCD.set(interaction.guildId ?? '', now);
                    // add it to the client collection
                    cmdCooldowns.set(command.data.name, serverCD);
                }
                else {
                    // get the server cooldowns for this command
                    const cooldowns = cmdCooldowns.get(command.data.name);
                    const lastUsed = cooldowns?.get(interaction.guildId ?? '');

                    // calc the expiration timestamp
                    const expTime = lastUsed ? lastUsed + command.cooldown * 1000 : 0;

                    // if it's on cooldown, alert and return
                    if (now < expTime) {
                        const expiredTimestamp = Math.round(expTime / 1000);
                        await interaction.reply({ content: `Command is on cooldown. You can use it again <t:${expiredTimestamp}:R>.`, ephemeral: true });
                        return;
                    }
                    // otherwise, update the timestamp
                    else {
                        const serverCD: Collection<string, number> = new Collection();
                        serverCD.set(interaction.guildId ?? '', now);
                        cmdCooldowns.set(command.data.name, serverCD);
                    }
                }
            }

            // by here, it's one of this bot's commands, so do it.
            // wrap the execution in a try/catch so that errors are handled and won't cause the bot to crash
            try {
                // try to execute
                await command.execute(interaction);
            }
            catch (error) {
                // let the user know there was a problem
                // try to keep errors ephemeral so it doesn't clog the chat and only the person who initiated can see the error
                // but first, route the error through the error handler so that we don't lose the info if the followups fail (those errors will be automatically routed as well)
                errorHandler({ err: error, int: interaction });

                // depending on the response method, we only have so long to respond
                // deferred responses give you 15 minutes
                // non-deferred have 3 seconds
                const timeDelay = Date.now() - interaction.createdTimestamp;
                const followUpLimit = 15 * 60 * 1000;
                const replyLimit = 3 * 1000;

                if (error instanceof DiscordAPIError) {
                    let msgout = '';

                    if (error.message.includes('IMAGE_INVALID')) {
                        msgout = `Error: ${error.message}. \n\nIf you are creating an emoji, make sure you are using the proper image format (jpg, png, gif) and copied the correct link. On Discord, select "Copy Link" **not** "Copy Message Link." From Google, select "Copy Image Link."`;
                    }
                    else if (error.message.includes('Unknown Emoji')) {
                        msgout = `Error: ${error.message}. \n\nI did not recognize that emoji. Make sure it's spelled correctly and available in this guild`;
                    }
                    else {
                        msgout = `Error: ${error.message}`;
                    }
                    // if we already replied, send a new one
                    if (interaction.replied) {
                        await interaction.channel?.send(msgout);
                    }
                    // if we haven't replied yet, but we deferred a reply, follow up
                    else if (!interaction.replied && interaction.deferred && interaction.isRepliable()) {
                        if (timeDelay < followUpLimit) {
                            await interaction.followUp(msgout);
                        }
                        
                    }
                    // if we haven't deferred or replied, reply
                    else if (!interaction.replied && interaction.isRepliable()) {
                        if (timeDelay < replyLimit) {
                            await interaction.reply({ content: msgout, ephemeral: true });
                        }
                    }
                }
                 // if it's a collector timeout error, just return without letting them know
                 else if (error instanceof Error && error.message === 'Collector received no interactions before ending with reason: time') {
                    return;
                }
                else if (error instanceof Collection && error.size === 0) {
                    await interaction.channel?.send('Collector timed out without receiving an interaction');
                }
                // if we already replied, send a new one
                else if (interaction.replied) {
                    await interaction.channel?.send('There was en error while executing this command');
                }
                // if we haven't replied yet, but we deferred a reply, follow up
                else if (!interaction.replied && interaction.deferred && interaction.isRepliable()) {
                    if (timeDelay < followUpLimit) {
                        await interaction.followUp('There was an error while executing this command');
                    }
                }
                // if we haven't deferred or replied, reply
                else if (!interaction.replied && interaction.isRepliable()) {
                    if (timeDelay < replyLimit) {
                        await interaction.reply({ content: 'There was an error while executing this command', ephemeral: true });
                    }
                }
            }
        }
        // buttons
        else if (interaction.isButton()) {
            // check if it's a ticket event
            try {
                await createTicket(interaction);
                await markOfficial(interaction);
            }
            catch (error) {
                // let the user know there was a problem
                // try to keep errors ephemeral so it doesn't clog the chat and only the person who initiated can see the error
                // but first, route the error through the error handler so that we don't lose the info if the followups fail (those errors will be automatically routed as well)
                errorHandler({ err: error, int: interaction });

                // depending on the response method, we only have so long to respond
                // deferred responses give you 15 minutes
                // non-deferred have 3 seconds
                const timeDelay = Date.now() - interaction.createdTimestamp;
                const followUpLimit = 15 * 60 * 1000;
                const replyLimit = 3 * 1000;

                if (error instanceof DiscordAPIError) {
                    // if we already replied, send a new one
                    if (interaction.replied) {
                        await interaction.channel?.send(error.message);
                    }
                    // if we haven't replied yet, but we deferred a reply, follow up
                    else if (!interaction.replied && interaction.deferred && interaction.isRepliable()) {
                        if (timeDelay < followUpLimit) {
                            await interaction.followUp(error.message);
                        }   
                    }
                    // if we haven't deferred or replied, reply
                    else if (!interaction.replied && interaction.isRepliable()) {
                        if (timeDelay < replyLimit) {
                            await interaction.reply({ content: error.message, ephemeral: true });
                        }
                    }
                }
                // if it's a collector timeout error, just return without letting them know
                else if (error instanceof Error && error.message === 'Collector received no interactions before ending with reason: time') {
                    return;
                }
                // if we already replied, send a new one
                else if (interaction.replied) {
                    await interaction.channel?.send('There was en error while executing this command');
                }
                // if we haven't replied yet, but we deferred a reply, follow up
                else if (!interaction.replied && interaction.deferred && interaction.isRepliable()) {
                    if (timeDelay < followUpLimit) {
                        await interaction.followUp('There was an error while executing this command');
                    }
                }
                // if we haven't deferred or replied, reply
                else if (!interaction.replied && interaction.isRepliable()) {
                    if (timeDelay < replyLimit) {
                        await interaction.reply({ content: 'There was an error while executing this command', ephemeral: true });
                    }
                }
            }
        }
        // autocomplete handler
        else if (interaction.isAutocomplete()) {
            const command = interaction.client.commands.get(interaction.commandName) as SlashCommand | undefined;

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
                throw { err: error, int: interaction };
            }

        }

    },
};
