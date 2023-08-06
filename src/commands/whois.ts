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
        .setDescription('Looks up information about a provided user')
        .addSubcommand(new SlashCommandSubcommandBuilder()
            .setName('forums')
            .setDescription('Looks up a user\'s discord-forum connection')    
            .addStringOption(option =>
                option.setName('user')
                .setDescription('Discord user ID or forum profile URL/username')
                .setRequired(true)))
        .addSubcommand(new SlashCommandSubcommandBuilder()
            .setName('findid')
            .setDescription('Finds a user\'s Discord user id if they share a server')
            .addStringOption(option =>
                option.setName('accountname')
                .setDescription('Discord account name (not display name)')
                .setRequired(true)))
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

        /**
         * FORUM LOOKUP
         */
        if (interaction.options.getSubcommand() === 'forums') {
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
            // nonnumeric = url or username
            else {
                // extract their profile id from the provided url
                let forumid: string | number | undefined = user.match(/^(?:https?:\/\/)?(?:www\.)?smogon\.com\/forums\/members\/(?:(.*?)\.)?(\d+)\/?$/)?.pop();

                // if forumid is undefined, assume they entered a username
                if (forumid === undefined) {
                    // query the xf tables to get their id
                    // we don't store usernames because of namechanges
                    const [sqlMatch] = await sqlPool.execute('SELECT user_id FROM xenforo.xf_user WHERE username = ?', [user]);

                    // cast to meaningful array
                    const idArr = sqlMatch as { user_id: number }[] | [];

                    // if we didn't get a match, let them know
                    if (idArr.length) {
                        forumid = idArr[0].user_id;
                    }
                    else {
                        await interaction.followUp('Profile not found. Please provide the URL or exact username of your forum profile.');
                        return;
                    }
                    
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
        }

        /**
         * ID LOOKUP
         */
        else if (interaction.options.getSubcommand() === 'findid') {
            // get the user input
            const username = interaction.options.getString('accountname', true);

            // check the current guild first in an attempt to short circuit the search
            const currentMembers = await interaction.guild.members.fetch();
            const currentFound = currentMembers.filter(member => member.displayName === username.toLowerCase()).first();
            if (currentFound) {
                await interaction.followUp(`${currentFound.displayName}'s user id is ${currentFound.id}`);
                return;
            }

            // loop over the guilds the bot is in, looking for someone with that username
            for (const guild of interaction.client.guilds.cache.values()) {
                // don't bother rechecking the current one
                if (guild.id === interaction.guildId) {
                    continue;
                }
                const memberList = await guild.members.fetch();
                // as of now, member.displayname = user.username = name on account
                // there isn't a way to retrieve display name
                const foundUser = memberList.filter(member => member.displayName === username.toLowerCase()).first();

                if (foundUser) {
                    await interaction.followUp(`${foundUser.displayName}'s user id is ${foundUser.id}`);
                    return;
                }
                else {
                    continue;
                }

            }

            // if you're here, you didn't find a match, so let them know
            await interaction.followUp(`ID not found. I do not share a guild with ${username}`);

        }
        

    },
};