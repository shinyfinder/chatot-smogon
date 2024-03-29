import { Modes, botConfig } from '../config.js';

/**
 * Validates the input when adding/removing team raters
 * Also maps the meta and provided gen to a number and channel
 * Function should be awaited.
 * @param meta - Metagame the user rates teams for
 * @returns Arr - Returns the meta in expected case and relevant RMT channel
 */
export function mapRMTMeta(meta: string, genIn: string) {
    // map the meta to the channel
    let channel = '';
    let metaOut = '';
    if (botConfig.MODE === Modes.Dev) {
        channel = '1060628096442708068';
        metaOut = 'NU';
    }
    else {
        switch (meta) {
            case 'lgpe ou':
                channel = '1060339824537641152';
                metaOut = 'LGPE OU';
                break;
            case 'bdsp ou':
                channel = '1060339824537641152';
                metaOut = 'BDSP OU';
                break;
            case 'ou':
                if (genIn === 'SV') {
                    channel = '1059653209678950460';
                    metaOut = 'OU';
                    break;
                }
                // old gens ou
                else {
                    channel = '1060339824537641152';
                    metaOut = 'OU';
                    break;
                }
            case 'ubers':
                channel = '1059901370477576272';
                metaOut = 'Ubers';
                break;
            case 'dou':
                channel = '1059655497587888158';
                metaOut = 'DOU';
                break;
            case 'uu':
                channel = '1059743348728004678';
                metaOut = 'UU';
                break;
            case 'lc':
                channel = '1061135027599048746';
                metaOut = 'LC';
                break;
            case 'ru':
                channel = '1061135917160607766';
                metaOut = 'RU';
                break;
            case 'nu':
                channel = '1061136091056439386';
                metaOut = 'NU';
                break;
            case 'pu':
                channel = '1061136198208344084';
                metaOut = 'PU';
                break;
            case 'mono':
                channel = '1059658237097545758';
                metaOut = 'Mono';
                break;
            case 'natdex ou':
                channel = '1059714627384115290';
                metaOut = 'NatDex OU';
                break;
            case 'natdex uu':
                channel = '1060037469472555028';
                metaOut = 'NatDex UU';
                break;
            case 'natdex ag':
                channel = '1060037469472555028';
                metaOut = 'NatDex AG';
                break;
            case 'natdex mono':
                channel = '1060037469472555028';
                metaOut = 'NatDex Mono';
                break;
            case '1v1':
                channel = '1089349311080439882';
                metaOut = '1v1';
                break;
            case 'ag':
                channel = '1060682013453078711';
                metaOut = 'AG';
                break;
            case 'cap':
                channel = '1059708679814918154';
                metaOut = 'CAP';
                break;
            case 'general om':
                channel = '1059657287293222912';
                metaOut = 'General OM';
                break;
            case '2v2':
                channel = '1059657287293222912';
                metaOut = '2v2';
                break;
            case 'om mashup':
                channel = '1059657287293222912';
                metaOut = 'OM Mashup';
                break;
            case 'bh':
                channel = '1059657287293222912';
                metaOut = 'BH';
                break;
            case 'mnm':
                channel = '1059657287293222912';
                metaOut = 'MnM';
                break;
            case 'stabmons':
                channel = '1059657287293222912';
                metaOut = 'STABmons';
                break;
            case 'aaa':
                channel = '1059657287293222912';
                metaOut = 'AAA';
                break;
            case 'gg':
                channel = '1059657287293222912';
                metaOut = 'GG';
                break;
            case 'nfe':
                channel = '1059657287293222912';
                metaOut = 'NFE';
                break;
            case 'vgc':
                channel = '1059704283072831499';
                metaOut = 'VGC';
                break;
            case 'bss':
                channel = '1060690402711183370';
                metaOut = 'BSS';
                break;
            case 'ph':
                channel = '1059657287293222912';
                metaOut = 'PH';
                break;
            case 'pic':
                channel = '1059657287293222912';
                metaOut = 'PiC';
                break;
            case 'inh':
                channel = '1059657287293222912';
                metaOut = 'Inh';
                break;
            default:
                return ['', ''];
        }
    }
    

    return [metaOut, channel];
}