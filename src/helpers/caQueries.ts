import { ICAStatus, IXFCAStatus } from '../types/ca';
import { pool, sqlPool } from './createPool.js';
import { caSubs } from './constants.js';

/**
 * File containing db queries relating to C&C integration
 */


/**
 * Retrieves the cached info for the CA threads
 * @returns Array containing the thread id and stage (thread prefix)
 */
export async function loadCAStatus() {
    // poll the db
    const oldCAPG = await pool.query('SELECT thread_id, phrase_text FROM chatot.castatus');
    
    // unpack and update cache
    const oldCAStatus: ICAStatus[] | [] = oldCAPG.rows;
    return oldCAStatus;
}


/**
 * Manages the database of current thread C&C stages
 * @param data Thread information parsed for C&C status and progress
 * @param prune Boolean whether to remove the row from the database
 */
export async function updateCACache(data: IXFCAStatus[] | ICAStatus[], prune = false) {
    // delete the row so we don't clog up the db
    if (prune) {
        const ids = data.map(d => d.thread_id);
        await pool.query('DELETE FROM chatot.castatus WHERE thread_id = ANY($1)', [ids]);
    }
    // otherwise, upsert the row with the new values
    else {
        const ids = data.map(d => d.thread_id);
        const stages = data.map(d => d.phrase_text);

        await pool.query(`
        INSERT INTO chatot.castatus (thread_id, phrase_text)
        VALUES (UNNEST($1::integer[]), UNNEST($2::text[]))
        ON CONFLICT (thread_id)
        DO UPDATE SET phrase_text=EXCLUDED.phrase_text`, [ids, stages]);
    }
}


/**
 * Looks for new/updates threads in the relevant C&C subforums
 * 
 * thread_id and node_id are the unique ids of the thread and subforum, respectively
 * prefix_id is the id of the prefix on the thread
 * phrase_text is the words the prefix uses (QC, GP, Done, WIP, etc)
 * data_id is the id assigned to the attachment data
 * filename is the name of the attachment (i.e. image.jpg)
 * file_hash is a XF thing that's used in storing the attachment (and other things)
 * 
 * The data is spread out between 4 tables -- xf_thread, xf_phrase, xf_attachment, and xf_attachment_data
 * phrase_text is stored using the prefix id, with the format 'thread_prefix.PREFIX_ID'
 * IN finds the threads in the subs we care about, taking advantage of indexes
 * 
 * @returns Array of objects containing thread info (thread id, node id, title, prefix, data_id, filename, file_hash)
 */
export async function pollCAForum() {
    
    const [newThreads] = await sqlPool.execute(`
    SELECT thread_id, node_id, xenforo.xf_thread.title, phrase_text, data_id, filename, file_hash
    FROM xenforo.xf_thread
    LEFT JOIN xenforo.xf_phrase
    ON xenforo.xf_phrase.title = CONCAT('thread_prefix.', prefix_id)
    
    LEFT JOIN xenforo.xf_attachment
    ON content_id = first_post_id
    AND content_type = 'post'
    
    LEFT JOIN xenforo.xf_attachment_data
    USING (data_id)
    
    WHERE node_id IN (${caSubs.join(', ')})`);

    // cast to meaningful array
    const threadData = newThreads as IXFCAStatus[] | [];

    return threadData;

}