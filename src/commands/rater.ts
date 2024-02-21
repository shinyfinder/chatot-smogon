import { SlashCommandBuilder, ChatInputCommandInteraction, AutocompleteInteraction, SlashCommandSubcommandBuilder, SlashCommandSubcommandGroupBuilder, PermissionFlagsBits } from 'discord.js';
import { SlashCommand } from '../types/slash-command-base';
import { addRater } from '../helpers/addrater.js';
import { removeRater, removeRaterAll } from '../helpers/removerater.js';
import { listRater } from '../helpers/listrater.js';
import { psFormats } from '../helpers/loadDex.js';
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
                option.setName('meta')
                .setDescription('Tier which the user rates teams for. Start typing to filter the list')
                .setRequired(true)
                .setAutocomplete(true))
            .addUserOption(option =>
                option.setName('user')
                .setDescription('User to be added (can accept IDs)')
                .setRequired(true)))

        /**
         * Remove ALL
         */
        .addSubcommand(new SlashCommandSubcommandBuilder()
            .setName('removeall')
            .setDescription('Removes a team rater from all of their metas')
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
                    option.setName('meta')
                    .setDescription('Meta which the user rates teams for')
                    .setRequired(true)
                    .setAutocomplete(true)))),

    // prompt the user with autocomplete options since there are too many tiers to have a selectable list
    async autocomplete(interaction: AutocompleteInteraction) {
        const focusedOption = interaction.options.getFocused(true);

        if (focusedOption.name === 'meta') {
            const enteredText = focusedOption.value.toLowerCase();

            const filteredOut: {name: string, value: string }[] = [];
            // filter the options shown to the user based on what they've typed in
            // everything is cast to lower case to handle differences in case
            for (const pair of psFormats) {
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

        if (interaction.options.getSubcommand() === 'add') {
            // get the user inputs
            // get the inputs
            const metaIn = interaction.options.getString('meta', true).toLowerCase();
            const user = interaction.options.getUser('user', true);

            await addRater(interaction, metaIn, user);
        }
        else if (interaction.options.getSubcommand() === 'remove') {
            // get the inputs
            const metaIn = interaction.options.getString('meta', true).toLowerCase();
            const user = interaction.options.getUser('user', true);

            await removeRater(interaction, metaIn, user);
        }
        else if (interaction.options.getSubcommand() === 'removeall') {
            // get the input
            const user = interaction.options.getUser('user', true);

            // remove them
            await removeRaterAll(interaction, [user.id]);

            // done
            await interaction.followUp(`${user.username} was removed from all rater lists`);  
        }
        else if (interaction.options.getSubcommand() === 'all') {
            await listRater(interaction);
        }
        else if (interaction.options.getSubcommand() === 'meta') {
            // get the inputs
            const metaIn = interaction.options.getString('meta', true).toLowerCase();
            await listRater(interaction, metaIn);
        }
    },
};