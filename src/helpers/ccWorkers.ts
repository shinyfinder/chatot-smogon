/**
 * Functions related to C&C integration
 */
import { genAliases } from './constants.js';
import { ChannelType, Client } from 'discord.js';
import { getFromForumMap, getGenAlias, loadCCData, pollCCForums, updateCCAlertCooldowns, updateCCCache } from './ccQueries.js';
import { IXFParsedThreadData, ICCData, IXFStatusQuery } from '../types/cc';
import { lockout, ccTimeInterval } from './constants.js';
import { errorHandler } from './errorHandler.js';
import { ccCooldowns, updateCCCooldownMem } from './manageCCCooldownCache.js';
import { dexGens } from './loadDex.js';


/**
 * Finds new and updated C&C threads posted to the relevent subforums.
 * New thread ids are cached so their progress is tracked,
 * and alerts are sent to the relevant discord channels
 * @param client discord js client object
 */
export async function checkCCUpdates(client: Client) {
    // if we're locked out (the syncdb slash command is running), return
    // otherwise, engage the lock
    if (lockout.cc) {
        return;
    }
    else {
        lockout.cc = true;
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
        lockout.cc = false;
        return;
    }

    // parse the fetched thread info
    const parsedThreadData = await parseCCStage(threadData);

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
    lockout.cc = false;

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
 * @param oldData Object containing the result of the PG query, including json of the cached old data, and json of alert channels
 * @param client Discord js client object
 */
async function alertCCStatus(newDataArr: IXFParsedThreadData[], oldData: ICCData, client: Client) {
    for (const newData of newDataArr) {
        // to be safe, cast each element in the tier array to lower case
        let newTierLower = newData.tier.map(tier => tier.toLowerCase());

        // if there are multiple possible tiers, just assume the prefix is the tier
        if (newData.phrase_text && newTierLower.length !== 1) {
            newTierLower = [newData.phrase_text.toLowerCase()];
        }
        // if there are multiple possible and they didn't use the prefix, then we don't know what it could be
        // so skip it
        else if (newTierLower.length !== 1) {
            continue;
        }

        // if there is more than 1 possible gen, skip it
        if (newData.gen.length !== 1) {
            continue;
        }
        
        // check if there are any channels setup to receive alerts for this thread
        const alertChans = oldData.alertchans.filter(chanData => (newTierLower.includes(chanData.tier) || newTierLower.includes(chanData.prefix ?? '')) && newData.gen.includes(chanData.gen));
        
        // if there are no channels setup to receive this update, skip
        if (!alertChans.length) {
            continue;
        }

        // holder for chan ids so we don't alert each chan multiple times for the same thread
        const processedChans: string[] = [];

        // fetch the channel so we can post to it
        for (const alertChan of alertChans) {
            if (processedChans.includes(alertChan.channelid)) {
                continue;
            }

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
                let cooldown = 0;
                const targetedRoleRow = alertChans.find(achan => achan.channelid === alertChan.channelid && achan.stage.toLowerCase() === newData.stage.toLowerCase());
                const allRoleRow = alertChans.find(achan => achan.channelid === alertChan.channelid && achan.stage.toLowerCase() === 'all');
                
                
                if (targetedRoleRow) {
                    pingRole = targetedRoleRow.role;
                    cooldown = targetedRoleRow.cooldown ?? 0;
                }
                // if you didn't find one, check again but look for target any
                else if (allRoleRow) {
                    pingRole = allRoleRow.role;
                    cooldown = allRoleRow.cooldown ?? 0;
                }
                
                // don't ping for GP ready
                if (pingRole && newData.stage !== 'GP') {
                    alertmsg = `<@&${pingRole}> `.concat(alertmsg);
                }

                // try to get the corresponding element in the alertCDs array
                const identifier = `cc-${newData.gen[0]}${newTierLower[0]}`;
                const matchingCD = ccCooldowns.find(cd => cd.channelid === chan.id && cd.identifier === identifier);

                // if you got a match, get the last run timestamp
                const nextAllowedValue = matchingCD ? matchingCD.date.valueOf() + (cooldown * 1000 * 60 * 60) : 0;

                // if cooldown is defined (they want one) and it's currently later than the cooldown, alert
                // otherwise, just alert
                // the cooldown only applies to QC status
                if (Date.now().valueOf() < nextAllowedValue && newData.stage === 'QC') {
                    continue;
                }
                else {
                    await chan.send(alertmsg);
                }
                

                // add the thread id to the list of processed
                processedChans.push(alertChan.channelid);

                // update the entry to the cooldown object if this was a QC progress update
                if (cooldown && newData.stage === 'QC') {
                    // update the db
                    await updateCCAlertCooldowns(chan.id, identifier);
                    // update the mem cache
                    updateCCCooldownMem(chan.id, identifier);
                }
                
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
export async function parseCCStage(threadData: IXFStatusQuery[]) {
    const parsedThreadData: IXFParsedThreadData[] = [];
    const genRE = new RegExp('(?<=Gen )\\d+');

    // loop over the list of provided threads to figure out the state of each
    for (const thread of threadData) {
        // first, try to parse the prefix text, because that will work for most cases
        // we care about: QC ready (tag changed to QC), QC progress, and done
        let stage = '';
        let progress = '';
        let gen: string[] = [];
        let tier: string[] = [];
        let genNum = '';

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
        /*
        else if (thread.phrase_text && OMPrefix.includes(thread.phrase_text)) {
            tier = [thread.phrase_text];
        }
        */
        // past gens
        else if (thread.phrase_text && genRE.test(thread.phrase_text)) {
            // this will match the number in the prefix
            const genMatchArr = thread.phrase_text.match(genRE);
            if (genMatchArr) {
                genNum = genMatchArr[0];
            }
        }
        // rby other
        /*
        else if (thread.phrase_text && rbyOtherPrefix.includes(thread.phrase_text)) {
            tier = [thread.phrase_text];
        }
        */
        
        // determine the stage if we haven't already
        if (stage === '') {
            // regex match results in [match, 'qc/gp', '0/1'][] format
            const progressions = [...thread.title.matchAll(/(QC|GP).{0,3}(\d\s?\/\s?\d)/gi)];
            
            if (thread.title.toLowerCase().includes('done')) {
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
            // if the thread prefix has the gen number, map it to the gen alias
            if (genNum) {
                const genAlias = await getGenAlias(genNum);
                gen = genAlias.map(a => a.alias);
            }
            else {
                // try to find the gen from the title
                // ideally we wouldn't want to update this every time, so extend the pg query to get the gens with whatever aliases we have saved in constants
                // at least that way part of it will always be updated, and it may be totally sufficient if people don't use other random acronyms
                // we match with the 'i' flag, so it doesn't really matter if we use the shorthand or alias
                const extendedGenAliases = dexGens.map(g => g.name).concat(...Object.values(genAliases));
                const genRegex = new RegExp(`\\b(?:Gen|G|Generation)\\s*([0-9]+)\\b|\\b(${extendedGenAliases.join('|')})\\b`, 'i');
                const matchArr = thread.title.match(genRegex);

                // if there was a match from the regex test...
                if (matchArr) {
                    // match results in ["Gen X | abbr", "gen number" | undef, "abbr" | undef]
                    if (matchArr[1]) {
                        const genAlias = await getGenAlias(matchArr[1]);
                        gen = genAlias.map(a => a.alias);
                    }
                    else if (matchArr[2]) {
                        gen = [matchArr[2].toLowerCase()];
                    }
                }
                // else, try to get it from the thread map
                else {
                    const gensInForum = await getFromForumMap('gen', thread.node_id.toString()) as { gen: string }[] | [];
                    gen = gensInForum.map(g => g.gen);
                }
            }
        }

        // get the tier from the thread map or the prefix, if we haven't already
        if (!tier.length) {
            const tiersInForum = await getFromForumMap('tier', thread.node_id.toString()) as { tier: string }[] | [];
            tier = tiersInForum.map(t => t.tier);

            // if the list of possible tiers includes the thread prefix, filter out everything but the prefix
            // otherwise, return the original list of all possible tiers
            const filteredTier = tier.filter(t => t === thread.phrase_text);

            if (filteredTier.length) {
                tier = filteredTier;
            }
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
            .catch(e => (errorHandler(e), lockout.cc = false))
            .finally(() => createCCTimer(client));
    }, ccTimeInterval);
    
}

