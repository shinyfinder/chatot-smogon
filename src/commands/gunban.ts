import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import { SlashCommand } from '../types/slash-command-base';
import { pool } from '../helpers/createPool.js';
import { botConfig } from '../config.js';
import { errorHandler } from '../helpers/errorHandler.js';

interface IModlogPG {
    serverid: string,
    date: Date,
    reason: string
}

/**
 * Command to globally unban a user.
 * This command essentially undoes a gban.
 * Users who were banned before they were gbanned are left banned in the respective servers.
 */
export const command: SlashCommand = {
    global: false,
    guilds: ['192713314399289344'],
    // setup the slash command builder
    data: new SlashCommandBuilder()
        .setName('gunban')
        .setDescription('Globally unbans a user, if they were banned with gban')
        .addUserOption(option =>
            option.setName('user')
            .setDescription('The user to be unbanned (can accept IDs)')
            .setRequired(true))
        .addStringOption(option =>
            option.setName('reason')
            .setDescription('Optional reason for the unban (for the audit log)')
            .setRequired(false))
        .setDMPermission(false)
        .setDefaultMemberPermissions(0),

    // execute our desired task
    async execute(interaction: ChatInputCommandInteraction) {
        await interaction.deferReply();
        // make sure this command is used in a guild
        if (!interaction.guild) {
            await interaction.followUp({ content: 'This command can only be used in a server!', ephemeral: true });
            return;
        }

        // get the inputs
        const user = interaction.options.getUser('user', true);
        const auditEntry = interaction.options.getString('reason') ?? 'Unbanned from forums';
       
        // get the list of guild IDs the bot is in
        const guildIds = interaction.client.guilds.cache.map(guild => guild.id);

        // get the gban data for this user
        const gbanPG = await pool.query('SELECT date, reason FROM chatot.gbans WHERE target=$1', [user.id]);
        const gbanData: { date: Date, reason: string }[] | [] = gbanPG.rows;

        // if they provded a user that wasn't gbanned, return
        if (!gbanData.length) {
            await interaction.followUp('User was not globally banned, and thus cannot be globally unbanned');
            return;
        }

        // get the modlog entry for this user across all of the servers
        const modlogPG = await pool.query('SELECT serverid, date, reason FROM chatot.modlog WHERE executor=$1 AND action=$2 AND target=$3 ORDER BY date DESC', [botConfig.CLIENT_ID, 'Ban', user.id]);
        const modlogRows: IModlogPG[] | [] = modlogPG.rows;

        // at this point the PG query will return all bans associated with each user.
        // because there could be several over time, we just want the latest one for each server
        // which is presumably the active ban
        const uniqGbans: IModlogPG[] = [];

        // loop over the bans
        for (const gban of modlogRows) {
            // see if the ban is in the holding array
            // if it's not, add the entry
            if (!uniqGbans.some(ban => ban.serverid === gban.serverid)) {
                uniqGbans.push(gban);
            }
        }

        // uniqGbans is now an array of the current server ban for the user for each server

        // for comparison later, find the upper and lower bound of allowable times to compare with the gban data
        // use +/- 5 min, which should be more than enough time
        const ubound = gbanData[0].date.valueOf() + 5 * 60 * 1000;
        const lbound = gbanData[0].date.valueOf() - 5 * 60 * 1000;

        // try to unban from every guild, if they were banned because of the gban
        // to determine whether the active ban is because of the gban, we compare the date and reason
        for (const id of guildIds) {
            // fetch the guild to make sure we have access to all the methods
            const guild = await interaction.client.guilds.fetch(id);

            // get the modlog ban reason for this guild
            // there should only be 1
            const modlogBan = uniqGbans.filter(ban => ban.serverid === id)[0];

            // if you found an entry
            if (modlogBan) {
                // compare its date and reason with the gban data
                // the date won't be exactly the same, so just see if it's close enough (+/- 5 min)
                // if it's outside the range or a different reason, skip it
                const modlogBanVal = modlogBan.date.valueOf();
                if (modlogBanVal < lbound || modlogBanVal > ubound || modlogBan.reason !== gbanData[0].reason) {
                    continue;
                }
            }
            // otherwise, skip it
            else {
                continue;
            }

            // try to unban them
            // catch any errors but continue so we can unban as many as possible
            try {
                await guild.bans.remove(user, auditEntry);
            }
            catch (e) {
                errorHandler(e);
                continue;
            }
        }

        // let them know we're done
        await interaction.followUp(`I attempted to unban ${user.username} from every server I gbanned them from`);
        
    },
};