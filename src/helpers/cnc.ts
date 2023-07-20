/**
 * Functions related to C&C integration
 */
import { pool, sqlPool } from './createPool.js';
import { ccTimeInterval, ccMetaObj, ccSubObj, OMPrefix, pastGenPrefix, rbyOtherPrefix, gens } from './constants.js';
import { ChannelType, Client } from 'discord.js';
import { oldData, updateCCThreads, updateLastCheck } from './manageCCCache.js';

/**
 * Finds new C&C threads posted to the relevent subforums.
 * New thread ids are cached so their progress is tracked.
 * @param client discord js client object
 */
export async function checkCCUpdates(client: Client) { 
    // unpack the data we need
    const oldThreadIds = oldData.threads ? oldData.threads.map(thread => thread.thread_id) : [];
    
    let lastCheckUnix = 0;
    const now = Date.now();

    // if you found a match in the table
    // use that as the last check time, converted to UNIX format so it can be used to query the forum table
    if (oldData.lastcheck) {
        const lastCheckDate = new Date(oldData.lastcheck).valueOf();
        lastCheckUnix = Math.floor(lastCheckDate / 1000);
    }
    // if you didn't get a match, assume the last check was the current time minus the interval (boot time)
    else {
        lastCheckUnix = Math.floor(now / 1000 - ccTimeInterval);
    }

    // poll the xf tables to get the thread data we care about
    const threadData = await pollCCForums(lastCheckUnix, oldThreadIds);
    
    // if you didn't get a match, there's nothing to do
    // so update the check time and return
    if (!threadData.length) {
        await updateLastCheck(now);
        return;
    }

    // if you did get a match, try to figure out the state of the thread
    for (const thread of threadData) {
        // first, try to parse the prefix text, because that will work for most cases
        // we care about: QC ready (tag changed to QC), QC progress, and done
        let stage = '';
        let progress = '';
        let gen = '';
        let tier = '';

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
        else if (thread.phrase_text === 'Resource' || thread.phrase_text === 'Announcement') {
            continue;
        }
        // OM / pastgen OM
        else if (thread.phrase_text && OMPrefix.includes(thread.phrase_text)) {
            tier = thread.phrase_text;
        }
        // past gens
        else if (thread.phrase_text && pastGenPrefix.includes(thread.phrase_text)) {
            const genRE = thread.phrase_text.match(/(?<=Gen )\d/);
            if (genRE) {
                gen = genRE[0];
            }
        }
        // rby other
        else if (thread.phrase_text && rbyOtherPrefix.includes(thread.phrase_text)) {
            tier = thread.phrase_text;
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
                    progress = '?/?';
                }
                // otherwise, we're still in QC
                else {
                    stage = 'QC';
                    progress = qcStageProgress;
                }
                
               // stage = 'QC';
               // progress = qcStageProgress;
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
        if (gen === '') {
            // old gen OMs
            if (thread.node_id === 770) {
                // try to find the gen from the title
                const genRegex = /\b((Gen|G|Generation)\s*([1-9])|(SV|SWSH|SS|USUM|USM|SM|ORAS|XY|B2W2|BW2|BW|HGSS|DPP|DP|RSE|RS|ADV|GSC|GS|RBY|RB))*\b/i;
                const matchArr = thread.title.match(genRegex);

                // if there was a match from the regex test...
                if (matchArr !== null && matchArr[0] !== '') {
                    const genDesr = (matchArr[3] || matchArr[4]).toLowerCase();
                    gen = gens[genDesr];
                }
                // else, no gen was specified, give up
                else {
                    continue;
                }
            }
            // otherwise get the gen from the thread map
            else {
                const genArr = ccSubObj[thread.node_id.toString()].gens;
                gen = genArr[genArr.length - 1];
            }
        }

        // get the tier from the thread map, if we haven't already
        if (tier === '') {
            const tierArr = ccSubObj[thread.node_id.toString()].tiers;
            tier = tierArr[tierArr.length - 1];
        }

        // we have all the data we need, so compare with the cache
        // first, determine whether this thread was previously cached
        if (oldData.threads) {
            const oldThreadData = oldData.threads.filter(othread => othread.thread_id === thread.thread_id);
            // if there's a change or it's new, try to alert on discord
            if (!oldThreadData.length || stage !== oldThreadData[0].stage || progress !== oldThreadData[0].progress) {
                await alertCCStatus(thread.thread_id, stage, progress, gen, tier, client);
                // update the cache in memory with the new values
                updateCCThreads(thread.thread_id, stage, progress);
            }
            // otherwise, there's nothing to update, so skip over this thread
            else {
                continue;
            }
        }
        // if there is no cache, then this thread must be new
        // so try to alert discord
        else {
            await alertCCStatus(thread.thread_id, stage, progress, gen, tier, client);
            // then update the cache in memory
            updateCCThreads(thread.thread_id, stage, progress);
        }
        

        // update the db of cached statuses
        // if done, delete the row so we don't clog up the db
        if (stage === 'Done') {
            await pool.query('DELETE FROM chatot.ccstatus WHERE thread_id=$1', [thread.thread_id]);
        }
        // otherwise, upsert the row with the new values
        else {
            await pool.query('INSERT INTO chatot.ccstatus (thread_id, stage, progress) VALUES ($1, $2, $3) ON CONFLICT (thread_id) DO UPDATE SET stage=$2, progress=$3', [thread.thread_id, stage, progress]);
        }
        

    }

    // everything's done, so update the last checked time
    // we use the time this command was triggered rather than the time it finished since processing is non-zero.
    await updateLastCheck(now);
}


/**
 * Validates the user input against the list of possible choices for the tier field in /config cc.
 * Because autocomplete does not validate the entered text automatically, we need to check ourselves.
 * @param tier Entered text in the /config cc <tier> option
 * @returns Whether the entered text was one of the autocomplete options
 */
export function validateCCTier(tier: string) {
    // make sure what they entered is a valid entry
    const valid = ccMetaObj.some(pair => pair.value === tier.toLowerCase());
    return valid;
}


/**
 * Posts an update to the relevant discord channel if a change is detected in the C&C status of the thread
 * @param threadid Unique id of forum thread that is being monitored
 * @param stage Current C&C stage (WIP, QC, GP, etc)
 * @param progress How far along the stage is, in # / # format (ie. 1/2)
 * @param gen The gen this thread covers
 * @param tier The tier this thread covers (OU, UU, Ubers, etc)
 * @param client Discord js client object
 */
async function alertCCStatus(threadid: number, stage: string, progress: string, gen: string, tier: string, client: Client) {
    // select by gen and tier
    // then alert progress

    // get the discord channels setup to receive alerts

    // check if there are any channels setup to receive alerts for this thread
    const alertChans = oldData.alertchans?.filter(data => data.tier === tier && data.gen === gen);

    // if there are no channels setup to receive QC 
    if (alertChans === undefined || !alertChans.length) {
        return;
    }

    // fetch the channel so we can post to it
    for (const alertChan of alertChans) {
        const chan = await client.channels.fetch(alertChan.channelid);

        // typecheck chan
        if (!chan || !(chan.type === ChannelType.GuildText || chan.type === ChannelType.PublicThread || chan.type === ChannelType.PrivateThread)) {
            return;
        }
        // post
        // we only want to post for QC updates and done
        let alertmsg = '';
        if (stage === 'GP' && (progress.split('/')[0] === '0' || progress.split('/')[0] === '?')) {
            alertmsg = `Update to thread <https://www.smogon.com/forums/threads/${threadid}/>\n\nStatus: Ready for GP`;
        }
        else if (stage === 'QC' && progress.split('/')[0] === '0') {
            alertmsg = `Update to thread <https://www.smogon.com/forums/threads/${threadid}/>\n\nStatus: Ready for QC`;
        }
        else if (!(stage === 'QC' || stage === 'Done')) {
            return;
        }
        else {
            alertmsg = `Update to thread <https://www.smogon.com/forums/threads/${threadid}/>\n\nStatus: ${stage} ${progress}`;
        }

        // prepend with a ping on the role, if desired
        if (alertChan.role) {
            alertmsg = `<@&${alertChan.role}> `.concat(alertmsg);
        }

        await chan.send(alertmsg);
        return;
    }
}


/**
 * Looks for new/updates threads in the relevant C&C subforums
 * 
 * thread_id and node_id are the unique ids of the thread and subforum, respectively
 * post_date is the unix timestamp (sec) the thread was made
 * prefix_id is the id of the prefix on the thread
 * phrase_text is the words the prefix uses (QC, GP, Done, WIP, etc)
 * 
 * The data is spread out between 2 tables -- xf_thread, and xf_phrase
 * phrase_text is stored using the prefix id, with the format 'thread_prefix.PREFIX_ID'
 * FIND_IN_SET returns only the nodes we care about
 * 
 * We only want to find threads made after our last scan or were preciously cached for tracking
 * @param lastCheckTime UNIX timestamp of when we last polled for C&C updates
 * @param cachedIDArr Array of thread IDs that are being monitored for updates
 * @returns Array of objects containing thread info (thread id, node id, title, prefix)
 */
async function pollCCForums(lastCheckTime: number, cachedIDArr: number[]) {
    // make sure the array lengths are non zero so the query doesn't error out
    // IDs can't be negative, so it's safe to use those as dummy values
    const nodeIds = Object.keys(ccSubObj).length ? Object.keys(ccSubObj) : ['-1'];
    const cachedIDs = cachedIDArr.length ? cachedIDArr : [-1];

    const [newThreads] = await sqlPool.execute(`
    SELECT thread_id, node_id, xenforo.xf_thread.title, phrase_text
    FROM xenforo.xf_thread
    LEFT JOIN xenforo.xf_phrase
    ON xenforo.xf_phrase.title = CONCAT('thread_prefix.', prefix_id)
    WHERE (node_id IN ("${nodeIds.join('", "')}") AND post_date >= ${lastCheckTime})
    OR thread_id IN ("${cachedIDs.join('", "')}")`);

    // cast to meaningful array
    const threadData = newThreads as {
        thread_id: number,
        node_id: number,
        title: string,
        phrase_text: string | null,
    }[] | [];

    return threadData;

}