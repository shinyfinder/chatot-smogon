import { SlashCommandBuilder, ChatInputCommandInteraction, PermissionFlagsBits, GuildMember, Collection, SlashCommandSubcommandBuilder, GuildBan } from 'discord.js';
import { SlashCommand } from '../types/slash-command-base';
import { pool } from '../helpers/createPool.js';

/**
 * Command to lookup information about a user or to find a particular ban in the ban list
 *
 */
export const command: SlashCommand = {
    global: true,
    guilds: [],
    // setup the slash command builder
    data: new SlashCommandBuilder()
        .setName('find')
        .setDescription('Attempts to locate the searched item')
        .addSubcommand(new SlashCommandSubcommandBuilder()
            .setName('user')
            .setDescription('Retrieves a user\'s profile given their Discord display-, nick-, or username')
            .addStringOption(option =>
                option.setName('name')
                .setDescription('Discord display name, nickname, or username')
                .setRequired(true)))
        .addSubcommand(new SlashCommandSubcommandBuilder()
            .setName('ban')
            .setDescription('Finds the ban in the server with the provided info')
            .addStringOption(option =>
                option.setName('search')
                .setDescription('Username, display name, user id, or ban reason')
                .setRequired(true)))
        .addSubcommand(new SlashCommandSubcommandBuilder()
            .setName('alts')
            .setDescription('Finds any alts of a Discord user via their Smogon forum connection')
            .addUserOption(option =>
                option.setName('discord')
                .setDescription('Discord account (can also accept user IDs)')
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

        if (interaction.options.getSubcommand() === 'user') {
            // get the user input
            const username = interaction.options.getString('name', true).toLowerCase();

            // holder for each member found that matches the entered name
            let foundMembers: Collection<string, GuildMember> = new Collection;

            // check the current guild first to get the most relevant info
            const currentMembers = await interaction.guild.members.fetch();
            const currentFound = currentMembers.filter(member => member.nickname?.toLowerCase() === username || member.user.username === username || member.user.displayName.toLowerCase() === username);
            // if you got a match, concat it into the holder
            if (currentFound) {
                foundMembers = foundMembers.merge(currentFound, oldFound => ({ keep: true, value: oldFound }), newFound => ({ keep: true, value: newFound }), () => ({ keep: false }));
            }

            // loop over the guilds the bot is in, looking for someone with that username
            for (const guild of interaction.client.guilds.cache.values()) {
                // skip rechecking the current server
                if (guild.id === interaction.guildId) {
                    continue;
                }
                // fetch the guild member list
                const memberList = await guild.members.fetch();

                // filter out the users we care about
                const matchingMembers = memberList.filter(member => member.nickname?.toLowerCase() === username || member.user.username === username || member.user.displayName.toLowerCase() === username);
                
                // if you found a match, add it to the holder
                // keep the first found result so we don't duplicate users
                if (matchingMembers) {
                    foundMembers = foundMembers.merge(matchingMembers, oldFound => ({ keep: true, value: oldFound }), newFound => ({ keep: true, value: newFound }), (oldFound) => ({ keep: true, value: oldFound }));
                }
                else {
                    continue;
                }

            }

            // get the unique members
            let strOut = '';
            for (const mem of foundMembers.values()) {
                strOut += `${mem.displayName} (${mem.user.username}): ${mem.toString()}\n`;
            }

            // alert with results
            if (strOut.length) {
                await interaction.followUp(strOut);
            }
            else {
                await interaction.followUp('User not found in any shared servers');
            }
        }
        else if (interaction.options.getSubcommand() === 'ban') {
            // get the user input
            const str = interaction.options.getString('search', true).toLowerCase();

            // get the collection of bans in the server
            // discord returns a max of 1000 at a time
            // so we need to build the entire collection via iteration
            let numReturned = 1000;
            let banlist: Collection<string, GuildBan> = new Collection;
            let lastBan: string | undefined = '0';

            while (numReturned === 1000) {
                // retieve up to 1000 bans from the api
                const bans: Collection<string, GuildBan> = await interaction.guild.bans.fetch({ after: lastBan, limit: 1000 });

                // get the user id of the last ban for pagination
                lastBan = bans.last()?.user.id;

                // get the number of bans returned to break the loop
                // if this number is < 1000, there are no more bans to be retrieved
                numReturned = bans.size;

                // concat the retrieved collection with the old one
                banlist = banlist.merge(bans, oldFound => ({ keep: true, value: oldFound }), newFound => ({ keep: true, value: newFound }), () => ({ keep: false }));
            }

            // filter the built collection for the value entered
            const bannedMatches = banlist.filter(ban => ban.user.username.includes(str) || ban.user.displayName.toLowerCase().includes(str) || ban.user.id === str || ban.reason?.toLowerCase().includes(str));

            // if you found a match, output the ids so that they can enter the id into the ban menu
            if (bannedMatches.size) {
                const bannedIDs = bannedMatches.map(ban => ban.user.id);
                await interaction.followUp(`Matching bans found. Please enter the following user ID(s) into the Discord bans menu to find the ban: ${bannedIDs.join(', ')}`);
            }
            // otherwise, let them know nothing was found
            else {
                await interaction.followUp('No bans found with that criteria.');
            }
        }

        else if (interaction.options.getSubcommand() === 'alts') {
            // input
            const user = interaction.options.getUser('discord', true);

            // lookup their alts via the tables
            const altRowsQ = await pool.query(`
            WITH forum_account AS
            (SELECT forumid FROM chatot.identities WHERE discordid=$1)
            
            SELECT discordid, forumid FROM chatot.identities WHERE forumid = (SELECT * FROM forum_account)`, [user.id]);
            
            const altRows: { discordid: string, forumid: number }[] | [] = altRowsQ.rows;

            if (altRows.length === 0) {
                await interaction.followUp('No Discord-forum connection found!');
            }
            else if (altRows.length === 1) {
                await interaction.followUp('No alts found!');
            }
            else {
                const altTags = altRows.map(r => `<@${r.discordid}>`);
                await interaction.followUp(`These Discord accounts have verified with the same forum account: ${altTags.join(', ')}\nProfile: https://www.smogon.com/forums/members/${altRows[0].forumid}`);
            }
        }
    },
};