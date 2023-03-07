import { SlashCommandBuilder, ChatInputCommandInteraction, SlashCommandSubcommandBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, ModalActionRowComponentBuilder, ModalSubmitInteraction } from 'discord.js';
import { SlashCommand } from '../types/slash-command-base';
import { pool } from '../helpers/createPool.js';
import type { Pool } from 'pg';
import { addCustoms, editCustom, removeCustom } from '../helpers/manageCustomsCache.js';

/**
 * Command to post FAQs to the chat, optionally which one.
 *
 * Subcommands are add, remove, and list
 */

export const command: SlashCommand = {
    global: true,
    // setup the slash command builder
    data: new SlashCommandBuilder()
        .setName('custom')
        .setDescription('Manages the custom commands of the server')
        .setDMPermission(false)
        .setDefaultMemberPermissions(0)
        .addSubcommand(new SlashCommandSubcommandBuilder()
                .setName('add')
                .setDescription('Registers a custom prefix command to the bot'),
        )
        .addSubcommand(
            new SlashCommandSubcommandBuilder()
                .setName('remove')
                .setDescription('Removes a custom prefix command from the bot')
                .addStringOption(option =>
                    option.setName('name')
                    .setDescription('Unique identifier for this command (do not include prefix)')
                    .setRequired(true)),
        )
        .addSubcommand(
            new SlashCommandSubcommandBuilder()
                .setName('edit')
                .setDescription('Edits an existing custom command')
                .addStringOption(option =>
                    option.setName('name')
                    .setDescription('Unique identifier for the FAQ')
                    .setRequired(true)),
        )
        .addSubcommand(
            new SlashCommandSubcommandBuilder()
                .setName('list')
                .setDescription('Lists the custom commands in the server'),
        ),
    // execute our desired task
    async execute(interaction: ChatInputCommandInteraction) {
        const serverID = interaction.guildId;
        if (serverID === null) {
            return;
        }

        /**
         * ADD CUSTOM COMMAND
         * Subcommand to add an command to the list
         * Customs are stored separately for each server
         */
        if (interaction.options.getSubcommand() === 'add') {
            // instantiate a modal for user input
            const modal = new ModalBuilder()
                .setCustomId('mymodal')
                .setTitle('New Custom Command');

            // create the text fields for the modal
            const prefixInput = new TextInputBuilder()
                .setCustomId('prefixInput')
                .setLabel('Prefix')
                .setMaxLength(1)
                .setRequired(true)
                .setStyle(TextInputStyle.Short);

            const nameInput = new TextInputBuilder()
                .setCustomId('nameInput')
                .setLabel('Unique name of command')
                .setStyle(TextInputStyle.Short)
                .setRequired(true);

            const cmdInput = new TextInputBuilder()
                .setCustomId('cmdInput')
                .setLabel('Prints')
                .setStyle(TextInputStyle.Paragraph)
                .setRequired(true);

            // add an action row to hold the text inputs
            // an action row can only hold 1 text input, so you need 1 per input
            const prefixActionRow = new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents(prefixInput);
            const nameActionRow = new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents(nameInput);
            const cmdActionRow = new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents(cmdInput);

            // add the inputs to the modal
            modal.addComponents(prefixActionRow, nameActionRow, cmdActionRow);

            // show the modal to the user
            await interaction.showModal(modal);
            
            // await their input
            const filter = (modalInteraction: ModalSubmitInteraction) => modalInteraction.customId === 'mymodal';
            
            // wait for them to submit the modal
            const submittedModal = await interaction.awaitModalSubmit({ filter, time: 5 * 60 * 1000 });

            // on submit, defer our reply so we can process it
            await submittedModal.deferReply({ ephemeral: true });

            // get the info they entered
            const txt = submittedModal.fields.getTextInputValue('cmdInput');
            const name = submittedModal.fields.getTextInputValue('nameInput').toLowerCase();
            const prefix = submittedModal.fields.getTextInputValue('prefixInput');

            // make sure the name isn't blank
            if (!/\S/.test(name)) {
                await submittedModal.followUp('Name cannot be blank');
                return;
            }

            // make sure the prefix is a special character
            if (!/^[!@$%&+=._-]+$/.test(prefix)) {
                await submittedModal.followUp(`Prefix must be one of the following: ${'!@$%&+=._-'}`);
                return;
            }
            
            // query the database for the list of faqs for this server
            const dbmatches: { cmd: string, txt: string, prefix: string}[] | [] | undefined = await getdb(interaction, pool, serverID);

            if (dbmatches === undefined) {
                return;
            }

            // check if the identifier already exists
            // technically postgres checks for this if name is set to the primary key, but we check anyway to let the user know
            if (dbmatches.length) {
                const nameExists = dbmatches.some(e => e.cmd === name);
                if (nameExists) {
                    await submittedModal.followUp({ content: 'Identifier by this name already exists. Please specify a new one.', ephemeral: true });
                    return;
                }
            }

            // append new entry to the faqs for this server
            try { 
                await pool.query('INSERT INTO chatot.customs (serverid, cmd, txt, prefix) VALUES ($1, $2, $3, $4)', [serverID, name, txt, prefix]);
                await submittedModal.followUp({ content: `Added '${prefix}${name}' to the chat`, ephemeral: true });
                // update the cached list
                const newCommnad = {
                    serverid: serverID,
                    cmd: name,
                    txt: txt,
                    prefix: prefix,
                };
                addCustoms(newCommnad);
                return;
            }
            catch (err) {
                await submittedModal.followUp('An error occurred updating the database');
                throw err;
            }
            
        }

        /**
         * REMOVE CUSTOM
         * Subcommand to remove a custom command from the list
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
            const dbmatches: { cmd: string, txt: string, prefix: string}[] | [] | undefined = await getdb(interaction, pool, serverID);
            if (dbmatches === undefined) {
                return;
            }

            // check to make sure this entry exists in the database
            if (dbmatches.length) {
                const nameExists = dbmatches.some(e => e.cmd === name);
                if (!nameExists) {
                    await interaction.followUp({ content: 'There are no custom commands by that name for this server', ephemeral: true });
                    return;
                }
            }
            else {
                await interaction.followUp({ content: 'There are no custom commands for this server', ephemeral: true });
                return;
            }

            // remove the selected entry
            await pool.query('DELETE FROM chatot.customs WHERE serverid=$1 AND cmd=$2', [serverID, name]);
            await interaction.followUp({ content: 'Entry removed from the list of custom commands for this server.', ephemeral: true });
            // update the cache
            const oldCustom = {
                serverid: serverID,
                cmd: name,
                txt: dbmatches[0].txt,
                prefix: dbmatches[0].prefix,
            };
            removeCustom(oldCustom);
            return;
        }

        /**
         * EDIT CUSTOM
         */
        else if (interaction.options.getSubcommand() === 'edit') {
            // get the entered text
            const name = interaction.options.getString('name')?.toLowerCase();

            // type check the entered text
            if (name === undefined) {
                return;
            }

            const dbmatches: { cmd: string, txt: string, prefix: string}[] | [] | undefined = await getdb(interaction, pool, serverID);

            if (dbmatches === undefined) {
                return;
            }
            // check to make sure this entry exists in the database
            if (dbmatches.length) {
                const nameExists = dbmatches.some(e => e.cmd === name);
                if (!nameExists) {
                    await interaction.reply({ content: 'There are no custom commands by that name for this server', ephemeral: true });
                    return;
                }
            }
            else {
                await interaction.reply({ content: 'There are no custom commands for this server', ephemeral: true });
                return;
            }

            // get the index of the matches values
            const index = dbmatches.findIndex(row => row.cmd === name);

            // update the selected entry
            // instantiate a modal for user input
            const modal = new ModalBuilder()
                .setCustomId('mymodal')
                .setTitle(`Edit Command ${name}`);

            
            const prefixInput = new TextInputBuilder()
            .setCustomId('prefixInput')
            .setLabel('Prefix')
            .setStyle(TextInputStyle.Short)
            .setValue(dbmatches[index].prefix);

            const cmdInput = new TextInputBuilder()
            .setCustomId('cmdInput')
            .setLabel('Prints')
            .setStyle(TextInputStyle.Paragraph)
            .setValue(dbmatches[index].txt);

            // add an action row to hold the text inputs
            // an action row can only hold 1 text input, so you need 1 per input
            const prefixActionRow = new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents(prefixInput);
            const cmdActionRow = new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents(cmdInput);

            // add the inputs to the modal
            modal.addComponents(prefixActionRow, cmdActionRow);

            // show the modal to the user
            await interaction.showModal(modal);

            // await their input
            const filter = (modalInteraction: ModalSubmitInteraction) => modalInteraction.customId === 'mymodal';
            const submittedModal = await interaction.awaitModalSubmit({ filter, time: 5 * 60 * 1000 });

            // defer the reply to their submission so we can process it
            await submittedModal.deferReply({ ephemeral: true });

            // get their entered text
            const prefix = submittedModal.fields.getTextInputValue('prefixInput');
            const txt = submittedModal.fields.getTextInputValue('cmdInput');
            
            // update the db
            try {
                await pool.query('UPDATE chatot.customs SET txt=$1, prefix=$2 WHERE serverid=$3 AND cmd=$4', [txt, prefix, serverID, name]);
                await submittedModal.followUp({ content: `Updated custom '${name}' utilizing prefix '${prefix}' for this server.`, ephemeral: true });
                const newCommnad = {
                    serverid: serverID,
                    cmd: name,
                    txt: txt,
                    prefix: prefix,
                };
                editCustom(newCommnad);
                return;
            }
            catch (err) {
                await submittedModal.followUp('An error occurred updating the database');
                throw err;
            }
            
        }

        /**
         * LIST CUSTOM
         * Lists all of the custom commands for the server the command was used in
         */
        else {
            await interaction.deferReply({ ephemeral: true });
            
            const dbmatches: { cmd: string, txt: string, prefix: string}[] | [] | undefined = await getdb(interaction, pool, serverID);

            // an error occurred and we already let them know
            if (dbmatches === undefined) {
                return;
            }

            // if there are no db entries for this server, return
            if (!dbmatches.length) {
                await interaction.followUp({ content: 'There are no custom commands for this server' });
                return;
            }

            // if they didn't provide a name, list all of them
            const cmdArr: string[] = [];
            
            for (const entry of dbmatches) {
                const prefixedCommand = `${entry.prefix}${entry.cmd}`;
                cmdArr.push(prefixedCommand);
            }
            const strOut = cmdArr.join(', ');
            await interaction.followUp(`Server Custom Commands: ${strOut}`);
            return;
            

        }
    },

};

async function getdb(interaction: ChatInputCommandInteraction, db: Pool, serverID: string) {
    // query the database for the list of faqs for this server
    let dbmatches: { cmd: string, txt: string, prefix: string}[] | [];
    try {
        const customsPostgres = await db.query('SELECT cmd, txt, prefix FROM chatot.customs WHERE serverid = $1', [serverID]);
        dbmatches = customsPostgres.rows;
        return dbmatches;
    }
    catch (err) {
        console.error(err);
        await interaction.followUp({ content: 'An error occurred polling the database.', ephemeral: true });
        return undefined;
    }
}