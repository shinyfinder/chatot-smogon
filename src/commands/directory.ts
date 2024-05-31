import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import { SlashCommand } from '../types/slash-command-base';

/**
 * Posts the Smogon discord server directory to the chat
 */
export const command: SlashCommand = {
    global: true,
    guilds: [],
    // setup the slash command builder
    data: new SlashCommandBuilder()
        .setName('directory')
        .setDescription('Replies with the Smogon discord server directory') as SlashCommandBuilder,

    // execute our desired task
    async execute(interaction: ChatInputCommandInteraction) {
        await interaction.reply({ content: '<https://www.smogon.com/discord/directory>' });
    },
};