import { SlashCommandBuilder, ChatInputCommandInteraction, PermissionFlagsBits } from 'discord.js';
import { SlashCommand } from '../types/slash-command-base';

/**
 * Command to post FAQs to the chat, optionally which one.
 *
 * Subcommands are add, remove, and list
 */

export const command: SlashCommand = {
    global: true,
    guilds: [],
    // setup the slash command builder
    data: new SlashCommandBuilder()
        .setName('addemoji')
        .setDescription('Adds an emoji to the server given a link')
        .setDMPermission(false)
        .addStringOption(option =>
            option.setName('url')
            .setDescription('URL to the image you want to add as an emoji')
            .setRequired(true),
        )
        .addStringOption(option =>
            option.setName('name')
            .setDescription('Name for the emoji')
            .setRequired(true),
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageEmojisAndStickers),
    // execute our desired task
    async execute(interaction: ChatInputCommandInteraction) {
        // return if not used in guild
        if (!interaction.guild) {
            return;
        }

        // get the entered input
        const url = interaction.options.getString('url', true);
        const name = interaction.options.getString('name', true);

        // add the emoji
        await interaction.guild.emojis.create({ attachment: url, name: name });

        // let them know it was added
        await interaction.reply({ content: `Created a new emoji with name ${name}`, ephemeral: true });

    },

};