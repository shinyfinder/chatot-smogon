import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import { SlashCommand } from '../types/slash-command-base';
import { pollCCForums, updateCCCache, loadCCData } from '../helpers/ccQueries.js';
import { parseCCStage, uncacheRemovedThreads } from '../helpers/ccWorkers.js';
import { lockout } from '../helpers/constants.js';
import { loadCAStatus, pollCAForum, updateCACache } from '../helpers/caQueries.js';
import { uncacheRemovedCAThreads } from '../helpers/caWorkers.js';
import { pool } from '../helpers/createPool.js';
/**
 * Queries the xf tables to reset the cache of C&C threads
 */
export const command: SlashCommand = {
    global: false,
    guilds: ['1040378543626002442'],
    // setup the slash command builder
    data: new SlashCommandBuilder()
        .setName('syncdb')
        .setDescription('Rebases the C&C cache by polling all threads in the relevant subforums')
        .addStringOption(option =>
            option.setName('scope')
            .setDescription('Which database to resync')
            .setChoices(
                { name: 'C&C', value: 'cc' },
                { name: 'Custom Avatar', value: 'ca' },
                { name: 'Gban Status', value: 'gban' },
            )
            .setRequired(true))
        .setDMPermission(false)
        .setDefaultMemberPermissions(0),

    // execute our desired task
    async execute(interaction: ChatInputCommandInteraction) {
        await interaction.deferReply();

        let failsafe = false;
        const failsafeTimer = setTimeout(() => failsafe = true, 7 * 60 * 1000);

        // get the user input
        const scope = interaction.options.getString('scope', true);

        if (scope === 'cc') {
            // check if we're locked out
            // if we are, wait until it's freed up.
            // otherwise, return if it takes too long
            while (lockout.cc) {
                if (failsafe) {
                    await interaction.followUp('Failsafe triggered. Command taking too long to finish');
                    return;
                }
            }

            // the cc check timer is on cooldown, so we're safe to proceed
            // cancel the failsafe timer and reimplement the lockout
            clearTimeout(failsafeTimer);
            lockout.cc = true;

            // poll the database of cached cc threads, and current alert chans
            const oldData = await loadCCData();
            
            // query the xf tables to get all of the threads in the relevant subforums
            const threadData = await pollCCForums();

            // parse the retrieved threads to determine their status
            const parsedThreadData = await parseCCStage(threadData);

            // update the cache
            await updateCCCache(parsedThreadData);
            
            // prune the cache of threads that no longer exist
            await uncacheRemovedThreads(threadData, oldData);
            
            // let them know we're done
            await interaction.followUp('C&C cache reset with current thread information');
            
            // release the lock
            lockout.cc = false;
        }

        else if (scope === 'ca') {
            // check if we're locked out
            // if we are, wait until it's freed up.
            // otherwise, return if it takes too long
            while (lockout.ca) {
                if (failsafe) {
                    await interaction.followUp('Failsafe triggered. Command taking too long to finish');
                    return;
                }
            }

            // the cc check timer is on cooldown, so we're safe to proceed
            // cancel the failsafe timer and reimplement the lockout
            clearTimeout(failsafeTimer);
            lockout.ca = true;

            // poll the database of cached cc threads, and current alert chans
            const oldData = await loadCAStatus();
            
            // query the xf tables to get all of the threads in the relevant subforums
            const newData = await pollCAForum();

            // update the cache
            await updateCACache(newData);
            
            // prune the cache of threads that no longer exist
            await uncacheRemovedCAThreads(newData, oldData);
            
            // let them know we're done
            await interaction.followUp('Custom Avatar cache reset with current thread information');
            
            // release the lock
            lockout.ca = false;
        }


        else if (scope === 'gban') {
            // pull the logs from storage and the dev cord for comparison
            const gbans: { target: string }[] = (await pool.query('SELECT target FROM chatot.gbans')).rows;
            const currentBans = await interaction.guild!.bans.fetch();

            // get the ids that are in the db but not in the server
            // these are the ones that were unbanned
            const unbanned = gbans.filter(ban => !currentBans.has(ban.target)).map(ban => ban.target);

            // update the db to reflect they were unbanned
            await pool.query('UPDATE chatot.gbans SET unbanned = true WHERE target=ANY($1)', [unbanned]);

            await interaction.followUp('Unbanned statuses updated for list of gbans');
        }
        
    },
};