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
        
        /**
         * PS uses a different naming convention for their sprites than the dex.
         * Becase this is based on the dex, we need to modify the input a bit to match the PS convention
         */
        // get the name of the mon
        // we know this exists already and can just take the first value
        const monName = dexNames.filter(n => n.value === mon)[0].name;
        
        // remove any special characters that aren't -
        let nameSanitized = monName.replaceAll(/[^a-zA-Z0-9_-]/g, '').toLowerCase();

        // we need a special overwrite for the jangmo-o line because they have a special character that gets replaced
        if (nameSanitized === 'jangmo-o' || nameSanitized === 'hakamo-o' || nameSanitized === 'kommo-o') {
            nameSanitized = nameSanitized.replace('-', '');
        }

        let folderName = '';
        let ext = 'gif';
        
        // first gens don't have shinies
        if (gen === 1 && shiny) {
            await interaction.followUp('Shiny sprites are unavailable in gen 1');
            return;
        }
        // if gen < 5, no animated sprites exist
        else if (gen <= 5) {
            folderName = shiny ? `gen${gen}ani-shiny` : `gen${gen}ani`;
        }
        else {
            folderName = shiny ? 'ani-shiny' : 'ani';
        }

        url = `https://play.pokemonshowdown.com/sprites/${folderName}/${nameSanitized}.${ext}`;

        // try to get the URL
        const res = await fetch(url);

        // if the get failed, the image doesn't exist.
        // try to get the non-animated sprite (these are typically updated before the animated exist when new gens come out)
        if (res.status !== 200) {
            if (gen <= 5) {
                folderName = shiny ? `gen${gen}-shiny` : `gen${gen}`;
                ext = 'png';
            }
            else {
                folderName = shiny ? 'dex-shiny' : 'dex';
                ext = 'png';
            }

            url = `https://play.pokemonshowdown.com/sprites/${folderName}/${nameSanitized}.${ext}`;

            const resRetry = await fetch(url);

            // if that still doesn't work and they want a shiny
            // tell them we don't have it
            if (resRetry.status !== 200 && shiny) {
                url = 'No shiny sprite found; the databases are probably not updated yet.';
            }
            // if the res doesn't work and they want a regular sprite, try to use the dex
            else if (resRetry.status !== 200) {
                // map the gen alias to the gen number
                // sprites are stored under the alias
                const spriteGenAliases = ['rb', 'c', 'rs', 'dp', 'bw', 'xy', 'xy', 'xy', 'xy'];
                folderName = spriteGenAliases[gen - 1];

                // the dex uses different file extensions depending on the gen
                ext = ['gs', 'bw', 'xy', 'sm', 'sm', 'ss', 'sv'].includes(folderName) ? 'gif' : 'png';
                url = `https://smogon.com/dex/media/sprites/${folderName}/${mon}.${ext}`;

                // if THAT still doesn't work, tell them we don't have the sprite yet
                // because discord autoembeds the sprite, we can just post the url to post the image
                // meaning we can reuse the url variable for the fail string
                const resRetry2 = await fetch(url);
                if (resRetry2.status !== 200) {
                    url = 'No sprite found; the databases are probably not updated yet.';
                }
            }
        }
        
        // post the url
        await interaction.followUp(url);
        
    },
};