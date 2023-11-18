import { SlashCommandBuilder, ChatInputCommandInteraction, AutocompleteInteraction, EmbedBuilder, APIEmbedField } from 'discord.js';
import { SlashCommand } from '../types/slash-command-base';
import { pokedex, movesText, itemsText, items, abilitiesText, natures } from '../helpers/loadDex.js';
import { latestGen, myColors } from '../helpers/constants.js';
import { dexDataPairs } from '../helpers/createAutoPairs.js';
import fetch from 'node-fetch';
import { IPSDex } from '../types/ps';
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
        .setName('dt')
        .setDescription('Gives the details of the provided Pokemon, move, item, etc')
        .addStringOption(option =>
            option.setName('name')
            .setDescription('Name of the Pokemon, move, item, nature, or ability')
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

        if (focusedOption.name === 'name') {
            const enteredText = focusedOption.value.toLowerCase();
            const filteredOut: {name: string, value: string }[] = [];
            // filter the options shown to the user based on what they've typed in
            // everything is cast to lower case to handle differences in case
            for (const pair of dexDataPairs) {
                if (filteredOut.length < 25) {
                    const nameLower = pair.name.toLowerCase();
                    // return the pairs
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
        const queryStr = interaction.options.getString('name', true).toLowerCase();
        const gen = interaction.options.getInteger('gen') ?? latestGen;

        // get the data for the string
        /**
         * POKEDEX
         */
        if (Object.keys(pokedex).includes(queryStr)) {
            const data = pokedex[queryStr];

            // if gen is not the latest, get the mod data as well
            let modDex: IPSDex = {};
            if (gen !== latestGen) {
                let statusNum = 0;
                let genCheck = gen;

                while (statusNum !== 200 || genCheck > 0) {
                    const res = await fetch(`https://raw.githubusercontent.com/smogon/pokemon-showdown/master/data/mods/gen${gen}/pokedex.ts`);
                    statusNum = res.status;
                    if (res.status === 200) {
                        const txt = await res.text();
                        modDex = res2JSON(txt) as IPSDex;
                        if (!modDex[queryStr]) {
                            genCheck--;
                        }
                    }
                    else {
                        genCheck--;
                    }
                }
                
            }

            // overwrite the current gen data any matching data from the mods
            const moddedData = modDex[queryStr];

            for (const mod in moddedData) {
                data[mod] = moddedData[mod] ?? data[mod];
            }
  
            // get the power of Low Kick based on the weight
            let lkbp = 50;
            if (data.weightkg < 10) {
                lkbp = 20;
            }
            else if (data.weightkg < 25) {
                lkbp = 40;
            }
            else if (data.weightkg < 50) {
                lkbp = 60;
            }
            else if (data.weightkg < 100) {
                lkbp = 80;
            }
            else if (data.weightkg < 200) {
                lkbp = 100;
            }
            else {
                lkbp = 120;
            }


            // forumulate the gender string
            let genderOut = '';

            if (data.gender === 'N') {
                genderOut = 'Genderless';
            }
            else if (data.gender === 'M') {
                genderOut = 'Male Only';
            }
            else if (data.gender === 'F') {
                genderOut = 'Female Only';
            }
            else if (data.genderRatio) {
                genderOut = (data.genderRatio.F * 100).toString() + '% Female';
            }
            else {
                genderOut = '50% Female';
            }


            // set the embed color
            let embedColor = 0;
            for (const [color, value] of Object.entries(myColors)) {
                if (color === data.color) {
                    embedColor = value;
                }
            }

            // get the sprite
            // remove any special characters that aren't - from teh mon name
            let spriteName = pokedex[queryStr].name.replace(/[^a-z0-9-]/gi, '').toLowerCase();

            // we need a special overwrite for the jangmo-o line and ho-oh because they have a dash that gets replaced
            if (spriteName === 'jangmo-o' || spriteName === 'hakamo-o' || spriteName === 'kommo-o' || spriteName === 'ho-oh') {
                spriteName = spriteName.replace('-', '');
            }

            // build the ability field
            const abilityList: string[] = [];
            for (const [k, v] of Object.entries(data.abilities)) {
                abilityList.push(`${k}: ${v}`);
            }

            // compute the BST
            const bst = Object.values(data.baseStats).reduce((previous, current) => previous + current, 0).toString();

            // build the embed
            const embed = new EmbedBuilder()
                .setTitle(`${data.name} (Gen ${gen})`)
                .addFields(
                    { name: 'Typing', value: data.types.join(' / ') },
                    { name: 'Abilities', value: abilityList.join(' | ') },
                    { name: `Base Stats (BST: ${bst})`, value: Object.values(data.baseStats).join(' / ') },
                    { name: 'Weight', value: `${data.weightkg} kg (${lkbp} BP)`, inline: true },
                    { name: 'Gender Rate', value: genderOut, inline: true },
                )
                .setColor(embedColor)
                .setThumbnail(`https://raw.githubusercontent.com/shinyfinder/chatot-assets/main/home-sprites/normal/${spriteName}.png`);

            if (queryStr === 'koffing') {
                embed.setDescription('Official mascot of Smogon University. Check out our [Discord](https://discord.gg/smogon)!');
                const newField: APIEmbedField = { name: 'Birthday', value: 'December 18, 2004', inline: true };
                embed.addFields(newField);
            }
            else if (queryStr === 'chatot') {
                embed.setDescription('If you\'re reading this, I hope you have a great day! ❤');
                const newField: APIEmbedField = { name: 'Favorite User', value: `<@${interaction.user.id}>`, inline: true };
                embed.addFields(newField);
                // update the avatar url if we have one
                const aviURL = interaction.client.user.avatarURL();
                if (aviURL) {
                    embed.setThumbnail(aviURL);
                }
                
            }

            await interaction.followUp({ embeds: [embed] });
        }
    },
};