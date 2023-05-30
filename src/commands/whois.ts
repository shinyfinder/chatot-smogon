import { SlashCommandBuilder, ChatInputCommandInteraction, PermissionFlagsBits } from 'discord.js';
import { SlashCommand } from '../types/slash-command-base';
import { pool } from '../helpers/createPool.js';
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
        .addStringOption(option =>
            option.setName('user')
            .setDescription('Discord user ID or forum profile URL')
            .setRequired(true))
        .setDMPermission(false)
        .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),

    // execute our desired task
    async execute(interaction: ChatInputCommandInteraction) {
        // make sure this command is used in a guild
        if (!interaction.guild) {
            await interaction.reply({ content: 'This command can only be used in a server!', ephemeral: true });
            return;
        }
        await interaction.deferReply({ ephemeral: true });
        // get the inputs
        const user = interaction.options.getString('user', true);

        // if the string contains non-numeric characters, treat it as a URL
        // extract their profile id from the provided url
        const isNumeric = (/^\d+$/).test(user);

        // numeric = discordid
        if (isNumeric) {
            // query the db for the provided input
            const pgQuery = await pool.query('SELECT forumid FROM chatot.identities WHERE discordid=$1', [user]);
            const dbmatches: { forumid: string }[] | [] = pgQuery.rows;

            // give them the results
            if (dbmatches.length) {
                // fetch their discord profile
                // const profile = await interaction.client.users.fetch(user);
                await interaction.followUp(`Here's a link to their forum profile https://www.smogon.com/forums/members/${dbmatches[0].forumid}`);
            }
            else {
                await interaction.followUp('No connection found.');
            }
        }
        // nonnumeric = url
        else {
            // extract their profile id from the provided url
            const forumid = user.match(/(?<=[./])\d+/g)?.pop();

            if (forumid === undefined) {
                await interaction.followUp('Unrecognized profile URL');
                return;
            }

            // query the db for the provided input
            const pgQuery = await pool.query('SELECT discordid FROM chatot.identities WHERE forumid=$1', [Number(forumid)]);
            const dbmatches: { discordid: string }[] | [] = pgQuery.rows;

            // give them the results
            if (dbmatches.length) {
                // fetch their discord profile
                // const profile = await interaction.client.users.fetch(user);

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