import { ChatInputCommandInteraction, EmbedBuilder, ChannelType } from 'discord.js';
import { pool } from './createPool.js';
import type { IReactRole } from '../types/reactrole.js';
import { removeRRMessage } from './loadReactRoleMessages.js';

/**
 * Removes the react roles setup for the server.
 * If the monitored message is the bot's, it is reinitialzed and the reactions are removed.
 * If the monitored message is that of a user, the reactions are removed from the message.
 * 
 * In both cases, the reactroles database is cleared for this server. Roles are not removed from the users.
 * @param dbmatches Result from query of PG database on the reactroles table
 * @param interaction Source interaction for the command
 * @returns Promise<void>
 */
export async function rrClear(dbmatches: IReactRole[] | [], interaction: ChatInputCommandInteraction) {
    // determine if the message is the bot's or a user's
    // one of the rows will be the init row, which will have a roleID of bot or user
    const isBotMsg = dbmatches.some(row => row.roleid === 'bot');

    // there can only be 1 message per guild that can handle RRs, so we can pull the message ID from the db and use that for all subsequent events
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

    // if it's the bot's message, reinit the content
    if (isBotMsg) {
        // reinit the content
        // create an embed
        const newEmbed = new EmbedBuilder()
            .setTitle('React Roles')
            .setDescription('Choose your roles by reacting with the following:\n\u200B\n');

        // edit the message embed
        await rrMsg.edit({ embeds: [newEmbed] });
    }

    // remove all reactions from the post
    await rrMsg.reactions.removeAll();

    // clear the cache
    removeRRMessage(rrMsg.id);

    // clear the db for this server
    await pool.query('DELETE FROM chatot.reactroles WHERE serverid=$1', [interaction.guildId]);
    
    // let them know the deed is done
    await interaction.followUp('All monitored reactions removed from this server. You may delete the monitored message if you wish.');
    return;
}