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

export const ccSubObj: { [key: string] : { gens : string[], tiers: string[], url: string } } = {
    '758' : {
        gens: ['9', 'any'],
        tiers: ['ou'],
        url: 'https://www.smogon.com/forums/forums/ou-analyses.758/',
    },
    '759' : {
        gens: ['9'],
        tiers: ['ubers'],
        url: 'https://www.smogon.com/forums/forums/ubers-analyses.759/',
    },
    '539' : {
        gens: ['1', '2', '3', '4', '5', '6', '7', '8'],
        tiers: ['ubers'],
        url: 'https://www.smogon.com/forums/forums/past-generation-ubers-analyses.539/',
    },
    '772' : {
        gens: ['9'],
        tiers: ['uu'],
        url: 'https://www.smogon.com/forums/forums/uu-analyses.772/',
    },
    '576' : {
        gens: ['1', '2', '3', '4', '5', '6', '7', '8'],
        tiers: ['uu'],
        url: 'https://www.smogon.com/forums/forums/past-generation-uu-analyses.576/',
    },
    '774' : {
        gens: ['9'],
        tiers: ['nu'],
        url: 'https://www.smogon.com/forums/forums/nu-analyses.774/',
    },
    '587' : {
        gens: ['1', '2', '3', '4', '5', '6', '7', '8'],
        tiers: ['nu'],
        url: 'https://www.smogon.com/forums/forums/past-generation-nu-analyses.587/',
    },
    '775' : {
        gens: ['9'],
        tiers: ['pu'],
        url: 'https://www.smogon.com/forums/forums/pu-analyses.775/',
    },
    '844' : {
        gens: ['1', '2', '3', '4', '5', '6', '7', '8'],
        tiers: ['pu'],
        url: 'https://www.smogon.com/forums/forums/past-generation-pu-analyses.844/',
    },
    '760' : {
        gens: ['9'],
        tiers: ['lc'],
        url: 'https://www.smogon.com/forums/forums/lc-analyses.760/',
    },
    '540' : {
        gens: ['1', '2', '3', '4', '5', '6', '7', '8'],
        tiers: ['lc'],
        url: 'https://www.smogon.com/forums/forums/past-generation-lc-analyses.540/',
    },
    '761' : {
        gens: ['9'],
        tiers: ['dou'],
        url: 'https://www.smogon.com/forums/forums/doubles-ou-analyses.761/',
    },
    '541' : {
        gens: ['1', '2', '3', '4', '5', '6', '7', '8'],
        tiers: ['dou'],
        url: 'https://www.smogon.com/forums/forums/past-gen-doubles-ou-analyses.541/',
    },
    '762' : {
        gens: ['9'],
        tiers: ['mono'],
        url: 'https://www.smogon.com/forums/forums/monotype-analyses.762/',
    },
    '660' : {
        gens: ['1', '2', '3', '4', '5', '6', '7', '8'],
        tiers: ['mono'],
        url: 'https://www.smogon.com/forums/forums/past-generation-monotype-analyses.660/',
    },
    '763' : {
        gens: ['9'],
        tiers: ['nfe', 'aaa', '2v2', 'gg', 'ag', 'bg', 'm&m', 'stab', 'zu'],
        url: 'https://www.smogon.com/forums/forums/om-analyses.763/',
    },
    '770' : {
        gens: ['1', '2', '3', '4', '5', '6', '7', '8'],
        tiers: ['nfe', 'aaa', '2v2', 'gg', 'ag', 'bg', 'm&m', 'stab', 'zu'],
        url: 'https://www.smogon.com/forums/forums/past-generation-om-analyses.770/',
    },
    '764' : {
        gens: ['9'],
        tiers: ['1v1'],
        url: 'https://www.smogon.com/forums/forums/1v1-analyses.764/',
    },
    '476' : {
        gens: ['1', '2', '3', '4', '5', '6', '7', '8'],
        tiers: ['1v1'],
        url: 'https://www.smogon.com/forums/forums/past-generation-1v1-analyses.476/',
    },
    '765' : {
        gens: ['1', '2', '3', '4', '5', '6', '7', '8', '9'],
        tiers: ['natdex ou', 'natdex ag'],
        url: 'https://www.smogon.com/forums/forums/national-dex-analyses.765/',
    },
    '828' : {
        gens: ['1', '2', '3', '4', '5', '6', '7', '8', '9'],
        tiers: ['natdex mono'],
        url: 'https://www.smogon.com/forums/forums/natdex-mono-analyses.828/',
    },
    '839' : {
        gens: ['1', '2', '3', '4', '5', '6', '7', '8', '9'],
        tiers: ['natdex uu'],
        url: 'https://www.smogon.com/forums/forums/natdex-uu-analyses.839/',
    },
    '768' : {
        gens: ['1', '2', '3', '4', '5', '6', '7', '8', '9'],
        tiers: ['cap'],
        url: 'https://www.smogon.com/forums/forums/cap-analyses.768/',
    },
    '766' : {
        gens: ['1', '2', '3', '4', '5', '6', '7', '8', '9'],
        tiers: ['bss'],
        url: 'https://www.smogon.com/forums/forums/battle-stadium-analyses.766/',
    },
    '767' : {
        gens: ['1', '2', '3', '4', '5', '6', '7', '8', '9'],
        tiers: ['vgc'],
        url: 'https://www.smogon.com/forums/forums/vgc-analyses.767/',
    },
    '148' : {
        gens: ['1', '2', '3', '4', '5', '6', '7', '8'],
        tiers: ['ou'],
        url: 'https://www.smogon.com/forums/forums/past-generation-analyses.148/',
    },
    '512' : {
        gens: ['1'],
        tiers: ['nu', 'pu', 'stadium ou', 'tradebacks ou', 'uu', 'ubers'],
        url: 'https://www.smogon.com/forums/forums/rby-other-tier-analyses.512/',
    },
    '608' : {
        gens: ['1', '2', '3', '4', '5', '6', '7', '8', '9'],
        tiers: ['lgpe ou'],
        url: 'https://www.smogon.com/forums/forums/pokemon-lets-go-analyses.608/',
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

/*
const ccSubMetaMap: { [key: string] : { gens : string[], tiers: string[], url: string } } = {};
for (const [key, val] of Object.entries(ccSubObj)) {
    const regexMatch = key.match(/^(?:https?:\/\/)?(?:www\.)?smogon\.com\/forums\/forums\/(?:(.*?)\.)?(\d+)\/?$/);
    if (regexMatch !== null) {
        const id = regexMatch[regexMatch.length - 1];
        ccSubMetaMap[id] = { ...val, url: key };
    }
}

export { ccSubMetaMap };
*/

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

export const ccMetaObj = ccIntegrationMeta.map(meta => ({ name: meta, value: meta.toLowerCase() }));