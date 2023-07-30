/**
 * Functions related to C&C integration
 */
import { ccSubObj, OMPrefix, pastGenPrefix, rbyOtherPrefix, gens } from './constants.js';
import { ChannelType, Client } from 'discord.js';
import { loadCCData, pollCCForums, updateCCCache } from './ccQueries.js';
import { IXFParsedThreadData, ICCData, IXFStatusQuery } from '../types/cc';
import { cclockout, ccTimeInterval } from './constants.js';
import { errorHandler } from './errorHandler.js';

/**
 * Finds new and updated C&C threads posted to the relevent subforums.
 * New thread ids are cached so their progress is tracked,
 * and alerts are sent to the relevant discord channels
 * @param client discord js client object
 */
export async function checkCCUpdates(client: Client) {
    // if we're locked out (the synccc slash command is running), return
    // otherwise, engage the lock
    if (cclockout.flag) {
        return;
    }
    else {
        cclockout.flag = true;
    }

    // poll the database of cached cc threads, and current alert chans
    const oldData = await loadCCData();
    
    // poll the xf tables to get the thread data we care about
    const threadData = await pollCCForums();
    
    // if you didn't get a match, there's nothing in the forums
    // so empty the cache because nothing is there
    // this should never be the case
    if (!threadData.length) {
        await uncacheRemovedThreads(threadData, oldData);
        // release the lock
        cclockout.flag = false;
        return;
    }

    // parse the fetched thread info
    const parsedThreadData = parseCCStage(threadData);

    // filter out the threads from the most recent xf poll that are updated so we can update their values in the db
    // we want to get the threads where the thread ID matches the old, but the stage or the progress is different
    // or where the id is present in new but not old
    const updatedThreads: IXFParsedThreadData[] = [];
    for (const nthread of parsedThreadData) {
        if (!oldData.threads.some(othread => othread.thread_id === nthread.thread_id)) {
            updatedThreads.push(nthread);
        }
        else if (oldData.threads.some(othread => nthread.thread_id === othread.thread_id && (nthread.stage !== othread.stage || nthread.progress !== othread.progress))) {
            updatedThreads.push(nthread);
        }
    }

    // update the cache 
    await updateCCCache(updatedThreads);

    // alert for each new change
    await alertCCStatus(updatedThreads, oldData, client);

    // check for threads moved out of the forum, or deleted(?)
    await uncacheRemovedThreads(threadData, oldData);

    // release the lock
    cclockout.flag = false;

}


/**
 * Removes threads that have been moved out of the C&C forums from the cache
 * @param currentData Query result from polling C&C thread data from the xf tables
 * @param cachedData Query result from polling C&C thread data from the pg tables
 */
export async function uncacheRemovedThreads(currentData: IXFStatusQuery[], cachedData: ICCData) {
    // get the list of thread IDs currently in the nodes we care about
    const currentThreadIDs = currentData.map(data => data.thread_id);

    // compare that list with the list from the cache
    // any IDs that are cached but no longer present should be removed from the cache
    const cachedRemoved = cachedData.threads.filter(othread => !currentThreadIDs.includes(othread.thread_id));

    // if you found some, remove them from the cache
    await updateCCCache(cachedRemoved, true);
}


/**
 * Posts an update to the relevant discord channel
 * @param newData Object containing the parsed thread information regarding its C&C status
 * @param oldData Object containing the result of the PG query, including json of the cached old data, last check timestamp, and json of alert channels
 * @param client Discord js client object
 */
async function alertCCStatus(newDataArr: IXFParsedThreadData[], oldData: ICCData, client: Client) {
    for (const newData of newDataArr) {
        // to be safe, cast each element in the tier array to lower case
        const newTierLower = newData.tier.map(tier => tier.toLowerCase());

        // check if there are any channels setup to receive alerts for this thread
        const alertChans = oldData.alertchans.filter(chanData => newTierLower.includes(chanData.tier) && newData.gen.includes(chanData.gen));

        // if there are no channels setup to receive this update, skip
        if (!alertChans.length) {
            continue;
        }

        // fetch the channel so we can post to it
        for (const alertChan of alertChans) {
            // ideally we don't one one failed message (i.e. missing perms) to kill the rest
            // so try/catch the send so that even if 1 fails, the rest can try to be updated
            try {
                const chan = await client.channels.fetch(alertChan.channelid);

                // typecheck chan
                if (!chan || !(chan.type === ChannelType.GuildText || chan.type === ChannelType.PublicThread || chan.type === ChannelType.PrivateThread)) {
                    continue;
                }
                // post
                // we only want to post for QC updates and done
                let alertmsg = '';
                // for the sake of not doublling up when someone goes from QC 2/2 -> GP 0/1, check the old data for the thread
                const oldStatus = oldData.threads.find(othread => othread.thread_id === newData.thread_id);

                if (newData.stage === 'GP' && newData.progress.startsWith('0')) {
                    if (oldStatus && oldStatus.stage === 'GP' && oldStatus.progress === '0/?') {
                        continue;
                    }
                    else {
                        alertmsg = `Thread updated:\n${newData.phrase_text ?? '[]'} | ${newData.title}\n<https://www.smogon.com/forums/threads/${newData.thread_id}/>\nStatus: **Ready for GP**`;
                    }
                    
                }
                else if (newData.stage === 'QC' && newData.progress.startsWith('0')) {
                    alertmsg = `Thread updated:\n${newData.phrase_text ?? '[]'} | ${newData.title}\n<https://www.smogon.com/forums/threads/${newData.thread_id}/>\nStatus: **Ready for QC**`;
                }
                else if (!(newData.stage === 'QC' || newData.stage === 'Done')) {
                    continue;
                }
                else {
                    alertmsg = `Thread updated:\n${newData.phrase_text ?? '[]'} | ${newData.title}\n<https://www.smogon.com/forums/threads/${newData.thread_id}/>\nStatus: **${newData.stage} ${newData.progress}**`;
                }

                // prepend with a ping on the role, if desired
                // there should only be at most 1
                // first, check to see if there's a role targeting this specific stage
                let pingRole: string | null | undefined;
                const targetedRoleRow = alertChans.filter(achan => achan.channelid === alertChan.channelid && achan.stage.toLowerCase() === alertChan.stage.toLowerCase());

                // if you didn't find one, check again but look for target any
                if (!targetedRoleRow.length) {
                    const allRoleRow = alertChans.filter(achan => achan.channelid === alertChan.channelid && achan.stage.toLowerCase() === 'all');
                    if (allRoleRow.length) {
                        pingRole = allRoleRow[0].role;
                    }
                }
                else {
                    pingRole = targetedRoleRow[0].role;
                }
                
                if (pingRole) {
                    alertmsg = `<@&${pingRole}> `.concat(alertmsg);
                }
                // post alert to cord
                await chan.send(alertmsg);
            }
            catch (e) {
                errorHandler(e);
            }
        }
    }
    
}


/**
 * Parses the thread titles and prefixes to determine its C&C stage and progress.
 * Returned information includes thread id, node id, title, prefix text, stage, progress, gen, and tier
 * @param threadData Array of objects containing the thread information retrieved from the db query
 * @returns Parsed data array of objects for each thread indiciating the C&C stage and progress
 */
export function parseCCStage(threadData: IXFStatusQuery[]) {
    const parsedThreadData: IXFParsedThreadData[] = [];
    
    // loop over the list of provided threads to figure out the state of each
    for (const thread of threadData) {
        // first, try to parse the prefix text, because that will work for most cases
        // we care about: QC ready (tag changed to QC), QC progress, and done
        let stage = '';
        let progress = '';
        let gen: string[] = [];
        let tier: string[] = [];

        if (thread.phrase_text === 'WIP') {
            stage = 'WIP';
        }
        else if (thread.phrase_text === 'Quality Control') {
            stage = 'QC';
        }
        else if (thread.phrase_text === 'Copyediting') {
            stage = 'GP';
        }
        else if (thread.phrase_text === 'HTML') {
            stage = 'HTML';
        }
        else if (thread.phrase_text === 'Done') {
            stage = 'Done';
        }
        // if it's a resource or an announcement, skip
        else if (thread.phrase_text === 'Resource' || thread.phrase_text === 'Announcement' || thread.phrase_text === 'Project') {
            continue;
        }
        // OM / pastgen OM
        else if (thread.phrase_text && OMPrefix.includes(thread.phrase_text)) {
            tier = [thread.phrase_text];
        }
        // past gens
        else if (thread.phrase_text && pastGenPrefix.includes(thread.phrase_text)) {
            const genRE = thread.phrase_text.match(/(?<=Gen )\d/);
            if (genRE) {
                gen = [genRE[0]];
            }
        }
        // rby other
        else if (thread.phrase_text && rbyOtherPrefix.includes(thread.phrase_text)) {
            tier = [thread.phrase_text];
        }
        
        // determine the stage if we haven't already
        if (stage === '') {
            // regex match results in [match, 'qc/gp', '0/1'][] format
            const progressions = [...thread.title.matchAll(/(QC|GP).{0,3}(\d\s?\/\s?\d)/gi)];
            
            // general progression is WIP, QC, GP, done
            if (!progressions.length) {
                stage = 'WIP';
            }
            else if (thread.title.toLowerCase().includes('done')) {
                stage = 'Done';
            }
            // if you match both, you have to parse each to see what stage you're really in
            else if (progressions.length >= 2) {
                // figure out the progress for each stage that was matched
                // we have to check for both QC and GP because some people might prefill the entries but not have values
                const gpStageMatch = progressions.filter(prog => prog.some(val => val?.toLowerCase() === 'gp'));

                // if the regex failed, just return to be safe
                if (!gpStageMatch.length || gpStageMatch[0].length < 3) {
                    continue;
                }

                const gpStageProgress = gpStageMatch[0][2].replace(/ /g, '');
                // split the progress on / so we can analyze the progression
                const gpProgArr = gpStageProgress.split('/');

                const qcStageMatch = progressions.filter(prog => prog.some(val => val?.toLowerCase() === 'qc'));

                // if the regex failed, just return to be safe
                if (!qcStageMatch.length || qcStageMatch[0].length < 3) {
                    continue;
                }

                const qcStageProgress = qcStageMatch[0][2].replace(/ /g, '');
                // split the progress on / so we can analyze the progression
                const qcProgArr = qcStageProgress.split('/');
                
                // if the qc progress isn't complete, it's in QC
                if (qcProgArr[0] !== qcProgArr[1]) {
                    stage = 'QC';
                    progress = qcStageProgress;
                }
                // if GP and QC are both complete, it's done
                else if (qcProgArr[0] === qcProgArr[1] && gpProgArr[0] === gpProgArr[1]) {
                    stage = 'Done';
                }
                // if QC is complete and GP isn't, it's in GP
                else {
                    stage = 'GP';
                    progress = gpStageProgress;
                }
            }
            // match gp only
            else if (progressions.some(prog => prog.some(val => val?.toLowerCase() === 'gp'))) {
                const gpStageMatch = progressions.filter(prog => prog.some(val => val?.toLowerCase() === 'gp'));
                const gpStageProgress = gpStageMatch[0][2].replace(/ /g, '');
                // split the progress on / so we can analyze the progression
                const gpProgArr = gpStageProgress.split('/');

                // if both sides of the / are the same, up the stage by 1
                if (gpProgArr[0] === gpProgArr[1]) {
                    stage = 'Done';
                }
                // otherwise, we're still in GP
                else {
                    stage = 'GP';
                    progress = gpStageProgress;
                }
                
            }
            // match qc only
            else if (progressions.some(prog => prog.some(val => val?.toLowerCase() === 'qc'))) {
                const qcStageMatch = progressions.filter(prog => prog.some(val => val?.toLowerCase() === 'qc'));
                const qcStageProgress = qcStageMatch[0][2].replace(/ /g, '');
                
                // split the progress on / so we can analyze the progression
                const qcProgArr = qcStageProgress.split('/');

                // if both sides of the / are the same, up the stage by 1
                if (qcProgArr[0] === qcProgArr[1]) {
                    stage = 'GP';
                    progress = '0/?';
                }
                // otherwise, we're still in QC
                else {
                    stage = 'QC';
                    progress = qcStageProgress;
                }
            }
            // if nothing, assume it's wip
            else {
                stage = 'WIP';
            }
        }

        // determine the progress if we haven't already
        if (progress === '') {
            const progressions = [...thread.title.matchAll(/(QC|GP).{0,3}(\d\s?\/\s?\d)/gi)];
            
            // if you found a match from the regex, try to find the entry corresponding to the tag
            if (stage === 'GP' || stage === 'QC') {
                let stageProgress = progressions.filter(prog => prog.some(val => val?.toLowerCase() === stage.toLowerCase()));
                // if you found one, a match, then use the match's progress
                if (stageProgress.length && stageProgress[0].length >= 3) {
                    progress = stageProgress[0][2].replace(/ /g, '');
                }
                // if you didn't find a match, it's possible they didn't enter the name of the stage into the title because it's implied by the tag
                // so use the progress of the match that doesn't have text
                else if (progressions.length) {
                    stageProgress = progressions.filter(prog => prog[1] === undefined && prog[2]);
                    if (stageProgress.length && stageProgress[0].length >= 3) {
                        progress = stageProgress[0][2].replace(/ /g, '');
                    }
                    
                }
            }

        }

        
        // determine the gen if we haven't already
        // past gen OMs are special in that we also have to get the gen from the title
        // everywhere else(?) is determined by either the thread location or prefix
        if (!gen.length) {
            // old gen OMs
            if (thread.node_id === 770) {
                // try to find the gen from the title
                const genRegex = /\b((Gen|G|Generation)\s*([1-9])|(SV|SWSH|SS|USUM|USM|SM|ORAS|XY|B2W2|BW2|BW|HGSS|DPP|DP|RSE|RS|ADV|GSC|GS|RBY|RB))*\b/i;
                const matchArr = thread.title.match(genRegex);

                // if there was a match from the regex test...
                if (matchArr !== null && matchArr[0] !== '') {
                    const genDesr = (matchArr[3] || matchArr[4]).toLowerCase();
                    gen = [gens[genDesr]];
                }
                // else, no gen was specified, give up
                else {
                    continue;
                }
            }
            // otherwise get the gen from the thread map
            else {
                gen = ccSubObj[thread.node_id.toString()].gens;
            }
        }

        // get the tier from the thread map, if we haven't already
        if (!tier.length) {
            tier = ccSubObj[thread.node_id.toString()].tiers;
        }
       
        // push the data to the holding array
        parsedThreadData.push({
            thread_id: thread.thread_id,
            node_id: thread.node_id,
            title: thread.title,
            phrase_text: thread.phrase_text,
            gen: gen,
            tier: tier,
            stage: stage,
            progress: progress,
        });
    }
    return parsedThreadData;
}


/**
 * Recursively creates a timer to check for updates on C&C status
 * @param client Discord js client object
 */
export function createCCTimer(client: Client) {
    setTimeout(() => {
        void checkCCUpdates(client)
            .catch(e => errorHandler(e))
            .finally(() => createCCTimer(client));
    }, ccTimeInterval * 1000);
    
}

