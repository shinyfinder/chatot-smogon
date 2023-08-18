import { SlashCommandBuilder, ChatInputCommandInteraction, PermissionFlagsBits, GuildMember, Collection } from 'discord.js';
import { SlashCommand } from '../types/slash-command-base';

/**
 * Command to lookup information about a user
 * @param user Userid or forum profile URL to lookup
 *
 */
export const command: SlashCommand = {
    global: true,
    guilds: [],
    // setup the slash command builder
    data: new SlashCommandBuilder()
        .setName('find')
        .setDescription('Retrieves a user\'s profile given their Discord display-, nick-, or username')
        .addStringOption(option =>
            option.setName('name')
            .setDescription('Discord display name, nickname, or username')
            .setRequired(true))
        .setDMPermission(false)
        .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),

    // execute our desired task
    async execute(interaction: ChatInputCommandInteraction) {
        // make sure this command is used in a guild
        if (!interaction.guild) {
            await interaction.reply({ content: 'This command can only be used in a server!', ephemeral: true });
            return;
        }
        await interaction.deferReply({ ephemeral: true });

        // get the user input
        const username = interaction.options.getString('name', true).toLowerCase();

        // holder for each member found that matches the entered name
        let foundMembers: Collection<string, GuildMember> = new Collection;

        // check the current guild first to get the most relevant info
        const currentMembers = await interaction.guild.members.fetch();
        const currentFound = currentMembers.filter(member => member.nickname?.toLowerCase() === username || member.user.username === username || member.user.displayName.toLowerCase() === username);
        // if you got a match, concat it into the holder
        if (currentFound) {
            foundMembers = foundMembers.merge(currentFound, oldFound => ({ keep: true, value: oldFound }), newFound => ({ keep: true, value: newFound }), () => ({ keep: false }));
        }

        // loop over the guilds the bot is in, looking for someone with that username
        for (const guild of interaction.client.guilds.cache.values()) {
            // skip rechecking the current server
            if (guild.id === interaction.guildId) {
                continue;
            }
            // fetch the guild member list
            const memberList = await guild.members.fetch();

            // filter out the users we care about
            const matchingMembers = memberList.filter(member => member.nickname?.toLowerCase() === username || member.user.username === username || member.user.displayName.toLowerCase() === username);
            
            // if you found a match, add it to the holder
            // keep the first found result so we don't duplicate users
            if (matchingMembers) {
                foundMembers = foundMembers.merge(matchingMembers, oldFound => ({ keep: true, value: oldFound }), newFound => ({ keep: true, value: newFound }), (oldFound) => ({ keep: true, value: oldFound }));
            }
            else {
                continue;
            }

        }

        // get the unique members
        let strOut = '';
        for (const mem of foundMembers.values()) {
            strOut += `${mem.displayName} (${mem.user.username}): ${mem.toString()}\n`;
        }

        // alert with results
        if (strOut.length) {
            await interaction.followUp(strOut);
        }
        else {
            await interaction.followUp('User not found in any shared servers');
        }
        

    },
};