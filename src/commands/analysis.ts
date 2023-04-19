import { SlashCommandBuilder, ChatInputCommandInteraction, AutocompleteInteraction } from 'discord.js';
import { SlashCommand } from '../types/slash-command-base';
import { dexNames as choices } from '../helpers/loadDex.js';

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
        .setName('analysis')
        .setDescription('Posts a link to the SmogDex analysis')
        .addStringOption(option =>
            option.setName('pokemon')
            .setDescription('Name of the Pokemon')
            .setRequired(true)
            .setAutocomplete(true))
        .addStringOption(option =>
            option.setName('gen')
            .setDescription('Which gen the analysis is for')
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
            .setRequired(true))
        .setDMPermission(false),

    // prompt the user with autocomplete options since there are too many tiers to have a selectable list
    async autocomplete(interaction: AutocompleteInteraction) {
        const focusedOption = interaction.options.getFocused(true);

        if (focusedOption.name === 'pokemon') {
            // filter the options shown to the user based on what they've typed in
            // everything is cast to lower case to handle differences in case
            const filtered = choices.filter(choice => choice.toLowerCase().includes(focusedOption.value.toLowerCase()));

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
        }
    },
    // execute our desired task
    async execute(interaction: ChatInputCommandInteraction) {
        await interaction.deferReply();
        // make sure this command is used in a guild
        if (!interaction.guild) {
            await interaction.reply({ content: 'This command can only be used in a server!', ephemeral: true });
            return;
        }

        // get the inputs
        const mon = interaction.options.getString('pokemon', true).toLowerCase();
        const gen = interaction.options.getString('gen', true);

        // make sure they entered proper text
        const validName = choices.some(n => n.toLowerCase() === mon);

        // make and post the url
        if (validName) {
            await interaction.followUp(`https://www.smogon.com/dex/${gen}/pokemon/${mon}/`);
        }
        else {
            await interaction.followUp('Invalid Pokemon name. Please choose one from the list');
        }
        return;
    },
};