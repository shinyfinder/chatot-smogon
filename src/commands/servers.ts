import { SlashCommandBuilder, ChatInputCommandInteraction, PermissionFlagsBits } from 'discord.js';
import { SlashCommand } from '../types/slash-command-base';
import { buildEmbed, embedField } from '../helpers/logging.js';
/**
 * Prints a list of servers the bot is in,
 * or the details of the specified server.
 * Useful for knowing which servers the bot banned a user from in the case of gban
 */
export const command: SlashCommand = {
    global: false,
    guilds: ['1040378543626002442', '192713314399289344'],
    // setup the slash command builder
    data: new SlashCommandBuilder()
        .setName('servers')
        .setDescription('Lists the servers the bot is in, or optionally the details of the provided one')
        .addStringOption(option =>
            option.setName('name')
            .setDescription('Name (or id) of the server to query. Bot must be in it')
            .setRequired(false))
        .setDMPermission(false)
        .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),

    // execute our desired task
    async execute(interaction: ChatInputCommandInteraction) {
        await interaction.deferReply();
        // get the list of guilds the bot is in
        const guildNames = interaction.client.guilds.cache.map(guild => guild.name);
        const owners = interaction.client.guilds.cache.map(guild => guild.ownerId);

        // sort them alphabetically
        guildNames.sort((a, b) => a.localeCompare(b, 'en-US', { ignorePunctuation: true }));

        // get the user input
        const guildQ = interaction.options.getString('name');

        // try to find the server in the cache if they provided one
        // otherwise, just return with the list of guild names
        if (guildQ) {
            const guildObj = interaction.client.guilds.cache.filter(g => g.name.toLowerCase() === guildQ.toLowerCase() || g.id === guildQ);
            // if you found something, print the output
            if (guildObj.size) {
                for (const guild of guildObj.values()) {
                    // fetch the owner object
                    const owner = await guild.fetchOwner();

                    // build an embed
                    const title = 'Server Details';
                    const desc = `Showing details for server ${guildQ}`;
                    const fields: embedField[] = [
                        { name: 'Name', value: guild.name, inline: true },
                        { name: 'ID', value: guild.id, inline: true },
                        { name: 'Owner', value: `${owner.user.displayName} | ${owner.user.username} (<@${guild.ownerId}>)` },
                    ];

                    const embed = buildEmbed(title, { description: desc, fields: fields });

                    // post it
                    await interaction.followUp({ embeds: [embed] });
                }
            }
            else {
                await interaction.followUp('I am not in a guild that matches the provided info. Are you sure it is correct?');
            }
        }
        else {
            // respond
            await interaction.followUp(`${guildNames.join(', ')}\n\nTotal: ${guildNames.length} | Unique owners: ${[...new Set(owners)].length}`);
        }
    },
};