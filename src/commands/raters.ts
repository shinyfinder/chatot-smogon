import { SlashCommandBuilder, ChatInputCommandInteraction, AutocompleteInteraction, User, EmbedBuilder } from 'discord.js';
import { SlashCommand } from '../types/slash-command-base';
import { pool } from '../helpers/createPool.js';
import { psFormats } from '../helpers/loadDex.js';
import { toPSAlias, validateAutocomplete } from '../helpers/autocomplete.js';
import { filterAutocomplete } from '../helpers/autocomplete.js';

/**
 * Outputs the list of team raters
 */

export const command: SlashCommand = {
    global: false,
    guilds: ['192713314399289344'],
    // setup the slash command builder
    // the rater command groups all add, remove, and list conditions under the same command
    data: new SlashCommandBuilder()
        .setName('raters')
        .setDescription('Lists a format\'s team raters or the formats a user rates')
        .addStringOption(option =>
            option.setName('format')
            .setDescription('Which format to query. Type to filter')
            .setAutocomplete(true)
            .setRequired(false))
        .addUserOption(option =>
            option.setName('user')
            .setDescription('Which user to query. Can accept ids')
            .setRequired(false)
        )
        .setDMPermission(false) as SlashCommandBuilder,

    // prompt the user with autocomplete options since there are too many tiers to have a selectable list
    async autocomplete(interaction: AutocompleteInteraction) {
        const focusedOption = interaction.options.getFocused(true);

        if (focusedOption.name === 'format') {
            await filterAutocomplete(interaction, focusedOption, psFormats);
        }
    },
    // execute our desired task
    async execute(interaction: ChatInputCommandInteraction) {
        await interaction.deferReply({ ephemeral: true});

        // get their input
        let format = interaction.options.getString('format');
        const user = interaction.options.getUser('user');
        let formatName = '';

        // no inputs, nothing to do
        if (!format && !user) {
            await interaction.followUp('Please provide at least one option to query against. Generally speaking, a rater is someone with the comp-helper role.');
            return;
        }

        // if they provided a format, make sure it's a valid input
        if (format) {
            // make sure it's valid input
            format = toPSAlias(format);
            if (!validateAutocomplete(format, psFormats)) {
                await interaction.followUp('Unrecognized format, please choose one from the list');
                return;
            }
            // get the type-cased name of the meta so that the output is pretty
            formatName = psFormats.find(f => f.value === format)!.name;
        }

        // specified both, so see if this user is a rater for this meta
        if (format && user) {
            const isRater = !!(await pool.query('SELECT * FROM chatot.raterlists WHERE meta=$1 AND userid=$2', [format, user.id])).rowCount
            const res = `User ${isRater ? 'is' : 'is not'} a rater for ${formatName}`;
            await interaction.followUp(res);
        }

        // gave a user, get a format(s)
        else if (user) {
            const formatList: { meta: string }[] = (await pool.query('SELECT meta FROM chatot.raterlists WHERE userid=$1', [user.id])).rows;
            if (!formatList.length) {
                await interaction.followUp('User does not rate for any formats');
            }
            else {
                await interaction.followUp(`The user rates for the following formats: ${formatList.map(f => f.meta).join(', ')}`);
            }
        }

        // they provided a format, get the users
        else if (format) {
            // retrieve the rater list from the db
            const raterList: { userid: string }[] = (await pool.query('SELECT userid FROM chatot.raterlists WHERE meta=$1', [format])).rows;
            
            if (!raterList.length) {
                await interaction.followUp('No raters found');
                return;
            }

            // fetch the users so we can get their username
            const userPromiseArr: Promise<User>[] = [];
            
            for (const user of raterList) {
                userPromiseArr.push(interaction.client.users.fetch(user.userid));
            }

            const userArr: User[] = await Promise.all(userPromiseArr);

            // populate an output string to include a user tag + username
            const userStr = userArr.map(user => `<@${user.id}> (${user.username})`).join('\n');

            // build the embed for output
            const embed = new EmbedBuilder()
                .setTitle(`Raters for ${formatName}`)
                .setDescription(`${userStr}`);

            // post it to the channel
            await interaction.followUp({ embeds: [embed] });
        }

    },
};