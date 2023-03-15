import { SlashCommandBuilder, ChatInputCommandInteraction, PermissionFlagsBits, EmbedBuilder } from 'discord.js';
import { SlashCommand } from '../types/slash-command-base';
import { pool } from '../helpers/createPool.js';

/**
 * Retrieves the list of modlog actions for a given user
 * Logged actions are ban add/remove, kick, and (un)timeout
 */

export const command: SlashCommand = {
    global: true,
    // setup the slash command builder
    data: new SlashCommandBuilder()
        .setName('modlog')
        .setDescription('Retrieves the modlog for a given user (punishment receiver)')
        .setDMPermission(false)
        .addUserOption(option =>
            option.setName('user')
            .setDescription('Username (id) to lookup actions against in this server')
            .setRequired(true),
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),
    // execute our desired task
    async execute(interaction: ChatInputCommandInteraction) {
        // get the id of the server this command was used in and the supplied user
        const serverid = interaction.guildId;
        const user = interaction.options.getUser('user');

        // typecheck
        if (serverid === null || user === null) {
            return;
        }
        // defer reply to give us time to poll the db
        await interaction.deferReply();

        // query the db
        interface pgres {
            executor: string,
            action: string,
            date: string,
            reason: string,
        }

        const modlogPostgres = await pool.query('SELECT executor, action, date, reason FROM chatot.modlog WHERE serverid = $1 AND target = $2', [serverid, user.id]);
        const dbmatches = modlogPostgres.rows as pgres[] | [];
        
        if (!dbmatches.length) {
            await interaction.followUp('No modlog for this user found');
            return;
        }
        // sort the array by timestamp
        // most recent first
        dbmatches.sort((a, b) => new Date(b.date).valueOf() - new Date(a.date).valueOf());

        // formulate output
        const strOut = [];
        for (const row of dbmatches) {
            // convert the date to a discord timestamp
            const ts = Math.floor(new Date(row.date).valueOf() / 1000);

            // get the executor name
            const execUser = await interaction.client.users.fetch(row.executor);

            // make the output string
            const str = `<t:${ts}> - ${row.action} by ${execUser.tag} - ${row.reason}`;
            strOut.push(str);
        }

        // build embed
        const embed = new EmbedBuilder()
            .setTitle(`Modlog for ${user.tag}`)
            .setDescription(strOut.join('\n\n'));
        
        // post the embed
        await interaction.followUp({ embeds: [embed] });
        return;


    },

};