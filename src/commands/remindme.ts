import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import { SlashCommand } from '../types/slash-command-base';

/**
 * Creates a timer to DM a user after a specifc time with a specified message
 */
export const command: SlashCommand = {
    global: true,
    guilds: [],
    // setup the slash command builder
    data: new SlashCommandBuilder()
        .setName('remindme')
        .setDescription('Has the bot send you a reminder at the specified time')
        .addStringOption(option =>
            option.setName('method')
            .setDescription('The method the bot will use to remind you. Choosing post will remind you in the interaction channel.')
            .addChoices(
                { name: 'DN', value: 'dm' },
                { name: 'post', value: 'post' },
            )
            .setRequired(true))
        .addNumberOption(option =>
            option.setName('time')
            .setDescription('When the bot will remind you')
            .addChoices(
                { name: '30 Min', value: 0.5 * 60 * 60 * 1000 },
                { name: '1 Hour', value: 1 * 60 * 60 * 1000 },
                { name: '1.5 Hour', value: 1.5 * 60 * 60 * 1000 },
                { name: '2 Hour', value: 2 * 60 * 60 * 1000 },
                { name: '2.5 Hour', value: 2.5 * 60 * 60 * 1000 },
                { name: '3 Hour', value: 3 * 60 * 60 * 1000 },
                { name: '4 Hour', value: 4 * 60 * 60 * 1000 },
                { name: '5 Hour', value: 5 * 60 * 60 * 1000 },
                { name: '7 Hour', value: 7 * 60 * 60 * 1000 },
                { name: '9 Hour', value: 9 * 60 * 60 * 1000 },
                { name: '12 Hour', value: 12 * 60 * 60 * 1000 },
                { name: '18 Hour', value: 18 * 60 * 60 * 1000 },
                { name: '1 Day', value: 24 * 60 * 60 * 1000 },
                { name: '2 Day', value: 2 * 24 * 60 * 60 * 1000 },
                { name: '3 Day', value: 3 * 24 * 60 * 60 * 1000 },
                { name: '4 Day', value: 4 * 24 * 60 * 60 * 1000 },
                { name: '5 Day', value: 5 * 24 * 60 * 60 * 1000 },
            )
            .setRequired(false))
        .addStringOption(option =>
            option.setName('custom')
            .setDescription('Unix timestamp of when to be reminded'))
        .setDMPermission(false),

    // execute our desired task
    async execute(interaction: ChatInputCommandInteraction) {
        await interaction.reply({ content: 'Pong!', ephemeral: true });
    },
};