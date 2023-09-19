import { CommandInteraction, ContextMenuCommandBuilder } from 'discord.js';

/**
 * Context menu command class definition
 * All context menu commands conform to this form factor
 */

export interface ContextCommand {
    global: boolean;
    guilds: string[];
    // in seconds
    cooldown?: number;
    data: ContextMenuCommandBuilder;
    execute (interaction: CommandInteraction): Promise<void>;
}