import { SlashCommandBuilder, ChatInputCommandInteraction, DiscordAPIError, PermissionFlagsBits } from 'discord.js';
import { SlashCommand } from '../types/slash-command-base';
import { pool } from '../helpers/createPool.js';

export const command: SlashCommand = {
    global: false,
    guilds: ['192713314399289344'],
    // setup the slash command builder
    data: new SlashCommandBuilder()
        .setName('checkgban')
        .setDescription('Checks each server for the ability to ban a user')
        .addUserOption(option =>
            option.setName('user')
            .setDescription('The user to lookup (can accept IDs')
            .setRequired(true))
        .setDMPermission(false)
        .setDefaultMemberPermissions(0) as SlashCommandBuilder,

    // execute our desired task
    async execute(interaction: ChatInputCommandInteraction) {
        await interaction.deferReply();

        // get the user input
        const user = interaction.options.getUser('user', true);

        // get the list of official guild ids
        const guildRows: { serverid: string}[] | [] = (await pool.query('SELECT serverid FROM chatot.servers WHERE class = 2')).rows;
        const officialIDs = guildRows.map(r => r.serverid);

        // loop over the list of guilds to determine whether the user is bannable
        const nonBanGuilds: string[] = [];

        for (const id of officialIDs) {
            // get the guild obj from the cache
            // this shouldn't be undef as we manage the db on server part
            // but typecheck just in case
            const guild = interaction.client.guilds.cache.get(id);
            if (!guild) {
                continue;
            }
            
            // try to get the member object of this user
            try {
                const member = await guild.members.fetch(user);

                // if you can't ban them, store the name of the guild
                if (!member.bannable) {
                    nonBanGuilds.push(guild.name);
                }
                else {
                    continue;
                }

            }
            // if we couldn't fetch them, then they aren't in the guild
            // so we need to make sure we have ban perms
            catch (e) {
                if (e instanceof DiscordAPIError && e.message.includes('Unknown Member')) {
                    // fetch our member instance
                    const me = await guild.members.fetchMe();
                    // make sure we have the relevant perms
                    if (!(me.permissions.has(PermissionFlagsBits.BanMembers) || me.permissions.has(PermissionFlagsBits.Administrator))) {
                        nonBanGuilds.push(guild.name);
                    }
                    else {
                        continue;
                    }
                }
                // if it's some other error, throw
                else {
                    throw e;
                }
            }
        }

        // alert the results
        if (nonBanGuilds.length) {
            await interaction.followUp(`${user.tag} cannot be banned from the following guilds:\n${nonBanGuilds.join(', ')}`);
        }
        else {
            await interaction.followUp(`${user.tag} is bannable in every guild`);
        }
    },
};