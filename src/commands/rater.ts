import { SlashCommandBuilder, ChatInputCommandInteraction, AutocompleteInteraction, SlashCommandSubcommandBuilder, PermissionFlagsBits } from 'discord.js';
import { SlashCommand } from '../types/slash-command-base';
import { pool } from '../helpers/createPool.js';
import { psFormats } from '../helpers/loadDex.js';
import { toPSAlias, validateAutocomplete } from '../helpers/autocomplete.js';
import { filterAutocomplete } from '../helpers/autocomplete.js';

/**
 * Manages the team rater database
 */

export const command: SlashCommand = {
    global: false,
    guilds: ['192713314399289344'],
    // setup the slash command builder
    // the rater command groups all add, remove, and list conditions under the same command
    data: new SlashCommandBuilder()
        .setName('rater')
        .setDescription('Manages the team raters database')
        .setDMPermission(false)
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
        /**
         * Add TR
         */
        .addSubcommand(new SlashCommandSubcommandBuilder()
            .setName('add')
            .setDescription('Adds a team rater to the specified format')
            .addStringOption(option =>
                option.setName('format')
                .setDescription('Format which the user rates teams for. Start typing to filter the list')
                .setRequired(true)
                .setAutocomplete(true))
            .addUserOption(option =>
                option.setName('user')
                .setDescription('User to be added (can accept IDs)')
                .setRequired(true)))
            
        /**
         * Remove TR
         */
        .addSubcommand(new SlashCommandSubcommandBuilder()
            .setName('remove')
            .setDescription('Removes a team rater from the specified format')
            .addStringOption(option =>
                option.setName('format')
                .setDescription('Format which the user rates teams for. Start typing to filter the list')
                .setRequired(true)
                .setAutocomplete(true))
            .addUserOption(option =>
                option.setName('user')
                .setDescription('User to be removed (can accept IDs)')
                .setRequired(true)))

        /**
         * Remove ALL
         */
        .addSubcommand(new SlashCommandSubcommandBuilder()
            .setName('removeall')
            .setDescription('Removes a team rater from all of their formats')
            .addUserOption(option =>
                option.setName('user')
                .setDescription('User to be removed (can accept IDs)')
                .setRequired(true))),

    // prompt the user with autocomplete options since there are too many tiers to have a selectable list
    async autocomplete(interaction: AutocompleteInteraction) {
        const focusedOption = interaction.options.getFocused(true);

        if (focusedOption.name === 'format') {
            await filterAutocomplete(interaction, focusedOption, psFormats);
        }
    },

    // execute our desired task
    async execute(interaction: ChatInputCommandInteraction) {
        await interaction.deferReply();

        /**
         * ADD
         */

        if (interaction.options.getSubcommand() === 'add') {
            // get the user inputs
            const format = toPSAlias(interaction.options.getString('format', true));
            const user = interaction.options.getUser('user', true);

            // validate AC
            if (!validateAutocomplete(format, psFormats)) {
                await interaction.followUp('Unrecognized format, please choose one from the list');
                return;
            }

            // try to find their ping preferences
            const pingMatch: { ping: string }[] = (await pool.query('SELECT ping FROM chatot.raterlists WHERE userid=$1', [user.id])).rows;

            
            // if they're already a rater for something, use their preferences for this new add
            // otherwise, default to All
            const pingOut = pingMatch.length ? pingMatch[0].ping : 'All';

            // push it to the db
            await pool.query('INSERT INTO chatot.raterlists (meta, userid, ping) VALUES ($1, $2, $3) ON CONFLICT (meta, userid) DO NOTHING', [format, user.id, pingOut]);

            // get the type-cased name of the format so that the output is pretty
            // we already know what they entered is in the list of formats
            const metaName = psFormats.find(f => f.value === format)!.name;

            // done!
            await interaction.followUp(`${user.username} was added to the list of ${metaName} raters.`);
            
        }


        /**
         * REMOVE
         */

        else if (interaction.options.getSubcommand() === 'remove') {
            // get the user inputs
            const format = toPSAlias(interaction.options.getString('format', true));
            const user = interaction.options.getUser('user', true);

            // validate AC
            if (!validateAutocomplete(format, psFormats)) {
                await interaction.followUp('Unrecognized format, please choose one from the list');
                return;
            }

            // remove it from the db
            await pool.query('DELETE FROM chatot.raterlists WHERE meta=$1 AND userid=$2', [format, user.id]);

            // get the type-cased name of the meta so that the output is pretty
            // we already know what they entered is in the list of formats, but we need to typecheck the find to make TS happy
            const metaName = psFormats.find(f => f.value === format)!.name;

            // let them know we're done
            await interaction.followUp(`${user.username} was removed from the list of ${metaName} raters.`);
        }


        /**
         * REMOVE ALL
         */

        else if (interaction.options.getSubcommand() === 'removeall') {
            // get the input
            const user = interaction.options.getUser('user', true);

            // remove them from the db
            await pool.query('DELETE FROM chatot.raterlists WHERE userid=$1', [user.id]);

            // done
            await interaction.followUp(`${user.username} was removed from all rater lists`);  
        }
    },
};