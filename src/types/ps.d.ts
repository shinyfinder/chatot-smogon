/* eslint-disable no-inline-comments */
export interface IPSDex {
    [key: string]: {
        name: string,
        color: string,
        types: string[],
        abilities: { 0: string, 1?: string, H?: string },
        heightm: number,
        weightkg: number,
        baseStats: { [key: string]: number },
        gender?: string,
        genderRatio?: { M: number, F: number},
        cosmeticFormes?: string[],
        prevo?: string,
        baseSpecies?: string,
        [key: string]: unknown,
    }
}

export interface IPSMoves {
    [key: string]: {
        name: string,
        flags: { [key: string]: 1},
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

export interface IPSItems {
    [key: string]: {
        name: string,
        gen: number,
        fling?: { basePower: number, status?: string, volatileStatus?: string; },
        naturalGift?: { basePower: number, type: string },
        [key: string]: unknown,
    }
}