import { CommandInteraction, ModalSubmitInteraction, PermissionResolvable } from 'discord.js';

/**
 * Checks channel permissions for the ability to complete the command. 
 * If the bot lacks the permissions, it will respond with the necessary ones.
 * 
 * Interactions should be deferred.
 * @param interaction Slash/Context menu interaction
 * @param perms Array of PermissionResolvable
 * @returns Promise<boolean>
 */
export async function checkChanPerms(interaction: CommandInteraction | ModalSubmitInteraction, perms: PermissionResolvable[]) {
    // typecheck
    if (!interaction.guild || !interaction.channelId) {
        return false;
    }

    // fetch our discord client
    const me = await interaction.guild.members.fetchMe();

    // then get our permissions for the interaction channel
    const chanPerms = me.permissionsIn(interaction.channelId);

    // make sure we have the permissions we need
    if (!chanPerms.has(perms)) {
        await interaction.followUp(`I lack the permissions to invoke this command. Please ensure I have the following permissions in this channel, then start over: ${perms.join(', ')}`);
        return false;
    }

    return true;
}
