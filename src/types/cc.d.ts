/**
 * Types for C&C integration
 */


/**
 * SQL query result for polling the xf tables for the C&C subforums
 */
export interface IXFStatusQuery {
    thread_id: number,
    node_id: number,
    title: string,
    phrase_text: string | null,
}


/**
 * XF Query result + thread titles parsed for gen/tier/stage/progress
 */
export interface IXFParsedThreadData {
    thread_id: number,
    node_id: number,
    title: string,
    phrase_text: string | null,
    gen: string[],
    tier: string[],
    stage: string,
    progress: string,
}

/**
 * PG query result containing the results from the query on chatot.ccprefs
 */
export interface IAlertChans {
    serverid: string,
    channelid: string,
    tier: string,
    role: string | undefined | null,
    gen: string,
    stage: string,
    cooldown: number | undefined,
    prefix: string | null,
}

/**
 * Query result containing the results from the query on chatot.ccstatus
 */
export interface ICCStatus {
    thread_id: number,
    stage: string,
    progress: string
}

/**
 * Object interface that combines the pg queries into a single json object
 */
export interface ICCData {
    threads: ICCStatus[],
    alertchans: IAlertChans[],
}

/**
 * Interface for the cooldown cache / table query
 */
interface ICCCooldown {
    channelid: string,
    identifier: string,
    date: Date,
}