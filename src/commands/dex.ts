import { SlashCommandBuilder, ChatInputCommandInteraction, AutocompleteInteraction } from 'discord.js';
import { SlashCommand } from '../types/slash-command-base';
import { dexdb, dexNames, IDexDB } from '../helpers/loadDex.js';
import { pool } from '../helpers/createPool.js';

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
            .addChoices(
                { name: 'SV', value: 'sv' },
                { name: 'SS', value: 'ss' },
                { name: 'SM', value: 'sm' },
                { name: 'XY', value: 'xy' },
                { name: 'BW', value: 'bw' },
                { name: 'DP', value: 'dp' },
                { name: 'RS', value: 'rs' },
                { name: 'GS', value: 'gs' },
                { name: 'RB', value: 'rb' },
            )
            .setRequired(false))
        .addStringOption(option =>
            option.setName('format')
            .setDescription('Optional format to fetch (ou, uu, monotype, etc)')
            .setRequired(false))
        .setDMPermission(false),

    // prompt the user with autocomplete options since there are too many tiers to have a selectable list
    async autocomplete(interaction: AutocompleteInteraction) {
        const focusedOption = interaction.options.getFocused(true);

        if (focusedOption.name === 'pokemon') {
            const enteredText = focusedOption.value.toLowerCase();
            const filteredOut: {name: string, value: string }[] = [];
            // filter the options shown to the user based on what they've typed in
            // everything is cast to lower case to handle differences in case
            for (const pair of dexNames) {
                if (filteredOut.length < 25) {
                    if (pair.value.includes(enteredText)) {
                        filteredOut.push(pair);
                    }
                }
                else {
                    break;
                }
            }

            await interaction.respond(filteredOut);
            /*
            const filtered = dexNames.filter(choice => choice.toLowerCase().includes(focusedOption.value.toLowerCase()));

            // discord has a max length of 25 options
            // When the command is selected from the list, nothing is entered into the fields so it tries to return every entry in choices as autocomplete answers
            // so we need to trim the output to 25 choices so it doesn't throw an error
            let filteredOut: string[];
            if (filtered.length > 25) {
                filteredOut = filtered.slice(0, 25);
            }
            else {
                filteredOut = filtered;
            }
            await interaction.respond(
                filteredOut.map(choice => ({ name: choice, value: choice })),
            );
            */
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
        let gen = interaction.options.getString('gen');
        let format = interaction.options.getString('format');

        // make sure they entered proper text
        const validName = dexNames.some(n => n.value === mon);
        if (!validName) {
            await interaction.followUp('Invalid Pokemon name. Please choose one from the list');
            return;
        }


        // if either gen or format weren't provided, check the db to see if they specified a default
        let dbmatches: { format: string, gen: string }[] | [];
        if (gen === null || format === null) {
            // get the format from the table
            const defaultPG = await pool.query('SELECT format, gen FROM chatot.dexdefaults WHERE serverid=$1', [interaction.guildId]);
            dbmatches = defaultPG.rows;

            // check for format
            if (format === null) {
                // there can only be at most 1 match
                if (dbmatches.length) {
                    format = dbmatches[0].format;
                }
                else {
                    format = '';
                }
                
            }
            // check for gen
            // we use a default gen later on, so leave null if no default
            if (gen === null) {
                if (dbmatches.length) {
                    gen = dbmatches[0].gen === '' ? null : dbmatches[0].gen;
                }
            }
        }
       

        /**
         * If they didn't specify a gen and there's no default set, get the lastest one for the mon
         */
        if (gen === null) {
            // filter the db to only the mon they specified
            const dbFilterMon = dexdb.filter(poke => poke.alias.toLowerCase() === mon);
            let dbFilterFormat: IDexDB[];
            // if they set the format to cap, get the latest cap entry
            if (format === 'cap') {
                // get all of the entries related to cap
                dbFilterFormat = dbFilterMon.filter(poke => poke.isnonstandard.toLowerCase() === 'cap');
            }
            // if it's any of the natdex formats
            else if (format.includes('national-dex')) {
                // get all of the entries related to natdex
                dbFilterFormat = dbFilterMon.filter(poke => poke.isnonstandard.toLowerCase() === 'natdex');
            }
            // if they specified a format that's not cap or natdex
            else if (format !== '') {
                dbFilterFormat = dbFilterMon.filter(poke => poke.isnonstandard.toLowerCase() === 'standard');
            }
            // they didn't specify anything and didn't set a default, so just get the last one (which'd be the latest gen)
            else {
                dbFilterFormat = dbFilterMon;
            }

            // pick the last one because we already sorted by oldest to newest listed in the query
            const latestGen = dbFilterFormat.pop();
            if (latestGen === undefined) {
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