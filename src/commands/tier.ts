import { SlashCommandBuilder, ChatInputCommandInteraction, AutocompleteInteraction, EmbedBuilder } from 'discord.js';
import { SlashCommand } from '../types/slash-command-base';
import { dexFormats, dexGens, latestGen, dexGenNumAbbrMap, commitHash } from '../helpers/loadDex.js';
import { pool } from '../helpers/createPool.js';
import { filterAutocomplete, toAlias, toGenAlias, validateAutocomplete } from '../helpers/autocomplete.js';

/**
 * Gets the details of a specific tier.
 * Duplicated with /dt
 *
 */
export const command: SlashCommand = {
    global: true,
    guilds: [],
    // setup the slash command builder
    data: new SlashCommandBuilder()
        .setName('tier')
        .setDescription('Retrieves the Dex resources for the specified tier')
        .addStringOption(option =>
            option.setName('name')
            .setDescription('Name of the tier')
            .setRequired(true)
            .setAutocomplete(true))
        .addStringOption(option =>
            option.setName('gen')
            .setDescription('Which gen to target. If blank, the latest is used')
            .setAutocomplete(true)
            .setRequired(false))
        .setDMPermission(false),

    // prompt the user with autocomplete options
    async autocomplete(interaction: AutocompleteInteraction) {
        const focusedOption = interaction.options.getFocused(true);

        if (focusedOption.name === 'name') {
            await filterAutocomplete(interaction, focusedOption, dexFormats);
        }
        else if (focusedOption.name === 'gen') {
            await filterAutocomplete(interaction, focusedOption, dexGens);
        }
    },
    // execute our desired task
    async execute(interaction: ChatInputCommandInteraction) {
        await interaction.deferReply();
        // make sure this command is used in a guild
        if (!interaction.guild) {
            await interaction.reply('This command can only be used in a server!');
            return;
        }

        // get the inputs
        const tier = toAlias(interaction.options.getString('name', true));
        let gen = interaction.options.getString('gen') ?? latestGen;

        // map the gen and format to their aliases just in case
        gen = await toGenAlias(gen);
        
        // since we're using autocomplete, we have to validate their imputs
        if (!validateAutocomplete(tier, dexFormats)) {
            await interaction.followUp('Unrecognized tier; please choose one from the list');
            return;
        }

        if (!validateAutocomplete(gen, dexGens)) {
            await interaction.followUp('Unrecognized gen; please choose one from the list');
            return;
        }

        // get the gen number for the supplied gen
        // null check if it can't find it, but that will never happen because we already validated the input above
        const genNum = dexGenNumAbbrMap.find(g => g.abbr === gen)!.num;
        const embedColor = 0x6363b0;
        
        // query the db to get the info we want
        const dtQuery = await pool.query(`
        SELECT resource_name, url FROM dex.format_resources
        JOIN dex.formats USING (format_id)
        WHERE dex.formats.alias=$1 AND dex.formats.gen_id=$2`, [tier, gen]);

        interface IDBData {
            resource_name: string,
            url: string,
        }

        const dbData: IDBData[] | [] = dtQuery.rows;

        // extract the name-url pairs so we can join them into a bulleted list
        const maskedURLs = dbData.map(row => (`* [${row.resource_name}](${row.url})`));
        
        // get the name of the format they entered
        // we can't just get it from the database, because some formats may not have resources (yet)
        // so get it from the autocomplete
        const formatName = dexFormats.find(format => format.value === tier)?.name ?? tier;

        // build the embed
        const embed = new EmbedBuilder()
        .setTitle(`${formatName} (Gen ${genNum})`)
        .setDescription(maskedURLs.join('\n') || 'No resources found')
        .setThumbnail(`https://raw.githubusercontent.com/shinyfinder/chatot-assets/${commitHash}/images/formats.png`)
        .addFields([
            { name: 'Overview', value: `For more info, see this format's [Dex page](https://www.smogon.com/dex/${gen}/formats/${tier}/).` },
        ])
        .setColor(embedColor);

        await interaction.followUp({ embeds: [embed] });
    },
};