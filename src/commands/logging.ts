import { SlashCommandBuilder, ChatInputCommandInteraction, SlashCommandSubcommandBuilder, PermissionFlagsBits, ChannelType } from 'discord.js';
import { SlashCommand } from '../types/slash-command-base';
import { pool } from '../helpers/createPool.js';

/**
 * Command to turn mod logging on or off in the channel this command is used.
 * Only 1 logging channel is allowed per server.
 * Logged actions are ban add/remove, kick, (un)boosting, (un)timeout, and message deleted
 * Subcommands are on and off
 */

export const command: SlashCommand = {
    global: true,
    guilds: [],
    // setup the slash command builder
    data: new SlashCommandBuilder()
        .setName('logging')
        .setDescription('Toggles mod logging for this server')
        .setDMPermission(false)
        .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
        .addSubcommand(new SlashCommandSubcommandBuilder()
                .setName('enable')
                .setDescription('Turns on logging in the specified channel')
                .addChannelOption(option =>
                    option.setName('channel')
                    .setDescription('Which channel to log in')
                    .setRequired(true)
                    .addChannelTypes(ChannelType.GuildText))
                .addStringOption(option =>
                    option.setName('logtype')
                    .setDescription('Whether to log edits, all, or mod actions in this channel')
                    .setChoices(
                        // everything
                        { name: 'All', value: 'all' },
                        // only edits
                        { name: 'Edits', value: 'edits' },
                        // everything but edits
                        { name: 'Non-Edits', value: 'nonedits' },
                        // user executed (self deletes, edits, boost)
                        { name: 'User Executed', value: 'userex' },
                        // mod executed (kick, ban, TO, mod delete)
                        { name: 'Mod Executed', value: 'modex' },
                        // user targeted (kick, ban, TO, boost)
                        { name: 'User Targeted', value: 'usertarget' },
                        // message targeted (delete, edit)
                        { name: 'Message Targeted', value: 'msgtarget' },
                    )
                    .setRequired(false)),
        )
        .addSubcommand(
            new SlashCommandSubcommandBuilder()
                .setName('disable')
                .setDescription('Turns off logging in the specified channel')
                .addChannelOption(option =>
                    option.setName('channel')
                    .setDescription('The channel currently being logged in')
                    .setRequired(true)),
        ),
    // execute our desired task
    async execute(interaction: ChatInputCommandInteraction) {
        // typecheck
        if (interaction.guildId === null) {
            return;
        }
        await interaction.deferReply({ ephemeral: true });

        // query the database for the list of logging channels
        // const ratersPostgres = await pool.query('SELECT channelid FROM chatot.logchan WHERE serverid = $1', [interaction.guildId]);
        // const logchans: { channelid: string}[] | [] = ratersPostgres.rows;

        
        /**
         * LOG ENABLE
         */
        if (interaction.options.getSubcommand() === 'enable') {
            // get the user input
            const chan = interaction.options.getChannel('channel', true, [ChannelType.GuildText]);
            let type = interaction.options.getString('logtype');

            // try to default the chan type to whatever is currently there if no type was provided
            // if no results, default to all
            const logchanPG = await pool.query('SELECT channelid, logtype FROM chatot.logchan WHERE serverid = $1', [interaction.guildId]);
            const logchans: { channelid: string, logtype: string }[] | [] = logchanPG.rows;

            const matchIndex = logchans.findIndex(row => row.channelid === chan.id);
            // match and no type = set to match
            if (matchIndex >= 0 && !type) {
                type = logchans[matchIndex].logtype;
            }
            // no match and no type = default
            else if (matchIndex < 0 && !type) {
                type = 'all';
            }

            // upsert into the db
            await pool.query('INSERT INTO chatot.logchan (serverid, channelid, logtype) VALUES ($1, $2, $3) ON CONFLICT (serverid, channelid) DO UPDATE SET serverid = EXCLUDED.serverid, channelid = EXCLUDED.channelid, logtype = $3', [interaction.guildId, chan.id, type]);

            // let them know we're done
            await interaction.followUp(`Logging set to channel **${chan.name}**`);
        }

        /**
         * MODLOG OFF
         */
        else if (interaction.options.getSubcommand() === 'disable') {
            // get the user input
            const chan = interaction.options.getChannel('channel', true, [ChannelType.GuildText]);
            // delete the corresponding row
            await pool.query('DELETE FROM chatot.logchan WHERE serverid = $1 AND channelid = $2', [interaction.guildId, chan.id]);
            
            // let hem know we're done
            await interaction.followUp(`I will no longer log to channel **${chan.name}**`);
        }
    },

};