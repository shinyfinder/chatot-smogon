import { SlashCommandBuilder, ChatInputCommandInteraction, PermissionFlagsBits, ChannelType, AutocompleteInteraction, SlashCommandSubcommandBuilder, SlashCommandSubcommandGroupBuilder } from 'discord.js';
import { pool } from '../helpers/createPool.js';
import { SlashCommand } from '../types/slash-command-base';
import { filterAutocomplete, validateAutocomplete } from '../helpers/autocomplete.js';
import { cacheTourPingOptions, tourPingPairs } from '../helpers/relayPings.js';
import { psFormatAliases } from '../helpers/loadDex.js';
import { ServerClass } from '../helpers/constants.js';
import { checkChanPerms } from '../helpers/checkChanPerms.js';
/**
 * Command to change a users subscription to the RMT ping system
 * @param data SlashCommandBuilder() instance from discord.js
 *
 */
export const command: SlashCommand = {
    global: true,
    guilds: [],
    // setup the slash command builder
    data: new SlashCommandBuilder()
        .setName('tourpings')
        .setDescription('Ping a role in your server when official servers ping for Smogon tours')
        .addSubcommand(new SlashCommandSubcommandBuilder()
            .setName('sub')
            .setDescription('Sets up a role to receive pings from another server')
            .addStringOption(option =>
                option.setName('tour')
                .setDescription('The tour/tournament you want to subscribe to')
                .setRequired(true)
                .setAutocomplete(true))
            .addRoleOption(option =>
                option.setName('role')
                .setDescription('The role to receive alerts')
                .setRequired(true))
            .addChannelOption(option =>
                option.setName('channel')
                .setDescription('The channel to receive alerts')
                .setRequired(true)
                .addChannelTypes(ChannelType.GuildText, ChannelType.PublicThread, ChannelType.PrivateThread)))
        .addSubcommand(new SlashCommandSubcommandBuilder()
            .setName('unsub')
            .setDescription('Stops a role from receiving pings from another server')
            .addStringOption(option =>
                option.setName('tour')
                .setDescription('The tour/tournament you no longer want to subscribe to')
                .setRequired(true)
                .setAutocomplete(true)))
        .addSubcommandGroup(new SlashCommandSubcommandGroupBuilder()
            .setName('host')
            .setDescription('Manages a role to transmit pings to another server if they subscribe')
            .addSubcommand(new SlashCommandSubcommandBuilder()
                .setName('add')
                .setDescription('Adds a role whose pings other servers can subscribe to')
                .addStringOption(option =>
                    option.setName('tour')
                    .setDescription('Name to identify what you are pinging for (i.e. SV OU SPL matches')
                    .setRequired(true))
                .addRoleOption(option =>
                    option.setName('role')
                    .setDescription('The role you ping when these matches take place')
                    .setRequired(true))
                .addStringOption(option =>
                    option.setName('psladder')
                    .setDescription('The PS ladder to alert for (i.e. gen9ou)')
                    .setRequired(false)
                    .setAutocomplete(true)))
            .addSubcommand(new SlashCommandSubcommandBuilder()
                .setName('editrole')
                .setDescription('Edits the role for a tier whose pings get relayed')
                .addStringOption(option =>
                    option.setName('tour')
                    .setDescription('Name to identify what you are pinging for (i.e. SV OU SPL matches')
                    .setRequired(true)
                    .setAutocomplete(true))
                .addRoleOption(option =>
                    option.setName('role')
                    .setDescription('The role you ping when these matches take place')
                    .setRequired(true)))
            .addSubcommand(new SlashCommandSubcommandBuilder()
                .setName('remove')
                .setDescription('Removes the ping relay for a tour and unsubscribes relevant servers')
                .addStringOption(option =>
                    option.setName('tour')
                    .setDescription('Name to identify what you are pinging for (i.e. SV OU SPL matches')
                    .setRequired(true)
                    .setAutocomplete(true))))
       
        .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),


     // prompt the user with autocomplete options
     async autocomplete(interaction: AutocompleteInteraction) {
        const focusedOption = interaction.options.getFocused(true);

        if (focusedOption.name === 'tour') {
            // if we need to, update the options
            await cacheTourPingOptions();
            await filterAutocomplete(interaction, focusedOption, tourPingPairs);
        }
        else if (focusedOption.name === 'psladder') {
            await filterAutocomplete(interaction, focusedOption, psFormatAliases);
        }
    },

    // execute our desired task
    async execute(interaction: ChatInputCommandInteraction) {
        await interaction.deferReply({ ephemeral: true });
        
        /**
         * SUBSCRIBE
         */

        if (interaction.options.getSubcommand() === 'sub') {
            // get their selection
            const tour = interaction.options.getString('tour', true).toLowerCase().replace(/[^a-z0-9]/g, '');
            const subRole = interaction.options.getRole('role', true);
            const subChan = interaction.options.getChannel('channel', true, [ChannelType.GuildText, ChannelType.PublicThread, ChannelType.PrivateThread]);

            // validate autocomplete
            if (!validateAutocomplete(tour, tourPingPairs)) {
                await interaction.followUp('I did not recognize that tour, please choose one from the list');
                return;
            }

            // make sure we can post in the channel
            let canComplete = true;
            if (subChan.type === ChannelType.PublicThread || subChan.type === ChannelType.PrivateThread) {
                canComplete = await checkChanPerms(interaction, subChan, ['ViewChannel', 'SendMessagesInThreads']);
            }
            else if (subChan.type === ChannelType.GuildText) {
                canComplete = await checkChanPerms(interaction, subChan, ['ViewChannel', 'SendMessages']);
            }

            if (!canComplete) {
                return;
            }

            // atp we know that the tour alias is in the database
            // so add the sub info
            await pool.query(` 
            INSERT INTO chatot.crossping_subs
            (source, serverid, roleid, channelid)
            VALUES ($1, $2, $3, $4)
            ON CONFLICT (source, roleid) DO
            UPDATE SET channelID = EXCLUDED.channelid`, [tour, interaction.guildId, subRole.id, subChan.id]);

            await interaction.followUp('Preferences updated');
        }

        /**
         * UNSUBSCRIBE
         */

        else if (interaction.options.getSubcommand() === 'unsub') {
            // inputs
            const tour = interaction.options.getString('tour', true).toLowerCase().replace(/[^a-z0-9]/g, '');

            // validate autocomplete
            if (!validateAutocomplete(tour, tourPingPairs)) {
                await interaction.followUp('I did not recognize that tour, please choose one from the list');
                return;
            }

            // outs
            await pool.query('DELETE FROM chatot.crossping_subs WHERE source=$1 AND serverid=$2', [tour, interaction.guildId]);

            await interaction.followUp('Preferences updated');
        }


        /**
         * HOST
         */

        else if (interaction.options.getSubcommandGroup() === 'host') {

            /**
             * HOST ADD
             */

            if (interaction.options.getSubcommand() === 'add') {
                // get their inputs
                const tour = interaction.options.getString('tour', true);
                const ladder = interaction.options.getString('psladder');
                const role = interaction.options.getRole('role', true);

                // validate autocomplete
                if (ladder && !validateAutocomplete(ladder, psFormatAliases)) {
                    await interaction.followUp('I did not recognize that ladder, please choose one from the list');
                    return;
                }

                // make sure this is an official cord
                const serverInfo: { class: ServerClass }[] | [] = (await pool.query('SELECT class FROM chatot.servers WHERE serverid=$1', [interaction.guildId])).rows;

                if (!serverInfo.length) {
                    await interaction.followUp('No info found for this server...how did I get here?');
                    return;
                }
                else if (serverInfo[0].class !== ServerClass.Official) {
                    await interaction.followUp('Only official servers can setup a role that is relayed');
                    return;
                }

                // form the alias of the id (lower case and remove all non-alphanumeric)
                // this should be unique
                const tourAlias = tour.toLowerCase().replace(/[^a-z0-9]/g, '');

                // try to insert
                // we wrap this in a try catch in order to get the user a meaningful error message
                try {
                    await pool.query(`
                    INSERT INTO chatot.crossping_sources (tour, tour_alias, psladder, roleid, serverid)
                    VALUES ($1, $2, $3, $4, $5)`,
                    [tour, tourAlias, ladder, role.id, interaction.guildId]);

                    await cacheTourPingOptions(true);
                    await interaction.followUp(`Ok, people can now subscribe to your pings for ${tour}`);
                    
                }
                catch (e) {
                    if (e instanceof Error && 'constraint' in e) {
                        if (e.constraint === 'crossping_sources_pkey') {
                            await interaction.followUp(`You cannot use the same identifier for multiple tours! Tour already exists for ${tour}. If you are trying to edit the information for this tour, please use the appropriate subcommand. `);
                        }
                        else if (e.constraint === 'crossping_sources_psladder_roleid_key') {
                            await interaction.followUp('You cannot use the same combination of PS ladder and role to ping for different tours. If you are trying to ping for a different tour that uses the same PS ladder, please use a different role.');
                        }
                        else {
                            throw e;
                        }
                    }
                    else {
                        throw e;
                    }
                }
            }

            /**
             * HOST EDIT
             */

            else if (interaction.options.getSubcommand() === 'editrole') {
                // get their selection
                const tour = interaction.options.getString('tour', true).toLowerCase().replace(/[^a-z0-9]/g, '');
                const role = interaction.options.getRole('role', true);
                

                // validate autocomplete
                if (!validateAutocomplete(tour, tourPingPairs)) {
                    await interaction.followUp('I did not recognize that tour, please choose one from the list');
                    return;
                }

                // atp we know that the tour alias is in the database
                // update the info
                try {
                    const updated = (await pool.query('UPDATE chatot.crossping_sources SET roleid=$1 WHERE tour_alias=$2 AND serverid=$3 RETURNING *', [role.id, tour, interaction.guildId])).rowCount;

                    if (updated) {
                        await interaction.followUp('Role info updated. Any servers that subscribed to these pings are still subscribed.');
                    }
                    else {
                        await interaction.followUp('Cannot update tour info that was setup in another server');
                    }
                }
                catch (e) {
                    if (e instanceof Error && 'constraint' in e) {
                        if (e.constraint === 'crossping_sources_psladder_roleid_key') {
                            await interaction.followUp('You cannot use the same combination of PS ladder and role to ping for different tours. If you are trying to ping for a different tour that uses the same PS ladder, please use a different role.');
                        }
                        else {
                            throw e;
                        }
                    }
                    else {
                        throw e;
                    }
                }
            }

            /**
             * HOST REMOVE
             */

            else if (interaction.options.getSubcommand() === 'remove') {
                // get their selection
                const tour = interaction.options.getString('tour', true).toLowerCase().replace(/[^a-z0-9]/g, '');
                 // validate autocomplete
                 if (!validateAutocomplete(tour, tourPingPairs)) {
                    await interaction.followUp('I did not recognize that tour, please choose one from the list');
                    return;
                }

                const removed = (await pool.query('DELETE FROM chatot.crossping_sources WHERE tour_alias=$1 AND serverid=$2 RETURNING *', [tour, interaction.guildId])).rowCount;

                if (removed) {
                    await interaction.followUp(`Ping relay removed for ${interaction.options.getString('tour', true)}. All relevant servers have been unsubscribed.`);
                }
                else {
                    await interaction.followUp('Cannot update tour info that was setup in another server');
                }

            }

        }

    },
};