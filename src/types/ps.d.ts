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
        isZ?: string,
        [key: string]: unknown,
    }
}

export interface IPSMoveText {
    [key: string]: {
        name: string,
        desc: string,
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
        fling?: { basePower: number, status?: string },
        naturalGift?: { basePower: number, type: string },
        [key: string]: unknown,
    }
}

export interface IPSItemText {
    [key: string]: {
        name: string,
        desc: string,
        [key: string]: unknown,
    }
}

export interface IPSAbilityText {
    [key: string]: {
        name: string,
        desc?: string,
        shortDesc?: string,
        [key: string]: unknown,
    }
}

export interface IPSNatures {
    [key: string]: {
        name: string,
        plus?: string,
        minus?: string,
    }
}