import {
    SlashCommandBuilder,
    ChatInputCommandInteraction,
    PermissionFlagsBits,
    ChannelType,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    ActionRowBuilder,
    ModalActionRowComponentBuilder,
    ModalSubmitInteraction,
    SnowflakeUtil,
 } from 'discord.js';
import { SlashCommand } from '../types/slash-command-base';
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
        .setDescription('Posts a message to the provided channel')
        .addChannelOption(option =>
            option.setName('channel')
            .setDescription('The channel where the post will be made')
            .setRequired(true)
            .addChannelTypes(ChannelType.GuildText, ChannelType.PublicThread))
        .setDMPermission(false)
        .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers) as SlashCommandBuilder,
    // execute our desired task
    async execute(interaction: ChatInputCommandInteraction) {
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
        await chan.send({ content: modMsg, enforceNonce: true, nonce: SnowflakeUtil.generate().toString() });

        // done
        await submittedModal.followUp({ content: 'Post made', ephemeral: true });
        
    },

};