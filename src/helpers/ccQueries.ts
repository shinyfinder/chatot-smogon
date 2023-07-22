import { pool, sqlPool } from './createPool.js';
import { ICCData, IParsedThreadData, IXFStatusQuery } from '../types/cc';
import { ccSubObj } from './constants.js';

/**
 * File containing db queries relating to C&C integration
 */


/**
 * Retrieves the cc status, last check timestamp, and cc log chans
 * @returns JSON object containing the query results
 */
export async function loadCCData() {
    // poll the db
    const oldDataPG = await pool.query(`
        WITH cc_status AS
        (SELECT thread_id, stage, progress FROM chatot.ccstatus),

        time_stamp AS
        (SELECT tstamp FROM chatot.lastcheck WHERE topic=$1),

        alert_chans AS
        (SELECT serverid, channelid, tier, role, gen FROM chatot.ccprefs)

        SELECT json_build_object(
            'threads', (SELECT COALESCE(JSON_AGG(cc_status.*), '[]') FROM cc_status),
            'lastcheck', (SELECT * FROM time_stamp),
            'alertchans', (SELECT COALESCE(JSON_AGG(alert_chans.*), '[]') FROM alert_chans)
        ) AS data`, ['c&c']);
    
    // unpack and update cache
    const oldData = oldDataPG.rows.map((row: { data: ICCData }) => row.data)[0];
    return oldData;
}


/**
 * Stores last c&c check timestamp.
 * Times are stored as the timestamptz data type
 * @param now Timestamp in ms since the epoch
 */
export async function updateLastCheck(now: number) {
    // update the db
    await pool.query('INSERT INTO chatot.lastcheck (topic, tstamp) VALUES ($1, to_timestamp($2)) ON CONFLICT (topic) DO UPDATE SET tstamp = to_timestamp($2)', ['c&c', Math.floor(now / 1000)]);
    return;
}

/**
 * Manages the database of current thread C&C stages
 * @param data Thread information parsed for C&C status and progress
 */
export async function updateCCCache(data: IParsedThreadData) {
    // if done, delete the row so we don't clog up the db
    if (data.stage === 'Done') {
        await pool.query('DELETE FROM chatot.ccstatus WHERE thread_id=$1', [data.thread_id]);
    }
    // otherwise, upsert the row with the new values
    else {
        await pool.query('INSERT INTO chatot.ccstatus (thread_id, stage, progress) VALUES ($1, $2, $3) ON CONFLICT (thread_id) DO UPDATE SET stage=$2, progress=$3', [data.thread_id, data.stage, data.progress]);
    }

    return;
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
export async function pollCCForums(lastCheckTime: number, cachedIDArr: number[]) {
    // extract the subforum ids
    const nodeIds = Object.keys(ccSubObj);
    
    // if there are no subforums to monitor, just return
    // this should never be the case
    if (!nodeIds.length) {
        return [];
    }

    // create a guard so that empty set is not passed into the query
    // we dont want to return because there could be a new thread despite there not being anything in the cache
    const cachedIDGuard = cachedIDArr.length ? cachedIDArr : [-1];

    const [newThreads] = await sqlPool.execute(`
    SELECT thread_id, node_id, xenforo.xf_thread.title, phrase_text
    FROM xenforo.xf_thread
    LEFT JOIN xenforo.xf_phrase
    ON xenforo.xf_phrase.title = CONCAT('thread_prefix.', prefix_id)
    WHERE (node_id IN ("${nodeIds.join('", "')}") AND post_date >= ${lastCheckTime})
    OR thread_id IN ("${cachedIDGuard.join('", "')}")`);

    // cast to meaningful array
    const threadData = newThreads as IXFStatusQuery[] | [];

    return threadData;

}