import { SlashCommandBuilder, ChatInputCommandInteraction, PermissionFlagsBits } from 'discord.js';
import { SlashCommand } from '../types/slash-command-base';
import { pool } from '../helpers/createPool.js';

/**
 * Posts a link in the chat to the specified Pokemon analysis
 * @param pokemon Name of the pokemon
 * @param gen Which gen to pull up the analysis for
 *
 */
export const command: SlashCommand = {
    global: true,
    guilds: [],
    // setup the slash command builder
    data: new SlashCommandBuilder()
        .setName('dexdefault')
        .setDescription('Sets the default format for the /dex command. Defaults are automatically appended.')
        .addStringOption(option =>
            option.setName('format')
            .setDescription('Which format to automatically link to when using /dex. i.e. ou, uu, lc, doubles')
            .setRequired(false))
        .addStringOption(option =>
            option.setName('gen')
            .setDescription('Which gen to automatically link to when using /dex. i.e. rb, ss, sv')
            .setRequired(false))
        .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
        .setDMPermission(false),

    // execute our desired task
    async execute(interaction: ChatInputCommandInteraction) {
        await interaction.deferReply({ ephemeral: true });
        // make sure this command is used in a guild
        if (!interaction.guild) {
            await interaction.reply('This command can only be used in a server!');
            return;
        }

        // get the inputs
        const format = interaction.options.getString('format') ?? '';
        const gen = interaction.options.getString('gen') ?? '';

        // upsert it into the table
        await pool.query('INSERT INTO chatot.dexdefaults (serverid, format, gen) VALUES ($1, $2, $3) ON CONFLICT (serverid) DO UPDATE SET format=EXCLUDED.format, gen=EXCLUDED.gen', [interaction.guildId, format.toLowerCase(), gen.toLowerCase()]);
        // let them know we updated it
        await interaction.followUp('Defaults set');
    },
};