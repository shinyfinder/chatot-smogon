export interface IPSDex {
    [key: string]: {
        name: string,
        cosmeticFormes?: string[],
        prevo?: string,
        baseSpecies?: string,
        [key: string]: unknown,
    }
}

export interface IPSMoves {
    [key: string]: {
        name: string,
        isZ?: string,
        [key: string]: unknown,
    }
}

export interface IPSLearnsets {
    [key: string]: {
        learnset: {
            [key: string]: string[]
        },
        [key: string]: unknown,
    }
}