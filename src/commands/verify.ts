import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import { SlashCommand } from '../types/slash-command-base';
import { pool } from '../helpers/createPool.js';

/**
 * Links a user's discord account to their profile
 * 
 */
export const command: SlashCommand = {
    global: false,
    guilds: [],
    // setup the slash command builder
    data: new SlashCommandBuilder()
        .setName('verify')
        .setDescription('Links your discord and forum accounts')
        .addStringOption(option => 
            option.setName('profile')
            .setDescription('Link to your forum profile. Enter your tag into forum Account Details > Identities first')
            .setRequired(true))
        .setDMPermission(false),

    // execute our desired task
    async execute(interaction: ChatInputCommandInteraction) {
        await interaction.deferReply({ ephemeral: true });

        // get the url from the input
        const profileURL = interaction.options.getString('profile', true);

        // extract their profile id from the provided url
        const forumid = profileURL.match(/(?<=[./])\d+/g)?.pop();

        if (forumid === undefined) {
            await interaction.followUp('Unrecognized profile URL');
            return;
        }

        /**
         * TODO: Query the forum table
         */

        // upsert into the db
        await pool.query('INSERT INTO chatot.identities (discordid, forumid) VALUES ($1, $2) ON CONFLICT (discordid) DO UPDATE SET discordid=EXCLUDED.discordid, forumid=EXCLUDED.forumid', [interaction.user.id, Number(forumid)]);

        // let them know success
        await interaction.followUp('Discord and forum profiles linked!');
        return;

    },
};