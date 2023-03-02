import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import { pool } from '../helpers/createPool.js';
import { SlashCommand } from '../types/slash-command-base';

/**
 * Command to change a users subscription to the RMT ping system
 * @param data SlashCommandBuilder() instance from discord.js
 * @returns Replies Pong! in the chat
 *
 * Can be used as a template for future commands
 */
export const command: SlashCommand = {
    global: false,
    // setup the slash command builder
    data: new SlashCommandBuilder()
        .setName('rmtpings')
        .setDescription('Sets your subscription to the ping system for new RMTs based on your set Discord status')
        .addStringOption(option =>
            option.setName('status')
            .setDescription('You will be pinged only when you are...')
            .addChoices(
                { name: 'Online (Green)', value: 'Online' },
                { name: 'Idle (Yellow)', value: 'Idle' },
                { name: 'Busy (Red)', value: 'Busy' },
                { name: 'Offline/Invisible', value: 'Offline' },
                { name: 'Available (Green/Yellow)', value: 'Avail' },
                { name: 'Around (Green/Yellow/Red)', value: 'Around' },
                { name: 'All', value: 'All' },
                { name: 'None', value: 'None' },
            )
            .setRequired(true))
        .setDefaultMemberPermissions(0),

    // execute our desired task
    async execute(interaction: ChatInputCommandInteraction) {
        await interaction.deferReply({ ephemeral: true });
        // get their selection
        const status = interaction.options.getString('status');
        // and the id of the person who used the command
        const uid = interaction.user.id;

        // typecheck
        if (status === null) {
            return;
        }

        // update the value in the raters postgres table
        // the table schema defaults to All for everyone
        // query the raters table for their ID
        const res = await pool.query('SELECT ping FROM chatot.raters WHERE userid=$1', [uid]);
        const dbmatches: { ping: string}[] | [] = res.rows;

        if (dbmatches.length) {
            await pool.query('UPDATE chatot.raters SET ping=$1 WHERE userid=$2', [status, uid]);
            await interaction.followUp({ content: 'Your preferences have been updated.', ephemeral: true });
            return;
        }
        else {
            await interaction.followUp({ content: 'You are not currently setup to rate any teams. You must be added to the lists first before you can update your preferences.', ephemeral: true });
            return;
        }
        
    },
};