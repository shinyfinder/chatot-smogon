import {
    SlashCommandBuilder,
    ChatInputCommandInteraction,
    PermissionFlagsBits,
    SlashCommandSubcommandBuilder,
    ChannelType,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    ActionRowBuilder,
    ModalActionRowComponentBuilder,
    ModalSubmitInteraction,
 } from 'discord.js';
import { SlashCommand } from '../types/slash-command-base';
import { pool } from '../helpers/createPool.js';
import { getRandInt } from '../helpers/getRandInt.js';
import { checkChanPerms } from '../helpers/checkChanPerms.js';
/**
 * Posts a message to the specific channel with the provided content.
 * Also allows the post to be edited.
 */

export const command: SlashCommand = {
    global: true,
    guilds: [],
    // setup the slash command builder
    data: new SlashCommandBuilder()
        .setName('modpost')
        .setDescription('Posts/edits a message to the provided channel')
        .addSubcommand(new SlashCommandSubcommandBuilder()
            .setName('create')
            .setDescription('Posts a message to the specified channel')
            .addChannelOption(option =>
                option.setName('channel')
                .setDescription('The channel where the post will be made')
                .setRequired(true)
                .addChannelTypes(ChannelType.GuildText, ChannelType.PublicThread)))
        .addSubcommand(new SlashCommandSubcommandBuilder()
            .setName('edit')
            .setDescription('Edits the provided Chatot post. Must be text only.')
            .addStringOption(option =>
                option.setName('url')
                .setDescription('The link to the message. Right click/long press > Copy Message Link')
                .setRequired(true)))
        .setDMPermission(false)
        .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),
    // execute our desired task
    async execute(interaction: ChatInputCommandInteraction) {

        /**
         * CREATE
         */

        if (interaction.options.getSubcommand() === 'create') {
            // get the info they entered
            const chan = interaction.options.getChannel('channel', true, [ChannelType.GuildText, ChannelType.PublicThread]);

            // make sure we have the necessary perms to post there
            let canComplete = true;
            if (chan.type === ChannelType.PublicThread) {
                canComplete = await checkChanPerms(interaction, chan, ['ViewChannel', 'SendMessagesInThreads']);
            }
            else if (chan.type === ChannelType.GuildText) {
                canComplete = await checkChanPerms(interaction, chan, ['ViewChannel', 'SendMessages']);
            }

            if (!canComplete) {
                return;
            }

            // get rand int to uniquely id the modal
            const randInt = getRandInt(0, 65535);

            // instantiate a modal for user input
            const modal = new ModalBuilder()
                .setCustomId(`modpost${randInt}`)
                .setTitle('New Mod Post');

            const msgTextInput = new TextInputBuilder()
                .setCustomId(`modpost-text-${randInt}`)
                .setLabel('Message')
                .setStyle(TextInputStyle.Paragraph)
                .setRequired(true);

            // add an action row to hold the text inputs
            // an action row can only hold 1 text input, so you need 1 per input
            const msgActionRow = new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents(msgTextInput);

            // add the inputs to the modal
            modal.addComponents(msgActionRow);

            // show the modal to the user
            await interaction.showModal(modal);
            
            // await their input
            const filter = (modalInteraction: ModalSubmitInteraction) => modalInteraction.customId === `modpost${randInt}` && modalInteraction.user.id === interaction.user.id;
            
            // wait for them to submit the modal
            const submittedModal = await interaction.awaitModalSubmit({ filter, time: 5 * 60 * 1000 });

            const modMsg = submittedModal.fields.getTextInputValue(`modpost-text-${randInt}`);

            // respond with their message
            await chan.send(modMsg);

            // done
            await interaction.followUp({ content: 'Post made', ephemeral: true });
        }

        /**
         * Edit
         */

        if (interaction.options.getSubcommand() === 'edit') {
            /*
            // get the info they entered
            const url = interaction.options.getString('url', true);

            // split the url

            // make sure we have the necessary perms to post there
            let canComplete = true;
            if (chan.type === ChannelType.PublicThread) {
                canComplete = await checkChanPerms(interaction, chan, ['ViewChannel', 'SendMessagesInThreads']);
            }
            else if (chan.type === ChannelType.GuildText) {
                canComplete = await checkChanPerms(interaction, chan, ['ViewChannel', 'SendMessages']);
            }

            if (!canComplete) {
                return;
            }

            // get rand int to uniquely id the modal
            const randInt = getRandInt(0, 65535);

            // instantiate a modal for user input
            const modal = new ModalBuilder()
                .setCustomId(`modpost${randInt}`)
                .setTitle('New Mod Post');

            const msgTextInput = new TextInputBuilder()
                .setCustomId(`modpost-text-${randInt}`)
                .setLabel('Message')
                .setStyle(TextInputStyle.Paragraph)
                .setRequired(true);

            // add an action row to hold the text inputs
            // an action row can only hold 1 text input, so you need 1 per input
            const msgActionRow = new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents(msgTextInput);

            // add the inputs to the modal
            modal.addComponents(msgActionRow);

            // show the modal to the user
            await interaction.showModal(modal);
            
            // await their input
            const filter = (modalInteraction: ModalSubmitInteraction) => modalInteraction.customId === `modpost${randInt}` && modalInteraction.user.id === interaction.user.id;
            
            // wait for them to submit the modal
            const submittedModal = await interaction.awaitModalSubmit({ filter, time: 5 * 60 * 1000 });

            const modMsg = submittedModal.fields.getTextInputValue(`modpost-text-${randInt}`);

            // respond with their message
            await chan.send(modMsg);

            // done
            await interaction.followUp({ content: 'Post made', ephemeral: true });
            */
            await interaction.followUp('wip');
        }
        
    },

};