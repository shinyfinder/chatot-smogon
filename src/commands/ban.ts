import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import { SlashCommand } from '../types/slash-command-base';

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
        .setDefaultMemberPermissions(0),

    // execute our desired task
    async execute(interaction: ChatInputCommandInteraction) {
        // make sure this command is used in a guild
        if (!interaction.guild) {
            await interaction.reply({ content: 'This command can only be used in a server!', ephemeral: true });
            return;
        }

        // get the inputs
        const user = interaction.options.getUser('user');
        let auditEntry = interaction.options.getString('reason');
        const dm = interaction.options.getString('dm');
        let messages = interaction.options.getNumber('timeframe');

        // check for null user to make TS happy
        // this should never be null since it is a required field
        if (user === null) {
            return;
        }

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
                await interaction.client.users.send(user, `You have been banned from ${interaction.guild.name} for the following reason:\n\n${dm}.`);
                wasDMd = true;
            }
            catch (error) {
                console.error(error);
                wasDMd = false;
            }
        }
        else {
            wasDMd = false;
        }
        // ban the user and delete any messages, if required
        try {
            await interaction.guild.members.ban(user, {
            reason: auditEntry,
            deleteMessageSeconds: messages,
            });

            // banned + DMd
            if (wasDMd) {
                await interaction.followUp(`${user.username} has been banned. I let them know.`);
                return;
            }
            // banned + not DMd
            else {
                await interaction.followUp(`${user.username} has been banned. I did not DM them. Possible reasons are they have DMs turned off, they are not in a server with me, or you didn't specify a DM.`);
                return;
            }
        }
        catch (err) {
            console.error(err);
            // not banned + DMd
            if (wasDMd) {
                await interaction.followUp(`An error occurred and ${user.username} was not banned. However, I was able to DM them.`);
                return;
            }
            // not banned + not DMd
            else {
                await interaction.followUp(`An error occurred and ${user.username} was not banned or notified.`);
                return;
            }

        }
    },
};