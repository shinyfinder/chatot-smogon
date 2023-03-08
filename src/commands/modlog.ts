import { SlashCommandBuilder, ChatInputCommandInteraction, SlashCommandSubcommandBuilder, PermissionFlagsBits } from 'discord.js';
import { SlashCommand } from '../types/slash-command-base';
import { pool } from '../helpers/createPool.js';

/**
 * Command to turn mod logging on or off in the channel this command is used.
 * Only 1 logging channel is allowed per server.
 * Logged actions are ban add/remove, kick, (un)boosting, (un)timeout, and message deleted
 * Subcommands are on and off
 */

export const command: SlashCommand = {
    global: true,
    // setup the slash command builder
    data: new SlashCommandBuilder()
        .setName('modlog')
        .setDescription('Toggles mod logging in this channel')
        .setDMPermission(false)
        .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
        .addSubcommand(new SlashCommandSubcommandBuilder()
                .setName('on')
                .setDescription('Turns on modlogging to this channel'),
        )
        .addSubcommand(
            new SlashCommandSubcommandBuilder()
                .setName('off')
                .setDescription('Turns off modlogging in the server'),
        ),
    // execute our desired task
    async execute(interaction: ChatInputCommandInteraction) {
        const channelid = interaction.channelId;
        const serverid = interaction.guildId;

        // typecheck
        if (serverid === null) {
            return;
        }
        await interaction.deferReply();
        // query the database for the list of logging channels
        // the PK is serverid, so there can only be 1 result, if any
        const ratersPostgres = await pool.query('SELECT channelid FROM chatot.logchan WHERE serverid = $1', [serverid]);
        const logchans: { channelid: string}[] | [] = ratersPostgres.rows;

        
        /**
         * MODLOG ON
         */
        if (interaction.options.getSubcommand() === 'on') {
            // if there is already a row in the table, mod log is on somewhere
            if (logchans.length) {
                // check if the logging channel is already set to this channel
                if (logchans[0].channelid === channelid) {
                    await interaction.followUp({ content: 'Logging is already set to this channel.' });
                    return;
                }
                // else, update it to be this channel
                else {
                    await pool.query('UPDATE chatot.logchan SET channelid=$1 WHERE serverid=$2', [channelid, serverid]);
                    await interaction.followUp({ content: 'Logging set to this channel.' });
                    return;
                }
            }
            // if you didn't find a result, insert a new row to turn on logging
            else {
                await pool.query('INSERT INTO chatot.logchan (serverid, channelid) VALUES ($1, $2)', [serverid, channelid]);
                await interaction.followUp({ content: 'Logging set to this channel.' });
                return;
            }
        }

        /**
         * MODLOG OFF
         */
        else if (interaction.options.getSubcommand() === 'off') {
            // if there is already a row in the table, mod log is on somewhere
            if (logchans.length) {
                await pool.query('DELETE FROM chatot.logchan WHERE serverid=$1', [serverid]);
                await interaction.followUp({ content: 'Logging turned off in this server.' });
                return;
            }
            // if you didn't find a result, let them know
            else {
                await interaction.followUp({ content: 'Logging is not currently enabled in this server' });
                return;
            }

        }
    },

};