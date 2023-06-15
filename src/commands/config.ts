import { SlashCommandBuilder, ChatInputCommandInteraction, PermissionFlagsBits, SlashCommandSubcommandBuilder, SlashCommandSubcommandGroupBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, User, ComponentType, ButtonInteraction, ButtonComponent } from 'discord.js';
import { SlashCommand } from '../types/slash-command-base';
import { pool } from '../helpers/createPool.js';
import { getRandInt } from '../helpers/getRandInt.js';
import { cp } from 'node:fs';

/**
 * Sets up the requirements for a user to be considered verified within the discord server
 * 
 */
export const command: SlashCommand = {
    global: true,
    guilds: [],
    // setup the slash command builder
    data: new SlashCommandBuilder()
        .setName('config')
        .setDescription('Sets up the requirements for a user to be considered verified')
        .setDMPermission(false)
        .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)

        /**
         * VERIFY MEMBERS
         */
        .addSubcommand(new SlashCommandSubcommandBuilder()
            .setName('verify')
            .setDescription('Configures the server verification requirements')
            .addRoleOption(option => 
                option.setName('role')
                .setDescription('Role given to or removed from verified users')
                .setRequired(true))
            .addStringOption(option =>
                option.setName('method')
                .setDescription('Upon verification, this role is...')
                .addChoices(
                    { name: 'Added', value: 'add' },
                    { name: 'Removed', value: 'remove' },
                )
                .setRequired(true))
            .addIntegerOption(option =>
                option.setName('accountage')
                .setDescription('Minimum account age in days')
                .setMinValue(0)
                .setMaxValue(2147483647)
                .setRequired(false))
            .addBooleanOption(option =>
                option.setName('turnoff')
                .setDescription('Turns off the verification process')
                .setRequired(false)))
        

        /**
         * LOGGING
         */
        .addSubcommandGroup(new SlashCommandSubcommandGroupBuilder()
            .setName('logging')
            .setDescription('Configures server logging')
            .addSubcommand(new SlashCommandSubcommandBuilder()
                .setName('ignore')
                .setDescription('Turns off deleted message tracking from the specified channel')
                .addChannelOption(option =>
                    option.setName('channel')
                    .setDescription('Channel to ignore deleted messages in')
                    .setRequired(true)))
            .addSubcommand(new SlashCommandSubcommandBuilder()
            .setName('unignore')
            .setDescription('Restores deleted message logging in ignored channel')
            .addChannelOption(option =>
                option.setName('channel')
                .setDescription('Channel to restore deleted message tracking')
                .setRequired(true)))
            .addSubcommand(new SlashCommandSubcommandBuilder()
                .setName('deletes')
                .setDescription('Configure whether all or only mod deletes get tracked')
                .addStringOption(option =>
                    option.setName('scope')
                    .setDescription('Messages will by logged if deleted by...')
                    .setChoices(
                        { name: 'Mods', value: 'mod' },
                        { name: 'Everyone', value: 'all' },
                    )
                    .setRequired(true)))),

    // execute our desired task
    async execute(interaction: ChatInputCommandInteraction) {
        await interaction.deferReply({ ephemeral: true });

        if (!interaction.guildId) {
            return;
        }

        
        if (interaction.options.getSubcommand() === 'verify') {
            // retrieve the user input
            const role = interaction.options.getRole('role', true);
            const method = interaction.options.getString('method', true);
            const age = interaction.options.getInteger('accountage') ?? 0;
            const turnoff = interaction.options.getBoolean('turnoff');

            // make sure it's a valid assignable role
            // invalid are the built-in @everyone role and any role that's externally managed (i.e. bot role, boost role)
            if (role.managed || role.name === '@everyone') {
                await interaction.followUp('I cannot assign that role');
                return;
            }

            // upsert into the db
            if (turnoff) {
                await pool.query('DELETE FROM chatot.verifyreqs WHERE serverid=$1', [interaction.guildId]);
                // success!
                await interaction.followUp('Ok, I will no longer assign a role to new members');
            }
            else {
                await pool.query('INSERT INTO chatot.verifyreqs (serverid, roleid, age, method) VALUES ($1, $2, $3, $4) ON CONFLICT (serverid) DO UPDATE SET serverid=EXCLUDED.serverid, roleid=EXCLUDED.roleid, age=EXCLUDED.age, method=EXCLUDED.method', [interaction.guildId, role.id, age, method]);
                // success!
                await interaction.followUp(`Ok, I will **${method}** role **${role.name}** on new members with a forum account older than **${age}** days.`);
            }
            return;
        }

        else if (interaction.options.getSubcommand() === 'ignore') {
            // get the user input
            const chan = interaction.options.getChannel('channel', true);

            // see if there are entries for this server already so we can update them
            const q = await pool.query('SELECT deletescope FROM chatot.logprefs WHERE serverid=$1', [interaction.guildId]);
            const storedScope: { deletescope: string }[] | [] = q.rows;

            // get the desired deletion scope
            // if there's an existing row for this server, just use whatever it says
            // if there isn't a row, default to only logging mod deletes
            const scope = storedScope.length ? storedScope[0].deletescope : 'mod';

            // store it in the db
            await pool.query('INSERT INTO chatot.logprefs (serverid, ignoreid, deletescope) VALUES ($1, $2, $3) ON CONFLICT (ignoreid) DO NOTHING', [interaction.guildId, chan.id, scope]);

            // success!
            await interaction.followUp(`I won't log messages deleted from channel **${chan.name ?? 'Unknown'}**`);
        }

        else if (interaction.options.getSubcommand() === 'unignore') {
            // get the user input
            const chan = interaction.options.getChannel('channel', true);

            // store it in the db
            await pool.query('DELETE FROM chatot.logprefs WHERE ignoreid=$1', [chan.id]);

            // success!
            await interaction.followUp(`I'll log messages deleted from channel **${chan.name ?? 'Unknown'}** again`);
        }

        else if (interaction.options.getSubcommand() === 'deletes') {
            // get user input
            const scope = interaction.options.getString('scope', true);

            // see if there are entries for this server already so we can update them
            const q = await pool.query('SELECT deletescope FROM chatot.logprefs WHERE serverid=$1', [interaction.guildId]);
            const storedScope: { deletescope: string }[] | [] = q.rows;

            // if there's no row for this server, make one
            if (!storedScope.length) {
                await pool.query('INSERT INTO chatot.logprefs (serverid, ignoreid, deletescope) VALUES ($1, $2, $3)', [interaction.guildId, '0', scope]);
                // success!
                await interaction.followUp(`Now logging messages deleted by ${scope === 'mod' ? 'mods' : 'everyone'}`);
            }
            // otherwise, update all references to use the new scope if it changed
            else if (storedScope[0].deletescope !== scope) {
                await pool.query('UPDATE chatot.logprefs SET deletescope=$1 WHERE serverid=$2', [scope, interaction.guildId]);
                // success!
                await interaction.followUp(`Now logging messages deleted by ${scope === 'mod' ? 'mods' : 'everyone'}`);
            }
        }
    },
};