import { SlashCommandBuilder, ChatInputCommandInteraction, AutocompleteInteraction } from 'discord.js';
import { SlashCommand } from '../types/slash-command-base';
import { filterAutocomplete, validateAutocomplete } from '../helpers/autocomplete.js';
import { pool } from '../helpers/createPool.js';

/**
 * Returns the list of users in a server that do not have a connected forum account.
 * Presumably, these are all the users who were manually verified without Chatot
 */

export const command: SlashCommand = {
    global: false,
    guilds: ['1040378543626002442'],
    // setup the slash command builder
    data: new SlashCommandBuilder()
        .setName('dumpunverified')
        .setDescription('Find the users in a guild not verified with Chatot')
        .addStringOption(option =>
            option.setName('guild')
            .setDescription('The guild to query')
            .setAutocomplete(true)
            .setRequired(true))
        .setDMPermission(false)
        .setDefaultMemberPermissions(0),

     async autocomplete(interaction: AutocompleteInteraction) {
        const focusedOption = interaction.options.getFocused(true);

        if (focusedOption.name === 'guild') {
            const guildNamesIDs = interaction.client.guilds.cache.map(guild => ({ name: guild.name, id: guild.id }));
            const guildPairs = guildNamesIDs.map(g => ({ name: g.name, value: g.id }));

            await filterAutocomplete(interaction, focusedOption, guildPairs);
        }
    },

    // execute our desired task
    async execute(interaction: ChatInputCommandInteraction) {
        await interaction.deferReply();
        const guildNamesIDs = interaction.client.guilds.cache.map(guild => ({ name: guild.name, id: guild.id }));
        const guildPairs = guildNamesIDs.map(g => ({ name: g.name, value: g.id }));

        // get the user input
        const guildQ = interaction.options.getString('guild', true);

        if (!validateAutocomplete(guildQ, guildPairs)) {
            await interaction.followUp('Unrecognized server; please choose one from the list');
            return;
        }

        // fetch the guild's members
        const guild = await interaction.client.guilds.fetch(guildQ);
        const memberList = (await guild.members.fetch()).filter(member => !member.user.bot);
        
        const notVerified: { id: string }[] = (await pool.query('SELECT * FROM UNNEST($1::text[]) AS id EXCEPT SELECT discordid FROM chatot.identities;', [Array.from(memberList.keys())])).rows;

        let csvID = '';
        let csvIDUsername = 'id,username\n';

        for (const member of notVerified) {
            csvID += `${member.id}\n`;
            const username = memberList.get(member.id)!.user.username;
            csvIDUsername += `${member.id},${username}\n`;
        }

        // output the CSV to wherever the interaction occurred
        // data must be stored in a buffer to create an attachment, so do that first
        const bufID = Buffer.from(csvID);
        const bufIDUsername = Buffer.from(csvIDUsername);

        if (interaction.channel) {
            await interaction.followUp({ content: `Here is the list users I didn't verify in ${guild.name}`, files: [
                { attachment: bufID, name: 'manual_verify_ids.csv' },
                { attachment: bufIDUsername, name: 'manual_verify_ids_usernames.csv' },
            ] });
        }
    },

};