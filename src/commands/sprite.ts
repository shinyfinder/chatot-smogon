import { SlashCommandBuilder, ChatInputCommandInteraction, AutocompleteInteraction } from 'discord.js';
import { SlashCommand } from '../types/slash-command-base';
import { dexdb, spriteNames } from '../helpers/loadDex.js';
import fetch from 'node-fetch';

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
        .addBooleanOption(option =>
            option.setName('shiny')
            .setDescription('Whether to retrieve the shiny sprite. Default false')
            .setRequired(false))
        .addBooleanOption(option =>
            option.setName('home')
            .setDescription('Whether to use HOME sprites. Default false')
            .setRequired(false))
        .addIntegerOption(option =>
            option.setName('gen')
            .setDescription('Which gen to retrieve the sprite for. If blank, the latest available is used')
            .setMinValue(1)
            .setMaxValue(9)
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
            for (const pair of spriteNames) {
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
        const home = interaction.options.getBoolean('home') ?? false;
        
        // make sure they entered proper text
        // the value is the alias
        const validName = spriteNames.some(n => n.value === mon);
        if (!validName) {
            await interaction.followUp('Invalid Pokemon name. Please choose one from the list');
            return;
        }

        let folderName = '';
        let ext = 'gif';

        /**
         * PS uses a different naming convention for their sprites than the dex.
         * Becase the checks are based on the dex, we need to modify the input a bit to match the PS convention
         */
        // get the name of the mon
        // we know this exists already and can just take the first value
        const monName = spriteNames.filter(n => n.value === mon)[0].name;
        
        // remove any special characters that aren't -
        let nameSanitized = monName.replaceAll(/[^a-zA-Z0-9_-]/g, '').toLowerCase();

        // we need a special overwrite for the jangmo-o line and ho-oh because they have a dash that gets replaced
        if (nameSanitized === 'jangmo-o' || nameSanitized === 'hakamo-o' || nameSanitized === 'kommo-o' || nameSanitized === 'ho-oh') {
            nameSanitized = nameSanitized.replace('-', '');
        }


        // HOME sprites ignores gen and any other flow, so check that first so we can return early
        if (home) {
            folderName = shiny ? 'shiny' : 'normal';
            ext = 'png';
            url = `https://raw.githubusercontent.com/shinyfinder/chatot-assets/main/home-sprites/${folderName}/${nameSanitized}.${ext}`;

            const homeRes = await fetch(url);

            // if it errors, tell them we couldn't find it
            // otherwise send them the url, which will auto-embed
            if (homeRes.status !== 200) {
                await interaction.followUp('No sprite found; the databases are probably not updated yet.');
                return;
            }
            else {
                await interaction.followUp(url);
                return;
            }
        }

        // validate that the selected mon is available in the selected gen
        if (gen) {
            // map the gen number to the gen alias
            const genAliases = ['rb', 'gs', 'rs', 'dp', 'bw', 'xy', 'sm', 'ss', 'sv'];
            const genAlias = genAliases[gen - 1];

            // try to find a row available for the mon
            // we don't really care if it's standard or not because we just want the sprite
            let dbFilterMon = dexdb.filter(poke => poke.alias === mon && poke.gen_id === genAlias);

            // if you didn't find a match, it's possible it's a cosmetic forme
            // so split on - and take the first word, which should be the mon
            if (!dbFilterMon.length) {
                dbFilterMon = dexdb.filter(poke => poke.alias.includes(mon.split('-')[0]) && poke.gen_id === genAlias);

                // if still no match, return
                if (!dbFilterMon.length) {
                    await interaction.followUp(`${mon} is unavailable in gen ${gen}`);
                    return;
                }
                
            }
        }
        
        // first gens don't have shinies
        if (gen === 1 && shiny) {
            await interaction.followUp('Shiny sprites are unavailable in gen 1');
            return;
        }
        // if gen < 5, no animated sprites exist
        else if (gen <= 5) {
            folderName = shiny ? `gen${gen}-shiny` : `gen${gen}`;
            ext = 'png';
        }
        else {
            folderName = shiny ? 'ani-shiny' : 'ani';
        }

        url = `https://play.pokemonshowdown.com/sprites/${folderName}/${nameSanitized}.${ext}`;

        // try to get the URL
        const res = await fetch(url);
        
        // if the get failed, the image doesn't exist.
        // try to get the HOME sprite
        if (res.status !== 200) {
            folderName = shiny ? 'shiny' : 'normal';
            url = `https://raw.githubusercontent.com/shinyfinder/chatot-assets/main/home-sprites/${folderName}/${nameSanitized}.png`;

            const resRetry = await fetch(url);

            // if that still doesn't work and they want a shiny
            // try the gen 5 static dex
            if (resRetry.status !== 200 && shiny) {
                folderName = 'gen5-shiny';
                ext = 'png';
                url = `https://play.pokemonshowdown.com/sprites/${folderName}/${nameSanitized}.${ext}`;
                
                const resRetry2 = await fetch(url);
                // if that fails tell them we don't have it
                if (resRetry2.status !== 200) {
                    url = 'No shiny sprite found; the databases are probably not updated yet.';
                }
            }
            // if the res doesn't work and they want a regular sprite, try to use the dex
            else if (resRetry.status !== 200) {
                // map the gen alias to the gen number
                // sprites are stored under the alias
                // repeating xy isn't a typo, because the newer gens pull frmo the xy folder
                const spriteGenAliases = ['rb', 'c', 'rs', 'dp', 'bw', 'xy', 'xy', 'xy', 'xy'];
                folderName = spriteGenAliases[gen - 1];

                // the dex uses different file extensions depending on the gen
                ext = ['gs', 'bw', 'xy'].includes(folderName) ? 'gif' : 'png';
                url = `https://smogon.com/dex/media/sprites/${folderName}/${mon}.${ext}`;

                // if THAT still doesn't work, tell them we don't have the sprite yet
                // because discord autoembeds the sprite, we can just post the url to post the image
                // meaning we can reuse the url variable for the fail string
                const resRetry3 = await fetch(url);
                if (resRetry3.status !== 200) {
                    url = 'No sprite found; the databases are probably not updated yet.';
                }
            }
        }
        
        // post the url
        await interaction.followUp(url);
        
    },
};