import { SlashCommandBuilder, ChatInputCommandInteraction, PermissionFlagsBits } from 'discord.js';
import { SlashCommand } from '../types/slash-command-base';

/**
 * Adds an emoji from the server given a url to the image
 *
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
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuildExpressions),
    // execute our desired task
    async execute(interaction: ChatInputCommandInteraction) {
        // return if not used in guild
        if (!interaction.guild) {
            return;
        }
        await interaction.deferReply({ ephemeral: true });

        // get the entered input
        const url = interaction.options.getString('url', true);
        const name = interaction.options.getString('name', true);

        // make sure the name only includes alphanumeric and underscore amd is at least 2 char long
        const validName = (/^[a-z0-9_]{2,}$/gi).test(name);

        if (!validName) {
            await interaction.followUp('Emoji names must be at least 2 characters long and only contain alphanumeric characters and underscores');
            return;
        }

        // add the emoji
        await interaction.guild.emojis.create({ attachment: url, name: name });

        // let them know it was added
        await interaction.followUp(`Created a new emoji with name ${name}`);

    },

};