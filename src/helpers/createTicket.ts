import { ButtonInteraction, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, ModalActionRowComponentBuilder, ModalSubmitInteraction, ChannelType } from 'discord.js';
import { pool } from './createPool.js';
import { getRandInt } from './getRandInt.js';

/**
 * Posts the discord server directory to the chat
 */
export async function createTicket(interaction: ButtonInteraction) {
    // check if this button is in the db of help ticket initiators
    const ticketQuery = await pool.query('SELECT threadchanid, staffid FROM chatot.tickets WHERE messageid=$1', [interaction.message.id]);
    const threadSetup: { threadchanid: string, staffid: string }[] | [] = ticketQuery.rows;

    if (!threadSetup.length) {
        return;
    }

    // create a modal to show to the user
    // first setup the modal
    const randInt = getRandInt(0, 65535);
    const modal = new ModalBuilder()
        .setCustomId(`createTicket${randInt}`)
        .setTitle('Contact the mods');
    
    // then create the text input rows applied to it
    const desc = new TextInputBuilder()
        .setCustomId(`desc${randInt}`)
        .setLabel('What can we help with?')
        .setStyle(TextInputStyle.Paragraph)
        .setMaxLength(250)
        .setPlaceholder('Please enter a brief description to explain your inquiry')
        .setRequired(true);
    
    // add the text input to an action row
    const row = new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents(desc);
    
    // add the action row to the modal
    modal.addComponents(row);

    // show it to the user
    // show the modal to the user
    await interaction.showModal(modal);

    // await their input
    const modalFilter = (modalInteraction: ModalSubmitInteraction) => modalInteraction.customId === `createTicket${randInt}` && modalInteraction.user.id === interaction.user.id;
    
    // wait for them to submit the modal
    const submittedModal = await interaction.awaitModalSubmit({ filter: modalFilter, time: 10 * 60 * 1000 });

    // on submit, defer our reply so we can process it
    await submittedModal.deferReply({ ephemeral: true });

    // get the info they entered
    const txt = submittedModal.fields.getTextInputValue(`desc${randInt}`);

    // fetch the channel so that we can make the thread
    const channel = await interaction.client.channels.fetch(threadSetup[0].threadchanid);

    if (channel?.type !== ChannelType.GuildText) {
        await submittedModal.followUp('Unable to fetch parent channel to create your thread. Please let server staff know.');
        return;
    }

    // create the thread
    const thread = await channel.threads.create({
        name: `${interaction.user.username}-support-${randInt}`,
        type: ChannelType.PrivateThread,
        invitable: false,
    });

    const staffPings: string[] = [];
    for (const staffrow of threadSetup) {
        staffPings.push(`<@&${staffrow.staffid}>`);
    }
    // invite the users to the thread
    // await thread.members.add(interaction.user.id);
    await thread.send(`<@${interaction.user.id}> this is the start of your private thread with ${staffPings.join(', ')} for the reason below. If you wish to provide more information, you can do so here. Staff will respond as soon as they can.\n\`\`\`\n${txt}\n\`\`\``);

    
    // reply to the interaction so we don't leave it hanging
    await submittedModal.followUp({ content: 'Private thread created', ephemeral: true });

}