import { ChannelType, Channel, Client } from 'discord.js';
import { Modes, botConfig } from '../config.js';

/**
 * Temp rewrite to tell people to use the command
 */
export async function updatePublicRatersList(client: Client) {
    // fetch all of the messages from the relevant channel so that we can edit the bot's messages
    // load the channel
    let raterListChannel: Channel | null;
    // dev mode gate
    if (botConfig.MODE === Modes.Dev) {
        raterListChannel = await client.channels.fetch('1065764634562416680');
    }
    else {
        raterListChannel = await client.channels.fetch('1079156451609686026');
    }
    
    if (!(raterListChannel?.type === ChannelType.GuildText || raterListChannel?.type === ChannelType.PublicThread)) {
        return;
    }

    // fetch the messages from the channel
    const messages = await raterListChannel.messages.fetch({ limit: 100, cache: false });
    
    // then find the id of the messages that is from the bot and has the embeds
    const botMsgs = messages.filter(msg => msg.author.id === client.user?.id);

    // delete them
    for (const [, msg] of botMsgs) {
        await msg.delete();
    }

    // send a new message telling them of the new syntax
    await raterListChannel.send('Please use the `/raters` command to see the list of raters');
    
}