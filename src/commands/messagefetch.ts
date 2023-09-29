import { SlashCommandBuilder, ChatInputCommandInteraction, PermissionFlagsBits } from 'discord.js';
import { SlashCommand } from '../types/slash-command-base';

/**
 * Deletes messages in bulk from the specified channel
 * This is currently a dev-only command
 * Messages must be newer than 2 weeks
 */

export const command: SlashCommand = {
    global: false,
    guilds: [],
    // setup the slash command builder
    data: new SlashCommandBuilder()
        .setName('messagefetch')
        .setDescription('Fetches a message from the interaction channel')
        .addStringOption(option =>
            option.setName('messageid')
            .setDescription('The message to fetch')
            .setRequired(true))
        .setDMPermission(false)
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),

    // execute our desired task
    async execute(interaction: ChatInputCommandInteraction) {
        await interaction.deferReply({ ephemeral: true });
        // get the user input
        const id = interaction.options.getString('messageid', true);
        
        const msg = await interaction.channel?.messages.fetch(id);

        // done
        await interaction.followUp('Done');
    },

};