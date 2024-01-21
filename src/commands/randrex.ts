import { SlashCommandBuilder, ChatInputCommandInteraction, ChannelType } from 'discord.js';
import { SlashCommand } from '../types/slash-command-base';
/**
 * Posts a random picture of Rex, the goodest of boys
 */
export const command: SlashCommand = {
    global: true,
    guilds: [],
    // cd in seconds
    cooldown: 10,
    // setup the slash command builder
    data: new SlashCommandBuilder()
        .setName('randrex')
        .setDescription('Posts a random picture of Rex, winner of Smog Awards 2022 Cutest Pet')
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

        // fetch the messages in the channel
        const messages = await rexChan.messages.fetch({ limit: 100 });

        // get all of the attachments
        const attachments = messages.flatMap(msg => msg.attachments);
        
        const img = attachments.random();
        
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