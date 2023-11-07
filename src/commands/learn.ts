import { SlashCommandBuilder, ChatInputCommandInteraction, AutocompleteInteraction } from 'discord.js';
import { SlashCommand } from '../types/slash-command-base';
import { dexNames, moveNames } from '../helpers/loadDex.js';
import fetch from 'node-fetch';
import { IPSLearnsets } from '../types/ps';

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
        .addIntegerOption(option =>
            option.setName('gen')
            .setDescription('Which gen number to search. If blank, all are returned')
            .setMinValue(0)
            .setMaxValue(9)
            .setRequired(false))
        .addStringOption(option =>
            option.setName('move')
            .setDescription('Name of the move to search')
            .setRequired(true)
            .setAutocomplete(true))
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
                    // return the pairs, excluding any -Mega and -Gmax formes because those don't have keys in the PS learnset json
                    if (pair.value.includes(enteredText) && !pair.name.includes('-Mega') && !pair.name.includes('-Gmax')) {
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
                    if (pair.value.includes(enteredText)) {
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
        const mon = interaction.options.getString('pokemon', true);
        const gen = interaction.options.getInteger('gen');
        const move = interaction.options.getString('move', true);

        // make sure they entered proper text
        // the value is the alias
        const validMonName = dexNames.some(n => n.value === mon);
        const validMoveName = moveNames.some(n => n.value === move);
        if (!validMonName || !validMoveName) {
            await interaction.followUp('Invalid Pokemon name. Please choose one from the list');
            return;
        }

        // fetch the learnsets from the PS API
        const res = await fetch('https://play.pokemonshowdown.com/data/learnsets.json');
        const learnJson = await res.json() as IPSLearnsets;

        // determine if their chosen mon learns the chosen move
        const monLearnset = learnJson[mon];

        // make sure the mon has learnset info
        if (!monLearnset) {
            await interaction.followUp('No move information found for that Pokemon');
            return;
        }

        // determine whether the mon learns the move
        const learnMethods = monLearnset.learnset[move];

        if (!learnMethods) {
            await interaction.followUp('Move not learned!');
            return;
        }

        const genArr: string[] = [];
        const methodArr: string[] = [];
        // if it does learn the move, figure out how
        for (const method of learnMethods) {
            // get the gen number
            const learnableGen = method.match(/\d*/)?.shift();
            // if they specified a gen, see if it matches
            // if it doesn't, ignore this entry
            if (gen) {
                if (gen === Number(learnableGen) && !genArr.includes(`Gen ${gen}`)) {
                    genArr.push(`Gen ${gen}`);
                    /**
                     * MAP THE METHOD FUNCTION GOES HERE
                     */
                }
            }

        }
        /**
         * Describes a possible way to get a move onto a pokemon.
         *
         * First character is a generation number, 1-7.
         * Second character is a source ID, one of:
         *
         * - M = TM/HM
         * - T = tutor
         * - L = start or level-up, 3rd char+ is the level
         * - R = restricted (special moves like Rotom moves)
         * - E = egg
         * - D = Dream World, only 5D is valid
         * - S = event, 3rd char+ is the index in .eventData
         * - V = Virtual Console or Let's Go transfer, only 7V/8V is valid
         * - C = NOT A REAL SOURCE, see note, only 3C/4C is valid
         *
         * C marks certain moves learned by a pokemon's prevo. It's used to
         * work around the chainbreeding checker's shortcuts for performance;
         * it lets the pokemon be a valid father for teaching the move, but
         * is otherwise ignored by the learnset checker (which will actually
         * check prevos for compatibility).
         */


        // make and post the url
        
    },
};