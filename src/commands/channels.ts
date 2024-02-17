import { SlashCommandBuilder, ChatInputCommandInteraction, TextChannel } from 'discord.js';
import { SlashCommand } from '../types/slash-command-base';

/**
 * Gets a channel by id.
 * Dev command.
 */
export const command: SlashCommand = {
    global: false,
    guilds: [],
    // setup the slash command builder
    data: new SlashCommandBuilder()
        .setName('channels')
        .setDescription('Gets a channel by id')
        .addStringOption(option =>
            option.setName('id')
            .setDescription('Name (or id) of the server to query. Bot must be in it')
            .setRequired(true))
        .setDMPermission(false)
        .setDefaultMemberPermissions(0),

    // execute our desired task
    async execute(interaction: ChatInputCommandInteraction) {
        await interaction.deferReply();
        
        // user input
        const id = interaction.options.getString('id', true);
        const chan = interaction.client.channels.cache.get(id);

        if (!chan) {
            await interaction.followUp('Cannot find the chanenl. Do I have access?');
        }
        else if (chan.isTextBased() && chan instanceof TextChannel) {
            await interaction.followUp(`Channel name is ${chan.name}`);
        }
    },
};