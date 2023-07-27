import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import { SlashCommand } from '../types/slash-command-base';
import { pollCCForums, updateCCCache, loadCCData } from '../helpers/ccQueries.js';
import { parseCCStage, uncacheRemovedThreads } from '../helpers/ccWorkers.js';
import { cclockout } from '../helpers/constants.js';

/**
 * Queries the xf tables to reset the cache of C&C threads
 */
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

        let failsafe = false;
        const failsafeTimer = setTimeout(() => failsafe = true, 7 * 60 * 1000);

        // check if we're locked out
        // if we are, wait until it's freed up.
        // otherwise, return if it takes too long
        while (cclockout.flag) {
            if (failsafe) {
                await interaction.followUp('Failsafe triggered. Command taking too long to finish');
                return;
            }
        }

        // the cc check timer is on cooldown, so we're safe to proceed
        // cancel the failsafe timer and reimplement the lockout
        clearTimeout(failsafeTimer);
        cclockout.flag = true;

        // poll the database of cached cc threads, and current alert chans
        const oldData = await loadCCData();
        
        // query the xf tables to get all of the threads in the relevant subforums
        const threadData = await pollCCForums();

        // parse the retrieved threads to determine their status
        const parsedThreadData = parseCCStage(threadData);

        // update the cache
        await updateCCCache(parsedThreadData);
        
        // prune the cache of threads that no longer exist
        await uncacheRemovedThreads(threadData, oldData);
        
        // let them know we're done
        await interaction.followUp('C&C cache reset with current thread information');
        
        // release the lock
        cclockout.flag = false;
    },
};