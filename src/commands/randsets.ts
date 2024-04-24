import { SlashCommandBuilder, ChatInputCommandInteraction, AutocompleteInteraction, SlashCommandSubcommandBuilder, EmbedBuilder, MessageReaction, User } from 'discord.js';
import { SlashCommand } from '../types/slash-command-base.js';
import { dexFormats, monNames, dexGens, latestGen, dexGenNumAbbrMap, pokedex, commitHash } from '../helpers/loadDex.js';
import { filterAutocomplete, toPSAlias, toGenAlias, validateAutocomplete, toAlias } from '../helpers/autocomplete.js';
import { myColors } from '../helpers/constants.js';


interface PS_RAND_SETS {
    [key: string]: {
        level: number,
        sets: {
            role: string,
            movepool: string[],
            teraTypes: string[]
        }[]
    }
}

interface PS_RAND_MOD_SETS {
    [key: string]: {
        moves?: string[],
        level?: number,
        sets?: {
            role: string,
            movepool: string[]
        }[]
    }
}

/**
 * Displays a mon's possible sets in randbats
 * Default: latest gen
 */
export const command: SlashCommand = {
    global: false,
    guilds: [],
    // setup the slash command builder
    data: new SlashCommandBuilder()
        .setName('randsets')
        .setDescription('Displays the possible Pokemon sets used in PS\'s randbats')
        .addSubcommand(new SlashCommandSubcommandBuilder()
            .setName('randbats')
            .setDescription('Displays a Pokemon\'s Random Battle moves')
            .addStringOption(option =>
                option.setName('pokemon')
                .setDescription('The Pokemon to query')
                .setRequired(true)
                .setAutocomplete(true))
            .addStringOption(option =>
                option.setName('gen')
                .setDescription('The gen to query. Default: latest')
                .setAutocomplete(true)
                .setRequired(false))
            .addStringOption(option =>
                option.setName('mods')
                .setDescription('Specific randbats modifiers')
                .addChoices(
                    { name: 'LGPE', value: 'letsgo' },
                    { name: 'BDSP', value: 'bdsp' },
                    { name: 'Doubles', value: 'doubles' },
                )
                .setRequired(false)))
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
        const mon = toAlias(interaction.options.getString('pokemon', true));
        let gen = interaction.options.getString('gen');
        const mod = interaction.options.getString('mods') ?? '';


        // if they don't specify a gen, see if they want lgpe/bdsp
        // if so, default to those gens
        // otherwise, default to the current gen
        if (!gen) {
            if (mod === 'letsgo') {
                gen = 'sm';
            }
            else if (mod === 'bdsp') {
                gen = 'ss';
            }
            else {
                gen = latestGen;
            }
        }
        
        // map the gen to its alias just in case
        gen = await toGenAlias(gen);

        // make sure they didn't enter garbage
        if (!validateAutocomplete(gen, dexGens)) {
            await interaction.followUp('Unrecognized gen; please choose one from the list');
            return;
        }

        if (!validateAutocomplete(mon, monNames)) {
            await interaction.followUp('Unrecognized Pokemon; please choose one from the list');
            return;
        }
        
        // conversions
        const psmon = toPSAlias(mon);
        const genNum = dexGenNumAbbrMap.find(g => g.abbr === gen)?.num;
        const monName = monNames.filter(m => m.value === mon)[0].name;

        // define the path to the set
        const pathBase = 'https://raw.githubusercontent.com/smogon/pokemon-showdown/master/data/';
        let path = '';
        let modpath = '';

        if (mod === 'doubles') {
           if (gen === 'ss') {
                path = pathBase + 'mods/gen8/random-data.json';
            }
            else if (gen === latestGen) {
                path = pathBase + 'random-doubles-sets.json';
            }
            else {
                path = pathBase + `mods/gen${genNum}/random-doubles-sets.json`;
            }
        }
        else if (mod) {
            path = pathBase + `mods/gen${genNum}/random-data.json`;
            modpath = pathBase + `mods/gen${genNum}${mod}/random-data.json`;
        }
        else if (gen === 'rb' || gen === 'ss') {
            path = pathBase + `mods/gen${genNum}/random-data.json`;
        }
        else {
            path = pathBase + `mods/gen${genNum}/random-sets.json`;
        }

        // fetch the file(s)
        const res = await fetch(path);
        if (!res.ok) {
            await interaction.followUp(`No sets found for gen ${genNum} ${mod} Random Battles`);
            return;
        }

        const allData = await res.json() as PS_RAND_SETS;
        // get the sets for this mon
        const randData = allData[mon];
       
        if (!randData) {
            await interaction.followUp(`No sets found for ${monName}`);
            return;
        }

        // if they chose latest gen, we're done
        if (gen === latestGen) {
            return;
        }
        /*
        // fsr, gen 1, gen 8, and lgpe/bdsp use a unique syntax on PS
        // mod is meaningless for most gens, but rather than a bunch of edge cases it's easier to just return nothing to their garbage inputs
        if (genNum === 1 || genNum === 8 || mod) {
            path = pathBase + `mods/gen${gen}${mod}/random-data.json`;
        }
        else {
            path = pathBase + `mods/gen${gen}${mod}/random-sets.json`;
        }
        
        // fetch the file from the ps git
        const modRes = await fetch(path);
        if (!modRes.ok) {
            await interaction.followUp(`No sets found for gen ${genNum} ${mod} ${doubles ? 'doubles' : ''}`);
            return;
        }
        const modSets = await res.json() as PS_RAND_MOD_SETS;
        */
    },
};
