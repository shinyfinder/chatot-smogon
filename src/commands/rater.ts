import { SlashCommandBuilder, ChatInputCommandInteraction, AutocompleteInteraction, SlashCommandSubcommandBuilder, SlashCommandSubcommandGroupBuilder, PermissionFlagsBits } from 'discord.js';
import { SlashCommand } from '../types/slash-command-base';
import { allowedMetas as choices } from '../helpers/constants.js';
import { addRater } from '../helpers/addrater.js';
import { removeRater } from '../helpers/removerater.js';
import { listRater } from '../helpers/listrater.js';

/**
 * Command to manage the team rater database.
 * Subcommands are add, remove, list all, and list meta.
 *
 * add: Adds a user to the specified meta.
 *
 * remove: Removes a user from the specified meta.
 *
 * list all: Lists all raters in the database grouped by the meta which they rate for.
 *
 * list meta: Lists all raters for the specified meta.
 */
export const command: SlashCommand = {
    global: false,
    guilds: ['192713314399289344'],
    // setup the slash command builder
    // the rater command groups all add, remove, and list conditions under the same command
    // the command structure is as follows, where <> denote required fields
    /**
     * rater
     * |
     * --- add <generation> <meta> <user>
     * |
     * --- remove <generation> <meta> <user>
     * |
     * --- list
     * |
     * ------ all
     * |
     * ------ meta <generation> <meta>
     */
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
            .setDescription('Adds a team rater to the specified meta')
            .addStringOption(option =>
                option.setName('generation')
                .setDescription('Which gen this user rates teams for')
                .addChoices(
                    { name: 'SV', value: 'SV' },
                    { name: 'SS', value: 'SS' },
                    { name: 'SM', value: 'SM' },
                    { name: 'XY', value: 'XY' },
                    { name: 'BW', value: 'BW' },
                    { name: 'DP', value: 'DP' },
                    { name: 'RS', value: 'RS' },
                    { name: 'GS', value: 'GS' },
                    { name: 'RB', value: 'RB' },
                    { name: 'LGPE', value: 'LGPE' },
                    { name: 'BDSP', value: 'BDSP' },
                )
                .setRequired(true))
            .addStringOption(option =>
                option.setName('meta')
                .setDescription('Tier which the user rates teams for. Start typing to filter the list')
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
            .setDescription('Removes a team rater from the specified meta')
            .addStringOption(option =>
                option.setName('generation')
                .setDescription('Which gen this user rates teams for')
                .addChoices(
                    { name: 'SV', value: 'SV' },
                    { name: 'SS', value: 'SS' },
                    { name: 'SM', value: 'SM' },
                    { name: 'XY', value: 'XY' },
                    { name: 'BW', value: 'BW' },
                    { name: 'DP', value: 'DP' },
                    { name: 'RS', value: 'RS' },
                    { name: 'GS', value: 'GS' },
                    { name: 'RB', value: 'RB' },
                    { name: 'LGPE', value: 'LGPE' },
                    { name: 'BDSP', value: 'BDSP' },
                )
                .setRequired(true))
            .addStringOption(option =>
                option.setName('meta')
                .setDescription('Tier which the user rates teams for. Start typing to filter the list')
                .setRequired(true)
                .setAutocomplete(true))
            .addUserOption(option =>
                option.setName('user')
                .setDescription('User to be added (can accept IDs)')
                .setRequired(true)))
        /**
         * List TR
         */
        .addSubcommandGroup(new SlashCommandSubcommandGroupBuilder()
            .setName('list')
            .setDescription('Lists the team raters in the database, optionally for a specified meta')
            // all
            .addSubcommand(new SlashCommandSubcommandBuilder()
                .setName('all')
                .setDescription('Lists all raters'))
            // specific meta
            .addSubcommand(new SlashCommandSubcommandBuilder()
                .setName('meta')
                .setDescription('Lists the raters for the specified meta')
                .addStringOption(option =>
                    option.setName('generation')
                    .setDescription('Respective gen the user rates teams for')
                    .addChoices(
                        { name: 'SV', value: 'SV' },
                        { name: 'SS', value: 'SS' },
                        { name: 'SM', value: 'SM' },
                        { name: 'XY', value: 'XY' },
                        { name: 'BW', value: 'BW' },
                        { name: 'DP', value: 'DP' },
                        { name: 'RS', value: 'RS' },
                        { name: 'GS', value: 'GS' },
                        { name: 'RB', value: 'RB' },
                        { name: 'LGPE', value: 'LGPE' },
                        { name: 'BDSP', value: 'BDSP' },
                    )
                    .setRequired(true))
                .addStringOption(option =>
                    option.setName('meta')
                    .setDescription('Meta which the user rates teams for')
                    .setRequired(true)
                    .setAutocomplete(true)))),

    // prompt the user with autocomplete options since there are too many tiers to have a selectable list
    async autocomplete(interaction: AutocompleteInteraction) {
        const focusedOption = interaction.options.getFocused(true);

        if (focusedOption.name === 'meta') {
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

        if (interaction.options.getSubcommand() === 'add') {
            // get the user inputs
            // get the inputs
            const metaIn = interaction.options.getString('meta', true).toLowerCase();
            const gen = interaction.options.getString('generation', true);
            const user = interaction.options.getUser('user', true);

            await addRater(interaction, metaIn, gen, user);
            return;
        }
        else if (interaction.options.getSubcommand() === 'remove') {
            // get the inputs
            const metaIn = interaction.options.getString('meta', true).toLowerCase();
            const gen = interaction.options.getString('generation', true);
            const user = interaction.options.getUser('user', true);

            await removeRater(interaction, metaIn, gen, user);
            return;
        }
        else if (interaction.options.getSubcommand() === 'all') {
            await listRater(interaction);
            return;
        }
        else if (interaction.options.getSubcommand() === 'meta') {
            // get the inputs
            const metaIn = interaction.options.getString('meta', true).toLowerCase();
            const gen = interaction.options.getString('generation', true);

            await listRater(interaction, metaIn, gen);
            return;
        }
    },
};