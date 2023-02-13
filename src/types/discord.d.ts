import { Collection } from 'discord.js';
/**
 * Extends the discord.js client definition to include a command list.
 * This allows us to dynamically build our command list and attach it to the client instance, allowing the command list to be accessed anywhere (i.e. interaction.client.commands)
 */

declare module 'discord.js' {
    export interface Client {
      commands: Collection<unknown, unknown>
    }
}