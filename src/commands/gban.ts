import { SlashCommandBuilder, ChatInputCommandInteraction, SlashCommandSubcommandBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, ModalActionRowComponentBuilder, ModalSubmitInteraction, Message, DiscordAPIError, ChannelType } from 'discord.js';
import { getRandInt } from '../helpers/getRandInt.js';
import { SlashCommand } from '../types/slash-command-base';
import config from '../config.js';
import { buildEmbed, postLogEvent, loggedEventTypes } from '../helpers/logging.js';
import { errorHandler } from '../helpers/errorHandler.js';
import { pool } from '../helpers/createPool.js';
import { updatePublicRatersList } from '../helpers/updatePublicRatersList.js';
import { checkChanPerms } from '../helpers/checkChanPerms.js';
/**
 * Command to ban a user from every server the bot is in
 * Supports banning a single user or a group of users depending on the selected subcommand
 * @param user: Username (id) of the person to ban
 * @param reason Optional reason for the audit log/modlog message. Defaults to Banned from forums
 *
 */
export const command: SlashCommand = {
    global: false,
    guilds: ['192713314399289344'],
    // setup the slash command builder
    data: new SlashCommandBuilder()
        .setName('gban')
        .setDescription('Bans a user from every server the bot is in')
        .setDefaultMemberPermissions(0)
        .addSubcommand(new SlashCommandSubcommandBuilder()
                .setName('user')
                .setDescription('Bans a user from every server the bot is in')
                .addUserOption(option =>
                    option.setName('user')
                    .setDescription('The user to be banned (can accept IDs)')
                    .setRequired(true))
                .addStringOption(option =>
                    option.setName('reason')
                    .setDescription('Optional reason for the ban (for the audit log and log channel)')
                    .setRequired(false)),
        )
        .addSubcommand(new SlashCommandSubcommandBuilder()
                .setName('group')
                .setDescription('Bans a group of users from every server the bot is in'),
        ),

    // execute our desired task
    async execute(interaction: ChatInputCommandInteraction) {
        // make sure this command is used in a the main smogon server
        const allowedGuildID = config.MODE === 'dev' ? '1040378543626002442' : '192713314399289344';

        if (!interaction.guild || !(interaction.guild.id === allowedGuildID)) {
            await interaction.reply({ content: 'You must use this command in the Smogon main server!', ephemeral: true });
            return;
        }


        /**
         * SINGLE USER
         */
        if (interaction.options.getSubcommand() === 'user') {
            // defer our reply to give us time to process
            await interaction.deferReply();

            // check for the necessary permissions based on where it's used
            // also make sure it's used in a channel (which it has to be, but we have to type check it anyway)
            let canComplete = true;
            if (interaction.channel?.type === ChannelType.GuildText) {
                canComplete = await checkChanPerms(interaction, ['ViewChannel', 'SendMessages']);

            }
            else if (interaction.channel?.type === ChannelType.PublicThread || interaction.channel?.type === ChannelType.PrivateThread) {
                canComplete = await checkChanPerms(interaction, ['ViewChannel', 'SendMessagesInThreads']);
            }
            else {
                await interaction.followUp('This command must be used in a channel.');
                return;
            }

            if (!canComplete) {
                return;
            }

            // get the inputs
            const user = interaction.options.getUser('user', true);
            let auditEntry = interaction.options.getString('reason');

            // if no reason is provided, state so for the audit log
            if (auditEntry === null) {
                auditEntry = 'Banned from forums';
            }

            
            // prompt the user to confirm
            await interaction.followUp(`You are about to ban ${user.tag} from every server I am in. Are you sure? (y/n)`);
            const filter = (m: Message) => interaction.user.id === m.author.id;
            const confirmMsg = await interaction.channel?.awaitMessages({ filter, time: 60 * 1000, max: 1, errors: ['time'] });
            if (confirmMsg === undefined) {
                return;
            }
            const confirmMsgContent = confirmMsg.first()?.content?.toLowerCase();
            const failedGuilds: string[] = [];

            if (confirmMsgContent === 'yes' || confirmMsgContent === 'y') {
                // confirm we got the message
                await interaction.channel?.send('Grabbing my banhammer...');

                // get the list of guild IDs the bot is in
                const guildIds = interaction.client.guilds.cache.map(guild => guild.id);

                // create a flag for failed ban attempts
                let failedBans = false;

                // loop over the list of ids and ban the user from them
                for (const id of guildIds) {
                    const guild = interaction.client.guilds.cache.get(id);
                    if (guild === undefined) {
                        continue;
                    }

                    // ban the user and don't delete any messages
                    // I think this defaults to 0 deleted, but I'd rather be safe
                    // try catch the bans in case one of the servers removed ban access from the bot
                    try {
                        await guild.members.ban(user, {
                            reason: auditEntry,
                            deleteMessageSeconds: 0,
                        });
                    }
                    catch (err) {
                        // catch the errors and alert staff so they know which ones the user wasn't banned from
                        // continue, instead of throwing, so that we can ban from as many servers as we can
                        
                        failedBans = true;

                        // store the guild name for error logging
                        failedGuilds.push(guild.name);

                        // try to send a message to their logging channel so they know we tried and they may have to tweak their settings
                        // first, fetch the member of this guild so we can tell them who it is

                        // set the inputs needed to build the embed
                        const title = 'Failed Ban Attempt';
                        const description = `I attempted to ban ${user.toString()} (${user.tag}), but was unsuccessful. Please ensure I have the Ban Users permission and that my role is above that of other users in the Roles menu. <https://support.discord.com/hc/en-us/articles/214836687-Role-Management-101>`;
                        const color = 0xf00000;

                        // build the discord embed
                        const embed = buildEmbed(title, { description: description, color: color });

                        // post the log to the logging channel
                        // wrap in its own try catch so that if this errors too the whole execution doesn't quit
                        try {
                            await postLogEvent(embed, guild, loggedEventTypes.Ban);
                        }
                        catch (e) {
                            // if it errors, run it thru the error handler to make sure it's not something we need to address
                            errorHandler(e);
                        }
                        continue;
                        
                    }

                }

                // let them know you're done and whether you had issues along the way
                if (failedBans) {
                    await interaction.channel?.send(`I attempted to ban the user from every server I am in, but I had issues in:\n\n${failedGuilds.join(', ')}`);
                }
                else {
                    await interaction.channel?.send('I have banned the user from every server I am in.');
                }

                // add this entry to the gban db
                await pool.query(`
                INSERT INTO chatot.gbans (target, date, reason)
                VALUES ($1, $2, $3)
                ON CONFLICT (target)
                DO UPDATE SET target=EXCLUDED.target, date=EXCLUDED.date, reason=EXCLUDED.reason`, [user.id, new Date(), auditEntry]);

                // remove them from the list of raters, returning an array of the deleted metas/gens
                const removedRates: { meta: string, gen: string }[] | [] = (await pool.query('DELETE FROM chatot.raters WHERE userid=$1 RETURNING meta, gen', [user.id])).rows;

                // if something was deleted, update the public rater list
                // only do this for the main cord
                if (removedRates.length) {
                    for (const rateObj of removedRates) {
                        await updatePublicRatersList(interaction.client, rateObj.meta, rateObj.gen);
                    }
                }
            } 
            else {
                await interaction.channel?.send('Global ban exited');
                return;
            }

            
        }

        /**
         * MULTI USER
         */
        else if (interaction.options.getSubcommand() === 'group') {
            // instantiate a modal for user input
            // get a random int to uniquely identifiy the modal
            const randInt = getRandInt(0, 65535);
            const modal = new ModalBuilder()
                .setCustomId(`gbanmodal${randInt}`)
                .setTitle('Global Ban Users');

            // create the text fields for the modal
            const idInput = new TextInputBuilder()
                .setCustomId('idInput')
                .setLabel('User IDs')
                .setPlaceholder('Enter 1 ID per line')
                .setRequired(true)
                .setStyle(TextInputStyle.Paragraph);

            const reasonInput = new TextInputBuilder()
                .setCustomId('reasonInput')
                .setLabel('Reason')
                .setPlaceholder('Text for audit log and modlog entry')
                .setRequired(false)
                .setStyle(TextInputStyle.Paragraph);

            // add an action row to hold the text inputs
            // an action row can only hold 1 text input, so you need 1 per input
            const idActionRow = new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents(idInput);
            const reasonActionRow = new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents(reasonInput);

            // add the inputs to the modal
            modal.addComponents(idActionRow, reasonActionRow);

            // show the modal to the user
            await interaction.showModal(modal);

            // await their input
            const modalFilter = (modalInteraction: ModalSubmitInteraction) => modalInteraction.customId === `gbanmodal${randInt}` && modalInteraction.user.id === interaction.user.id;
            
            // wait for them to submit the modal
            const submittedModal = await interaction.awaitModalSubmit({ filter: modalFilter, time: 5 * 60 * 1000 });

            // on submit, defer our reply so we can process it
            await submittedModal.deferReply();

            // check for the necessary permissions based on where it's used
            // also make sure it's used in a channel (which it has to be, but we have to type check it anyway)
            let canComplete = true;
            if (interaction.channel?.type === ChannelType.GuildText) {
                canComplete = await checkChanPerms(submittedModal, ['ViewChannel', 'SendMessages']);

            }
            else if (interaction.channel?.type === ChannelType.PublicThread || interaction.channel?.type === ChannelType.PrivateThread) {
                canComplete = await checkChanPerms(submittedModal, ['ViewChannel', 'SendMessagesInThreads']);
            }
            else {
                await submittedModal.followUp('This command must be used in a channel.');
                return;
            }

            if (!canComplete) {
                return;
            }

            // get the info they entered
            const uids = submittedModal.fields.getTextInputValue('idInput').split('\n');

            // make sure the IDs are actually IDs (numeric)
            const isID = uids.every(id => /^\d+$/.test(id));

            if (!isID) {
                await submittedModal.followUp('There was an error parsing your IDs. Make sure each ID is numeric and on its own line');
                return;
            }

            let auditEntry = submittedModal.fields.getTextInputValue('reasonInput');

            // if no reason is provided, use a default entry
            if (auditEntry === '') {
                auditEntry = 'Banned from forums';
            }


            // prompt them to confirm
            // prompt the user to confirm
            await submittedModal.followUp(`You are about to ban ${uids.length} users from every server I am in. Are you sure? (y/n)`);
            const confirmFilter = (m: Message) => interaction.user.id === m.author.id;
            const confirmMsg = await interaction.channel?.awaitMessages({ filter: confirmFilter, time: 60 * 1000, max: 1, errors: ['time'] });
            if (confirmMsg === undefined) {
                return;
            }
            const confirmMsgContent = confirmMsg.first()?.content?.toLowerCase();
            const failedGuilds: string[] = [];

            if (confirmMsgContent === 'yes' || confirmMsgContent === 'y') {
                // confirm we got the message
                await interaction.channel?.send('Grabbing my banhammer...');

                // get the list of guild IDs the bot is in
                const guildIds = interaction.client.guilds.cache.map(guild => guild.id);

                // create a flag to check for failed ban attempts
                let failedBans = false;

                // loop over the list of ids and ban the user(s) from them
                for (const id of guildIds) {
                    // loop over the list of provided ids
                    for (const uid of uids) {
                        // retrieve the guild from the cache
                        const guild = interaction.client.guilds.cache.get(id);
                        // make sure there were no errors in getting the guild
                        // and make sure the uid isn't blank (i.e. a blank line in the modal)
                        if (guild === undefined || uid === '') {
                            continue;
                        }

                        // ban the user and don't delete any messages
                        // I think this defaults to 0 deleted, but I'd rather be safe
                        try {
                            // get the member in the guild
                            await guild.members.ban(uid, {
                                reason: auditEntry,
                                deleteMessageSeconds: 0,
                            });
                        }
                        catch (err) {
                            failedBans = true;
                            if (err instanceof DiscordAPIError && err.message === 'Unknown User') {
                                await interaction.channel?.send(`Unable to fetch user with id ${uid}. Cancelling.`);
                                return;
                            }
                            else {
                                // catch the errors and alert staff so they know which ones the user wasn't banned from
                                // continue, instead of throwing, so that we can ban from as many servers as we can

                                // store the guild name for error logging
                                failedGuilds.push(guild.name);

                                // try to send a message to their logging channel so they know we tried and they may have to tweak their settings
                                // first, fetch the member of this guild so we can tell them who it is
                                const user = await interaction.client.users.fetch(uid);

                                // set the inputs needed to build the embed
                                const title = 'Failed Ban Attempt';
                                const description = `I attempted to ban ${user.toString()} (${user.tag}), but was unsuccessful. Please ensure I have the Ban Users permission and that my Role is above that of other users. <https://support.discord.com/hc/en-us/articles/214836687-Role-Management-101>`;
                                const color = 0xf00000;

                                // build the discord embed
                                const embed = buildEmbed(title, { description: description, color: color });

                                // post the log to the logging channel
                                // wrap in a try catch in case this errors too
                                try {
                                    await postLogEvent(embed, guild, loggedEventTypes.Ban);
                                }
                                catch (e) {
                                    errorHandler(e);
                                }

                                continue;
                            }
                            
                        }
                        
                    }
                    

                }
                
                // let the user know you're done, and indicate whether all bans were successful. 
                if (failedBans) {
                    // get the unique guild names
                    const uniqFailedGuilds = [...new Set(failedGuilds)];
                    await interaction.channel?.send(`I attempted to ban the provided id(s) from every server I am in, but I had some issues in:\n\n${uniqFailedGuilds.join(', ')}`);
                }
                else {
                    await interaction.channel?.send('I have banned the provided id(s) from every server I am in.');
                }

                // add these entries to the gban db
                const dates = [new Date()];
                const reasons = [auditEntry];

                await pool.query(`
                INSERT INTO chatot.gbans (target, date, reason)
                VALUES (UNNEST($1::text[]), UNNEST($2::timestamptz[]), UNNEST($3::text[]))
                ON CONFLICT (target)
                DO UPDATE SET target=EXCLUDED.target, date=EXCLUDED.date, reason=EXCLUDED.reason`, [uids, dates, reasons]);

                // remove them from the list of raters, returning an array of the deleted metas/gens
                const removedRates: { meta: string, gen: string }[] | [] = (await pool.query('DELETE FROM chatot.raters WHERE userid = ANY($1) RETURNING meta, gen', [uids])).rows;

                // if something was deleted, update the public rater list
                // only do this for the main cord
                if (removedRates.length) {
                    for (const rateObj of removedRates) {
                        await updatePublicRatersList(interaction.client, rateObj.meta, rateObj.gen);
                    }
                }
                
            }
            else {
                await interaction.channel?.send('Global ban exited');
            }

            
        }
        
    },
};