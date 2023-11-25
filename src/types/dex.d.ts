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

export interface IDexNameDump {
    pokemon: IPokedexDB[],
    items: IItemsDB[],
    abilities: IAbilitiesDB[],
    moves: IMovesDB[],
    natures: INaturesDB[],
    types: ITypesDB[],
}