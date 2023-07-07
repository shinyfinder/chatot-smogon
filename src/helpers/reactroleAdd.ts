import { ChatInputCommandInteraction, EmbedBuilder, ChannelType, Role, APIRole } from 'discord.js';
import { pool } from './createPool.js';
import type { IReactRole } from '../types/reactrole.js';

/**
 * Adds an emoji to the list of watched emojis for this server for user's to choose their role with a reaction.
 * If the reaction message is the bot's, the embed is updated to include the emoji/role combination and a brief desciption of the role received.
 * The specified emoji is then seeded on this message and the table is updated.
 * 
 * If the reaction message is a user's, the specified emoji is seeded on the message and the table is updated.
 * @param dbmatches Query result from the chatot.reactroles table
 * @param interaction Source interaction for the command
 * @param role Role object the user wants to add to a user upon react
 * @param emojiID Which emoji the user needs to react with to receive the role
 * @param desc Description of the role the user receives
 * @returns Promise<void>
 */
export async function rrAdd(dbmatches: IReactRole[] | [], interaction: ChatInputCommandInteraction, role: Role | APIRole, emojiID: string, desc: string, msgid: string | null) {
    let chan = '';
    let msg = '';
    // if they didn't provide a message, assume it's the first entry from the db
    if (!msgid) {
        chan = dbmatches[0].channelid;
        msg = dbmatches[0].messageid;
    }
    // otherwise, find the channel id corresponding to the provided message id
    else {
        chan = dbmatches.filter(row => row.messageid === msgid).map(filtRow => filtRow.channelid)[0];
        msg = msgid;
    }
    

    // fetch the message
    const rrChan = await interaction.client.channels.fetch(chan);
    if (rrChan === null) {
        await interaction.followUp('I could not fetch the channel. Did I lose access?');
        return;
    }
    else if (!(rrChan?.type === ChannelType.GuildText || rrChan?.type === ChannelType.PublicThread)) {
        await interaction.followUp('Invalid channel type. Reaction role messages should be in a public channel');
        return;
    }
    // fetch the message
    const rrMsg = (await rrChan.messages.fetch({ around: msg, limit: 1, cache: false })).first();

    if (rrMsg === undefined) {
        await interaction.followUp('Unable to fetch message. Does it still exist?');
        return;
    }

    
    // react with the emoji
    // we do this first because if it's not a valid emoji we don't want to edit the post
    await rrMsg.react(emojiID);

    // determine if the message is the bot's or a user's
    // one of the rows will be the init row, which will have a roleID of bot or user
    const isBotMsg = dbmatches.some(row => row.roleid === 'bot');

    // if it's a bot message...
    if (isBotMsg) {
        // get the current embed
        const embed = rrMsg.embeds[0];

        if (!embed?.description) {
            await interaction.followUp('Embed was deleted; cannot continue');
            return;
        }
        // append the emoji to the message
        const newDesc = embed.description.concat(`\n${emojiID} ${role.name} - ${desc}`);

        // create a new embed with the template of the old one since embeds are immutable
        const newEmbed = EmbedBuilder.from(embed).setDescription(newDesc);
        // edit the message embed
        await rrMsg.edit({ embeds: [newEmbed] });
    }

    // save it to the db
    await pool.query('INSERT INTO chatot.reactroles (serverid, channelid, messageid, roleid, emoji) VALUES ($1, $2, $3, $4, $5)', [interaction.guildId, chan, msg, role.id, emojiID]);

    // let them know we're done
    await interaction.followUp(`Users can now react with ${emojiID} to get role ${role.name}`);

    return;
}
