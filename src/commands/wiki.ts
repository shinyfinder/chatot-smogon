import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import { SlashCommand } from '../types/slash-command-base';

/**
 * Posts a link to the bot's wiki
 */
export const command: SlashCommand = {
    global: true,
    guilds: [],
    // setup the slash command builder
    data: new SlashCommandBuilder()
        .setName('wiki')
        .setDescription('Posts a link to the wiki'),

    // execute our desired task
    async execute(interaction: ChatInputCommandInteraction) {
        await interaction.reply({ content: '<https://github.com/shinyfinder/chatot-smogon/wiki/Commands>', ephemeral: true });
    },
};