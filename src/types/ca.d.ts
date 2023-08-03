export interface ICAStatus {
    thread_id: number,
    phrase_text: string,
}

export interface IXFCAStatus {
    thread_id: number,
    node_id: number,
    title: string,
    phrase_text: string | null,
    data_id: number | null,
    filename: string | null,
    file_hash: string | null,
}