import { SlashCommandBuilder, ChatInputCommandInteraction, SlashCommandSubcommandBuilder } from 'discord.js';
import { SlashCommand } from '../types/slash-command-base';
import { pool } from '../helpers/createPool.js';

/**
 * Command to post FAQs to the chat, optionally which one.
 * @param data SlashCommandBuilder() instance from discord.js
 * @returns Replies Pong! in the chat
 *
 * Can be used as a template for future commands
 */

export const command: SlashCommand = {
    // setup the slash command builder
    data: new SlashCommandBuilder()
        .setName('rfaq')
        .setDescription('Replies with the list of FAQs, optionally specifying which')
        .setDMPermission(false)
        .setDefaultMemberPermissions(0)
        .addSubcommand(new SlashCommandSubcommandBuilder()
                .setName('add')
                .setDescription('Adds a FAQ to the list')
                .addStringOption(option =>
                    option.setName('name')
                    .setDescription('Unique identifier for this faq')
                    .setRequired(true))
                .addStringOption(option =>
                    option.setName('faq')
                    .setDescription('Text the user is supposed to read')
                    .setRequired(true)),
        )
        .addSubcommand(
            new SlashCommandSubcommandBuilder()
                .setName('remove')
                .setDescription('Removes a FAQ from the list')
                .addStringOption(option =>
                    option.setName('name')
                    .setDescription('Unique identifier for this faq')
                    .setRequired(true)),
        )
        .addSubcommand(
            new SlashCommandSubcommandBuilder()
                .setName('list')
                .setDescription('Lists the FAQs, optionally specifying which')
                .addStringOption(option =>
                    option.setName('name')
                    .setDescription('Unique identifier for the FAQ')
                    .setRequired(false)),
        ),
    // execute our desired task
    async execute(interaction: ChatInputCommandInteraction) {
        const serverID = interaction.guildId;
        if (serverID === null) {
            return;
        }

        await interaction.deferReply();
        // query the database for the list of faqs for this server
        let dbmatches: { name: string, faq: string}[] | [];
        try {
            const ratersPostgres = await pool.query('SELECT name, faq FROM chatot.faqs WHERE serverid = $1', [serverID]);
            dbmatches = ratersPostgres.rows;

        }
        catch (err) {
            console.error(err);
            await interaction.followUp({ content: 'An error occurred polling the database.' });
            return;
        }


        /**
         * ADD FAQ
         * Subcommand to add an faq to the list
         * FAQs are stored separately for each server
         */
        if (interaction.options.getSubcommand() === 'add') {
            // get the entered text
            const txt = interaction.options.getString('faq');
            const name = interaction.options.getString('name');

            // typecheck
            if (txt === null || name === null) {
                return;
            }

            // check if the identifier already exists
            // technically postgres checks for this if name is set to the primary key, but we check anyway to let the user know
            if (dbmatches.length) {
                const nameExists = dbmatches.some(e => e.name === name);
                if (nameExists) {
                    await interaction.followUp({ content: 'Identifier by this name already exists. Please specify a new one.' });
                    return;
                }
            }

            // append new entry to the faqs for this server
            try {
                await pool.query('INSERT INTO chatot.faqs (name, serverid, faq) VALUES ($1, $2, $3)', [name, serverID, txt]);
                await interaction.followUp({ content: `Entry added to the list of FAQs for this server as ${name}` });
            }
            catch (err) {
                console.error(err);
                await interaction.followUp({ content: 'An error occurred writing the database.' });
            }
        }

        /**
         * REMOVE FAQ
         * Subcommand to remove and faq from the list
         * FAQs are stored separately for each server
         */
        else if (interaction.options.getSubcommand() === 'remove') {
            // get the entered text
            const name = interaction.options.getString('name');

            // type check the entered text
            if (name === null) {
                return;
            }

            // check to make sure this entry exists in the database
            if (dbmatches.length) {
                const nameExists = dbmatches.some(e => e.name === name);
                if (!nameExists) {
                    await interaction.followUp({ content: 'There are no FAQs by that name for this server' });
                    return;
                }
            }
            else {
                await interaction.followUp({ content: 'There are no FAQs for this server' });
                return;
            }

            // remove the selected entry
            try {
                await pool.query('DELETE FROM chatot.faqs WHERE serverid=$1 AND name=$2', [serverID, name]);
                await interaction.followUp({ content: 'Entry removed from the list of FAQs for this server.' });
            }
            catch (err) {
                console.error(err);
                await interaction.followUp({ content: 'An error occurred writing the database.' });
            }

        }

        /**
         * LIST FAQ
         * Lists all of the FAQs for the server the command was used in
         */
        else {
            // if there are no db entries for this server, return
            if (!dbmatches.length) {
                await interaction.followUp({ content: 'There are no FAQs for this server' });
                return;
            }
            // get the entered text
            const name = interaction.options.getString('name');

            // if they didn't provide a name, list all of them
            let strOut = '';
            if (name === null) {
                for (let i = 0; i < dbmatches.length; i++) {
                    strOut += `${i + 1}. ${dbmatches[i].faq}\n\n`;

                }
                await interaction.followUp(strOut);
                return;
            }
            // else, list the one they specified
            else {
                // try to find the name they specified
                const obj = dbmatches.find(e => e.name === name);
                if (obj === undefined) {
                    await interaction.followUp({ content: 'There are no FAQs by that name for this server' });
                    return;
                }
                else {
                    await interaction.followUp({ content: obj.faq });
                }
            }

        }
    },

};