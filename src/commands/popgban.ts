import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import { SlashCommand } from '../types/slash-command-base';
import { pool } from '../helpers/createPool.js';
import { botConfig } from '../config.js';

interface IModlogPG {
    target: string,
    date: Date,
    reason: string
}
/**
 * Populates the database of gban information
 * This is currently a dev-only command
 */
export const command: SlashCommand = {
    global: false,
    guilds: ['1040378543626002442'],
    // setup the slash command builder
    data: new SlashCommandBuilder()
        .setName('popgban')
        .setDescription('Populates the database of gban information')
        .setDMPermission(false)
        .setDefaultMemberPermissions(0),

    // execute our desired task
    async execute(interaction: ChatInputCommandInteraction) {
        await interaction.deferReply({ ephemeral: true });

        // fetch the bans from the dev cord
        // the only bans here should be gbans
        const devGuild = interaction.client.guilds.cache.get('1040378543626002442');
        const devBans = await devGuild?.bans.fetch({ limit: 1000 });

        // if there aren't any bans, return
        if (!devBans || !devBans.size) {
            return;
        }
        const gbanIDs = devBans.map(ban => ban.user.id);

        // for each ban, find the associated modlog entry.
        // this should be the latest one
        const modlogPG = await pool.query('SELECT target, date, reason FROM chatot.modlog WHERE executor=$1 AND action=$2 AND target=ANY($3) ORDER BY date DESC', [botConfig.CLIENT_ID, 'Ban', gbanIDs]);
        const modlogRows: IModlogPG[] | [] = modlogPG.rows;

        // at this point the PG query will return all bans associated with each user.
        // because there could be several over time, we just want the latest one
        // which is presumably the active ban
        const uniqGbans: IModlogPG[] = [];

        // loop over the bans
        for (const gban of modlogRows) {
            // see if the ban is in the holding array
            // if it's not, add the entry
            if (!uniqGbans.some(ban => ban.target === gban.target)) {
                uniqGbans.push(gban);
            }
        }

        // insert the unique gban entries into the database to populate it
        const ids = uniqGbans.map(gban => gban.target);
        const dates = uniqGbans.map(gban => gban.date);
        const reasons = uniqGbans.map(gban => gban.reason);

        await pool.query(`
        INSERT INTO chatot.gbans (target, date, reason)
        VALUES (UNNEST($1::text[]), UNNEST($2::timestamptz[]), UNNEST($3::text[]))
        ON CONFLICT (target)
        DO UPDATE SET target=EXCLUDED.target, date=EXCLUDED.date, reason=EXCLUDED.reason`, [ids, dates, reasons]);

        // done
        await interaction.followUp('Gban database populated');

    },

};