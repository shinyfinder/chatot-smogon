import { SlashCommandBuilder, CommandInteraction } from 'discord.js';

/**
 * Command to test the bot is online and working.
 * @param data SlashCommandBuilder() instance from discord.js
 * @returns Replies Pong! in the chat
 *
 * Can be used as a template for future commands
 */
export = {
    // setup the slash command builder
    data: new SlashCommandBuilder()
        .setName('ping')
        .setDescription('Replies with Pong!'),

    // execute our desired task
    async execute(interaction: CommandInteraction) {
        await interaction.reply('Pong!');
    },
};