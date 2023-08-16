import { SlashCommandBuilder, ChatInputCommandInteraction, AutocompleteInteraction } from 'discord.js';
import { SlashCommand } from '../types/slash-command-base';
import { dexdb, dexNames } from '../helpers/loadDex.js';

/**
 * Posts an image in the chat of the specified Pokemon
 * @param pokemon Name of the pokemon
 * @param gen Which gen to pull up the sprite for
 * @param shiny Boolean to retrieve shiny sprites
 *
 */
export const command: SlashCommand = {
    global: false,
    guilds: ['265293623778607104'],
    // setup the slash command builder
    data: new SlashCommandBuilder()
        .setName('sprite')
        .setDescription('Embeds a sprite of the provided Pokemon')
        .addStringOption(option =>
            option.setName('pokemon')
            .setDescription('Name of the Pokemon (start typing to filter)')
            .setRequired(true)
            .setAutocomplete(true))
        .addIntegerOption(option =>
            option.setName('gen')
            .setDescription('Which gen to retrieve the sprite for. If blank, the latest available is used')
            .setMinValue(1)
            .setMaxValue(9)
            .setRequired(false))
        .addBooleanOption(option =>
            option.setName('shiny')
            .setDescription('Whether to retrieve the shiny sprite. Default false')
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
        }
    },
    // execute our desired task
    async execute(interaction: ChatInputCommandInteraction) {
        await interaction.deferReply();
        let url = '';
        // make sure this command is used in a guild
        if (!interaction.guild) {
            await interaction.reply('This command can only be used in a server!');
            return;
        }

        // get the inputs
        const mon = interaction.options.getString('pokemon', true).toLowerCase();
        const gen = interaction.options.getInteger('gen') ?? 9;
        const shiny = interaction.options.getBoolean('shiny') ?? false;
        
        // make sure they entered proper text
        // the value is the alias
        const validName = dexNames.some(n => n.value === mon);
        if (!validName) {
            await interaction.followUp('Invalid Pokemon name. Please choose one from the list');
            return;
        }

        // validate that the selected mon is available in the selected gen
        if (gen) {
            // map the gen number to the gen alias
            const genAliases = ['rb', 'gs', 'rs', 'dp', 'bw', 'xy', 'sm', 'ss', 'sv'];
            const genAlias = genAliases[gen - 1];

            // try to find a row available for the mon
            // we don't really care if it's standard or not because we just want the sprite
            const dbFilterMon = dexdb.filter(poke => poke.alias === mon && poke.gen_id === genAlias);

            // if you didn't find a match, return and let them know
            if (!dbFilterMon.length) {
                await interaction.followUp(`${mon} is unavailable in gen ${gen}`);
                return;
            }
        }


        // determine if the mon they selected is a CAP mon
        const isCapMon = dexdb.find(poke => poke.isnonstandard === 'CAP' && poke.alias === mon);

        // if they want a shiny CAP mon sprite, use PS non-animated
        if (shiny && isCapMon) {
            // use the gen number to find the folder
            let folderName = '';
            if (gen === 1) {
                await interaction.followUp('Shiny sprites are unavailable in gen 1');
                return;
            }
            else if (gen <= 5) {
                folderName = `gen${gen}-shiny`;
            }
            else {
                folderName = 'dex-shiny';
            }

            url = `https://play.pokemonshowdown.com/sprites/${folderName}/${mon}.png`;
        }
        // if they want a shiny (non cap mon), use the PS animated when you can
        // the non-animated sprites are missing some for newer games (i.e. basculegion)
        // PS animated are only available gen > 4
        else if (shiny && !isCapMon) {
            let ext = 'png';
            // use the gen number to find the folder
            let folderName = '';
            if (gen === 1) {
                await interaction.followUp('Shiny sprites are unavailable in gen 1');
                return;
            }
            else if (gen < 5) {
                folderName = `gen${gen}-shiny`;
            }
            else if (gen === 5) {
                folderName = 'gen5ani-shiny';
                ext = 'gif';
            }
            else {
                folderName = 'ani-shiny';
                ext = 'gif';
            }

            url = `https://play.pokemonshowdown.com/sprites/${folderName}/${mon}.${ext}`;
        }
        // otherwise, use the dex
        else {
            // map the gen alias to the gen number
            // sprites are stored under the alias
            const spriteGenAliases = ['rb', 'c', 'rs', 'dp', 'bw', 'xy', 'xy', 'xy', 'xy'];
            const folderName = spriteGenAliases[gen - 1];

            // the dex uses different file extensions depending on the gen
            const ext = ['gs', 'bw', 'xy', 'sm', 'sm', 'ss', 'sv'].includes(folderName) ? 'gif' : 'png';
            url = `https://smogon.com/dex/media/sprites/${folderName}/${mon}.${ext}`;
        }
        

        // make and post the url
        await interaction.followUp(url);
        
    },
};