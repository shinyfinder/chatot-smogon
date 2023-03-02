import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import { SlashCommand } from '../types/slash-command-base';

/**
 * Command to kick a user from the chat
 * @param user Username/id to be kicked from the chat
 * @param reason Optional reason for the audit log
 * @param dm Optional DM to be sent to the user
 *
 */
export const command: SlashCommand = {
    global: true,
    // setup the slash command builder
    data: new SlashCommandBuilder()
        .setName('kick')
        .setDescription('Kicks a user from the server.')
        .addUserOption(option =>
            option.setName('user')
            .setDescription('The user to be kicked (can accept IDs)')
            .setRequired(true))
        .addStringOption(option =>
            option.setName('reason')
            .setDescription('Optional reason for the kick (for the audit log)')
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

        // check for null user to make TS happy
        // this should never be null since it is a required field
        if (user === null) {
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
                await interaction.client.users.send(user, `You have been kicked from ${interaction.guild.name} for the following reason:\n\n${dm}.`);
                wasDMd = true;
            }
            catch (error) {
                wasDMd = false;
            }
        }
        // no dm specified
        else {
            wasDMd = false;
        }
        // kick the user
        await interaction.guild.members.kick(user, auditEntry);
        // kicked + DMd
        if (wasDMd) {
            await interaction.followUp({ content: `${user.username} has been kicked. I let them know.`, ephemeral: true });
            return;
        }
        // kicked + not DMd
        else {
            await interaction.followUp({ content: `${user.username} has been kicked. I did not DM them. Possible reasons are they have DMs turned off, they are not in a server with me, or you did not specify a DM.`, ephemeral: true });
            return;
        }
    },
};