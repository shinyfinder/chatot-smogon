import { SlashCommandBuilder, ChatInputCommandInteraction, ChannelType } from 'discord.js';
import { SlashCommand } from '../types/slash-command-base';
/**
 * Command to lookup information about a user
 * @param user Userid or forum profile URL to lookup
 *
 */
export const command: SlashCommand = {
    global: false,
    // main cord and om cord
    guilds: ['192713314399289344', '262990512636559362', '474308055408967681', '235082371743875072'],
    // cd in seconds
    cooldown: 10,
    // setup the slash command builder
    data: new SlashCommandBuilder()
        .setName('randrex')
        .setDescription('Posts a random picture of Rex')
        .setDMPermission(false)
        .setDefaultMemberPermissions(0),

    // execute our desired task
    async execute(interaction: ChatInputCommandInteraction) {
        // make sure this command is used in a guild
        if (!interaction.guild) {
            await interaction.reply({ content: 'This command can only be used in a server!', ephemeral: true });
            return;
        }
        await interaction.deferReply();
        
        // fetch the messages from the dev cord channel housing the pics
        const rexChan = await interaction.client.channels.fetch('1128358918674993233');

        // typecheck
        if (!rexChan) {
            await interaction.followUp('Could not find image channel. Did I lose access?');
            return;
        }
        else if (!(rexChan.type === ChannelType.GuildText || rexChan.type === ChannelType.PublicThread)) {
            await interaction.followUp('Could not fetch image channel. Did I lose access?');
            return;
        }

        // fetch the messagesin the channel
        const messages = await rexChan.messages.fetch({ limit: 100 });

        // pick a random message
        const randMsg = messages.random();

        // typecheck
        if (!randMsg) {
            await interaction.followUp('Cannot fetch messages within the channel');
            return;
        }
        
        // pick a random attachment
        const img = randMsg.attachments.random();

        // and post
        if (img) {
            const ext = img.contentType ? img.contentType.split('/')[1] : 'png';
            await interaction.followUp({ files: [{
                attachment: img.url,
                name: `SPOILER_img.${ext}`,
            }] });
        }
        else {
            await interaction.followUp('Cannot find image in message');
        }
        
    },
};