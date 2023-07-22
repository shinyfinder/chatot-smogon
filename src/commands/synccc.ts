import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import { SlashCommand } from '../types/slash-command-base';
import { pollCCForums, updateCCCache } from '../helpers/ccQueries.js';
import { parseCCStage } from '../helpers/ccWorkers.js';

export const command: SlashCommand = {
    global: false,
    guilds: ['1040378543626002442'],
    // setup the slash command builder
    data: new SlashCommandBuilder()
        .setName('synccc')
        .setDescription('Rebases the C&C cache by polling all threads in the relevant subforums')
        .setDMPermission(false)
        .setDefaultMemberPermissions(0),

    // execute our desired task
    async execute(interaction: ChatInputCommandInteraction) {
        await interaction.deferReply();
        
        // query the xf tables to get all of the threads in the relevant subforums
        const threadData = await pollCCForums(0, []);

        // parse the retrieved threads to determine their status
        const parsedThreadData = parseCCStage(threadData);

        // update the database with all of the threads
        for (const parsedThread of parsedThreadData) {
            await updateCCCache(parsedThread);
        }

        // let them know we're done
        await interaction.followUp('C&C cache reset with current thread information');
    },
};