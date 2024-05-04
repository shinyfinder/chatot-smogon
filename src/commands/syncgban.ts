import { SlashCommandBuilder, ChatInputCommandInteraction, PermissionFlagsBits, DiscordAPIError } from 'discord.js';
import { SlashCommand } from '../types/slash-command-base';
import { pool } from '../helpers/createPool.js';
import { errorHandler } from '../helpers/errorHandler.js';

/**
 * Tries to ban all active gbans. This is useful if Chatot was added late to a server
 */
export const command: SlashCommand = {
    global: true,
    guilds: [],
    // setup the slash command builder
    data: new SlashCommandBuilder()
        .setName('syncgban')
        .setDescription('Ensures all gbans are enforced')
        .setDMPermission(false)
        .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),

    // execute our desired task
    async execute(interaction: ChatInputCommandInteraction) {
        await interaction.deferReply();

        if (!interaction.guild || !interaction.channel) {
            await interaction.followUp('This command can only be used in a server');
            return;
        }

        // make sure gbans are enabled here
        const guildClass: { class: number }[] = (await pool.query('SELECT class FROM chatot.servers WHERE serverid=$1', [interaction.guildId])).rows;

        if (!guildClass.length || guildClass[0].class < 1) {
            await interaction.followUp('gbans are not currently enforced in this server. If you wish to subscribe to global bans, please first opt in with the `/opt in` command.');
            return;
        }

        // also make sure we have the ability to ban
        const bot = await interaction.guild.members.fetchMe();
        if (!bot.permissions.has(PermissionFlagsBits.BanMembers)) {
            await interaction.followUp('I do not have the Ban Members permission. Cannot continue.');
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
                if (e instanceof DiscordAPIError && e.message.includes('Missing Permissions')) {
                    await interaction.followUp(`I cannot ban id ${ban.target} because I lack the permissions to do so, probably because they have a role higher than mine in the roles list. Please ensure my role is adequately placed in the Roles menu then run this command again. Exiting`);
                    return;
                }
                await interaction.channel.send(`Cannot ban id ${ban.target}`);
                continue;
            }
        }

        await interaction.followUp(`gbans synced. ${missingGbans.length} new bans were found.`);

    },
};