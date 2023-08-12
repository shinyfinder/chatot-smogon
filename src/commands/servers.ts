import { SlashCommandBuilder, ChatInputCommandInteraction, PermissionFlagsBits } from 'discord.js';
import { SlashCommand } from '../types/slash-command-base';

/**
 * Prints a list of servers the bot is in.
 * Useful for knowing which servers the bot banned a user from in the case of gban
 */
export const command: SlashCommand = {
    global: false,
    guilds: ['1040378543626002442'],
    // setup the slash command builder
    data: new SlashCommandBuilder()
        .setName('servers')
        .setDescription('Lists the servers the bot is in')
        .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),

    // execute our desired task
    async execute(interaction: ChatInputCommandInteraction) {
        await interaction.deferReply();
        // get the list of guilds the bot is in
        const guildNames = interaction.client.guilds.cache.map(guild => guild.name);

        // sort them alphabetically
        guildNames.sort((a, b) => a.localeCompare(b, 'en-US', { ignorePunctuation: true }));

        /*
        // get the list of guildIDs to check for duplicates
        const guildIDs = interaction.client.guilds.cache.map(guild => guild.id);
        const uniqGuildIDs = [...new Set(guildIDs)];

        // get the suspicous servers
        const susGuilds = interaction.client.guilds.cache.filter(g => g.name === 'Smogon' || g.name === 'OU Draft Server');
        // get their owners
        const susOwnerIDs = susGuilds.map(({ name, ownerId }) => ({ name, ownerId }));

        // print
        for (const susOwner of susOwnerIDs) {
            const susUser = await interaction.client.users.fetch(susOwner.ownerId);
            await interaction.channel?.send((`${susOwner.name}: ${susUser.displayName} ${susUser.username} (${susUser.toString()})`));
        }


        // respond
        await interaction.followUp(`${guildNames.join(', ')}\n\nTotal: ${guildNames.length} | Repeats: ${guildIDs.length - uniqGuildIDs.length}`);
        */

        // respond
        await interaction.followUp(`${guildNames.join(', ')}\n\nTotal: ${guildNames.length}`);
    },
};