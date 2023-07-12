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
    'PH',
];

export const allowedMetasObj = allowedMetas.map(meta => ({ name: meta, value: meta.toLowerCase() }));

/**
 * Time interval for checking for new C&C threads (ms)
 */
export const ccTimeInterval = 15 * 1000;

/**
 * List of subforums containing analyses
 */
const ccSubs = [
    'https://www.smogon.com/forums/forums/wi-fi.1/',
    'https://www.smogon.com/forums/forums/wi-fi.2/',
    'https://www.smogon.com/forums/forums/ou-analyses.758/',
    
];

const ccSubObj: { [key: string] : { [key: string ] : string[] } } = {
    'https://www.smogon.com/forums/forums/ou-analyses.758/' : {
        gens: ['9', 'any'],
        tiers: ['ou'],
    },
    'https://www.smogon.com/forums/forums/ubers-analyses.759/' : {
        gens: ['9'],
        tiers: ['ubers'],
    },
    'https://www.smogon.com/forums/forums/past-generation-ubers-analyses.539/' : {
        gens: ['1', '2', '3', '4', '5', '6', '7', '8'],
        tiers: ['ubers'],
    },
    'https://www.smogon.com/forums/forums/uu-analyses.772/' : {
        gens: ['9'],
        tiers: ['uu'],
    },
    'https://www.smogon.com/forums/forums/past-generation-uu-analyses.576/' : {
        gens: ['1', '2', '3', '4', '5', '6', '7', '8'],
        tiers: ['uu'],
    },
    'https://www.smogon.com/forums/forums/nu-analyses.774/' : {
        gens: ['9'],
        tiers: ['nu'],
    },
    'https://www.smogon.com/forums/forums/past-generation-nu-analyses.587/' : {
        gens: ['1', '2', '3', '4', '5', '6', '7', '8'],
        tiers: ['nu'],
    },
    'https://www.smogon.com/forums/forums/pu-analyses.775/' : {
        gens: ['9'],
        tiers: ['pu'],
    },
    'https://www.smogon.com/forums/forums/past-generation-pu-analyses.844/' : {
        gens: ['1', '2', '3', '4', '5', '6', '7', '8'],
        tiers: ['pu'],
    },
    'https://www.smogon.com/forums/forums/lc-analyses.760/' : {
        gens: ['9'],
        tiers: ['lc'],
    },
    'https://www.smogon.com/forums/forums/past-generation-lc-analyses.540/' : {
        gens: ['1', '2', '3', '4', '5', '6', '7', '8'],
        tiers: ['lc'],
    },
    'https://www.smogon.com/forums/forums/doubles-ou-analyses.761/' : {
        gens: ['9'],
        tiers: ['dou'],
    },
    'https://www.smogon.com/forums/forums/past-gen-doubles-ou-analyses.541/' : {
        gens: ['1', '2', '3', '4', '5', '6', '7', '8'],
        tiers: ['dou'],
    },
    'https://www.smogon.com/forums/forums/monotype-analyses.762/' : {
        gens: ['9'],
        tiers: ['mono'],
    },
    'https://www.smogon.com/forums/forums/past-generation-monotype-analyses.660/' : {
        gens: ['1', '2', '3', '4', '5', '6', '7', '8'],
        tiers: ['mono'],
    },
    'https://www.smogon.com/forums/forums/om-analyses.763/' : {
        gens: ['9'],
        tiers: ['nfe', 'aaa', '2v2', 'gg', 'ag', 'bg', 'm&m', 'stab', 'zu'],
    },
    'https://www.smogon.com/forums/forums/past-generation-om-analyses.770/' : {
        gens: ['1', '2', '3', '4', '5', '6', '7', '8'],
        tiers: ['nfe', 'aaa', '2v2', 'gg', 'ag', 'bg', 'm&m', 'stab', 'zu'],
    },
    'https://www.smogon.com/forums/forums/1v1-analyses.764/' : {
        gens: ['9'],
        tiers: ['1v1'],
    },
    'https://www.smogon.com/forums/forums/past-generation-1v1-analyses.476/' : {
        gens: ['1', '2', '3', '4', '5', '6', '7', '8'],
        tiers: ['1v1'],
    },
    'https://www.smogon.com/forums/forums/national-dex-analyses.765/' : {
        gens: ['1', '2', '3', '4', '5', '6', '7', '8', '9'],
        tiers: ['natdex ou', 'natdex ag'],
    },
    'https://www.smogon.com/forums/forums/natdex-mono-analyses.828/' : {
        gens: ['1', '2', '3', '4', '5', '6', '7', '8', '9'],
        tiers: ['natdex mono'],
    },
    'https://www.smogon.com/forums/forums/natdex-uu-analyses.839/' : {
        gens: ['1', '2', '3', '4', '5', '6', '7', '8', '9'],
        tiers: ['natdex uu'],
    },
    'https://www.smogon.com/forums/forums/cap-analyses.768/' : {
        gens: ['1', '2', '3', '4', '5', '6', '7', '8', '9'],
        tiers: ['cap'],
    },
    'https://www.smogon.com/forums/forums/battle-stadium-analyses.766/' : {
        gens: ['1', '2', '3', '4', '5', '6', '7', '8', '9'],
        tiers: ['bss'],
    },
    'https://www.smogon.com/forums/forums/vgc-analyses.767/' : {
        gens: ['1', '2', '3', '4', '5', '6', '7', '8', '9'],
        tiers: ['vgc'],
    },
    'https://www.smogon.com/forums/forums/past-generation-analyses.148/' : {
        gens: ['1', '2', '3', '4', '5', '6', '7', '8'],
        tiers: ['ou'],
    },
    'https://www.smogon.com/forums/forums/rby-other-tier-analyses.512/' : {
        gens: ['1'],
        tiers: ['nu', 'pu', 'stadium ou', 'tradebacks ou', 'uu', 'ubers'],
    },
    'https://www.smogon.com/forums/forums/pokemon-lets-go-analyses.608/' : {
        gens: ['1', '2', '3', '4', '5', '6', '7', '8', '9'],
        tiers: ['lgpe ou'],
    },
};

// extract and export the subforum ids
export const ccSubIDs: string[] = ccSubs.map(sub => {
    const regexMatch = sub.match(/^(?:https?:\/\/)?(?:www\.)?smogon\.com\/forums\/forums\/(?:(.*?)\.)?(\d+)\/?$/);
    if (regexMatch !== null) {
        const id = regexMatch[regexMatch.length - 1];
        return id;
    }
    else {
        return '';
    }
});


/**
 * List of supported metas for C&C integration
 * This is mostly the same as the rmt system, plus a few extras based on the thread prefixes
 */
const ccIntegrationMeta = [
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
    '2v2',
    'BH',
    'M&M',
    'STABmons',
    'AAA',
    'GG',
    'NFE',
    'VGC',
    'BSS',
    'PH',
    'Stadium OU',
    'Tradebacks OU',
    'STAB',
    'ZU',
    'All',
];

export const ccIntObj = ccIntegrationMeta.map(meta => ({ name: meta, value: meta.toLowerCase() }));