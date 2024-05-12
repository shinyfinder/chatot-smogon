import { Colors } from 'discord.js';
/**
 * This is a placeholder file to export various constants needed for mutiple files
 * If you need a place to import a variable from, it could go here rather than making a new file
 */


/**
 * INTERVALS
 * times should be in ms, up to a max value of 2,147,483,647 (~24.8 days)
 */

export const ccTimeInterval = 15 * 1000;
export const cacheInterval = 30 * 60 * 1000;
export const caTimeInterval = 15 * 1000;
export const garbageInterval = 2 * 24 * 60 * 60 * 1000;

/**
 * Gens
 */

// list of aliases for the gen abbreivations
// we dont need the numbers because we can get those from the db
// case doesn't matter, but the keys should be the aliases used by the dex
// if no custom alias, either leave off or use empty set for the value
export const genAliases: { [key: string]: string[] } = {
    'RB': ['RBY'],
    'GS': ['GSC'],
    'RS': ['RSE', 'ADV'],
    'DP': ['DPP', 'HGSS'],
    'BW': ['BW2', 'B2W2'],
    'XY': ['ORAS'],
    'SM': ['USM', 'USUM'],
    'SS': ['SWSH'],
    'SV': [],
};

/**
 * CUSTOM AVATAR SUBS
 * Array of subforum ids
 */
export const caSubs = [845];

/**
 * COSMETIC FORMES
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


/**
 * CUSTOM COLORS
 */
const customColors = {
    Brown: 0x964B00,
    Pink: 0xFFC0CB,
    Gray: Colors.Grey,
    Normal: 0xada594,
    Fighting: 0xa55239,
    Flying: 0x9cadf7,
    Poison: 0xb55aa5,
    Ground: 0xd6b55a,
    Rock: 0xbda55a,
    Bug: 0xadbd21,
    Ghost: 0x6363b5,
    Steel: 0xadadc6,
    Fire: 0xf75231,
    Water: 0x399cff,
    Grass: 0x7bce52,
    Electric: 0xffc631,
    Psychic: 0xff73a5,
    Ice: 0x5acee7,
    Dragon: 0x7b63e7,
    Dark: 0x735a4a,
    Fairy: 0xff65d5,
};

export const myColors = { ...Colors, ...customColors };


/**
 * FLAGS
 */

// lockout functions to prevent concurrency issues
export const lockout: { [key: string]: boolean } = {
    'cc': false,
    'ca': false,
};
// flag to signal successful startup
export const startupFlags: {success: boolean } = { success: false };

export enum ServerClass {
    OptOut = 0,
    OptIn = 1,
    Official = 2,
}