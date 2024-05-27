import { SlashCommandBuilder, ChatInputCommandInteraction, SlashCommandSubcommandBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, ModalActionRowComponentBuilder, ModalSubmitInteraction, PermissionFlagsBits, DiscordAPIError, SlashCommandSubcommandGroupBuilder } from 'discord.js';
import { SlashCommand } from '../types/slash-command-base';
import { getRandInt } from '../helpers/getRandInt.js';
/**
 * Command to manage (add/remove) user(s) roles
 */

export const command: SlashCommand = {
    global: true,
    guilds: [],
    // setup the slash command builder
    data: new SlashCommandBuilder()
        .setName('role')
        .setDescription('Manages the userlist of a role')
        .setDMPermission(false)
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
        .addSubcommandGroup(new SlashCommandSubcommandGroupBuilder()
            .setName('mass')
            .setDescription('Subcommands for bulk adding or removing roles from users')
            .addSubcommand(new SlashCommandSubcommandBuilder()
                .setName('add')
                .setDescription('Adds a role to a large group (6+) of users')
                .addRoleOption(option =>
                    option.setName('role')
                    .setDescription('Role to be modified')
                    .setRequired(true)),
            )
            .addSubcommand(
                new SlashCommandSubcommandBuilder()
                    .setName('remove')
                    .setDescription('Removes a role from a large group (6+) of users')
                    .addRoleOption(option =>
                        option.setName('role')
                        .setDescription('Role to be modified')
                        .setRequired(true)),
            ),
        )
        .addSubcommand(
            new SlashCommandSubcommandBuilder()
                .setName('add')
                .setDescription('Adds a role to a group (<=6) of users')
                .addRoleOption(option =>
                    option.setName('role')
                    .setDescription('Role to be modified')
                    .setRequired(true))
                .addUserOption(option =>
                    option.setName('user1')
                    .setDescription('User to which the role is added')
                    .setRequired(false))
                .addUserOption(option =>
                    option.setName('user2')
                    .setDescription('User to which the role is added')
                    .setRequired(false))
                .addUserOption(option =>
                    option.setName('user3')
                    .setDescription('User to which the role is added')
                    .setRequired(false))
                .addUserOption(option =>
                    option.setName('user4')
                    .setDescription('User to which the role is added')
                    .setRequired(false))
                .addUserOption(option =>
                    option.setName('user5')
                    .setDescription('User to which the role is added')
                    .setRequired(false))
                .addUserOption(option =>
                    option.setName('user6')
                    .setDescription('User to which the role is added')
                    .setRequired(false)),
        )
        .addSubcommand(
            new SlashCommandSubcommandBuilder()
                .setName('remove')
                .setDescription('Removes a role from a group (<=6) of users')
                .addRoleOption(option =>
                    option.setName('role')
                    .setDescription('Role to be modified')
                    .setRequired(true))
                .addUserOption(option =>
                    option.setName('user1')
                    .setDescription('User to which the role is removed')
                    .setRequired(false))
                .addUserOption(option =>
                    option.setName('user2')
                    .setDescription('User to which the role is removed')
                    .setRequired(false))
                .addUserOption(option =>
                    option.setName('user3')
                    .setDescription('User to which the role is removed')
                    .setRequired(false))
                .addUserOption(option =>
                    option.setName('user4')
                    .setDescription('User to which the role is removed')
                    .setRequired(false))
                .addUserOption(option =>
                    option.setName('user5')
                    .setDescription('User to which the role is removed')
                    .setRequired(false))
                .addUserOption(option =>
                    option.setName('user6')
                    .setDescription('User to which the role is removed')
                    .setRequired(false)),
        ),
    // execute our desired task
    async execute(interaction: ChatInputCommandInteraction) {
        if (!interaction.guild) {
            return;
        }

        // get the specified role
        const role = interaction.options.getRole('role', true);
        
        /**
         * MASS ADD
         */
        if (interaction.options.getSubcommand() === 'add' && interaction.options.getSubcommandGroup() === 'mass') {
            // get a random int to uniquely identify the modal
            const randInt = getRandInt(0, 65535);

            // instantiate a modal for user input
            const modal = new ModalBuilder()
                .setCustomId(`myrolemodal${randInt}`)
                .setTitle(`Add Users to ${role.name}`);

            // create the input for the userlist
             const idInput = new TextInputBuilder()
             .setCustomId('idInput')
             .setLabel('User IDs')
             .setPlaceholder('Enter 1 ID per line')
             .setRequired(true)
             .setStyle(TextInputStyle.Paragraph);

            // add an action row to hold the text inputs
            // an action row can only hold 1 text input, so you need 1 per input
            const idActionRow = new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents(idInput);

            // add the inputs to the modal
            modal.addComponents(idActionRow);

            // show the modal to the user
            await interaction.showModal(modal);
            
            // await their input
            const filter = (modalInteraction: ModalSubmitInteraction) => modalInteraction.customId === `myrolemodal${randInt}` && modalInteraction.user.id === interaction.user.id;
            
            // wait for them to submit the modal
            const submittedModal = await interaction.awaitModalSubmit({ filter, time: 5 * 60 * 1000 });

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

            // loop over the list of IDs and add the specified role to each person
            for (const id of uids) {
                try {
                    // fetch the user
                    const member = await interaction.guild.members.fetch(id);
                    // add the role
                    await member.roles.add(role.id);
                }
                // check to make sure the ID was valid
                catch (err) {
                    if (err instanceof DiscordAPIError && err.message === 'Unknown User') {
                        continue;
                    }
                    else {
                        await submittedModal.followUp(`An error occurred while trying to add the role to id ${id}`);
                        throw err;
                    }
                    
                    
                }
                
            }

            await submittedModal.followUp('Role added to every user provided');
        
            
        }

        /**
         * MASS REMOVE ROLE
         */
        else if (interaction.options.getSubcommand() === 'remove' && interaction.options.getSubcommandGroup() === 'mass') {
            // get random int to uniquely id the modal
            const randInt = getRandInt(0, 65535);

            // instantiate a modal for user input
            const modal = new ModalBuilder()
                .setCustomId(`myrolemodal${randInt}`)
                .setTitle(`Add Users to ${role.name}`);

            // create the input for the userlist
             const idInput = new TextInputBuilder()
             .setCustomId('idInput')
             .setLabel('User IDs')
             .setPlaceholder('Enter 1 ID per line')
             .setRequired(true)
             .setStyle(TextInputStyle.Paragraph);

            // add an action row to hold the text inputs
            // an action row can only hold 1 text input, so you need 1 per input
            const idActionRow = new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents(idInput);

            // add the inputs to the modal
            modal.addComponents(idActionRow);

            // show the modal to the user
            await interaction.showModal(modal);
            
            // await their input
            const filter = (modalInteraction: ModalSubmitInteraction) => modalInteraction.customId === `myrolemodal${randInt}` && modalInteraction.user.id === interaction.user.id;
            
            // wait for them to submit the modal
            const submittedModal = await interaction.awaitModalSubmit({ filter, time: 5 * 60 * 1000 });

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

            // loop over the list of IDs and remove the specified role to each person
            for (const id of uids) {
                try {
                    // fetch the user
                    const member = await interaction.guild.members.fetch(id);
                    // remove the role
                    await member.roles.remove(role.id);
                }
                // check to make sure the ID was valid
                catch (err) {
                    if (err instanceof DiscordAPIError && err.message === 'Unknown User') {
                        continue;
                    }
                    else {
                        await submittedModal.followUp(`An error occurred while trying to remove the role from id ${id}`);
                        throw err;
                    }
                    
                    
                }
                
            }
            await submittedModal.followUp('Role removed from every user provided');
        }

        /**
         * ADD SMALL GROUP
         */
        else if (interaction.options.getSubcommand() === 'add') {
            // get the inputs
            const user1 = interaction.options.getUser('user1');
            const user2 = interaction.options.getUser('user2');
            const user3 = interaction.options.getUser('user3');
            const user4 = interaction.options.getUser('user4');
            const user5 = interaction.options.getUser('user5');
            const user6 = interaction.options.getUser('user6');

            const inputArr = [user1, user2, user3, user4, user5, user6];

            // make sure they provided at least 1 user
            if (inputArr.every(u => u === null)) {
                await interaction.reply({ content: 'You must provide at least 1 user', ephemeral: true });
                return;
            }

            // loop over the list of applied users and apply the role to each
            await interaction.deferReply();
            for (const user of inputArr) {
                if (user === null) {
                    continue;
                }
                else {
                    // fetch the member
                    const member = await interaction.guild.members.fetch(user);
                    // add the role
                    await member.roles.add(role.id);
                }
            }
            // let them know you're done
            await interaction.followUp(`Role ${role.name} added to every specified user`);
            
        }
        else if (interaction.options.getSubcommand() === 'remove') {
            // get the inputs
            const user1 = interaction.options.getUser('user1');
            const user2 = interaction.options.getUser('user2');
            const user3 = interaction.options.getUser('user3');
            const user4 = interaction.options.getUser('user4');
            const user5 = interaction.options.getUser('user5');
            const user6 = interaction.options.getUser('user6');

            const inputArr = [user1, user2, user3, user4, user5, user6];

            // make sure they provided at least 1 user
            if (inputArr.every(u => u === null)) {
                await interaction.reply({ content: 'You must provide at least 1 user', ephemeral: true });
                return;
            }

            // loop over the list of applied users and apply the role to each
            await interaction.deferReply();
            for (const user of inputArr) {
                if (user === null) {
                    continue;
                }
                else {
                    // fetch the member
                    const member = await interaction.guild.members.fetch(user);
                    // add the role
                    await member.roles.remove(role.id);
                }
            }
            // let them know you're done
            await interaction.followUp(`Role ${role.name} removed from every specified user`);
        }
        
    },

};