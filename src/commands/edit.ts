import { 
    ContextMenuCommandBuilder,
    ApplicationCommandType,
    MessageContextMenuCommandInteraction,
    PermissionFlagsBits,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    ActionRowBuilder,
    ModalActionRowComponentBuilder,
    ModalSubmitInteraction,
 } from 'discord.js';
import { ContextCommand } from '../types/context-command-base';
import { botConfig } from '../config.js';
import { getRandInt } from '../helpers/getRandInt.js';
/**
 * Context menu command to keep a message pinned to the top of the pins list in a channel
 */
export const command: ContextCommand = {
    global: true,
    guilds: [],
    // setup the slash command builder
    data: new ContextMenuCommandBuilder()
        .setName('edit')
        .setType(ApplicationCommandType.Message)
        .setDMPermission(false)
        .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),

    // execute our desired task
    async execute(interaction: MessageContextMenuCommandInteraction) {
        // fetch the mesage
        const msg = interaction.targetMessage;
    
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
    },
};