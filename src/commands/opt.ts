import { SlashCommandBuilder, ChatInputCommandInteraction, PermissionFlagsBits, SlashCommandSubcommandBuilder } from 'discord.js';
import { SlashCommand } from '../types/slash-command-base';
import { pool } from '../helpers/createPool.js';
import { ServerClass } from '../helpers/constants.js';
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
        .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers) as SlashCommandBuilder,

    // execute our desired task
    async execute(interaction: ChatInputCommandInteraction) {
        await interaction.deferReply({ ephemeral: true });

        if (!interaction.guild) {
            await interaction.followUp('This command can only be used in a server!');
            return;
        }
        
        if (interaction.options.getSubcommand() === 'in') {
            // we do an upsert in case the initial insertion failed when the bot joined the server (which really shouldn't happen)
            // we only allow people to opt out if they aren't official
            const q = await pool.query(`
            INSERT INTO chatot.servers (serverid, class)
            VALUES ($1, $2) 
            ON CONFLICT (serverid) DO
            UPDATE SET class = EXCLUDED.class WHERE chatot.servers.class < $2
            RETURNING *`, [interaction.guildId, ServerClass.OptIn]);

            const count = q.rowCount;

            if (count !== 1) {
                await interaction.followUp('Your server is already enrolled in gbans.');
            }
            else {
                await interaction.followUp(`Ok, I will ban users here as well. You can update your preferences at any time with the opt in/out command.

It is recommended to setup a [logging channel](<https://github.com/shinyfinder/chatot-smogon/wiki/Commands#logging>) if you haven't already so you can be alerted if there are any issues.

If you wish to be synced with the current list of global bans, you may run the \`/syncgban\` command.`);
            }
            
        }
        else if (interaction.options.getSubcommand() === 'out') {
            // first, check if they are official
            const officialCheck: { class: ServerClass }[] | [] = (await pool.query('SELECT class FROM chatot.servers WHERE serverid=$1', [interaction.guildId])).rows;

            if (officialCheck.length) {
                if (officialCheck[0].class === ServerClass.Official) {
                    await interaction.followUp('Your server is marked as official and cannot opt out of gbans.');
                    return;
                }
                else if (officialCheck[0].class === ServerClass.OptOut) {
                    await interaction.followUp('Your server is already opted out of gbans.');
                    return;
                }
            }

            // upsert to ensure there's a row
            // we only allow people to opt out if they aren't official
            await pool.query(`
            INSERT INTO chatot.servers (serverid, class)
            VALUES ($1, $2) 
            ON CONFLICT (serverid) DO
            UPDATE SET class = EXCLUDED.class
            RETURNING *`, [interaction.guildId, ServerClass.OptOut]);

            await interaction.followUp('Ok, I will not try to globally ban users from here. You can update your preferences at any time with the opt in/out command.');
        }
        
    },

};