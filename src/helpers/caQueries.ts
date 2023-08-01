import { pool, sqlPool } from './createPool.js';


/**
 * File containing db queries relating to C&C integration
 */


/**
 * Retrieves the cc status, last check timestamp, and cc log chans
 * @returns JSON object containing the query results
 */
export async function loadCAStatus() {
    // poll the db
    const oldCAPG = await pool.query('SELECT thread_id, stage FROM chatot.ccprefs');
    
    // unpack and update cache
    const oldCAStatus = oldCAPG.rows.map((row: { data: ICCData }) => row.data)[0];
    return oldCAStatus;
}


/**
 * Manages the database of current thread C&C stages
 * @param data Thread information parsed for C&C status and progress
 * @param prune Boolean whether to remove the row from the database
 */
export async function updateCCCache(data: IXFParsedThreadData[] | ICCStatus[], prune = false) {
    // delete the row so we don't clog up the db
    if (prune) {
        const ids = data.map(d => d.thread_id);
        await pool.query('DELETE FROM chatot.ccstatus WHERE thread_id = ANY($1)', [ids]);
    }
    // otherwise, upsert the row with the new values
    else {
        const ids = data.map(d => d.thread_id);
        const stages = data.map(d => d.stage);
        const progresses = data.map(d => d.progress);

        await pool.query(`
        INSERT INTO chatot.ccstatus (thread_id, stage, progress)
        VALUES (UNNEST($1::integer[]), UNNEST($2::text[]), UNNEST($3::text[]))
        ON CONFLICT (thread_id)
        DO UPDATE SET stage=EXCLUDED.stage, progress=EXCLUDED.progress`, [ids, stages, progresses]);
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
 * @returns Array of objects containing thread info (thread id, node id, title, prefix)
 */
export async function pollCCForums() {
    // extract the subforum ids
    const nodeIds = Object.keys(ccSubObj);
    
    // if there are no subforums to monitor, just return
    // this should never be the case
    if (!nodeIds.length) {
        return [];
    }

    const [newThreads] = await sqlPool.execute(`
    SELECT thread_id, node_id, xenforo.xf_thread.title, phrase_text
    FROM xenforo.xf_thread
    LEFT JOIN xenforo.xf_phrase
    ON xenforo.xf_phrase.title = CONCAT('thread_prefix.', prefix_id)
    WHERE node_id IN ("${nodeIds.join('", "')}")`);

    // cast to meaningful array
    const threadData = newThreads as IXFStatusQuery[] | [];

    return threadData;

}