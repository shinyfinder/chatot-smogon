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
    'PiC',
    'Inh',
];

export const allowedMetasObj = allowedMetas.map(meta => ({ name: meta, value: meta.toLowerCase() }));

/**
 * Time interval for checking for new C&C threads (sec)
 */
export const ccTimeInterval = 15;

/**
 * List of subforums containing analyses
 */

export const ccSubObj: { [key: string] : { gens : string[], tiers: string[], url: string } } = {
    '758' : {
        gens: ['9'],
        tiers: ['ou'],
        url: 'https://www.smogon.com/forums/forums/ou-analyses.758/',
    },
    '538' : {
        gens: ['8'],
        tiers: ['ou'],
        url: 'https://www.smogon.com/forums/forums/ou-analyses.538/',
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
        gens: ['9'],
        tiers: ['natdex ou', 'natdex ag'],
        url: 'https://www.smogon.com/forums/forums/national-dex-analyses.765/',
    },
    '828' : {
        gens: ['9'],
        tiers: ['natdex mono'],
        url: 'https://www.smogon.com/forums/forums/natdex-mono-analyses.828/',
    },
    '839' : {
        gens: ['9'],
        tiers: ['natdex uu'],
        url: 'https://www.smogon.com/forums/forums/natdex-uu-analyses.839/',
    },
    '768' : {
        gens: ['1', '2', '3', '4', '5', '6', '7', '9'],
        tiers: ['cap'],
        url: 'https://www.smogon.com/forums/forums/cap-analyses.768/',
    },
    '555' : {
        gens: ['8'],
        tiers: ['cap'],
        url: 'https://www.smogon.com/forums/forums/cap-analyses.555/',
    },
    '766' : {
        gens: ['9'],
        tiers: ['bss'],
        url: 'https://www.smogon.com/forums/forums/battle-stadium-analyses.766/',
    },
    '543' : {
        gens: ['8'],
        tiers: ['bss'],
        url: 'https://www.smogon.com/forums/forums/battle-stadium-analyses.543/',
    },
    '767' : {
        gens: ['9'],
        tiers: ['vgc'],
        url: 'https://www.smogon.com/forums/forums/vgc-analyses.767/',
    },
    '148' : {
        gens: ['1', '2', '3', '4', '5', '6', '7'],
        tiers: ['ou'],
        url: 'https://www.smogon.com/forums/forums/past-generation-analyses.148/',
    },
    '512' : {
        gens: ['1'],
        tiers: ['nu', 'pu', 'stadium ou', 'tradebacks ou', 'uu', 'ubers'],
        url: 'https://www.smogon.com/forums/forums/rby-other-tier-analyses.512/',
    },
    '608' : {
        gens: ['7'],
        tiers: ['lgpe ou'],
        url: 'https://www.smogon.com/forums/forums/pokemon-lets-go-analyses.608/',
    },
    '707' : {
        gens: ['8'],
        tiers: ['bdsp ou'],
        url: 'https://www.smogon.com/forums/forums/bdsp-ou-analyses.707/',
    },
};


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
    'BDSP OU',
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

// lockout functions to prevent concurrency issues
export const lockout: { [key: string]: boolean } = {
    'cc': false,
    'ca': false,
};


/**
 * Thread Prefixes
 */
export const OMPrefix = ['NFE', 'AAA', '2v2', 'GG', 'AG', 'BH', 'M&M', 'STAB', 'ZU', 'PH'];
export const pastGenPrefix = ['Gen 1', 'Gen 2', 'Gen 3', 'Gen 4', 'Gen 5', 'Gen 6', 'Gen 7', 'Gen 8'];
export const rbyOtherPrefix = ['NU', 'PU', 'Stadium OU', 'Tradebacks OU', 'UU', 'Ubers'];

/**
 * Gens
 */
// create a map of gen numbers to abbreviations
export const gens: {[key: string]: string} = {
    'sv': '9',
    '9': '9',
    'swsh': '8',
    'ss': '8',
    '8': '8',
    'usum': '7',
    'usm': '7',
    'sm': '7',
    '7': '7',
    'oras': '6',
    'xy': '6',
    '6': '6',
    'b2w2': '5',
    'bw2': '5',
    'bw': '5',
    '5': '5',
    'hgss': '4',
    'dpp': '4',
    'dp': '4',
    '4': '4',
    'rse': '3',
    'rs': '3',
    'adv': '3',
    '3': '3',
    'gsc': '2',
    'gs': '2',
    '2': '2',
    'rby': '1',
    'rb': '1',
    '1': '1',
};

/**
 * CUSTOM AVATAR SUBS
 * Array of subforum ids
 */
export const caSubs = [845];

/**
 * Time interval for checking for new CA threads (sec)
 */
export const caTimeInterval = 15;


/**
 * Alcremie formes
 */
export const alcremieFormes = [
    'alcremie-ruby-swirl-flower',
    'alcremie-rainbow-swirl',
    'alcremie-mint-cream',
    'alcremie-caramel-swirl-love',
    'alcremie-salted-cream-clover',
    'alcremie-ruby-cream-clover',
    'alcremie-rainbow-swirl-berry',
    'alcremie-rainbow-swirl-clover',
    'alcremie-vanilla-cream-berry',
    'alcremie-ruby-cream-ribbon',
    'alcremie-caramel-swirl-flower',
    'alcremie-ruby-cream-love',
    'alcremie-matcha-cream-flower',
    'alcremie-ruby-swirl-ribbon',
    'alcremie-matcha-cream-love',
    'alcremie-vanilla-cream-ribbon',
    'alcremie-lemon-cream',
    'alcremie-rainbow-swirl-love',
    'alcremie-mint-cream-flower',
    'alcremie-mint-cream-star',
    'alcremie-rainbow-swirl-ribbon',
    'alcremie-ruby-swirl-clover',
    'alcremie-salted-cream-star',
    'alcremie-lemon-cream-berry',
    'alcremie-ruby-cream-berry',
    'alcremie-lemon-cream-flower',
    'alcremie-matcha-cream-star',
    'alcremie-caramel-swirl-star',
    'alcremie-ruby-cream-star',
    'alcremie-salted-cream-flower',
    'alcremie-ruby-cream',
    'alcremie-lemon-cream-star',
    'alcremie-mint-cream-berry',
    'alcremie-matcha-cream-berry',
    'alcremie-matcha-cream-ribbon',
    'alcremie-ruby-swirl-berry',
    'alcremie-lemon-cream-love',
    'alcremie-salted-cream-ribbon',
    'alcremie-salted-cream',
    'alcremie-salted-cream-love',
    'alcremie-mint-cream-ribbon',
    'alcremie-vanilla-cream-star',
    'alcremie-caramel-swirl',
    'alcremie',
    'alcremie-vanilla-cream-flower',
    'alcremie-ruby-swirl-star',
    'alcremie-caramel-swirl-clover',
    'alcremie-vanilla-cream-love',
    'alcremie-matcha-cream-clover',
    'alcremie-ruby-swirl',
    'alcremie-matcha-cream',
    'alcremie-salted-cream-berry',
    'alcremie-ruby-swirl-love',
    'alcremie-lemon-cream-clover',
    'alcremie-caramel-swirl-ribbon',
    'alcremie-mint-cream-love',
    'alcremie-gmax',
    'alcremie-vanilla-cream-clover',
    'alcremie-lemon-cream-ribbon',
    'alcremie-caramel-swirl-berry',
    'alcremie-rainbow-swirl-star',
    'alcremie-ruby-cream-flower',
    'alcremie-mint-cream-clover',
    'alcremie-rainbow-swirl-flower',    
];

/**
 * Mons with gender differences
 */
export const genderDiffs = [
    'wobbuffet-f',
    'indeedee-f',
    'relicanth-f',
    'dustox-f',
    'eevee-starter-f',
    'wooper-f',
    'shiftry-f',
    'ursaring-f',
    'vileplume-f',
    'doduo-f',
    'hypno-f',
    'toxicroak-f',
    'sudowoodo-f',
    'rhyperior-f',
    'starly-f',
    'combusken-f',
    'steelix-f',
    'golbat-f',
    'venusaur-f',
    'unfezant-f',
    'oinkologne-f',
    'mamoswine-f',
    'girafarig-f',
    'gyarados-f',
    'gligar-f',
    'hippopotas-f',
    'ledian-f',
    'roserade-f',
    'milotic-f',
    'heracross-f',
    'bidoof-f',
    'weavile-f',
    'basculegion-f',
    'ledyba-f',
    'staraptor-f',
    'garchomp-f',
    'combee-f',
    'raichu-f',
    'sneasel-hisui-f',
    'roselia-f',
    'pachirisu-f',
    'unown-f',
    'jellicent-f',
    'pikachu-starter-f',
    'rhyhorn-f',
    'octillery-f',
    'donphan-f',
    'xatu-f',
    'piloswine-f',
    'murkrow-f',
    'blaziken-f',
    'ambipom-f',
    'luxray-f',
    'luxio-f',
    'zubat-f',
    'scyther-f',
    'staravia-f',
    'butterfree-f',
    'swalot-f',
    'ludicolo-f',
    'rhydon-f',
    'pikachu-f',
    'meganium-f',
    'frillish-f',
    'gible-f',
    'meditite-f',
    'dodrio-f',
    'floatzel-f',
    'hippowdon-f',
    'meowstic-f',
    'lumineon-f',
    'croagunk-f',
    'kricketot-f',
    'rattata-f',
    'nuzleaf-f',
    'cacturne-f',
    'kadabra-f',
    'quagsire-f',
    'alakazam-f',
    'snover-f',
    'beautifly-f',
    'camerupt-f',
    'torchic-f',
    'bibarel-f',
    'seaking-f',
    'goldeen-f',
    'nidoran-f',
    'numel-f',
    'tangrowth-f',
    'eevee-f',
    'politoed-f',
    'buizel-f',
    'finneon-f',
    'houndoom-f',
    'kricketune-f',
    'gabite-f',
    'scizor-f',
    'medicham-f',
    'pyroar-f',
    'raticate-f',
    'shinx-f',
    'gloom-f',
    'magikarp-f',
    'aipom-f',
    'sneasel-f',
    'abomasnow-f',
    'gulpin-f',
];