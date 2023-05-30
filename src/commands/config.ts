import { SlashCommandBuilder, ChatInputCommandInteraction, PermissionFlagsBits, SlashCommandSubcommandBuilder } from 'discord.js';
import { SlashCommand } from '../types/slash-command-base';
import { pool } from '../helpers/createPool.js';

/**
 * Sets up the requirements for a user to be considered verified within the discord server
 * 
 */
export const command: SlashCommand = {
    global: true,
    guilds: [],
    // setup the slash command builder
    data: new SlashCommandBuilder()
        .setName('config')
        .setDescription('Sets up the requirements for a user to be considered verified')
        .setDMPermission(false)
        .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)

        /**
         * VERIFY MEMBERS
         */
        .addSubcommand(new SlashCommandSubcommandBuilder()
            .setName('verify')
            .setDescription('Configures the server verification requirements')
            .addRoleOption(option => 
                option.setName('unverifiedrole')
                .setDescription('Role the user is given ')
                .setRequired(true))
            .addIntegerOption(option =>
                option.setName('accountage')
                .setDescription('Minimum account age in days')
                .setMinValue(0)
                .setMaxValue(2147483647)
                .setRequired(false))
            .addBooleanOption(option =>
                option.setName('turnoff')
                .setDescription('Turns off the verification process')
                .setRequired(false))),

    // execute our desired task
    async execute(interaction: ChatInputCommandInteraction) {
        await interaction.deferReply({ ephemeral: true });

        if (!interaction.guildId) {
            return;
        }

        
        if (interaction.options.getSubcommand() === 'verify') {
            // retrieve the user input
            const role = interaction.options.getRole('unverifiedrole', true);
            const age = interaction.options.getInteger('accountage') ?? 0;
            const turnoff = interaction.options.getBoolean('turnoff');

            // make sure it's a valid assignable role
            // invalid are the built-in @everyone role and any role that's externally managed (i.e. bot role, boost role)
            if (role.managed || role.name === '@everyone') {
                await interaction.followUp('I cannot assign that role');
                return;
            }

            // upsert into the db
            if (turnoff) {
                await pool.query('DELETE FROM chatot.verifyreqs WHERE serverid=$1', [interaction.guildId]);
                // success!
                await interaction.followUp('Ok, I will no longer assign a role to new members');
            }
            else {
                await pool.query('INSERT INTO chatot.verifyreqs (serverid, roleid, age) VALUES ($1, $2, $3) ON CONFLICT (serverid) DO UPDATE SET serverid=EXCLUDED.serverid, roleid=EXCLUDED.roleid, age=EXCLUDED.age', [interaction.guildId, role.id, age]);
                // success!
                await interaction.followUp(`Ok, I will assign role **${role.name}** to new members without a forum account older than **${age}** days.`);
            }
            return;
        }
    },
};