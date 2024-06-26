import { SlashCommandBuilder, ChatInputCommandInteraction, PermissionFlagsBits, SnowflakeUtil } from 'discord.js';
import { SlashCommand } from '../types/slash-command-base';
import { Modes, botConfig } from '../config.js';
import { pool } from '../helpers/createPool.js';
/**
 * Command to ban a user from the server
 * @param data SlashCommandBuilder() instance from discord.js
 * @param user Username/id of the user to be banned
 * @param timeframe Optional timeframe to delete the user's past messages. Defaults to 0
 * @param reason Optional reason entry for the audit log
 * @param dm Optional message to send to the user befor banning them
 *
 */
export const command: SlashCommand = {
    global: true,
    guilds: [],
    // setup the slash command builder
    data: new SlashCommandBuilder()
        .setName('ban')
        .setDescription('Bans a user from the server.')
        .addUserOption(option =>
            option.setName('user')
            .setDescription('The user to be banned (can accept IDs)')
            .setRequired(true))
        .addNumberOption(option =>
            option.setName('timeframe')
            .setDescription('Timeframe of messages to delete. Default: 0')
            // add a list of timeframe choices to choose from
            // times must be in seconds from 0 to 604800 (7 days) inclusive
            .addChoices(
                { name: 'None', value: 0 },
                { name: '1 Hour', value: 1 * 60 * 60 },
                { name: '6 Hours', value: 6 * 60 * 60 },
                { name: '12 Hours', value: 12 * 60 * 60 },
                { name: '24 Hours', value: 24 * 60 * 60 },
                { name: '3 Days', value: 3 * 24 * 60 * 60 },
                { name: '7 Days', value: 7 * 24 * 60 * 60 },
            )
            .setRequired(false))
        .addStringOption(option =>
            option.setName('reason')
            .setDescription('Optional reason for the ban (for the audit log)')
            .setRequired(false))
        .addStringOption(option =>
            option.setName('dm')
            .setDescription('Optional message to be sent to the user')
            .setRequired(false))
        .setDMPermission(false)
        .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers) as SlashCommandBuilder,

    // execute our desired task
    async execute(interaction: ChatInputCommandInteraction) {
        // make sure this command is used in a guild
        if (!interaction.guild) {
            await interaction.reply({ content: 'This command can only be used in a server!', ephemeral: true });
            return;
        }

        // get the inputs
        const user = interaction.options.getUser('user', true);
        let auditEntry = interaction.options.getString('reason');
        const dm = interaction.options.getString('dm');
        let messages = interaction.options.getNumber('timeframe');


        // if no reason is provided, state so for the audit log
        if (auditEntry === null) {
            auditEntry = 'No reason provided';
        }

        // if they don't give a timeframe, default to 0
        if (messages === null) {
            messages = 0;
        }

        // respond to the message so discord knows we're trying
        await interaction.deferReply({ ephemeral: true });

        // try to DM the user with the provided message
        let wasDMd = false;
        if (dm !== null) {
            try {
                await interaction.client.users.send(user, { content: `You have been banned from ${interaction.guild.name} for the following reason:\n\n${dm}.`, enforceNonce: true, nonce: SnowflakeUtil.generate().toString() });
                wasDMd = true;
            }
            catch (error) {
                wasDMd = false;
            }
        }
        else {
            wasDMd = false;
        }
        // ban the user and delete any messages, if required
    
        await interaction.guild.members.ban(user, {
        reason: auditEntry,
        deleteMessageSeconds: messages,
        });

        // banned + DMd
        if (wasDMd) {
            await interaction.followUp(`${user.username} has been banned. I let them know.`);
        }
        // banned + not DMd
        else {
            await interaction.followUp(`${user.username} has been banned. I did not DM them. Possible reasons are they have DMs turned off, they are not in a server with me, or you didn't specify a DM.`);
        }
        
        // remove them from the list of raters
        // only do this for the main cord
        if ((botConfig.MODE === Modes.Dev && interaction.guildId === botConfig.GUILD_ID) || (botConfig.MODE === Modes.Production && interaction.guildId === '192713314399289344')) {
            await pool.query('DELETE FROM chatot.raterlists WHERE userid=$1', [user.id]);
        }
    },
};