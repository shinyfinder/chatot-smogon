/**
 * This is a placeholder file to export various constants needed for mutiple files
 * If you need a place to import a variable from, it could go here rather than making a new file
 */

/**
 * List of allowable metas to add/remove/list a team rater for
 */
const allowedMetas = [
    'OU',
    'Ubers',
    'DOU',
    'UU',
    'LC',
    'RU',
    'NU',
    'PU',
    'Mono',
    'NatDex OU',
    'NatDex UU',
    'NatDex AG',
    'NatDex Mono',
    '1v1',
    'AG',
    'CAP',
    'LGPE OU',
    'BDSP OU',
    'General OM',
    '2v2',
    'OM Mashup',
    'BH',
    'MnM',
    'STABmons',
    'AAA',
    'GG',
    'NFE',
    'VGC',
    'BSS',
];

export const allowedMetasObj = allowedMetas.map(meta => ({ name: meta, value: meta.toLowerCase() }));