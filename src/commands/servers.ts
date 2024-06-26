import { SlashCommandBuilder, ChatInputCommandInteraction, PermissionFlagsBits, AutocompleteInteraction } from 'discord.js';
import { SlashCommand } from '../types/slash-command-base';
import { buildEmbed, embedField } from '../helpers/logging.js';
import { filterAutocomplete } from '../helpers/autocomplete.js';
import { pool } from '../helpers/createPool.js';
import { ServerClass } from '../helpers/constants.js';
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
            .setRequired(false)
            .setAutocomplete(true))
        .setDMPermission(false)
        .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers) as SlashCommandBuilder,

    // prompt the user with autocomplete options since there are too many tiers to have a selectable list
    async autocomplete(interaction: AutocompleteInteraction) {
        const focusedOption = interaction.options.getFocused(true);

        if (focusedOption.name === 'name') {
            const guildNamesIDs = interaction.client.guilds.cache.map(guild => ({ name: guild.name, id: guild.id }));
            const guildPairs = guildNamesIDs.map(g => ({ name: g.name, value: g.id }));

            await filterAutocomplete(interaction, focusedOption, guildPairs);
        }
    },

    // execute our desired task
    async execute(interaction: ChatInputCommandInteraction) {
        await interaction.deferReply();
        // get the list of guilds the bot is in
        const guildNames = interaction.client.guilds.cache.map(guild => guild.name);
        const owners = interaction.client.guilds.cache.map(guild => guild.ownerId);

        const guildOwnerObjArr = interaction.client.guilds.cache.map(g => ({ serverid: g.id, serverName: g.name, ownerid: g.ownerId }));

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

                    // fetch the gban info
                    const classRows: { class: ServerClass }[] | [] = (await pool.query('SELECT class FROM chatot.servers WHERE serverid=$1', [guild.id])).rows;

                    // get the text associated with the class
                    // if you don't return a row, just assuming its unofficial opted out
                    let classKey = '';
                    if (classRows.length) {
                        classKey = ServerClass[classRows[0].class];
                    }
                    else {
                        classKey = ServerClass[ServerClass.OptOut];
                    }

                    // build an embed
                    const title = 'Server Details';
                    const desc = `Showing details for server ${guild.name}`;
                    const fields: embedField[] = [
                        { name: 'Name', value: guild.name, inline: true },
                        { name: 'ID', value: guild.id, inline: true },
                        { name: 'Owner (display name | username)', value: `${owner.user.displayName} | ${owner.user.username} (<@${guild.ownerId}>)` },
                        { name: 'Gbans', value: `${classKey}` },
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
            let csv = 'server name,server id\n';
            for (const g of guildOwnerObjArr) {
                csv += `${g.serverName},${g.serverid}\n`;
            }

            // output the CSV to wherever the interaction occurred
            // data must be stored in a buffer to create an attachment, so do that first
            const buf = Buffer.from(csv);
            if (interaction.channel) {
                await interaction.followUp({ content: `Here is the list of servers I am in:\n\nTotal: ${guildNames.length} | Unique owners: ${[...new Set(owners)].length}`, files: [
                    { attachment: buf, name: 'servers.csv' },
                ] });
            }
        }
    },
};