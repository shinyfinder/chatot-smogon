import { SlashCommandBuilder, ChatInputCommandInteraction, AutocompleteInteraction } from 'discord.js';
import { SlashCommand } from '../types/slash-command-base';
import { dexFormats, dexGens, latestGen } from '../helpers/loadDex.js';
import { filterAutocomplete, toAlias, toGenAlias, validateAutocomplete } from '../helpers/autocomplete.js';
import { fetchTierResources } from '../helpers/fetchTierResources.js';

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

        // build the embed of the tier's resrouces
        const embed = await fetchTierResources(tier, gen, interaction);

        // post
        if (embed) {
            await interaction.followUp({ embeds: [embed] });
        }
    },
};