import { ContextMenuCommandBuilder, ApplicationCommandType, MessageContextMenuCommandInteraction, PermissionFlagsBits } from 'discord.js';
import { ContextCommand } from '../types/context-command-base';
import { pool } from '../helpers/createPool.js';

/**
 * Command to test the bot is online and working.
 * @param data SlashCommandBuilder() instance from discord.js
 * @returns Replies Pong! in the chat
 *
 * Can be used as a template for future commands
 */
export const command: ContextCommand = {
    global: true,
    guilds: [],
    // setup the slash command builder
    data: new ContextMenuCommandBuilder()
        .setName('(un)sticky')
        .setType(ApplicationCommandType.Message)
        .setDMPermission(false)
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),

    // execute our desired task
    async execute(interaction: MessageContextMenuCommandInteraction) {
        await interaction.deferReply({ ephemeral: true });

        // get the targeted message
        const msg = interaction.targetMessage;

        // get the pins in the channel
        const pins = await msg.channel.messages.fetchPinned();

        // get the stickied pins for this channel
        const stickyPG = await pool.query('SELECT messageid FROM chatot.stickies WHERE channelid=$1', [msg.channelId]);
        const stickied: { messageid: string }[] | [] = stickyPG.rows;

        // determine whether this message is already pinned
        // and get the first pin
        const pinned = pins.find(pin => pin.id === msg.id);
        const firstPin = pins.first();

        // if this message is the first pin and stickied,
        // unsticky it
        if (firstPin?.id === msg.id && stickied.length && stickied[0].messageid === msg.id) {
            await pool.query('DELETE FROM chatot.stickies WHERE channelid=$1', [msg.channelId]);
            await interaction.followUp('Message unstickied. Default Discord functionality restored');
            return;
        }
        // if this message is already pinned but isn't the first, repin so it gets put to the top
        else if (pinned) {
            await msg.unpin();
            await msg.pin();
        }
        // if it's not pinned yet, or there aren't any pins,
        // pin it
        else if (!pinned) {
            await msg.pin();
        }
        
        // update the sticky in the db
        await pool.query(`INSERT INTO chatot.stickies (serverid, channelid, messageid)
        VALUES ($1, $2, $3)
        ON CONFLICT (channelid) DO
        UPDATE SET serverid=EXCLUDED.serverid, channelid=EXCLUDED.channelid, messageid=EXCLUDED.messageid`, [interaction.guildId, msg.channelId, msg.id]);

        // respond
        await interaction.followUp('Message stickied');
    },
};