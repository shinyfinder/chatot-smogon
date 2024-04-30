import { SlashCommandBuilder, ChatInputCommandInteraction, AutocompleteInteraction } from 'discord.js';
import { SlashCommand } from '../types/slash-command-base.js';
import { monNames, dexGens, latestGen, dexGenNumAbbrMap } from '../helpers/loadDex.js';
import { filterAutocomplete, toPSAlias, toGenAlias, validateAutocomplete, toAlias } from '../helpers/autocomplete.js';

interface PS_RAND_SETS {
    [key: string]: {
        level?: number,
        sets?: {
            role: string,
            movepool: string[],
            teraTypes: string[]
        }[],
        moves?: string[],
        essentialMoves?: string[],
        comboMoves?: string[],
        exclusiveMoves?: string[],
        doublesLevel?: number,
        doublesMoves?: string[],
        noDynamaxMoves?: string[],
    }
}

interface PS_RAND_MOD_SETS {
    [key: string]: {
        moves: string[],
    }
}

/**
 * Displays a mon's possible sets in randbats
 * Default: latest gen
 */
export const command: SlashCommand = {
    global: false,
    guilds: ['294651453279174656'],
    // setup the slash command builder
    data: new SlashCommandBuilder()
        .setName('randbats')
        .setDescription('Displays the possible Pokemon sets used in PS\'s randbats')
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
                { name: 'No Dynamax', value: 'nodyna' },
            )
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
            else if (mod === 'bdsp' || mod === 'nodyna') {
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
        const genNum = dexGenNumAbbrMap.find(g => g.abbr === gen)!.num;
        const monName = monNames.filter(m => m.value === mon)[0].name;

        // define the path to the set
        const pathBase = 'https://raw.githubusercontent.com/smogon/pokemon-showdown/master/data/';
        let path = '';
        let modpath = '';

        /**
         * I dislike how this is setup but it works (for now)
         * PS is not very consistent in its conventions, and stuff changes all the time
         * so it's not worth making this really fancy
         */

        // if they want doubles sets,
        // latest gen is in the root directory under random-doubles-sets.json
        // gen 8 uses a file called random-data.json for both singles and doubles
        // everything else is under /mods/gen*/random-doubles-sets.json (which don't exist? but oh well)
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
        // for let's go, it uses an inheritance system so fetching just the */random-data.json isn't enough
        // we also need the gen 7 base file
        else if (mod === 'letsgo') {
            path = pathBase + `mods/gen${genNum}/random-sets.json`;
            modpath = pathBase + `mods/gen${genNum}${mod}/random-data.json`;
        }
        // similar to lgpe, but the base file for gen 8 is called random-data.json
        // and combines doubles and singles
        else if (mod === 'bdsp') {
            path = pathBase + `mods/gen${genNum}/random-data.json`;
            modpath = pathBase + `mods/gen${genNum}${mod}/random-data.json`;
        }
        // gens 1 and 8 use a different filename convention
        else if (gen === 'rb' || gen === 'ss') {
            path = pathBase + `mods/gen${genNum}/random-data.json`;
        }
        // current gen breaks the /mods/gens syntax used by the others
        else if (gen === latestGen) {
            path = pathBase + 'random-sets.json';
        }
        // everything else
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
        let modData: PS_RAND_MOD_SETS = {};

        if (modpath) {
            const modRes = await fetch(modpath);
            if (!modRes.ok) {
                await interaction.followUp(`No sets found for gen ${genNum} ${mod} Random Battles`);
                return;
            }
            modData = await modRes.json() as PS_RAND_MOD_SETS;
        }
        

        // get the sets for this mon
        const randData = allData[psmon];
       
        if (!randData) {
            await interaction.followUp(`No sets found for ${monName} in gen ${genNum} ${mod ?? ''}`);
            return;
        }

        /**
         * Build the output string
         * Again, stuff isn't consistent
         * Gen 2 uses a completely different format for the levels for some reason, but we just ignore that and output nothing for level because well, we tried
         * Some of the files (gens 7 and 8) work on an inheritance system, so we need to merge data
         * Whereas the others contain all the info we need
         * Gen 1 has extra fields that are used for something meaningful I imagine, but are broken up separately and we need to output all of them
         * 
         * tldr: stuff is inconsistent
         * 
         */
        const qualifier = `Gen ${genNum} ${mod || ''}`.trim();
        let strOut = `_${monName} (${qualifier})\n\n_`;

        // if stuff has sets, this is pretty much everything we need
        // Except for let's go, which is inheritance-based
        if (randData.sets) {
            let str = '';
            if (mod === 'letsgo') {
                str += `**Level:** ${randData.level ?? 'N/A'}\n**Movepool:** ${modData[psmon].moves.join(', ')}`;
            }
            else {
                for (const set of randData.sets) {
                    str += `**${set.role}**\nLevel: ${randData.level ?? 'N/A'}\nMovepool: ${set.movepool.join(', ')}`;
                    if (set.teraTypes) {
                        str += `\nTera Types: ${set.teraTypes.join(', ')}`;
                    }
                    str += '\n\n';
                }
            }
            
            strOut += str;
        }
        // latest gen doubles is covered by the above because it has it's own file
        // which matches the format of the singles sets
        // so all that's really left is Gen 8 because nothing else really has doubles...apparently
        else if (mod === 'doubles') {
            let str = `**Level:** ${randData.doublesLevel ?? 'N/A'}\n`;
            str += `**Moves:** ${randData.doublesMoves?.join(', ')}`;
            strOut += str;

        }
        // inheritance system for lgpe/bdsp singles
        else if (mod === 'letsgo' || mod === 'bdsp') {
            let str = `**Level:** ${randData.level ?? 'N/A'}\n`;
            if (modData) {
                str += `**Moves:** ${modData[psmon].moves.join(', ') ?? 'N/A'}`;
            }
            strOut += str;
        }
        // whatever format is needed for gen 8 no dynamax clause
        else if (mod === 'nodyna') {
            let str = `**Level:** ${randData.level ?? 'N/A'}\n`;
            str += `**Moves:** ${randData.noDynamaxMoves?.join(', ') ?? randData.moves?.join(', ') ?? 'N/A'}`;
            strOut += str;
        }
        // gen 1 and whatever edge case isn't covered by the above
        else {
            let str = `**Level:** ${randData.level ?? 'N/A'}\n`;
            str += `**Moves:** ${randData.moves?.join(', ') ?? 'N/A'}\n`;
            if (randData.comboMoves) {
                str += `**Combo moves:** ${randData.comboMoves.join(', ')}\n`;
            }
            if (randData.essentialMoves) {
                str += `**Essential moves:** ${randData.essentialMoves.join(', ')}\n`;
            }
            if (randData.exclusiveMoves) {
                str += `**Exclusive moves:** ${randData.exclusiveMoves.join(', ')}\n`;
            }
            strOut += str;
        }
        
        await interaction.followUp(strOut);
    },
};
