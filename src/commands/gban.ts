import { SlashCommandBuilder, ChatInputCommandInteraction, SlashCommandSubcommandBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, ModalActionRowComponentBuilder, ModalSubmitInteraction, Message, DiscordAPIError } from 'discord.js';
import { getRandInt } from '../helpers/getRandInt.js';
import { SlashCommand } from '../types/slash-command-base';

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
        if (!interaction.guild || !(interaction.guild.id === '192713314399289344')) {
            await interaction.reply({ content: 'You must use this command in the Smogon main server!', ephemeral: true });
            return;
        }


        /**
         * SINGLE USER
         */
        if (interaction.options.getSubcommand() === 'user') {
            // get the inputs
            const user = interaction.options.getUser('user', true);
            let auditEntry = interaction.options.getString('reason');

            // if no reason is provided, state so for the audit log
            if (auditEntry === null) {
                auditEntry = 'Banned from forums';
            }

            
            // prompt the user to confirm
            await interaction.reply(`You are about to ban ${user.username} from every server I am in. Are you sure? (y/n)`);
            const filter = (m: Message) => interaction.user.id === m.author.id;
            const confirmMsg = await interaction.channel?.awaitMessages({ filter, time: 60 * 1000, max: 1, errors: ['time'] });
            if (confirmMsg === undefined) {
                return;
            }
            const confirmMsgContent = confirmMsg.first()?.content?.toLowerCase();

            if (confirmMsgContent === 'yes' || confirmMsgContent === 'y') {
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
                        failedBans = true;
                        // catch the errors and alert staff so they know which ones the user wasn't banned from
                        // continue, instead of throwing, so that we can ban from as many servers as we can
                        await interaction.channel?.send(`I am unable to ban the user from guild ${guild.name}`);
                        continue;
                        
                    }

                }

                // let them know you're done and whether you had issues along the way
                if (failedBans) {
                    await interaction.channel?.send('I attempted to ban the user from every server I am in, but I had issues in some.');
                    return;
                }
                else {
                    await interaction.channel?.send('I have banned the user from every server I am in.');
                    return;
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

            if (confirmMsgContent === 'yes' || confirmMsgContent === 'y') {
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
                                await interaction.channel?.send(`I am unable to ban the user from guild ${guild.name}`);
                                continue;
                            }
                            
                        }
                        
                    }
                    

                }
                
                // let the user know you're done, and indicate whether all bans were successful. 
                if (failedBans) {
                    await interaction.channel?.send('I attempted to ban the provided id(s) from every server I am in, but there were some issues in some.');
                    return;
                }
                else {
                    await interaction.channel?.send('I have banned the provided id(s) from every server I am in.');
                    return;
                }
                
            }
            else {
                await interaction.channel?.send('Global ban exited');
            }

            
        }
        
    },
};