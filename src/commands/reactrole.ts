import { SlashCommandBuilder, ChatInputCommandInteraction, SlashCommandSubcommandBuilder, PermissionFlagsBits } from 'discord.js';
import { SlashCommand } from '../types/slash-command-base';
import { pool } from '../helpers/createPool.js';
import { rrInit } from '../helpers/reactroleInit.js';
import { rrAdd } from '../helpers/reactroleAdd.js';
import type { IReactRole } from '../types/reactrole';
import { rrRemove } from '../helpers/reactroleRemove.js';
import { rrClear } from '../helpers/reactroleClear.js';
/**
 * Manages the list of roles a user can assign to themselves upon reacting to a message.
 * reactrole init makes the bot post a message into the interaction channel.
 * This message is used as the collector and stored in the db.
 * 
 * Once the message has been initialized, you can assign react roles to it
 */
export const command: SlashCommand = {
    global: true,
    guilds: [],
    data: new SlashCommandBuilder()
        .setName('reactrole')
        .setDescription('Manages the list of roles a user can assign themselves upon reacting')
        .setDMPermission(false)
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
        .addSubcommand(new SlashCommandSubcommandBuilder()
            .setName('init')
            .setDescription('Initializes the message to which users react')
            .addStringOption(option =>
                option.setName('message')
                .setDescription('Optional ID of the message which users react to. If not provided, the bot posts a message.')
                .setRequired(false)))
        /**
         * Add react role (RR)
         */
        .addSubcommand(new SlashCommandSubcommandBuilder()
            .setName('add')
            .setDescription('Adds a role to the list of self-assignable roles')
            .addRoleOption(option =>
                option.setName('role')
                .setDescription('The role to be assigned')
                .setRequired(true))
            .addStringOption(option =>
                option.setName('emoji')
                .setDescription('Emoji users need to react with (use the standard :name: syntax)')
                .setRequired(true))
            .addStringOption(option =>
                option.setName('description')
                .setDescription('Description of the role the user gets')
                .setRequired(true)))
        /**
         * Remove RR
         */
        .addSubcommand(new SlashCommandSubcommandBuilder()
            .setName('remove')
            .setDescription('Removes a role from the list of self-assignable roles')
            .addStringOption(option =>
                option.setName('emoji')
                .setDescription('Emoji users need to react with (use the standard :name: syntax)')
                .setRequired(true)))
        .addSubcommand(new SlashCommandSubcommandBuilder()
        .setName('clear')
        .setDescription('Empties the database of all self-assignable roles for this server. Does not remove roles.')),

    // execute our desired task
    async execute(interaction: ChatInputCommandInteraction) {
        // defer the reply to give us time to process
        await interaction.deferReply({ ephemeral: true });

        // make sure command was used in a channel
        if (!interaction.channel) {
            return;
        }

        // query the db to get the matches for this server
        const pgres = await pool.query('SELECT channelid, messageid, roleid, emoji FROM chatot.reactroles WHERE serverid=$1', [interaction.guildId]);
        const dbmatches: IReactRole[] | [] = pgres.rows;


        /**
         * INITIALIZE RR
         */
        if (interaction.options.getSubcommand() === 'init') {
            // if there's already a row for this server, they don't need to reinit
            if (dbmatches.length) {
                await interaction.followUp('You already initialized a post for this server');
                return;
            }
            // get the user input message id
            const msgID = interaction.options.getString('message');

            // intialize the message
            await rrInit(msgID, interaction);
            
        }


        /**
         * ADD RR
         */
        else if (interaction.options.getSubcommand() === 'add') {
            // make sure the RR message was initialized
            if (!dbmatches.length) {
                await interaction.followUp('You must first initialize a message to collect reactions');
                return;
            }

            // get the user inputs
            const role = interaction.options.getRole('role', true);

            // make sure it's a valid assignable role
            // invalid are the built-in @everyone role and any role that's externally managed (i.e. bot role, boost role)
            if (role.managed || role.name === '@everyone') {
                await interaction.followUp('I cannot assign that role');
                return;
            }

            const emojiID = interaction.options.getString('emoji', true);
            const desc = interaction.options.getString('description', true);


            // make sure we aren't duplicating the reaction
            const isDupeEmoji = dbmatches.some(row => row.emoji === emojiID);
            if (isDupeEmoji) {
                await interaction.followUp('You cannot reuse the same emoji');
                return;
            }

            // setup the new react role addition
            await rrAdd(dbmatches, interaction, role, emojiID, desc);

            return;
        }


        /**
         * REMOVE RR
         */
        else if (interaction.options.getSubcommand() === 'remove') {
            // make sure the RR message was initialized
            if (!dbmatches.length) {
                await interaction.followUp('You must first initialize a message to collect reactions');
                return;
            }

            // get the user inputs
            const emojiID = interaction.options.getString('emoji', true);

            // remove the react role
            await rrRemove(dbmatches, interaction, emojiID);
            return;

        }


        /**
         * CLEAR RR
         */
        else if (interaction.options.getSubcommand() === 'clear') {
            // make sure the RR message was initialized
            if (!dbmatches.length) {
                await interaction.followUp('Nothing to clear...');
                return;
            }

            // clear the react roles setup for the server
            await rrClear(dbmatches, interaction);
            return;

        }
    },
};