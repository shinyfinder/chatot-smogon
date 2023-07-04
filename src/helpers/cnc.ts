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
            // const progressions = thread.title.matchAll(/(QC:?\s?|GP\s?)?\d\s?\/\s?\d/gi);
            const progressions = 'SubRoost Zapdos [QC: 2/2] [GP:0/1]'.matchAll(/(QC:?\s?|GP:?\s?)?\d\s?\/\s?\d/gi);
            return;
        }

    }

}
