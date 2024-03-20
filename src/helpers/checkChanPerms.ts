/* eslint-disable @typescript-eslint/no-base-to-string */
import { CommandInteraction, GuildChannelResolvable, ModalSubmitInteraction, PermissionResolvable } from 'discord.js';

/**
 * Checks channel permissions for the ability to complete the command. 
 * If the bot lacks the permissions, it will respond with the necessary ones.
 * 
 * @param interaction Slash/Context menu interaction
 * @param perms Array of PermissionResolvable
 * @returns Promise<boolean>
 */
export async function checkChanPerms(interaction: CommandInteraction | ModalSubmitInteraction, channel: GuildChannelResolvable, perms: PermissionResolvable[]) {
    // typecheck
    if (!interaction.guild || !interaction.channelId) {
        return false;
    }

    // fetch our discord client
    const me = await interaction.guild.members.fetchMe();

    // then get our permissions for the interaction channel
    const chanPerms = me.permissionsIn(channel);

    // make sure we have the permissions we need
    if (!chanPerms.has(perms)) {
        // if we don't, reply with the permissions we need
        // try to make this ephemeral since it's an error message
        if (interaction.replied) {
            await interaction.followUp(`I lack the permissions to invoke this command. Please ensure I have the following permissions in ${channel.toString()}, then start over: ${perms.join(', ')}`);
        }
        else {
            await interaction.reply({ content: `I lack the permissions to invoke this command. Please ensure I have the following permissions in ${channel.toString()}, then start over: ${perms.join(', ')}`, ephemeral: true });
        }
        
        return false;
    }

    return true;
}
