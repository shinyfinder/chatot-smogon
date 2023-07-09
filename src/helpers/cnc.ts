/**
 * Functions related to C&C integration
 */
import { pool, sqlPool } from './createPool.js';
import { ccTimeInterval, ccSubs } from './constants.js';

export async function findNewThreads() {
    /**
     * Look for new threads in the relevant subforums
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
     * We only want to find threads made after our last scan
     */
    const [newThreads] = await sqlPool.execute(`
    SELECT thread_id, node_id, xenforo.xf_thread.title, phrase_text
    FROM xenforo.xf_thread
    LEFT JOIN xenforo.xf_phrase
    ON xenforo.xf_phrase.title = CONCAT('thread_prefix.', prefix_id)
    WHERE FIND_IN_SET(node_id, ?)
    AND post_date >= ?`, [ccSubs.join(','), 0]);
    // Math.floor(Date.now() / 1000 - ccTimeInterval)

    // cast to meaningful array
    const threadData = newThreads as {
        thread_id: number,
        node_id: number,
        title: string,
        phrase_text: string | null,
    }[] | [];

    // if you didn't get a match, there's nothing to do
    if (!threadData.length) {
        return;
    }

    // if you did get a match, try to figure out the state of the thread
    for (const thread of threadData) {
        // first, try to parse the prefix text, because that will work for most cases
        // we care about: QC ready (tag changed to QC), QC progress, and done
        let stage = '';
        let progress = '';
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
        // we also need to check for oldgen/oms
        // oldgens
        /**
         * RBY Other
         * 
         * NU
         * PU
         * Stadium OU
         * Tradebacks OU
         * UU
         * Ubers
         * 
         * LGPE
         * standard
         * 
         * 
         * Past Gen
         * Gen 1-8
         */

        /**
         * OMs
         * 
         * NFE
         * AAA
         * 2v2
         * GG
         * AG
         * BH
         * M&M
         * STAB
         * ZU
         * 
         * Past Gen
         * PH
         * 
         */
        // and no tag
        // the tag isn't helpful to determine the stage, so we'll need to parse the title
        else {
            // regex match results in [match, 'qc/gp', '0/1'][] format
            // const progressions = [...thread.title.matchAll(/(QC|GP)?:?\s?\d\s?\/\s?\d/gi)];
            const progressions = [...'SubRoost Zapdos [QC: 2/2] [GP:0/1]'.matchAll(/(QC|GP)?:?\s?(\d\s?\/\s?\d)/gi)];
            // general progression is WIP, QC, GP, done
            if (thread.title.toLowerCase().includes('done')) {
                stage = 'Done';
            }
            else if (progressions.some(prog => prog.some(val => val.toLowerCase() === 'gp'))) {
                const gpStageProgress = progressions.filter(prog => prog.some(val => val.toLowerCase() === 'gp'));
                stage = 'GP';
                progress = gpStageProgress[0][2];
            }
            else if (progressions.some(prog => prog.some(val => val.toLowerCase() === 'qc'))) {
                const gpStageProgress = progressions.filter(prog => prog.some(val => val.toLowerCase() === 'qc'));
                stage = 'QC';
                progress = gpStageProgress[0][2];
            }
            // if nothing, assume it's wip
            else {
                stage = 'WIP';
            }
        }

        // determine the progress if we haven't already
        if (progress === '') {
            // const progressions = [...thread.title.matchAll(/(QC|GP)?:?\s?\d\s?\/\s?\d/gi)];
            const progressions = [...'SubRoost Zapdos [QC: 2/2] [GP:0/1]'.matchAll(/(QC|GP)?:?\s?(\d\s?\/\s?\d)/gi)];
            // if you found a match from the regex, try to find the entry corresponding to the tag
            if (stage === 'GP' || stage === 'QC') {
                let stageProgress = progressions.filter(prog => prog.some(val => val.toLowerCase() === stage.toLowerCase()));
                // if you found one, a match, then use the match's progress
                if (stageProgress.length) {
                    progress = stageProgress[0][2];
                }
                // if you didn't find a match, it's possible they didn't enter the name of the stage into the title because it's implied by the tag
                // so use the progress of the match that doesn't have text
                else if (progressions.length) {
                    stageProgress = progressions.filter(prog => prog[1] === undefined && prog[2]);
                    progress = stageProgress[0][2];
                }
            }

        }

        // we have all the data we need, so interact with the cache
        // first, poll the db for this thread id to see if anything changed
        const oldThreadDataPG = await pool.query('SELECT stage, progress FROM chatot.cc_status WHERE thread_id =$1', [thread.thread_id]);
        const oldThreadData: { stage: string, progress: string }[] | [] = oldThreadDataPG.rows;

        /**
         * TODO publish to discord on change
         */
        
        // update the db
        // if done, delete the row so we don't clog up the db
        if (stage === 'Done') {
            await pool.query('DELETE FROM chatot.cc_status WHERE thread_id=$1', [thread.thread_id]);
        }
        // otherwise, upsert the row with the new values
        else {
            await pool.query('INSERT INTO chatot.cc_status (thread_id, stage, progress) VALUES ($1, $2, $3) ON CONFLICT (thread_id) DO UPDATE SET stage=$1, progress=$2', [thread.thread_id, stage, progress]);
        }
        

    }

}
