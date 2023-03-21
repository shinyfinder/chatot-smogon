import { SlashCommandBuilder, ChatInputCommandInteraction, PermissionFlagsBits } from 'discord.js';
import { SlashCommand } from '../types/slash-command-base';

/**
 * Command to timeout a user from the server
 * @param data SlashCommandBuilder() instance from discord.js
 * @param user Username/id of the user to be timed out
 * @param timeframe How long the user is muted
 * @param reason Optional reason entry for the audit log
 * @param dm Optional message to send to the user
 *
 */
export const command: SlashCommand = {
    global: true,
    // setup the slash command builder
    data: new SlashCommandBuilder()
        .setName('timeout')
        .setDescription('Bans a user from the server.')
        .addUserOption(option =>
            option.setName('user')
            .setDescription('The user to be timed out (can accept IDs)')
            .setRequired(true))
        .addNumberOption(option =>
            option.setName('timeframe')
            .setDescription('How long to time the user out for')
            // add a list of timeframe choices to choose from
            // times must be in milliseconds up to 28 days
            .addChoices(
                { name: '60 Sec', value: 60 * 1000 },
                { name: '5 Min', value: 5 * 60 * 1000 },
                { name: '10 Min', value: 10 * 60 * 1000 },
                { name: '1 Hour', value: 1 * 60 * 60 * 1000 },
                { name: '6 Hours', value: 6 * 60 * 60 * 1000 },
                { name: '12 Hours', value: 12 * 60 * 60 * 1000 },
                { name: '18 Hours', value: 18 * 60 * 60 * 1000 },
                { name: '1 Day', value: 24 * 60 * 60 * 1000 },
                { name: '1 Week', value: 7 * 24 * 60 * 60 * 1000 },
            )
            .setRequired(true))
        .addStringOption(option =>
            option.setName('reason')
            .setDescription('Optional reason for the timeout (for the audit log)')
            .setRequired(false))
        .addStringOption(option =>
            option.setName('dm')
            .setDescription('Optional message to be sent to the user')
            .setRequired(false))
        .setDMPermission(false)
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

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
        const time = interaction.options.getNumber('timeframe');

        // check for null user to make TS happy
        // this should never be null since it is a required field
        if (user === null || time === null) {
            return;
        }

        // if no reason is provided, state so for the audit log
        if (auditEntry === null) {
            auditEntry = 'No reason provided';
        }

        // respond to the message so discord knows we're trying
        await interaction.deferReply({ ephemeral: true });

        // try to DM the user with the provided message
        let wasDMd = false;
        if (dm !== null) {
            try {
                await interaction.client.users.send(user, `You have been timed out from ${interaction.guild.name} for the following reason:\n\n${dm}.`);
                wasDMd = true;
            }
            catch (error) {
                wasDMd = false;
            }
        }
        else {
            wasDMd = false;
        }
        // timeout the user
        const member = await interaction.guild.members.fetch(user);
        await member.timeout(time, auditEntry);

        // timed out + DMd
        if (wasDMd) {
            await interaction.followUp(`${user.username} has been timed out. I let them know.`);
            return;
        }
        // timed out + not DMd
        else {
            await interaction.followUp(`${user.username} has been timed out. I did not DM them. Possible reasons are they have DMs turned off, they are not in a server with me, or you didn't specify a DM.`);
            return;
        }
        
    },
};