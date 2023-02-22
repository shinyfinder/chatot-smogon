import { SlashCommandBuilder, ChatInputCommandInteraction, SlashCommandSubcommandBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, ModalActionRowComponentBuilder, ModalSubmitInteraction } from 'discord.js';
import { SlashCommand } from '../types/slash-command-base';
import { pool } from '../helpers/createPool.js';
import type { Pool } from 'pg';

/**
 * Command to post FAQs to the chat, optionally which one.
 *
 * Subcommands are add, remove, and list
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
                .setDescription('Adds a FAQ to the list'),
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
                .setName('edit')
                .setDescription('Edits an existing FAQ entry')
                .addStringOption(option =>
                    option.setName('name')
                    .setDescription('Unique identifier for the FAQ')
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

        /**
         * ADD FAQ
         * Subcommand to add an faq to the list
         * FAQs are stored separately for each server
         */
        if (interaction.options.getSubcommand() === 'add') {
            // instantiate a modal for user input
            const modal = new ModalBuilder()
                .setCustomId('mymodal')
                .setTitle('Add FAQ');

            // create the text fields for the modal
            const nameInput = new TextInputBuilder()
                .setCustomId('nameInput')
                .setLabel('Unique name of FAQ')
                .setStyle(TextInputStyle.Short);

            const faqInput = new TextInputBuilder()
            .setCustomId('faqInput')
            .setLabel('FAQ')
            .setStyle(TextInputStyle.Paragraph);

            // add an action row to hold the text inputs
            // an action row can only hold 1 text input, so you need 1 per input
            const nameActionRow = new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents(nameInput);
            const faqActionRow = new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents(faqInput);

            // add the inputs to the modal
            modal.addComponents(nameActionRow, faqActionRow);

            // show the modal to the user
            await interaction.showModal(modal);

            // await their input
            const filter = (modalInteraction: ModalSubmitInteraction) => modalInteraction.customId === 'mymodal';
            await interaction.awaitModalSubmit({ filter, time: 5 * 60 * 1000 })
                .then(async (submittedModal) => {
                    await submittedModal.deferReply({ ephemeral: true });

                    const txt = submittedModal.fields.getTextInputValue('faqInput');
                    const name = submittedModal.fields.getTextInputValue('nameInput').toLowerCase();
                    // query the database for the list of faqs for this server
                    // let dbmatches: { name: string, faq: string}[] | [];
                    const dbmatches: { name: string, faq: string}[] | [] | undefined = await getdb(interaction, pool, serverID);

                    if (dbmatches === undefined) {
                        return;
                    }

                    // check if the identifier already exists
                    // technically postgres checks for this if name is set to the primary key, but we check anyway to let the user know
                    if (dbmatches.length) {
                        const nameExists = dbmatches.some(e => e.name.toLowerCase() === name);
                        if (nameExists) {
                            await submittedModal.followUp({ content: 'Identifier by this name already exists. Please specify a new one.', ephemeral: true });
                            return;
                        }
                    }

                    // append new entry to the faqs for this server
                    try {
                        await pool.query('INSERT INTO chatot.faqs (name, serverid, faq) VALUES ($1, $2, $3)', [name, serverID, txt]);
                        await submittedModal.followUp({ content: `Entry added to the list of FAQs for this server as ${name}`, ephemeral: true });
                        return;
                    }
                    catch (err) {
                        console.error(err);
                        await submittedModal.followUp({ content: 'An error occurred writing the database.', ephemeral: true });
                        return;
                    }
                })
                .catch(err => console.error(err));
        }

        /**
         * REMOVE FAQ
         * Subcommand to remove and faq from the list
         * FAQs are stored separately for each server
         */
        else if (interaction.options.getSubcommand() === 'remove') {
            await interaction.deferReply({ ephemeral: true });
            // get the entered text
            const name = interaction.options.getString('name')?.toLowerCase();

            // type check the entered text
            if (name === undefined) {
                return;
            }

            // query the database for the list of faqs for this server
            const dbmatches: { name: string, faq: string}[] | [] | undefined = await getdb(interaction, pool, serverID);
            if (dbmatches === undefined) {
                return;
            }

            // check to make sure this entry exists in the database
            if (dbmatches.length) {
                const nameExists = dbmatches.some(e => e.name.toLowerCase() === name);
                if (!nameExists) {
                    await interaction.followUp({ content: 'There are no FAQs by that name for this server', ephemeral: true });
                    return;
                }
            }
            else {
                await interaction.followUp({ content: 'There are no FAQs for this server', ephemeral: true });
                return;
            }

            // remove the selected entry
            try {
                await pool.query('DELETE FROM chatot.faqs WHERE serverid=$1 AND name=$2', [serverID, name]);
                await interaction.followUp({ content: 'Entry removed from the list of FAQs for this server.', ephemeral: true });
            }
            catch (err) {
                console.error(err);
                await interaction.followUp({ content: 'An error occurred writing the database.', ephemeral: true });
            }

        }

        /**
         * EDIT FAQ
         * Edits an existing FAQ for the server
         */
        else if (interaction.options.getSubcommand() === 'edit') {
            // get the entered text
            const name = interaction.options.getString('name')?.toLowerCase();

            // type check the entered text
            if (name === undefined) {
                return;
            }

            const dbmatches: { name: string, faq: string}[] | [] | undefined = await getdb(interaction, pool, serverID);

            if (dbmatches === undefined) {
                return;
            }
            // check to make sure this entry exists in the database
            if (dbmatches.length) {
                const nameExists = dbmatches.some(e => e.name.toLowerCase() === name);
                if (!nameExists) {
                    await interaction.reply({ content: 'There are no FAQs by that name for this server', ephemeral: true });
                    return;
                }
            }
            else {
                await interaction.reply({ content: 'There are no FAQs for this server', ephemeral: true });
                return;
            }

            // update the selected entry
            // instantiate a modal for user input
            const modal = new ModalBuilder()
                .setCustomId('mymodal')
                .setTitle(`Edit FAQ ${name}`);

            const faqInput = new TextInputBuilder()
            .setCustomId('faqInput')
            .setLabel('FAQ')
            .setStyle(TextInputStyle.Paragraph)
            .setValue(dbmatches[0].faq);

            // add an action row to hold the text inputs
            // an action row can only hold 1 text input, so you need 1 per input
            const faqActionRow = new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents(faqInput);

            // add the inputs to the modal
            modal.addComponents(faqActionRow);

            // show the modal to the user
            await interaction.showModal(modal);

            // await their input
            const filter = (modalInteraction: ModalSubmitInteraction) => modalInteraction.customId === 'mymodal';
            await interaction.awaitModalSubmit({ filter, time: 5 * 60 * 1000 })
                .then(async (submittedModal) => {
                    await submittedModal.deferReply({ ephemeral: true });
                    const txt = submittedModal.fields.getTextInputValue('faqInput');
                    try {
                        await pool.query('UPDATE chatot.faqs SET faq=$1 WHERE serverid=$2 AND name=$3', [txt, serverID, name]);
                        await submittedModal.followUp({ content: `Updated FAQ ${name} for this server.`, ephemeral: true });
                    }
                    catch (err) {
                        console.error(err);
                        await submittedModal.followUp({ content: 'An error occurred writing the database.', ephemeral: true });
                    }
                })
                .catch(err => console.error(err));
        }

        /**
         * LIST FAQ
         * Lists all of the FAQs for the server the command was used in
         */
        else {
            // get the entered text
            const name = interaction.options.getString('name')?.toLowerCase();

            // defer reply
            // if they specified a specific faq, print it publically to the chat
            // otherwise, keep the reponse hidden
            if (name) {
                await interaction.deferReply();
            }
            else {
                await interaction.deferReply({ ephemeral: true });
            }
            const dbmatches: { name: string, faq: string}[] | [] | undefined = await getdb(interaction, pool, serverID);

            // an error occurred and we already let them know
            if (dbmatches === undefined) {
                return;
            }

            // if there are no db entries for this server, return
            if (!dbmatches.length) {
                await interaction.followUp({ content: 'There are no FAQs for this server' });
                return;
            }

            // if they didn't provide a name, list all of them
            const nameArr: string[] = [];
            if (name === undefined) {
                for (const entry of dbmatches) {
                    nameArr.push(entry.name.toLowerCase());
                }
                const strOut = nameArr.join(', ');
                await interaction.followUp(`Server FAQs: ${strOut}`);
                return;
            }
            // else, list the one they specified
            else {
                // try to find the name they specified
                const obj = dbmatches.find(e => e.name.toLowerCase() === name);
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

async function getdb(interaction: ChatInputCommandInteraction, db: Pool, serverID: string) {
    // query the database for the list of faqs for this server
    let dbmatches: { name: string, faq: string}[] | [];
    try {
        const ratersPostgres = await db.query('SELECT name, faq FROM chatot.faqs WHERE serverid = $1', [serverID]);
        dbmatches = ratersPostgres.rows;
        return dbmatches;
    }
    catch (err) {
        console.error(err);
        await interaction.followUp({ content: 'An error occurred polling the database.', ephemeral: true });
        return undefined;
    }
}