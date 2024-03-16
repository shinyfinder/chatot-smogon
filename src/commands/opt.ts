import { SlashCommandBuilder, ChatInputCommandInteraction, PermissionFlagsBits, SlashCommandSubcommandBuilder } from 'discord.js';
import { SlashCommand } from '../types/slash-command-base';
import { pool } from '../helpers/createPool.js';

/**
 * Deletes messages in bulk from the specified channel
 * This is currently a dev-only command
 * Messages must be newer than 2 weeks
 */

export const command: SlashCommand = {
    global: true,
    guilds: [],
    // setup the slash command builder
    data: new SlashCommandBuilder()
        .setName('opt')
        .setDescription('Opts in or out of the gban functionality')
        .addSubcommand(new SlashCommandSubcommandBuilder()
            .setName('in')
            .setDescription('Opts into gbans, allowing users to be globally banned by Smogon/PS admins'))
        .addSubcommand(new SlashCommandSubcommandBuilder()
            .setName('out')
            .setDescription('Opts out of allowing users to be globally banned by Smogon/PS admins'))
        .setDMPermission(false)
        .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),

    // execute our desired task
    async execute(interaction: ChatInputCommandInteraction) {
        await interaction.deferReply({ ephemeral: true });

        if (!interaction.guild) {
            await interaction.followUp('This command can only be used in a server!');
            return;
        }
        
        if (interaction.options.getSubcommand() === 'in') {
            await pool.query('INSERT INTO chatot.gban_opt_ins (serverid) VALUES ($1) ON CONFLICT (serverid) DO NOTHING', [interaction.guildId]);
            await interaction.followUp('Ok, I will ban users here as well. You can update your preferences at any time with the opt in/out command.\n\nIt is recommended to setup a [logging channel](<https://github.com/shinyfinder/chatot-smogon/wiki/Commands#logging>) if you haven\'t already so you can be alerted if there are any issues.');
        }
        else if (interaction.options.getSubcommand() === 'out') {
            await pool.query('DELETE FROM chatot.gban_opt_ins WHERE serverid=$1', [interaction.guildId]);
            await interaction.followUp('Ok, I will not try to globally ban users from here. You can update your preferences at any time with the opt in/out command.');
        }
        
    },

};