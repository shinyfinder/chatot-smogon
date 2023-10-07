import { TextBasedChannel, Message, User } from 'discord.js';
import config from '../config.js';

export async function getLTPlayers(host: User, tour: string, message: Message, channel: TextBasedChannel) {
    // fetch the msg
    const msg = await message.fetch();

    // get the people who reacted to this message with the desired emoji
    const entrants = msg.reactions.cache.get('👍');

    if (!entrants) {
        await channel.send(`No one signed up for ${tour} <@${host.id}>`);
        return;
    }
    const filteredEntrants = (await entrants.users.fetch()).filter(entrant => entrant.id !== config.CLIENT_ID);

    // if we were the only people to react, return;
    if (!filteredEntrants.size) {
        await channel.send(`No one signed up for ${tour} <@${host.id}>`);
    }
    else {
        await channel.send(`Here are the signups for ${tour} <@${host.id}>:\n\`\`\`\n${filteredEntrants.map(e => e.username).join('\n')}\n\`\`\``);
    }
}