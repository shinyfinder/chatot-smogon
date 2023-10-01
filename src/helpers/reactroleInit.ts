import { ChatInputCommandInteraction, EmbedBuilder, ChannelType, Message } from 'discord.js';
import { addRRMessage } from './loadReactRoleMessages.js';
import { pool } from './createPool.js';
import config from '../config.js';
import { errorHandler } from './errorHandler.js';

/**
 * Initializes a message users react to in order to receive roles.
 * 
 * If no message ID is provided, the bot posts an embed that is updated whenever a react role
 * is added or removed. Which setup is being used is specified in the table using a roleid of
 * bot or user.
 * 
 * The message is cached so that we don't poll the db on every reaction.
 * @param msgID Optional message ID of the message users react on to receive their role
 * @param interaction Source interaction for the command
 * @returns Promise<void>
 */
export async function rrInit(msgID: string | null, interaction: ChatInputCommandInteraction) {
    // typecheck interaction again to make TS happy even tho we already did this
    if (!interaction.channel) {
        return;
    }
    // if they didn't provide one, create a new message
    if (msgID === null) {
        // post a message to the channel

        // create an embed
        const embed = new EmbedBuilder()
            .setTitle('React Roles')
            .setDescription('Choose your roles by reacting with the following. Roles can be removed at any time by removing your reaction (clicking your reaction again).\n\u200B\n');
                
        const msg = await interaction.channel.send({ embeds: [embed] });
        // store it in the db
        // it's a bit hacky, but because we want to allow for multiple RR messages per server, we need to store an arbitrary unique emoji id on init
        // so I chose the message id prepended with - so they don't accidentally enter it
        await pool.query('INSERT INTO chatot.reactroles (serverid, channelid, messageid, roleid, emoji) VALUES ($1, $2, $3, $4, $5)', [msg?.guildId, msg?.channelId, msg?.id, 'bot', `-${msg?.id}`]);

        // cache the message id
        addRRMessage(msg.id);
    }
    else {
        // do some minimal checking to ensure the input is numeric (and thus probably an ID)
        const isID = /^\d+$/.test(msgID);
        if (!isID) {
            await interaction.followUp('IDs can only consist of numbers');
            return;
        }

        /**
         * check to make sure the entered ID isn't the bot's message
         * if it is, we should store it appropriately
         */
        let owner = 'user';

        // fetch the channel
        const rrChan = await interaction.client.channels.fetch(interaction.channelId);

        // check for errors
        if (rrChan === null) {
            await interaction.followUp('I could not fetch the channel. Did I lose access?');
            return;
        }
        else if (!(rrChan?.type === ChannelType.GuildText || rrChan?.type === ChannelType.PublicThread)) {
            await interaction.followUp('Invalid channel type. Reaction role messages should be in a public channel');
            return;
        }
        // fetch the message
        let rrMsg: Message;
        try {
            rrMsg = await rrChan.messages.fetch(msgID);
        }
        catch (e) {
            errorHandler(e);
            await interaction.followUp('Unable to fetch message. Does it still exist?');
            return;
        }

        // see if the message owner is the bot
        // discord doesn't seem to let us edit in an embed if there wasn't one originally
        // so if they're trying to reuse an old bot message and the embed was deleted, return
        if (rrMsg.author.id === config.CLIENT_ID) {
            if (rrMsg.embeds.length === 0) {
                await interaction.followUp('I cannot reuse one of my old messages that had its embeds deleted.');
                return;
            }
            else {
                owner = 'bot';
            }
            
        }
        // the message already exists, so we just need to store it in the db
        // use the message id as the emoji id so it's unique
        await pool.query('INSERT INTO chatot.reactroles (serverid, channelid, messageid, roleid, emoji) VALUES ($1, $2, $3, $4, $5)', [interaction.guildId, interaction.channelId, msgID, owner, `-${msgID}`]);

        // cache the message id
        addRRMessage(rrMsg.id);
    }

    // respond to the interaction so it's not left hanging
    await interaction.followUp('React role message initialized');

    return;
}
