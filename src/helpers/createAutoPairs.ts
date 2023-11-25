export const dexDataPairs: { name: string, value: string}[] = [];

export function createAutoPairs(objs: { [key: string]: { name: string, [key: string]: unknown }}[]) {
    for (const obj of objs) {
        for (const [k, v] of Object.entries(obj)) {
            dexDataPairs.push({
                name: v.name,
                value: k,
            });
        }
    }
}