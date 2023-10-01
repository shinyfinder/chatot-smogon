import { ChatInputCommandInteraction, EmbedBuilder, ChannelType } from 'discord.js';
import { pool } from './createPool.js';
import type { IReactRole } from '../types/reactrole.js';
import { removeRRMessage } from './loadReactRoleMessages.js';
import { errorHandler } from './errorHandler.js';

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
export async function rrClear(dbmatches: IReactRole[] | [], interaction: ChatInputCommandInteraction, msgid: string | null) {
    let targetArr: IReactRole[] | [] = [];
    // if they provided a msgid, they only want to target 1 message
    // so get the init row for that message so we can target it
    if (msgid) {
        targetArr = dbmatches.filter(row => row.messageid === msgid && (row.roleid === 'bot' || row.roleid === 'user'));
    }
    // if they didn't provide a message id, get all of the ones for this server
    // do so by getting all the init lines from the array of db matches
    // each of these will have a unique message/channel id
    else {
        targetArr = dbmatches.filter(row => row.roleid === 'bot' || row.roleid === 'user');
    }

    // loop over the array of targeted messages so we can try to clear/reinitialize each
    for (const target of targetArr) {
        try {
            // determine if the message is the bot's or a user's
            // one of the rows will be the init row, which will have a roleID of bot or user
            const isBotMsg = target.roleid === 'bot';

            // pull the chanid and msgid 
            const chan = target.channelid;
            const msg = target.messageid;

            // fetch the message's channel so we can then fetch the message
            const rrChan = await interaction.client.channels.fetch(chan);

            // type assertions
            if (rrChan === null) {
                continue;
            }
            else if (!(rrChan?.type === ChannelType.GuildText || rrChan?.type === ChannelType.PublicThread)) {
                continue;
            }
            // fetch the message
            const rrMsg = await rrChan.messages.fetch(msg);

            // if it's the bot's message, reinit the content
            if (isBotMsg) {
                // reinit the content
                // create an embed
                const newEmbed = new EmbedBuilder()
                    .setTitle('React Roles')
                    .setDescription('Choose your roles by reacting with the following. Roles can be removed at any time by removing your reaction (clicking your reaction again).\n\u200B\n');

                // edit the message embed
                await rrMsg.edit({ embeds: [newEmbed] });
            }

            // remove all reactions from the post
            await rrMsg.reactions.removeAll();
        }
        // if you encounter any errors, log anything super bad
        catch (e) {
            errorHandler(e);
        }
        finally {
            // clear the cache
            removeRRMessage(target.messageid);
            
            // clear the db for this message in this server
            await pool.query('DELETE FROM chatot.reactroles WHERE serverid=$1 AND messageid=$2', [interaction.guildId, target.messageid]);
        }
    }

    // let them know the deed is done
    await interaction.followUp('React role message(s) cleared. You may delete the previously-monitored message(s) if you wish. I attempted to reset the messages where I could by resetting the text and removing the reactions, but any roles were not removed.');
}
