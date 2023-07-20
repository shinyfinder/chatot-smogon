import { pool } from './createPool.js';

/**
 * Helper file to instantiate the connection to the postgres pool
 */
interface ICCData {
    threads: { thread_id: number, stage: string, progress: string }[] | null,
    lastcheck: string | null,
    alertchans: IAlertChans[] | null,
}

export interface IAlertChans {
    serverid: string,
    channelid: string,
    tier: string,
    role: string | undefined | null,
    gen: string
}

export let oldData: ICCData;

/**
 * Caches the cc status, last check timestamp, and cc log chans so we don't query on every interval
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
            'threads', (SELECT JSON_AGG(cc_status.*) FROM cc_status),
            'lastcheck', (SELECT * FROM time_stamp),
            'alertchans', (SELECT JSON_AGG(alert_chans.*) FROM alert_chans)
        ) AS data`, ['c&c']);
    
    // unpack and update cache
    oldData = oldDataPG.rows.map((row: { data: ICCData }) => row.data)[0];
    return oldData;
}

/**
 * Adds a newly created custom prefix command to the local cache
 * @param newCustom Custom prefix command
 * @returns Custom prefix cache
 */
export function updateCCAlertChans(alertData: IAlertChans[]) {
    // if there isn't anything in the cache, just use the new values
    if (oldData.alertchans === null) {
        oldData.alertchans = alertData;
    }
    // otherwise, upsert the new ones
    else {
        // like the SQL query, remove the channels that were targeted
        // filter out only the entries where the channel isn't the one being targeted (i.e. get all of the other channels)
        // users can only target 1 channel at a time with the config command, so just take the first entry since it'll be the same for all
        const otherChans = oldData.alertchans.filter(row => row.channelid !== alertData[0].channelid);

        // then append the new values
        oldData.alertchans = otherChans.concat(alertData);
    }
    
    return oldData;
}

/**
 * Updates the cache in memory of the timestamp for the last check for C&C updates
 * @param newTime Timestamp in ms since the epoch
 */
function updateCCTimestamp(newTime: number) {
    oldData.lastcheck = new Date(newTime).toString();
    return oldData;
}


/**
 * Manages the cache of the last c&c check timestamp.
 * Times are stored as the timestamptz data type
 * @param now Timestamp in ms since the epoch
 */
export async function updateLastCheck(now: number) {
    // update the db
    await pool.query('INSERT INTO chatot.lastcheck (topic, tstamp) VALUES ($1, to_timestamp($2)) ON CONFLICT (topic) DO UPDATE SET tstamp = to_timestamp($2)', ['c&c', Math.floor(now / 1000)]);

    // update the cache
    updateCCTimestamp(now);
    
    return;
}


/**
 * Uupdates the cache in memory of monitored C&C threads
 * @param id Unique id of the thread
 * @param stage Current C&C stage (WIP, QC, GP, etc)
 * @param progress Current progress within that stage (i.e. 1/2)
 */
export function updateCCThreads(id: number, stage: string, progress: string) {
    // if the stage is done and there's a cache, remove it from the cache
    if (stage === 'Done' && oldData.threads) {
        oldData.threads = oldData.threads.filter(data => data.thread_id !== id);
    }
    // if the stage is done and nothing is cached, then we don't need to do anything
    else if (stage === 'Done' && !oldData.threads) {
        return;
    }
    // if there's a cache and the stage isn't done, then upsert the row
    else if (oldData.threads) {
        // get everything but the element with this thread id
        const otherThreads = oldData.threads.filter(data => data.thread_id !== id);
        // add in the new info
        oldData.threads = otherThreads.concat({
            thread_id: id,
            stage: stage,
            progress: progress,
        });
    }
    else {
        oldData.threads = [{
            thread_id: id,
            stage: stage,
            progress: progress,
        }];
    }

    return;
}
