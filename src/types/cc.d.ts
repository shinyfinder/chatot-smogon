export interface IXFStatusQuery {
    thread_id: number,
    node_id: number,
    title: string,
    phrase_text: string | null,
}

export interface IParsedThreadData {
    thread_id: number,
    node_id: number,
    title: string,
    phrase_text: string | null,
    gen: string[],
    tier: string[],
    stage: string,
    progress: string,
}

export interface IAlertChans {
    serverid: string,
    channelid: string,
    tier: string,
    role: string | undefined | null,
    gen: string
}

export interface ICCData {
    threads: { thread_id: number, stage: string, progress: string }[],
    lastcheck: string | null,
    alertchans: IAlertChans[],
}