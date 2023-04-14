import { ChatInputCommandInteraction, EmbedBuilder, ChannelType } from 'discord.js';
import { pool } from './createPool.js';
import type { IReactRole } from '../types/reactrole.js';

/**
 * Removes an emoji from the list of those that grant a role to the user upon reaction to the initialized message.
 * If the message is the bot's, the embed is updated to remove this emoji from the list.
 * The specified reaction is cleared from the message and the table is updated.
 * 
 * If the message is a user's, the specified reaction is removed from the message and the table is updated.
 * @param dbmatches Query result for the chatot.reactroles table
 * @param interaction Source interaction for the command
 * @param emojiID Emoji identifier users react with
 * @returns Promise<void>
 */
export async function rrRemove(dbmatches: IReactRole[] | [], interaction: ChatInputCommandInteraction, emojiID: string) {
    // there can only be 1 message per guild that can handle RRs, so we can pull the messaage ID from the db and use that for all subsequent adds
    const chan = dbmatches[0].channelid;
    const msg = dbmatches[0].messageid;

    // fetch the message's channel so we can then fetch the message
    const rrChan = await interaction.client.channels.fetch(chan);

    // type assertions
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
    
    // determine if the message is the bot's or a user's
    // one of the rows will be the init row, which will have a roleID of bot or user
    const isBotMsg = dbmatches.some(row => row.roleid === 'bot');

    if (isBotMsg) {
        // get the current embed
        const embed = rrMsg.embeds[0];

        if (!embed?.description) {
            await interaction.followUp('Embed was deleted; cannot continue');
            return;
        }
        
        // remove the line containing this emoji with regex
        const regex = new RegExp(`^.*${emojiID}.*`, 'gm');
        const newDesc = embed.description.replace(regex, '');

        // create a new embed with the template of the old one since embeds are immutable
        const newEmbed = EmbedBuilder.from(embed).setDescription(newDesc);

        // edit the message embed
        await rrMsg.edit({ embeds: [newEmbed] });
    }
    

    // Left in case we ever want to do this, but removing the reaction would trigger the bot to remove the roles from everyone, which may not be desired
    // So instead we'll just remove the check for the emoji and the message can just have a bunch of useless reactions still on it.

    // try to fetch the entered emoji so we can remove the reactions
    let reaction = rrMsg.reactions.cache.get(emojiID);

    // if reaction is undefined, it's probably a custom emoji
    // so extract the ID
    if (reaction === undefined) {
        // regex match the id from the emoji string
        // format is <:name_goes_here123:1234567>
        const reactionID = emojiID.match(/\d*(?=>)/);
        if (reactionID === null) {
            await interaction.followUp('I did no understand that input');
            return;
        }
        // then try to fetch the emoji using the ID
        reaction = rrMsg.reactions.cache.get(reactionID[0]);
        if (reaction === undefined) {
            await interaction.followUp('I could not fetch that emoji. Maybe it is from a different server?');
            return;
        }
    }
    
    // finally remove the specified reactions
    await reaction.remove();
    

    // remove it from the db
    await pool.query('DELETE FROM chatot.reactroles WHERE serverid=$1 AND emoji=$2', [interaction.guildId, emojiID]);

    // let them know we're done
    await interaction.followUp(`Removed ${emojiID} from the list of monitored reactions.`);
    return;
}
