import { SlashCommandBuilder, ChatInputCommandInteraction} from 'discord.js';
import { SlashCommand } from '../types/slash-command-base';
import { pool } from '../helpers/createPool.js';
import { errorHandler } from '../helpers/errorHandler.js';

export const command: SlashCommand = {
    global: false,
    guilds: [],
    // setup the slash command builder
    data: new SlashCommandBuilder()
        .setName('syncgban')
        .setDescription('Ensures all gbans are currently enforced')
        .setDMPermission(false)
        .setDefaultMemberPermissions(0),

    // execute our desired task
    async execute(interaction: ChatInputCommandInteraction) {
        await interaction.deferReply();

        if (!interaction.guild) {
            await interaction.followUp('This command can only be used in a server');
            return;
        }

        // make sure gbans are enabled here
        const guildClass: { class: number }[] = (await pool.query('SELECT class FROM chatot.servers WHERE serverid=$1', [interaction.guildId])).rows;

        if (!guildClass.length || guildClass[0].class < 1) {
            await interaction.followUp('gbans are not currently enforced in this server. If you wish to subscribe to global bans, please first opt in with the `/opt in` command.');
            return;
        }

        // to save on api calls, get the current list of bans in the server
        const banList = await interaction.guild.bans.fetch();

        // get the list of currently banned users from the db
        const currentGbans: { target: string }[] = (await pool.query('SELECT target FROM chatot.gbans WHERE unbanned = false')).rows;

        // get the difference between the two
        const missingGbans = currentGbans.filter(b => !banList.has(b.target));

        for (const ban of missingGbans) {
            try {
                await interaction.guild.members.ban(ban.target, {
                    reason: 'sync gban',
                    deleteMessageSeconds: 0,
                    });
            }
            catch (e) {
                errorHandler(e);
                continue;
            }
        }

        await interaction.followUp(`gbans synced. ${missingGbans.length} new bans were found.`);

    },
};