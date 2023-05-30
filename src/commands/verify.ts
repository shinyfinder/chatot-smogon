import { SlashCommandBuilder, ChatInputCommandInteraction, GuildMember } from 'discord.js';
import { SlashCommand } from '../types/slash-command-base';
import { pool, sqlPool } from '../helpers/createPool.js';

/**
 * Links a user's discord account to their profile
 * 
 */
export const command: SlashCommand = {
    global: true,
    guilds: [],
    // setup the slash command builder
    data: new SlashCommandBuilder()
        .setName('verify')
        .setDescription('Links your discord and forum accounts')
        .addStringOption(option => 
            option.setName('profile')
            .setDescription('Link to your forum profile. Enter your tag into forum Account Details > Identities first')
            .setRequired(false))
        .setDMPermission(false),

    // execute our desired task
    async execute(interaction: ChatInputCommandInteraction) {
        if (!interaction.guild) {
            return;
        }

        await interaction.deferReply({ ephemeral: true });

        // get the url from the input
        const profileURL = interaction.options.getString('profile');
        let forumid: string | number | undefined;

        // if they didn't provide a profile, try to find it in the db in case they already linked it
        if (profileURL === null) {
            const idPG = await pool.query('SELECT forumid from chatot.identities WHERE discordid=$1', [interaction.user.id]);
            const idMatches: { forumid: number }[] | [] = idPG.rows;

            if (idMatches.length) {
                forumid = idMatches[0].forumid;
            }
            else {
                await interaction.followUp('No linked profile found. Please provide a forum URL in the appropriate field when invoking the command.');
                return;
            }
        }
        else {
            // extract their profile id from the provided url
            forumid = profileURL.match(/(?<=[./])\d+/g)?.pop();
        }

        // if you couldn't parse the ID from the url, let them know and return
        if (forumid === undefined) {
            await interaction.followUp('Unrecognized profile URL');
            return;
        }
        else if (typeof forumid === 'string') {
            forumid = Number(forumid);
        }

        // get the value of their Discord field off the provided profile
        // there should only be at most 1 value
        const [sqlMatch] = await sqlPool.execute('SELECT field_value FROM xenforo.xf_user_field_value WHERE user_id = ? AND field_id = "discord"', [forumid]);

        // cast the result as a meaningful array
        const userField = sqlMatch as { field_value: string }[] | [];

        // if we didn't get a match, they didn't provide a valid profile url, so let them know
        if (!userField.length) {
            await interaction.followUp(`User with id ${forumid} not found`);
            return;
        }
        // make sure the provided name is the same as the person using this command
        else if (userField[0].field_value !== interaction.user.tag) {
            await interaction.followUp('Your fourm account does not have your Discord tag in your Identities. Did you enter your username correctly?');
            return;
        }

        // if we're still here, it's a match
        // so write to the database to store the link

        // upsert into the db
        await pool.query('INSERT INTO chatot.identities (discordid, forumid) VALUES ($1, $2) ON CONFLICT (discordid) DO UPDATE SET discordid=EXCLUDED.discordid, forumid=EXCLUDED.forumid', [interaction.user.id, forumid]);

        // remove their role
        // but first check if verification is used in the server
        const reqPG = await pool.query('SELECT roleid, age FROM chatot.verifyreqs WHERE serverid=$1', [interaction.guild.id]);
        const reqMatches: { roleid: string, age: number }[] | [] = reqPG.rows;

        if (reqMatches.length) {
            // check their account age if necessary
            if (reqMatches[0].age !== 0) {
                // get their account age from the forum table
                // there should only be at most 1 value
                const [sqlMatchDate] = await sqlPool.execute('SELECT register_date FROM xenforo.xf_user WHERE user_id = ?', [forumid]);

                // cast the result as a meaningful array
                const joinDate = sqlMatchDate as { register_date: number }[] | [];

                // compute the number of days since registered
                const daysRegistered = Math.floor(((Date.now() / 1000) - joinDate[0].register_date) / 86400);

                // compare against the server req
                // if their account isn't old enough, give them the role
                if (daysRegistered < reqMatches[0].age) {
                    await interaction.followUp(`Your Discord and forum profiles were linked; however, your account was created too recently for this server's verification requirements. Please run the \`verify\` command again in this server in **${reqMatches[0].age - daysRegistered} days**.`);
                    return;
                }
            }

            // get the unverified role and member object of the user who initiated the command
            const role = interaction.guild.roles.cache.get(reqMatches[0].roleid);
            const member = await interaction.guild.members.fetch(interaction.user.id);
            // typecheck to make sure the API resolved
            if (role === undefined || !(member instanceof GuildMember)) {
                return;
            }

            // remove if present on member
            if (member.roles.cache.some(r => r.id === role.id)) {
                await member.roles.remove(role);
            }

        }

        // let them know success
        await interaction.followUp('Discord and forum profiles linked! You have been given access to this server. Please enjoy your stay.');
        return;

    },
};