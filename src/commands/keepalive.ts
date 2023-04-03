import { SlashCommandBuilder, ChatInputCommandInteraction, SlashCommandSubcommandBuilder, PermissionFlagsBits, ChannelType } from 'discord.js';
import { SlashCommand } from '../types/slash-command-base';
import { pool } from '../helpers/createPool.js';

/**
 * Command to prevent a thread from archiving
 * Unarchiving locked threads requires the Manage Threads permission
 * Subcommands are on and off
 */

export const command: SlashCommand = {
    global: true,
    guilds: [],
    // setup the slash command builder
    data: new SlashCommandBuilder()
        .setName('keepalive')
        .setDescription('Prevents a thread from archiving')
        .setDMPermission(false)
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageThreads)
        .addSubcommand(new SlashCommandSubcommandBuilder()
                .setName('on')
                .setDescription('Prevents the thread from archiving'),
        )
        .addSubcommand(
            new SlashCommandSubcommandBuilder()
                .setName('off')
                .setDescription('Allows the thread to be archived'),
        ),
    // execute our desired task
    async execute(interaction: ChatInputCommandInteraction) {
        const channel = interaction.channel;
        // typecheck and restrict to threads
        if (channel === null || !(channel.type === ChannelType.PublicThread || channel.type === ChannelType.PrivateThread)) {
            await interaction.reply({ content: 'You can only use this command in a thread I can access!', ephemeral: true });
            return;
        }

        await interaction.deferReply({ ephemeral: true });
        // query the database for the list of threads to be kept alive
        // the PK is the id, so there can only be 1 result, if any
        const KAPostgres = await pool.query('SELECT id FROM chatot.keepalives WHERE id = $1', [channel.id]);
        const chan: { id: string}[] | [] = KAPostgres.rows;

                
        /**
         * KEEPALIVE ON
         */
        if (interaction.options.getSubcommand() === 'on') {
            // if there is already a row in the table, mod log is on somewhere
            if (chan.length) {
                // check if the thread is already being kept alive
                if (chan[0].id === channel.id) {
                    await interaction.followUp({ content: 'Thread is already being kept alive.' });
                    return;
                }
            }
            // if you didn't find a result, insert a new row to disable archiving
            else {
                await pool.query('INSERT INTO chatot.keepalives (id) VALUES ($1)', [channel.id]);
                await interaction.followUp({ content: 'I will prevent this thread from archiving.' });
                return;
            }
        }

        /**
         * KEEPALIVE OFF
         */
        else if (interaction.options.getSubcommand() === 'off') {
            // if you found a result, remove the row to allow the thread to archive
            if (chan.length) {
                await pool.query('DELETE FROM chatot.keepalives WHERE id=$1', [channel.id]);
                await interaction.followUp({ content: 'This thread can be archived again.' });
                return;
            }
            // if you didn't find a result, let them know
            else {
                await interaction.followUp({ content: 'keepalive not enabled for this thread' });
                return;
            }

        }
    },

};