import { ContextMenuCommandBuilder, ApplicationCommandType, MessageContextMenuCommandInteraction, ChannelType, User, Collection, PermissionFlagsBits } from 'discord.js';
import { ContextCommand } from '../types/context-command-base';
import { botConfig } from '../config.js';

/**
 * Context menu command to keep a message pinned to the top of the pins list in a channel
 */
export const command: ContextCommand = {
    global: true,
    guilds: [],
    // setup the slash command builder
    data: new ContextMenuCommandBuilder()
        .setName('reactors')
        .setType(ApplicationCommandType.Message)
        .setDMPermission(false)
        .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers) as ContextMenuCommandBuilder,

    // execute our desired task
    async execute(interaction: MessageContextMenuCommandInteraction) {
        await interaction.deferReply({ ephemeral: true });

        if (!interaction.channel || interaction.channel.type === ChannelType.DM) {
            await interaction.followUp('Command must be used in a guild channel');
            return;
        }

        // get the targeted message
        const msg = interaction.targetMessage;

        // get the list of people who reacted to the targeted message
        const reactorManagers = msg.reactions.cache.map(r => r.users);

        // holder for each unique user who reacted
        let allReactUsers: Collection<string, User> = new Collection;

        // each emoji will have a manager associated with it, so loop over each and fetch the users
        for (const manager of reactorManagers) {
            const users = await manager.fetch();
            allReactUsers = allReactUsers.concat(users);
        }
        
        // filter out the bot
        const filteredUsers = allReactUsers.filter(user => user.id !== botConfig.CLIENT_ID);

        // map the users to a list of names
        // we need to make sure the content isn't too long
        let usernames = filteredUsers.map(u => u.username).join('\n');

        if (usernames.length === 0) {
            await interaction.followUp('Either no reactions or only me');
        }
        else if (usernames.length > 1900) {
            usernames = usernames.slice(0, 1900);
            await interaction.followUp(`Message too long; output is truncated:\n\`\`\`\n${usernames}\n\`\`\``);
        }
        else {
            await interaction.followUp(`These users reacted to this post:\n\`\`\`\n${usernames}\n\`\`\``);
        }
        
        
    },
};