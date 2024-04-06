export interface IPokedexDB {
    name: string,
    alias: string,
    gen_id: string,
    isnonstandard: string,
}

interface IPokedexNames {
    name: string,
    alias: string,
}

interface IItemsDB {
    name: string,
    alias: string,
}

interface IAbilitiesDB {
    name: string,
    alias: string,
}

interface IMovesDB {
    name: string,
    alias: string,
}

interface INaturesDB {
    name: string,
    alias: string,
}

interface ITypesDB {
    name: string,
    alias: string,
    description: string,
}

interface IFormatsDB {
    shorthand: string,
    alias: string,
    psname: string,
}

export interface IGensDB {
    shorthand: string,
    alias: string,
    order: number,
}

export interface IDexNameDump {
    pokemon: IPokedexDB[],
    items: IItemsDB[],
    abilities: IAbilitiesDB[],
    moves: IMovesDB[],
    natures: INaturesDB[],
    types: ITypesDB[],
    formats: IFormatsDB[],
    gens: IGensDB[],
}

export interface IDtNameDump {
    pokemon: IPokedexDB[],
    items: IItemsDB[],
    abilities: IAbilitiesDB[],
    moves: IMovesDB[],
    natures: INaturesDB[],
    types: ITypesDB[],
    formats: IFormatsDB[],
}

export interface IChatotAssetHash {
    commit: {
        sha: string,
    }
}