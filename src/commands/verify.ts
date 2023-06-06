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
            .setDescription('URL or username of your forum profile. Enter your tag into forum Account Details > Identities first')
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
        let userData: { user_id: number, field_value: string, register_date: number }[] | [] = [];

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
            // try to extract their profile id from the provided string
            forumid = profileURL.match(/^(?:https?:\/\/)?(?:www\.)?smogon\.com\/forums\/members\/(?:(.*?)\.)?(\d+)\/?$/)?.pop();

            // at this point, forumid is either a string or undefined
            // if it's a string, they provided a url
            if (typeof forumid === 'string') {
                forumid = Number(forumid);
                // query the db to get their username and field value from the provided ID
                const [sqlMatch] = await sqlPool.execute(`
                    SELECT xenforo.xf_user.user_id, field_value, register_date
                    FROM xenforo.xf_user
                    INNER JOIN xenforo.xf_user_field_value ON xenforo.xf_user.user_id = xenforo.xf_user_field_value.user_id
                    WHERE xenforo.xf_user.user_id = ? AND field_id = "discord"`, [forumid]);
                
                // cast to meaningful array
                userData = sqlMatch as { user_id: number, field_value: string, register_date: number }[] | [];
            }
            else {
                // assume they entered their username and try to find their forum ID based on that
                const [sqlMatch] = await sqlPool.execute(`
                    SELECT xenforo.xf_user.user_id, field_value, register_date
                    FROM xenforo.xf_user 
                    INNER JOIN xenforo.xf_user_field_value ON xenforo.xf_user.user_id = xenforo.xf_user_field_value.user_id 
                    WHERE xenforo.xf_user.username = ? AND field_id = "discord"`, [profileURL]);

                // cast the result as a meaningful array
                userData = sqlMatch as { user_id: number, field_value: string, register_date: number }[] | [];
            }

            // if we didn't get a match, they didn't provide a valid profile url or username, so let them know
            if (!userData.length) {
                await interaction.followUp('Profile not found. Please provide either your forum profile URL or your exact forum username.');
                return;
            }

            // make sure the provided name is the same as the person using this command
            let discordFieldUsername = userData[0].field_value;
            // if they didn't provide a #1234, assume they're on the new system
            // for now, the system appends #0 to users
            if (!discordFieldUsername.includes('#')) {
                discordFieldUsername += '#0';
            }

            if (discordFieldUsername !== interaction.user.tag) {
                await interaction.followUp('Your forum account does not have your Discord tag in your Identities. Did you enter your username correctly on your profile in the appropriate field? <https://www.smogon.com/forums/account/account-details>');
                return;
            }

            // if we're still here, it's a match
            // so write to the database to store the link
            forumid = userData[0].user_id;
            // upsert into the db
            await pool.query('INSERT INTO chatot.identities (discordid, forumid) VALUES ($1, $2) ON CONFLICT (discordid) DO UPDATE SET discordid=EXCLUDED.discordid, forumid=EXCLUDED.forumid', [interaction.user.id, forumid]);
        }

        
        // remove their role
        // but first check if verification is used in the server
        const reqPG = await pool.query('SELECT roleid, age FROM chatot.verifyreqs WHERE serverid=$1', [interaction.guild.id]);
        const reqMatches: { roleid: string, age: number }[] | [] = reqPG.rows;

        if (reqMatches.length) {
            // check their account age if necessary
            if (reqMatches[0].age !== 0) {
                // get their account age from the forum table
                // there should only be at most 1 value
                let joinDate = 0;

                // if userData is populated, we already have their register date
                if (userData.length) {
                    joinDate = userData[0].register_date;
                }
                // if it's not, they short-circuited verify and we only have their forumid atm
                // so we need to query the xf tables
                else {
                    const [sqlMatchDate] = await sqlPool.execute('SELECT register_date FROM xenforo.xf_user WHERE user_id = ?', [forumid]);

                    // cast the result as a meaningful array
                    // this array should never be empty because we already verified it's a valid user when they registered it
                    const joinDateMatch = sqlMatchDate as { register_date: number }[] | [];
                    if (joinDateMatch.length) {
                        joinDate = joinDateMatch[0].register_date;
                    }
                    else {
                        // this should be extremely rare
                        await interaction.followUp('User account no longer found. Were they deleted?');
                        return;
                    }
                }

                
                // compute the number of days since registered
                const daysRegistered = Math.floor(((Date.now() / 1000) - joinDate) / 86400);

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
        await interaction.followUp('Discord and forum profiles linked!');
        return;

    },
};