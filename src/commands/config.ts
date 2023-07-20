import { SlashCommandBuilder, ChatInputCommandInteraction, PermissionFlagsBits, SlashCommandSubcommandBuilder, SlashCommandSubcommandGroupBuilder, ChannelType, AutocompleteInteraction, ButtonBuilder, ButtonStyle, ButtonInteraction, ActionRowBuilder, ButtonComponent, ComponentType } from 'discord.js';
import { SlashCommand } from '../types/slash-command-base';
import { pool } from '../helpers/createPool.js';
import { ccMetaObj } from '../helpers/constants.js';
import { validateCCTier } from '../helpers/cnc.js';
import { getRandInt } from '../helpers/getRandInt.js';
import { IAlertChans, updateCCAlertChans } from '../helpers/manageCCCache.js';

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
                .setRequired(false)))
                
        /**
         * C&C
         */
        .addSubcommand(new SlashCommandSubcommandBuilder()
            .setName('cc')
            .setDescription('Configures where to log C&C thread status updates')
            .addChannelOption(option =>
                option.setName('channel')
                .setDescription('The channel to which C&C thread status updates are posted')
                .setRequired(true)
                .addChannelTypes(ChannelType.GuildText, ChannelType.PublicThread, ChannelType.PrivateThread))
            .addStringOption(option =>
                option.setName('tier')
                .setDescription('The tier to monitor C&C thread status updates for')
                .setAutocomplete(true)
                .setRequired(true))
            .addRoleOption(option =>
                option.setName('role')
                .setDescription('The role to ping')
                .setRequired(false))),

    // prompt the user with autocomplete options since there are too many tiers to have a selectable list
    async autocomplete(interaction: AutocompleteInteraction) {
        const focusedOption = interaction.options.getFocused(true);

        if (focusedOption.name === 'tier') {
            const enteredText = focusedOption.value.toLowerCase();

            const filteredOut: {name: string, value: string }[] = [];
            // filter the options shown to the user based on what they've typed in
            // everything is cast to lower case to handle differences in case
            for (const pair of ccMetaObj) {
                if (filteredOut.length < 25) {
                    if (pair.value.includes(enteredText)) {
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


        /**
         * C&C INTEGRATION
         */
        
        else if (interaction.options.getSubcommand() === 'cc') {
            // get inputs
            const channel = interaction.options.getChannel('channel', true, [ChannelType.GuildText, ChannelType.PublicThread, ChannelType.PrivateThread]);
            const tier = interaction.options.getString('tier', true);
            const role = interaction.options.getRole('role');

            // validate the autocomplete entry
            const valid = validateCCTier(tier);
            
            // if it's not valid, return and let them know
            if (!valid) {
                await interaction.followUp('I did not understand that meta or I am not setup to track it. Please choose one from the list');
                return;
            }

            // otherwise, followup with a prompt for them to choose the gen
            // since you can have multigens, the best way of multiple options is buttons
            // generate random int to uniquely id buttons for this interaction scope
            const randInt = getRandInt(0, 65535);

            // build the different logging buttons
            const submit = new ButtonBuilder()
                .setCustomId(`submit${randInt}`)
                .setLabel('Submit')
                .setStyle(ButtonStyle.Success);

            const cancel = new ButtonBuilder()
                .setCustomId(`cancel${randInt}`)
                .setLabel('Cancel')
                .setStyle(ButtonStyle.Danger);

            const gen1 = new ButtonBuilder()
                .setCustomId(`gen1-${randInt}`)
                .setLabel('Gen 1')
                .setStyle(ButtonStyle.Secondary);

            const gen2 = new ButtonBuilder()
                .setCustomId(`gen2-${randInt}`)
                .setLabel('Gen 2')
                .setStyle(ButtonStyle.Secondary);

            const gen3 = new ButtonBuilder()
                .setCustomId(`gen3-${randInt}`)
                .setLabel('Gen 3')
                .setStyle(ButtonStyle.Secondary);

            const gen4 = new ButtonBuilder()
                .setCustomId(`gen4-${randInt}`)
                .setLabel('Gen 4')
                .setStyle(ButtonStyle.Secondary);

            const gen5 = new ButtonBuilder()
                .setCustomId(`gen5-${randInt}`)
                .setLabel('Gen 5')
                .setStyle(ButtonStyle.Secondary);

            const gen6 = new ButtonBuilder()
                .setCustomId(`gen6-${randInt}`)
                .setLabel('Gen 6')
                .setStyle(ButtonStyle.Secondary);

            const gen7 = new ButtonBuilder()
                .setCustomId(`gen7-${randInt}`)
                .setLabel('Gen 7')
                .setStyle(ButtonStyle.Secondary);

            const gen8 = new ButtonBuilder()
                .setCustomId(`gen8-${randInt}`)
                .setLabel('Gen 8')
                .setStyle(ButtonStyle.Secondary);

            const gen9 = new ButtonBuilder()
                .setCustomId(`gen9-${randInt}`)
                .setLabel('Gen 9')
                .setStyle(ButtonStyle.Secondary);

            // build the action rows
            const row1 = new ActionRowBuilder<ButtonBuilder>()
                .addComponents(gen1, gen2, gen3, gen4, gen5);

            const row2 = new ActionRowBuilder<ButtonBuilder>()
                .addComponents(gen6, gen7, gen8, gen9);
            
            const row3 = new ActionRowBuilder<ButtonBuilder>()
                .addComponents(submit, cancel);

            // post the message with the buttons to get their input
            const btnReponse = await interaction.followUp({
                content: 'Select the gens that should be logged to this channel',
                components: [row1, row2, row3],
            });

            // setup a filter so that we only receive interactions from the user who initiated this sequence
            const collectionFilter = (btnInt: ButtonInteraction) => btnInt.user.id === interaction.user.id;
            
            // wait for them to interact with the buttons
            const collector = btnReponse.createMessageComponentCollector({ componentType: ComponentType.Button, filter: collectionFilter, time: 5 * 60 * 1000 });

            collector.on('collect', async (i) => {
                await i.deferUpdate();

                if (i.customId === `submit${randInt}`) {
                    // get the action rows from the current message
                    const oldActionRowComps = i.message.components.flatMap(row => row.components);

                    // update the old message to tell them we're working on it
                    // we do this second so we don't lose the buttons
                    await i.editReply({ content: 'Processing...', components: [] });

                    // filter out only the buttons that were clicked (style = primary)
                    const primBtn = oldActionRowComps.filter(comp => comp instanceof ButtonComponent && comp.style === ButtonStyle.Primary) as ButtonComponent[];

                    let hadError = false;         
                    const alertChanData: IAlertChans[] = [];

                    // loop over the list of buttons to get the gen numbers that were clicked
                    // begin the transaction with the db
                    const pgClient = await pool.connect();
                    try {
                        // start
                        await pgClient.query('BEGIN');
                        // delete
                        await pgClient.query('DELETE FROM chatot.ccprefs WHERE channelid=$1', [channel.id]);
                        // insert
                        for (const btn of primBtn) {
                            // get the gen number from the customid of the button
                            const genNum = btn.customId?.match(/(?<=gen)\d/);

                            // this should never happen
                            if (!genNum) {
                                continue;
                            }

                            // push to db
                            await pgClient.query('INSERT INTO chatot.ccprefs (serverid, channelid, tier, role, gen) VALUES ($1, $2, $3, $4, $5)', [interaction.guildId, channel.id, tier, role?.id, genNum[0]]);

                            // push to an array of data so we can update the cache in memory
                            alertChanData.push({
                                // this should never be null since we already type checked it before
                                serverid: interaction.guildId ?? '',
                                channelid: channel.id,
                                tier: tier,
                                role: role?.id,
                                gen: genNum[0],
                            });

                        }
                        // end
                        await pgClient.query('COMMIT');
                    }
                    catch (e) {
                        await pgClient.query('ROLLBACK');
                        hadError = true;
                        // if this errors we have bigger problems, so log it
                        console.error(e);
                        await i.editReply('An error occurred and your preferences were not saved');
                    }
                    finally {
                        // BE FREE, CLIENT!
                        pgClient.release();

                        // update the cache in memory of the discord alert chans
                        updateCCAlertChans(alertChanData);
                    }
                    // if we completed everything, let them know
                    if (!hadError) {
                        await i.editReply('Preferences updated');
                    }
                }
                else if (i.customId === `cancel${randInt}`) {
                    await i.editReply({ content: 'Process cancelled', components: [] });
                    return;
                }
                else {
                    // rebuild the buttons so that the one clicked toggles between secondary and primary styles
                    const newActionRows: ActionRowBuilder<ButtonBuilder>[] = [];

                    // extract the old action rows from the message
                    const oldActionRows = i.message.components.map(row => row);

                    for (const oldActionRow of oldActionRows) {
                        const newRow = new ActionRowBuilder<ButtonBuilder>();
                        
                        // loop over the buttons in the old row so we can assign them to the new
                        for (const oldBtn of oldActionRow.components) {
                            if (oldBtn instanceof ButtonComponent) {
                                const newBtn = ButtonBuilder.from(oldBtn);
                                /**
                                 * toggle the style on the new button if it's the same one that was clicked
                                 */ 
                                let buttonStyle = 0;
                                // if it was the button that was clicked, toggle the style
                                // unless they click the cancel or subtmit buttons
                                if (oldBtn.customId === i.customId) { 
                                    buttonStyle = oldBtn.style === ButtonStyle.Primary ? ButtonStyle.Secondary : ButtonStyle.Primary;
                                }
                                // otherwise, keep the old style
                                else {
                                    buttonStyle = oldBtn.style;
                                }
                                // assign the style to the button
                                newBtn.setStyle(buttonStyle);
                                // add the button to the row
                                newRow.addComponents(newBtn);
                            }
                        }
                        // add the row to the array of rows
                        newActionRows.push(newRow);
                    }

                    // update the message
                    await i.editReply({ components: newActionRows });
                }
                
            });
            
        }
    },
};