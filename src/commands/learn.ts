import { SlashCommandBuilder, ChatInputCommandInteraction, AutocompleteInteraction, EmbedBuilder } from 'discord.js';
import { SlashCommand } from '../types/slash-command-base';
import { dexNames, moveNames, pokedex, spriteNames } from '../helpers/loadDex.js';
import fetch from 'node-fetch';
import { IPSLearnsets } from '../types/ps';
import { latestGen, myColors } from '../helpers/constants.js';
import { res2JSON } from '../helpers/res2JSON.js';
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
        .setName('learn')
        .setDescription('Determines whether and how a Pokemon learns a move')
        .addStringOption(option =>
            option.setName('pokemon')
            .setDescription('Name of the Pokemon')
            .setRequired(true)
            .setAutocomplete(true))
        .addStringOption(option =>
            option.setName('move')
            .setDescription('Name of the move to search')
            .setRequired(true)
            .setAutocomplete(true))
        .addIntegerOption(option =>
            option.setName('gen')
            .setDescription('Which gen number to search. If blank, the latest is used')
            .setMinValue(1)
            .setMaxValue(latestGen)
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
                    const nameLower = pair.name.toLowerCase();
                    // return the pairs, excluding any -Mega and -Gmax formes because those don't have keys in the PS learnset json
                    if (nameLower.includes(enteredText) && !pair.name.includes('-Mega') && !pair.name.includes('-Gmax')) {
                        filteredOut.push(pair);
                    }
                }
                else {
                    break;
                }
            }

            await interaction.respond(filteredOut);
        }
        else if (focusedOption.name === 'move') {
            const enteredText = focusedOption.value.toLowerCase();
            const filteredOut: {name: string, value: string }[] = [];
            // filter the options shown to the user based on what they've typed in
            // everything is cast to lower case to handle differences in case
            for (const pair of moveNames) {
                if (filteredOut.length < 25) {
                    const nameLower = pair.name.toLowerCase();
                    if (nameLower.includes(enteredText)) {
                        filteredOut.push(pair);
                    }
                }
                else {
                    break;
                }
            }

            await interaction.respond(filteredOut);
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
        const monIn = interaction.options.getString('pokemon', true);
        const gen = interaction.options.getInteger('gen') ?? latestGen;
        const move = interaction.options.getString('move', true);

        // make sure they entered proper text
        // the value is the alias
        const validMonName = dexNames.some(n => n.value === monIn);
        const validMoveName = moveNames.some(n => n.value === move);
        if (!validMonName) {
            await interaction.followUp('Invalid Pokemon name. Please choose one from the list');
            return;
        }

        if (!validMoveName) {
            await interaction.followUp('Invalid move name. Please choose one from the list');
            return;
        }

        // fetch the learnsets from the PS API
        const res = await fetch('https://play.pokemonshowdown.com/data/learnsets.json');
        const learnJson = await res.json() as IPSLearnsets;

        // also get the modded learnsets for that gen
        const moddedLearnsets: IPSLearnsets = await fetchModdedLearnsets(gen);

        // get the base specie of the mon, if required
        // the response from the PS api doesn't include dash in the keys, so remove any
        const mon = monIn.replaceAll('-', '');

        // check if the mon has a learnset
        // if it doesn't, use the base specie
        let monLearnset = learnJson[mon];
        let monModLearnset = moddedLearnsets[mon];
        let baseSpecie: string | undefined;

        // if the mon doesn't have a learnset entry
        if (!monLearnset?.learnset) {
            // get the base specie
            baseSpecie = pokedex[mon].baseSpecies;

            // and if that exists, sanitize it of any special characters
            if (baseSpecie) {
                baseSpecie = baseSpecie.toLowerCase().replaceAll(/[^a-z]/g, '');
                // then use that to get the learnset
                monLearnset = learnJson[baseSpecie];
                monModLearnset = moddedLearnsets[baseSpecie];
            }
        }

        // make sure the mon has learnset info
        if (!monLearnset) {
            await interaction.followUp('No move information found for that Pokemon');
            return;
        }

        // determine whether the mon learns the move
        const learnMethods = monLearnset.learnset[move];
        const modLearnMethods = monModLearnset?.learnset[move];
        if (modLearnMethods) {
            for (const mod of modLearnMethods) {
                if (!learnMethods.includes(mod) && (gen === 7 || gen === 8)) {
                    const modStr = '*' + mod;
                    learnMethods.push(modStr);
                }
                else if (!learnMethods.includes(mod)) {
                    learnMethods.push(mod);
                }
            }
        }
        

        const genArr: string[] = [];
        const methodArr: string[][] = [];
        let tempMethodArr: string[] = [];
        const transferArr: string[] = [];

        // if it does learn the move, figure out how
        if (learnMethods) {
            for (const method of learnMethods) {
                // get the gen number
                const learnableGen = method.match(/\d+/)?.shift();
                
                let header = '';
                if (gen === 7 && method.startsWith('*')) {
                    header = 'LGPE Exclusive';
                }
                else if (gen === 8 && method.startsWith('*')) {
                    header = 'BDSP Exclusive';
                }
                else {
                    header = `Gen ${learnableGen}`;
                }

                // if they specified a gen, see if it matches
                // if they specified and it doesn't, see if it's a transfer
                if (gen === Number(learnableGen)) {
                    if (!genArr.includes(header)) {
                        genArr.push(header);
                        if (tempMethodArr.length) {
                            // get the unique entries so methods aren't duplicated
                            tempMethodArr = [...new Set(tempMethodArr)];
                            methodArr.push(tempMethodArr);
                            tempMethodArr = [];
                        }
                    }

                    // get the method
                    const sourceID = method.match(/[a-z]/i)?.shift();
                    if (!sourceID) {
                        continue;
                    }
                    else if (sourceID === 'M') {
                        tempMethodArr.push('TM/HM');
                    }
                    else if (sourceID === 'T') {
                        tempMethodArr.push('Move Tutor');
                    }
                    else if (sourceID === 'L') {
                        // get the level number
                        const level = method.match(/\d+/g)?.pop();
                        tempMethodArr.push(`Level ${level}`);
                    }
                    else if (sourceID === 'R') {
                        tempMethodArr.push('Unique');
                    }
                    else if (sourceID === 'E') {
                        tempMethodArr.push('Egg');
                    }
                    else if (sourceID === 'D') {
                        tempMethodArr.push('Drean World');
                    }
                    else if (sourceID === 'S') {
                        tempMethodArr.push('Event');
                    }
                    else if (sourceID === 'V') {
                        tempMethodArr.push('VC or LGPE Transfer');
                    }
                    else {
                        continue;
                    }
                }
                else if (Number(learnableGen) < gen) {
                    // add an entry to the gen array for transfers if needed
                    if (!genArr.includes('Transfer from gen(s)')) {
                        genArr.push('Transfer from gen(s)');
                    }

                    // add the gen number to the temporary holder
                    if (learnableGen && !transferArr.includes(learnableGen)) {
                        transferArr.push(learnableGen);
                    }
                }
            }
        }

        // the last iteration doesn't necessarily add to the array, so check if we need to push the temp array to the holder
        if (tempMethodArr.length) {
            // get the unique entries so methods aren't duplicated
            tempMethodArr = [...new Set(tempMethodArr)];
            methodArr.push(tempMethodArr);
        }

        // similarly, add the transfers to the method array if needed
        // we have no guarantee on order, so splice it in
        const transferIdx = genArr.indexOf('Transfer from gen(s)');

        if (transferIdx >= 0) {
            methodArr.splice(transferIdx, 0, transferArr);
        }

        // check for any prevos
        let dexEntry = baseSpecie ? pokedex[baseSpecie] : pokedex[mon];
        let embedColor = 0;
        for (const [color, value] of Object.entries(myColors)) {
            if (color === dexEntry.color) {
                embedColor = value;
            }
        }

        const prevosWithMove: string[] = [];
        while (dexEntry.prevo) {
            // get the prevo data
            const sanitizedPrevo = dexEntry.prevo.toLowerCase().replaceAll(/[^a-z]/g, '');
            const sanitizedName = dexEntry.name.toLowerCase().replaceAll(/[^a-z]/g, '');

            dexEntry = pokedex[sanitizedPrevo];

            // check the prevo for the move in its learnset
            // we only check for existence in the provided gen, if specified
            const prevoLearnset = learnJson[sanitizedName].learnset;
            const prevoLearnMethods = prevoLearnset[move];
            
            // if the prevo doesn't learn the move, move on
            if (!prevoLearnMethods) {
                continue;
            }
            else {
                // loop over the entries
                for (const method of prevoLearnMethods) {
                    // get the gen number for each entry
                    const prevoLearnGen = method.match(/\d+/)?.shift();
                    // if the gen number matches, push to the arrays because the mon can learn the move via a prevo
                    if (!gen || Number(prevoLearnGen) <= gen) {
                        if (!genArr.includes('Prevolution')) {
                            genArr.push('Prevolution');
                        }
                        prevosWithMove.push(dexEntry.name);
                        break;
                    }
                }
            }
        }
        // if there's ay least 1 prevo with the move, push it to the method array
        if (prevosWithMove.length) {
            methodArr.push(prevosWithMove);
        }

        // get the proper cased names for the text they enter
        const titleCaseMon = dexNames.find(pair => pair.value === monIn)?.name;
        const titleCaseMove = moveNames.find(pair => pair.value === move)?.name;
        const monSprite = spriteNames.find(s => s.value === monIn)?.name;

        // remove any special characters that aren't -
        let nameSanitized = monSprite?.replaceAll(/[^a-zA-Z0-9_-]/g, '').toLowerCase();

        // we need a special overwrite for the jangmo-o line and ho-oh because they have a dash that gets replaced
        if (nameSanitized === 'jangmo-o' || nameSanitized === 'hakamo-o' || nameSanitized === 'kommo-o' || nameSanitized === 'ho-oh') {
            nameSanitized = nameSanitized.replace('-', '');
 }

        // build the embed
        const embed = new EmbedBuilder().setTitle(`${titleCaseMon} @ ${titleCaseMove} (Gen ${gen})`);
        if (!genArr.length) {
            embed.setDescription(`${titleCaseMon} does not learn ${titleCaseMove}.`);
        }
        else {
            embed.setDescription(`${titleCaseMon} learns ${titleCaseMove} via the following:`);
            for (let i = 0; i < genArr.length; i++) {
                embed.addFields({ name: genArr[i], value: methodArr[i].join(', ') });
            }
        }
        embed.setThumbnail(`https://raw.githubusercontent.com/shinyfinder/chatot-assets/main/home-sprites/normal/${nameSanitized}.png`);
        embed.setColor(embedColor);
        await interaction.followUp({ embeds: [embed] });
        
    },
};


async function fetchModdedLearnsets(gen: number) {
    if (gen === 1 || gen === 2) {
        // fetch and extract the text
        const res = await fetch('https://raw.githubusercontent.com/smogon/pokemon-showdown/master/data/mods/gen2/learnsets.ts');
        const txt = await res.text();

        // convert to json
        const modLearnset = res2JSON(txt);

        return modLearnset;
    }
    else if (gen === 7) {
        const res = await fetch('https://raw.githubusercontent.com/smogon/pokemon-showdown/master/data/mods/gen7letsgo/learnsets.ts');
        const txt = await res.text();
        const modLearnset = res2JSON(txt);
        return modLearnset;
    }
    else if (gen === 8) {
        const res = await fetch('https://raw.githubusercontent.com/smogon/pokemon-showdown/master/data/mods/gen8bdsp/learnsets.ts');
        const txt = await res.text();
        const modLearnset = res2JSON(txt);
        return modLearnset;
    }
    else {
        return {};
    }
}