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
import { getRandInt } from '../helpers/getRandInt.js';
import { checkChanPerms } from '../helpers/checkChanPerms.js';
import { botConfig } from '../config.js';
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
            .setDescription('Edits the provided Chatot post if it was made with /modpost create')
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
                .setMinLength(1)
                .setMaxLength(1925)
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

            // we defer the reply because discord can be a bit finnicky when it comes to modals
            // it might hang, especially if there is a lot of text
            await submittedModal.deferReply({ ephemeral: true });

            // get what they entered
            let modMsg = submittedModal.fields.getTextInputValue(`modpost-text-${randInt}`);

            // get the unix time
            const dateUnix = Math.floor(Date.now() / 1000);

            // construct the object needed for discord
            const cordTime = `<t:${dateUnix}:f>`;

            // sign the message
            modMsg += `\n\nLast modpost edit: ${interaction.user.username} ${cordTime}`;

            // respond with their message
            await chan.send(modMsg);

            // done
            await submittedModal.followUp({ content: 'Post made', ephemeral: true });
        }

        /**
         * Edit
         */

        if (interaction.options.getSubcommand() === 'edit') {
            
            // get the info they entered
            const url = interaction.options.getString('url', true);

            // split the url
            // goes discord.com/channels/{server id}/{channel id}/{message id}
            const idMatchArr = url.match(/\d+/g);
            
            // validate the input
            if (!idMatchArr) {
                await interaction.reply({ content: 'Invalid input. Please proivde the link to the message.', ephemeral: true });
                return;
            }
            else if (idMatchArr.length !== 3) {
                await interaction.reply({ content: 'Did you give me the right link? Please provide a link to the message, not just the ID of the message.', ephemeral: true });
                return;
            }
                       
            // try to fetch the channel
            const chan = interaction.client.channels.cache.get(idMatchArr[1]);

            if (!chan) {
                await interaction.reply({ content: 'Invalid channel id; I don\'t recognize that channel', ephemeral: true });
                return;
            }
            else if (chan.type !== ChannelType.GuildText) {
                await interaction.reply({ content: 'Invalid channel id; I don\'t recognize that channel', ephemeral: true });
                return;
            }
           
            if (chan.guildId !== interaction.guildId) {
                await interaction.reply({ content: 'Channel must be in this server!', ephemeral: true });
                return;
            }

            // fetch the mesage
            const msg = await chan.messages.fetch(idMatchArr[2]);
           
            // make sure we're the author
            if (msg.author.id !== botConfig.CLIENT_ID) {
                await interaction.reply({ content: 'I can only edit messages I am the author of', ephemeral: true });
                return;
            }
            // make sure it includes the signature so they don't pass a random message of ours
            else if (!/Last modpost edit: /.test(msg.content)) {
                await interaction.reply({ content: 'I can only edit messages made via the modpost command', ephemeral: true });
                return;
            }

            // at this point we should (finally) have validated the use case
            // before we can show them the modal, strip the signature line
            const unsignedText = msg.content.replace(/\n\nLast modpost edit:.*/, '');

            // now show them the modal
            
            // get rand int to uniquely id the modal
            const randInt = getRandInt(0, 65535);

            // instantiate a modal for user input
            const modal = new ModalBuilder()
                .setCustomId(`modpost-edit-${randInt}`)
                .setTitle('Edit Mod Post');

            const msgTextInput = new TextInputBuilder()
                .setCustomId(`modpost-edit-text-${randInt}`)
                .setLabel('Message')
                .setStyle(TextInputStyle.Paragraph)
                .setMinLength(1)
                .setMaxLength(1925)
                .setValue(unsignedText)
                .setRequired(true);

            // add an action row to hold the text inputs
            // an action row can only hold 1 text input, so you need 1 per input
            const msgActionRow = new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents(msgTextInput);

            // add the inputs to the modal
            modal.addComponents(msgActionRow);

            // show the modal to the user
            await interaction.showModal(modal);
            
            // await their input
            const filter = (modalInteraction: ModalSubmitInteraction) => modalInteraction.customId === `modpost-edit-${randInt}` && modalInteraction.user.id === interaction.user.id;
            
            // wait for them to submit the modal
            const submittedModal = await interaction.awaitModalSubmit({ filter, time: 5 * 60 * 1000 });

            // we defer because it can hang sometimes
            await submittedModal.deferReply({ ephemeral: true });

            // get what they entered
            let modMsg = submittedModal.fields.getTextInputValue(`modpost-edit-text-${randInt}`);

            // get the unix time
            const dateUnix = Math.floor(Date.now() / 1000);

            // construct the object needed for discord
            const cordTime = `<t:${dateUnix}:f>`;

            // sign the message
            modMsg += `\n\nLast modpost edit: ${interaction.user.username} ${cordTime}`;

            // respond with their message
            await msg.edit(modMsg);

            // done
            await submittedModal.followUp({ content: 'Post edited', ephemeral: true });
            
        }
        
    },

};