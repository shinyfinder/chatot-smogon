import { SlashCommandBuilder, ChatInputCommandInteraction, AutocompleteInteraction } from 'discord.js';
import { SlashCommand } from '../types/slash-command-base';
import { dexGens, dexMondb, latestGen, spriteNames, dexGenNumAbbrMap } from '../helpers/loadDex.js';
import { filterAutocomplete, toAlias, toGenAlias, validateAutocomplete } from '../helpers/autocomplete.js';

/**
 * Posts an image in the chat of the specified Pokemon
 * @param pokemon Name of the pokemon
 * @param gen Which gen to pull up the sprite for
 * @param shiny Boolean to retrieve shiny sprites
 *
 */
export const command: SlashCommand = {
    global: true,
    guilds: [],
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
        .addStringOption(option =>
            option.setName('gen')
            .setDescription('Which gen to retrieve the sprite for. If blank, the latest available is used')
            .setAutocomplete(true)
            .setRequired(false))
        .setDMPermission(false),

    // prompt the user with autocomplete options since there are too many tiers to have a selectable list
    async autocomplete(interaction: AutocompleteInteraction) {
        const focusedOption = interaction.options.getFocused(true);

        if (focusedOption.name === 'pokemon') {
            await filterAutocomplete(interaction, focusedOption, spriteNames);
        }
        else if (focusedOption.name === 'gen') {
            await filterAutocomplete(interaction, focusedOption, dexGens);
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
        const mon = toAlias(interaction.options.getString('pokemon', true));
        let gen = interaction.options.getString('gen') ?? latestGen;
        const shiny = interaction.options.getBoolean('shiny') ?? false;
        const home = interaction.options.getBoolean('home') ?? false;
        
        gen = await toGenAlias(gen);
        
        // since we're using autocomplete, we have to validate their imputs
        if (!validateAutocomplete(mon, spriteNames)) {
            await interaction.followUp('Unrecognized Pokemon; please choose one from the list');
            return;
        }
        
        if (!validateAutocomplete(gen, dexGens)) {
            await interaction.followUp('Unrecognized gen; please choose one from the list');
            return;
        }
        

        // get the gen number for the supplied gen
        // null check if it can't find it, but that will never happen because we already validated the input above
        const genNum = dexGenNumAbbrMap.find(g => g.abbr === gen)?.num ?? -1;

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
        // try to find a row available for the mon
        // we don't really care if it's standard or not because we just want the sprite
        let dbFilterMon = dexMondb.filter(poke => poke.alias === mon && poke.gen_id === gen);

        // if you didn't find a match, it's possible it's a cosmetic forme
        // so split on - and take the first word, which should be the mon
        if (!dbFilterMon.length) {
            dbFilterMon = dexMondb.filter(poke => poke.alias.includes(mon.split('-')[0]) && poke.gen_id === gen);

            // if still no match, return
            if (!dbFilterMon.length) {
                await interaction.followUp(`${mon} is unavailable in gen ${genNum}`);
                return;
            }
            
        }
        
        
        // first gens don't have shinies
        if (genNum === 1 && shiny) {
            await interaction.followUp('Shiny sprites are unavailable in gen 1');
            return;
        }
        // if gen < 5, no animated sprites exist
        else if (genNum <= 5) {
            folderName = shiny ? `gen${genNum}-shiny` : `gen${genNum}`;
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
                const spriteGenAliases = ['rb', 'c', 'rs', 'dp', 'bw', 'xy'];
                if (genNum <= 5) {
                    folderName = spriteGenAliases[genNum - 1];
                }
                else {
                    folderName = spriteGenAliases[spriteGenAliases.length - 1];
                }
                

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