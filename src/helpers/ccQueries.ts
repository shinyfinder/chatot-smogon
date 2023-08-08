import { pool, sqlPool } from './createPool.js';
import { ICCCooldown, ICCData, ICCStatus, IXFParsedThreadData, IXFStatusQuery } from '../types/cc';
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

        alert_chans AS
        (SELECT serverid, channelid, tier, role, gen, stage, cooldown FROM chatot.ccprefs)

        SELECT json_build_object(
            'threads', (SELECT COALESCE(JSON_AGG(cc_status.*), '[]') FROM cc_status),
            'alertchans', (SELECT COALESCE(JSON_AGG(alert_chans.*), '[]') FROM alert_chans)
        ) AS data`);
    
    // unpack and update cache
    const oldData = oldDataPG.rows.map((row: { data: ICCData }) => row.data)[0];
    return oldData;
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
 * IN returns only the nodes we care about, making use of indexes
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

/**
 * Polls the chatot.cooldown database to see if the QC alert is on cooldown
 * @returns Array of cooldown objects
 */
export async function getCCAlertCooldowns() {
    const cdPG = await pool.query('SELECT channelid, identifier, date FROM chatot.cooldown');
    const cds: ICCCooldown[] | [] = cdPG.rows;
    return cds;
}


export async function updateCCAlertCooldowns(chanid: string, id: string) {
    await pool.query('INSERT INTO chatot.cooldown (channelid, identifier) VALUES ($1, $2) ON CONFLICT (channelid, identifier) DO UPDATE SET channelid=EXCLUDED.channelid, identifier=EXCLUDED.identifier', [chanid, id]);
    return;
}