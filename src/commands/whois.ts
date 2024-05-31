import { SlashCommandBuilder, ChatInputCommandInteraction, PermissionFlagsBits, SlashCommandSubcommandBuilder } from 'discord.js';
import { SlashCommand } from '../types/slash-command-base';
import { pool, sqlPool } from '../helpers/createPool.js';
/**
 * Command to lookup information about a user
 * @param user Userid or forum profile URL to lookup
 *
 */
export const command: SlashCommand = {
    global: true,
    guilds: [],
    // setup the slash command builder
    data: new SlashCommandBuilder()
        .setName('whois')
        .setDescription('Looks up a user\'s discord-forum connection')
        .addSubcommand(new SlashCommandSubcommandBuilder()
            .setName('discord')
            .setDescription('Gets a user\'s forum profile given their Discord')
            .addUserOption(option =>
                option.setName('user')
                .setDescription('Discord user profile (must be in this server) or user ID (global lookup)')
                .setRequired(true)))
        .addSubcommand(new SlashCommandSubcommandBuilder()
            .setName('forum')
            .setDescription('Gets a user\'s Discord given their Smogon profile')
            .addStringOption(option =>
                option.setName('user')
                .setDescription('Forum profile URL or exact (case sensitive) username')
                .setRequired(true)))
        .setDMPermission(false)
        .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers) as SlashCommandBuilder,

    // execute our desired task
    async execute(interaction: ChatInputCommandInteraction) {
        // make sure this command is used in a guild
        if (!interaction.guild) {
            await interaction.reply({ content: 'This command can only be used in a server!', ephemeral: true });
            return;
        }
        await interaction.deferReply({ ephemeral: true });

        /**
         * FORUM LOOKUP USING DISCORD
         */
        if (interaction.options.getSubcommand() === 'discord') {
            // get their input
            const cordUser = interaction.options.getUser('user', true);

            // query the db for the provided input
            const dbmatches: { forumid: string }[] | [] = (await pool.query('SELECT forumid FROM chatot.identities WHERE discordid=$1', [cordUser.id])).rows;

            // give them the results
            if (dbmatches.length) {
                // fetch their discord profile
                await interaction.followUp(`Here's a link to their forum profile https://www.smogon.com/forums/members/${dbmatches[0].forumid}`);
            }
            else {
                await interaction.followUp('No connection found.');
            }

        }

        /**
         * DISCORD LOOKUP USING FORUM
         */
        else if (interaction.options.getSubcommand() === 'forum') {
            // get their input
            const forumUser = interaction.options.getString('user', true);
            // extract their profile id from the provided url
            let forumid = forumUser.match(/^(?:https?:\/\/)?(?:www\.)?smogon\.com\/forums\/members\/(?:(.*?)\.)?(\d+)\/?$/)?.pop();

            // if forumid is undefined, assume they entered a username
            if (forumid === undefined) {
                // query the xf tables to get their id
                // we don't store usernames because of namechanges
                const [sqlMatch] = await sqlPool.execute('SELECT user_id FROM xenforo.xf_user WHERE username = ?', [forumUser]);

                // cast to meaningful array
                const idArr = sqlMatch as { user_id: number }[] | [];

                // if we didn't get a match, let them know
                if (idArr.length) {
                    forumid = idArr[0].user_id.toString();
                }
                else {
                    await interaction.followUp('Profile not found. Please provide the URL or exact (case sensitive) username of their forum profile.');
                    return;
                }
                
            }

            // query the db for the provided input
            const pgQuery = await pool.query('SELECT discordid FROM chatot.identities WHERE forumid=$1', [Number(forumid)]);
            const dbmatches: { discordid: string }[] | [] = pgQuery.rows;

            // give them the results
            if (dbmatches.length) {
                // loop over all of the discords with this forum profile to build an output string
                // this almost should never happen more than once but it's technically possible
                const strOutArr: string[] = [];

                for (const id of dbmatches) {
                    strOutArr.push(`<@${id.discordid}>`);
                }

                await interaction.followUp(`Their discord is ${strOutArr.join(', ')}`);
            }
            else {
                await interaction.followUp('No connection found.');
            }


        }
    },
};