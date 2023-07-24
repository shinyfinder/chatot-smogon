import { SlashCommandBuilder, ChatInputCommandInteraction, PermissionFlagsBits } from 'discord.js';
import { SlashCommand } from '../types/slash-command-base';

/**
 * Prints a list of servers the bot is in.
 * Useful for knowing which servers the bot banned a user from in the case of gban
 */
export const command: SlashCommand = {
    global: false,
    guilds: ['192713314399289344', '1040378543626002442'],
    // setup the slash command builder
    data: new SlashCommandBuilder()
        .setName('servers')
        .setDescription('Lists the servers the bot is in')
        .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),

    // execute our desired task
    async execute(interaction: ChatInputCommandInteraction) {
        // get the list of guild IDs the bot is in
        const guildNames = interaction.client.guilds.cache.map(guild => guild.name);

        // sort them alphabetically
        guildNames.sort((a, b) => a.localeCompare(b, 'en-US', { ignorePunctuation: true }));

        // respond
        await interaction.reply(`${guildNames.join(', ')}\n\nTotal: ${guildNames.length}`);
    },
};