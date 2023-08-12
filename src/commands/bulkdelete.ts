import { SlashCommandBuilder, ChatInputCommandInteraction, PermissionFlagsBits, ChannelType } from 'discord.js';
import { SlashCommand } from '../types/slash-command-base';

/**
 * Deletes messages in bulk from the specified channel
 */

export const command: SlashCommand = {
    global: false,
    guilds: [],
    // setup the slash command builder
    data: new SlashCommandBuilder()
        .setName('bulkdelete')
        .setDescription('Deletes messages in bulk from the specified channel')
        .addChannelOption(option =>
            option.setName('channel')
            .setDescription('The channel to delete messages from')
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(true))
        .addIntegerOption(option =>
            option.setName('number')
            .setDescription('How many messages to delete')
            .setRequired(true))
        .setDMPermission(false)
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),

    // execute our desired task
    async execute(interaction: ChatInputCommandInteraction) {
        await interaction.deferReply();
        // get the user input
        const channel = interaction.options.getChannel('channel', true, [ChannelType.GuildText]);
        const num = interaction.options.getInteger('number', true);

        // fetch the channel
        await interaction.client.channels.fetch(channel.id);

        // delete
        await channel.bulkDelete(num);

        // done
        await interaction.followUp('Messages deleted');
    },

};