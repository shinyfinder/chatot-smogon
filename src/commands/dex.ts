import { SlashCommandBuilder, ChatInputCommandInteraction, AutocompleteInteraction } from 'discord.js';
import { SlashCommand } from '../types/slash-command-base';
import { dexFormats, dexMondb, monNames, dexGens } from '../helpers/loadDex.js';
import { pool } from '../helpers/createPool.js';
import { IPokedexDB } from '../types/dex';
import { filterAutocomplete } from '../helpers/filterAutocomplete.js';
import { validateAutocomplete } from '../helpers/validateAutocomplete.js';
/**
 * Posts a link in the chat to the specified Pokemon analysis
 * @param pokemon Name of the pokemon
 * @param gen Which gen to pull up the analysis for
 *
 */
export const command: SlashCommand = {
    global: true,
    guilds: [],
    // setup the slash command builder
    data: new SlashCommandBuilder()
        .setName('dex')
        .setDescription('Posts a link to a SmogDex analysis')
        .addStringOption(option =>
            option.setName('pokemon')
            .setDescription('Name of the Pokemon')
            .setRequired(true)
            .setAutocomplete(true))
        .addStringOption(option =>
            option.setName('gen')
            .setDescription('Which gen the analysis is for. If blank, the latest available is used')
            .setAutocomplete(true)
            .setRequired(false))
        .addStringOption(option =>
            option.setName('format')
            .setDescription('Optional format to fetch (ou, uu, monotype, etc)')
            .setAutocomplete(true)
            .setRequired(false))
        .setDMPermission(false),

    // prompt the user with autocomplete options
    async autocomplete(interaction: AutocompleteInteraction) {
        const focusedOption = interaction.options.getFocused(true);

        if (focusedOption.name === 'pokemon') {
            await filterAutocomplete(interaction, focusedOption, monNames);
        }
        else if (focusedOption.name === 'gen') {
            await filterAutocomplete(interaction, focusedOption, dexGens);
        }
        else if (focusedOption.name === 'format') {
            await filterAutocomplete(interaction, focusedOption, dexFormats);
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
        const mon = interaction.options.getString('pokemon', true).toLowerCase();
        let gen = interaction.options.getString('gen')?.toLowerCase() ?? '';
        let format = interaction.options.getString('format')?.toLowerCase() ?? '';

        // since we're using autocomplete, we have to validate their imputs
        if (!validateAutocomplete(mon, monNames)) {
            await interaction.followUp('Unrecognized Pokemon; please choose one from the list');
            return;
        }

        if (format) {
            if (!validateAutocomplete(format, dexFormats)) {
                await interaction.followUp('Unrecognized format; please choose one from the list');
                return;
            }
        }
        if (gen) {
            if (!validateAutocomplete(gen, dexGens)) {
                await interaction.followUp('Unrecognized gen; please choose one from the list');
                return;
            }
        }


        // if either gen or format weren't provided, check the db to see if they specified a default
        let dbmatches: { format: string, gen: string }[] | [];
        if (!gen || !format) {
            // get the format from the table
            const defaultPG = await pool.query('SELECT format, gen FROM chatot.dexdefaults WHERE serverid=$1', [interaction.guildId]);
            dbmatches = defaultPG.rows;

            // check for format
            if (!format) {
                // there can only be at most 1 match
                // if they didn't specify a format, try to get the server default from the db
                // if it's still not in the db, then just leave it
                if (dbmatches.length) {
                    format = dbmatches[0].format === '' ? format : dbmatches[0].format;
                }   
            }
            // check for gen
            // we use a default gen later on, so leave it if no default
            if (!gen) {
                if (dbmatches.length) {
                    gen = dbmatches[0].gen === '' ? gen : dbmatches[0].gen;
                }
            }
        }

        /**
         * If they didn't specify a gen and there's no default set, get the lastest one for the mon
         */
        if (!gen) {
            // filter the db to only the mon they specified
            const dbFilterMon = dexMondb.filter(poke => poke.alias === mon);
            let dbFilteredByFormat: IPokedexDB[];
            // if they set the format to cap, get the latest cap entry
            if (format === 'cap') {
                // get all of the entries related to cap
                dbFilteredByFormat = dbFilterMon.filter(poke => poke.isnonstandard === 'CAP');
            }
            // if it's any of the natdex formats
            else if (format.includes('national-dex')) {
                // get all of the entries related to natdex
                dbFilteredByFormat = dbFilterMon.filter(poke => poke.isnonstandard === 'NatDex');
            }
            // if they specified a format that's not cap or natdex
            else if (format) {
                dbFilteredByFormat = dbFilterMon.filter(poke => poke.isnonstandard === 'Standard');
            }
            // they didn't specify anything and didn't set a default, so just get the last one (which'd be the latest gen)
            else {
                dbFilteredByFormat = dbFilterMon;
            }

            // pick the last one because we already sorted by oldest to newest listed in the query
            const latestGen = dbFilteredByFormat.pop();
            if (!latestGen) {
                await interaction.followUp('No matches found for this format');
                return;
            }
            else {
                gen = latestGen.gen_id;
            }
        }

        // make and post the url
        await interaction.followUp(`https://www.smogon.com/dex/${gen}/pokemon/${mon}/${format}`);
        return;
    },
};