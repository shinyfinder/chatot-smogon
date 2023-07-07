import { SlashCommandBuilder, ChatInputCommandInteraction, PermissionFlagsBits, SlashCommandSubcommandBuilder, SlashCommandSubcommandGroupBuilder, ChannelType } from 'discord.js';
import { SlashCommand } from '../types/slash-command-base';
import { pool } from '../helpers/createPool.js';

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
                .setName('scope')
                .setDescription('Configures whether certain locations or actions are ignored')
                .addChannelOption(option => 
                    option.setName('ignore')
                        .setDescription('Turns off deleted and edit message tracking from the specified channel')
                        .setRequired(false))
                .addChannelOption(option =>
                    option.setName('unignore')
                        .setDescription('Restores message tracking in the specified channel')
                        .setRequired(false))
                .addStringOption(option =>
                    option.setName('deletions')
                        .setDescription('Messages will be logged if deleted by...')
                        .setChoices(
                            { name: 'Mods', value: 'mod' },
                            { name: 'Everyone', value: 'all' },
                        )
                        .setRequired(false))
                .addBooleanOption(option =>
                    option.setName('edits')
                        .setDescription('Configure whether to track message edits')
                        .setRequired(false)))
            .addSubcommand(new SlashCommandSubcommandBuilder()
                .setName('chantype')
                .setDescription('Configures the log channel type. See wiki for details')
                .addChannelOption(option =>
                    option.setName('channel')
                    .setDescription('The log channel to modify')
                    .setRequired(true)
                    .addChannelTypes(ChannelType.GuildText, ChannelType.PublicThread, ChannelType.PrivateThread))
                .addStringOption(option =>
                    option.setName('type')
                    .setDescription('What gets logged into the channel')
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
                    .setRequired(true))),
            )
        
        /**
         * DEX
         */
        .addSubcommand(new SlashCommandSubcommandBuilder()
            .setName('dex')
            .setDescription('Sets the default format for the /dex command. Defaults are automatically appended.')
            .addStringOption(option =>
                option.setName('format')
                .setDescription('Which format to automatically link to when using /dex. i.e. ou, uu, lc, doubles')
                .setRequired(false))
            .addStringOption(option =>
                option.setName('gen')
                .setDescription('Which gen to automatically link to when using /dex. i.e. rb, ss, sv')
                .setRequired(false))),

    // execute our desired task
    async execute(interaction: ChatInputCommandInteraction) {
        await interaction.deferReply({ ephemeral: true });

        if (!interaction.guildId) {
            return;
        }

        /**
         * VERIFY
         */

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


        /**
         * LOGGING SCOPE
         */
        else if (interaction.options.getSubcommand() === 'scope') {
            // get the user input
            const ignoreChan = interaction.options.getChannel('ignore');
            const unignoreChan = interaction.options.getChannel('unignore');
            let del = interaction.options.getString('deletions');
            let edits = interaction.options.getBoolean('edits');

            // make sure they didn't enter the same chan for ignore and unignore
            if (ignoreChan && unignoreChan) {
                if (ignoreChan.id === unignoreChan.id) {
                    await interaction.followUp('Ignore and unignore channels cannot be the same');
                    return;
                }
            }

            // make sure they entered something
            if (!ignoreChan && !unignoreChan && !del && edits === null) {
                await interaction.followUp('No inputs provided. Nothing to update.');
                return;
            }

            // query the db so we can update the info if necessary
            const q = await pool.query('SELECT ignoreid, deletescope, logedits FROM chatot.logprefs WHERE serverid=$1', [interaction.guildId]);
            const storedVal: { ignoreid: string, deletescope: string, logedits: boolean }[] | [] = q.rows;

            /*
            // make sure they didn't duplicate the ignore chan
            if (storedVal.some(row => row.ignoreid === ignoreChan?.id && row.ignoreid !== '0')) {
                await interaction.followUp('This channel is already being ignored! Nothing was updated.');
                return;
            }
            */

            // default delete preferences to mod scope if not provided and not previously stored
            if (!del && storedVal.length) {
                del = storedVal[0].deletescope;
            }
            else if (!del) {
                del = 'mod';
            }

            // similarly, default log edits to false if not provided and not previously stored
            if (edits === null && storedVal.length) {
                edits = storedVal[0].logedits;
            }
            else if (edits === null) {
                edits = false;
            }

            // query the pool with a transaction
            const pgClient = await pool.connect();
            let hadError = false;
            try {
                // start
                await pgClient.query('BEGIN');
                // delete
                await pgClient.query('DELETE FROM chatot.logprefs WHERE ignoreid=$1', [unignoreChan?.id]);
                // insert
                await pgClient.query('INSERT INTO chatot.logprefs (serverid, ignoreid, deletescope, logedits) VALUES ($1, $2, $3, $4) ON CONFLICT (serverid, ignoreid) DO NOTHING', [interaction.guildId, ignoreChan?.id ?? '0', del, edits]);
                // update
                await pgClient.query('UPDATE chatot.logprefs SET deletescope=$1, logedits=$2 WHERE serverid=$3', [del, edits, interaction.guildId]);
                // end
                await pgClient.query('COMMIT');
            }
            catch (e) {
                await pgClient.query('ROLLBACK');
                hadError = true;
                // if this errors we have bigger problems, so log it
                console.error(e);
                await interaction.followUp('An error occurred and your preferences were not saved');
            }
            finally {
                pgClient.release();
            }
            if (!hadError) {
                await interaction.followUp('Preferences updated');
            }
        }

        /**
         * LOGGING CHAN TYPE
         */
        else if (interaction.options.getSubcommand() === 'chantype') {
            // get the user input
            const chan = interaction.options.getChannel('channel', true, [ChannelType.GuildText, ChannelType.PublicThread, ChannelType.PrivateThread]);
            const type = interaction.options.getString('type', true);

            // make sure they are actually logging in this channel.
            // if they aren't, return and tell them to enable it first
            const logchanPG = await pool.query('SELECT channelid FROM chatot.logchan WHERE serverid = $1', [interaction.guildId]);
            const logchans: { channelid: string }[] | [] = logchanPG.rows;

            if (!logchans.some(row => row.channelid === chan.id)) {
                await interaction.followUp('Logging is not currently set to the provided channel. Please enable logging with the `/logging enable` command first before setting preferences.');
                return;
            }

            // otherwise, update
            await pool.query('UPDATE chatot.logchan SET logtype = $1 WHERE channelid = $2', [type, chan.id]);

            // and tell them we updated their prefs
            await interaction.followUp('Log channel type updated');

        }

        /**
         * DEX DEFAULTS
         */

        else if (interaction.options.getSubcommand() === 'dex') {
            // get the inputs
            const format = interaction.options.getString('format') ?? '';
            const gen = interaction.options.getString('gen') ?? '';

            // upsert it into the table
            await pool.query('INSERT INTO chatot.dexdefaults (serverid, format, gen) VALUES ($1, $2, $3) ON CONFLICT (serverid) DO UPDATE SET format=EXCLUDED.format, gen=EXCLUDED.gen', [interaction.guildId, format.toLowerCase(), gen.toLowerCase()]);
            // let them know we updated it
            await interaction.followUp('Defaults set');
        }
    },
};