import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import { SlashCommand } from '../types/slash-command-base';
import { pollCCForums, updateCCCache } from '../helpers/ccQueries.js';
import { parseCCStage } from '../helpers/ccWorkers.js';
import { cclockout } from '../helpers/constants.js';

export const command: SlashCommand = {
    global: false,
    guilds: ['1040378543626002442'],
    // setup the slash command builder
    data: new SlashCommandBuilder()
        .setName('synccc')
        .setDescription('Rebases the C&C cache by polling all threads in the relevant subforums'),

    // execute our desired task
    async execute(interaction: ChatInputCommandInteraction) {
        await interaction.deferReply();
        // wrap everything in a try/catch so that if there's an error, we can release the C&C lock
        try {
            // to prevent the bot from being stuck in an infinite loop,
            // set a 7 minute timer (defer reply gives us 15 minutes)
            // that when it ends, causes the function to return
            let failsafe = false;
            const failsafeTimer = setTimeout(() => failsafe = true, 1000 * 60 * 7);

            // if C&C is locked out, wait for the timer to finish
            while (cclockout.flag) {
                // if it takes to long to be released, return without unlocking
                if (failsafe) {
                    await interaction.followUp('C&C lock taking too long to be released');
                    return;
                }
                continue;
            }
            // enable the lock until we complete what we need to do
            cclockout.flag = true;

            // clear the timeout so it's not needlessly running
            clearTimeout(failsafeTimer);

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

            // release the lock
            cclockout.flag = false;
        }
        catch (e) {
            // release the lock and throw
            cclockout.flag = false;
            throw e;
        }
        
    },
};