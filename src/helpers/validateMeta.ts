/**
 * Validates the input when adding/removing team raters
 * Function should be awaited.
 * @param meta - Metagame the user rates teams for
 * @returns Arr - Returns whether is a valid/tracked meta and, if valid, relevant channel and gen the rater belongs to. If invalid, return false and list of valid metas
 */
export function validateMeta(meta: string): [boolean, string, string] {
    // check for proper input
    // because there are more than 25 options (the max allowed for the number of options in a slash command), we need to parse them after the fact
    const allowedMetas = [
        'SV OU',
        'SV Ubers',
        'SV DOU',
        'SV UU',
        'SV LC',
        'SV Mono',
        'SV NatDex OU',
        'SV NatDex UU',
        'SV NatDex AG',
        'SV NatDex Mono',
        'SV 1v1',
        'SV AG',
        'SV CAP',
        'SS OU',
        'USUM OU',
        'ORAS OU',
        'BW OU',
        'DPP OU',
        'ADV OU',
        'GSC OU',
        'RBY OU',
        'LGPE OU',
        'BDSP OU',
        'OM',
        '2v2',
        'OM Mashup',
        'BH',
        'MnM',
        'STABmons',
        'AAA',
        'Godly Gift',
        'NFE',
        'VGC',
        'BSS',
    ];

    const allowedLower: string[] = [];
    for (let i = 0; i < allowedMetas.length; i++) {
        allowedLower.push(allowedMetas[i].toLowerCase());
    }

    // check the provided input against the allowed metas
    if (!allowedLower.includes(meta)) {
        const allowedMetaList = allowedMetas.join('\n');
        return [false, allowedMetaList, ''];
    }
    // parse the provided meta for the syntax we used in the raters json
    let channel = '';
    let gen = '';
    switch (meta) {
        case 'sv ou':
            channel = '1059653209678950460';
            gen = '9';
            break;
        case 'sv ubers':
            channel = '1059901370477576272';
            gen = '9';
            break;
        case 'sv dou':
            channel = '1059655497587888158';
            gen = '9';
            break;
        case 'sv uu':
            channel = '1059743348728004678';
            gen = '9';
            break;
        case 'sv lc':
            channel = '1061135027599048746';
            gen = '9';
            break;
        case 'sv mono':
            channel = '1059658237097545758';
            gen = '9';
            break;
        case 'sv natdex ou':
            channel = '1059714627384115290';
            gen = '9';
            break;
        case 'sv natdex uu':
            channel = '1060037469472555028';
            gen = 'uu';
            break;
        case 'sv natdex ag':
            channel = '1060037469472555028';
            gen = 'ag';
            break;
        case 'sv natdex mono':
            channel = '1060037469472555028';
            gen = 'mono';
            break;
        case 'sv 1v1':
            channel = '1059673638145622096';
            gen = '9';
            break;
        case 'sv ag':
            channel = '1060682013453078711';
            gen = '9';
            break;
        case 'sv cap':
            channel = '1059708679814918154';
            gen = '9';
            break;
        case 'ss ou':
            channel = '1060339824537641152';
            gen = '8';
            break;
        case 'usum ou':
            channel = '1060339824537641152';
            gen = '7';
            break;
        case 'oras ou':
            channel = '1060339824537641152';
            gen = '6';
            break;
        case 'bw ou':
            channel = '1060339824537641152';
            gen = '5';
            break;
        case 'dpp ou':
            channel = '1060339824537641152';
            gen = '4';
            break;
        case 'adv ou':
            channel = '1060339824537641152';
            gen = '3';
            break;
        case 'gsc ou':
            channel = '1060339824537641152';
            gen = '2';
            break;
        case 'rby ou':
            channel = '1060339824537641152';
            gen = '1';
            break;
        case 'lgpe ou':
            channel = '1060339824537641152';
            gen = 'lgpe';
            break;
        case 'bdsp ou':
            channel = '1060339824537641152';
            gen = 'bdsp';
            break;
        case 'om':
            channel = '1059657287293222912';
            gen = 'om';
            break;
        case '2v2':
            channel = '1059657287293222912';
            gen = '2v2';
            break;
        case 'om mashup':
            channel = '1059657287293222912';
            gen = 'omm';
            break;
        case 'bh':
            channel = '1059657287293222912';
            gen = 'bh';
            break;
        case 'mnm':
            channel = '1059657287293222912';
            gen = 'mnm';
            break;
        case 'stabmons':
            channel = '1059657287293222912';
            gen = 'stabmons';
            break;
        case 'aaa':
            channel = '1059657287293222912';
            gen = 'aaa';
            break;
        case 'godly gift':
            channel = '1059657287293222912';
            gen = 'gg';
            break;
        case 'nfe':
            channel = '1059657287293222912';
            gen = 'nfe';
            break;
        case 'vgc':
            channel = '1059704283072831499';
            gen = '9';
            break;
        case 'bss':
            channel = '1060690402711183370';
            gen = '9';
            break;
        default:
            return [false, '', ''];
    }

    return [true, channel, gen];
}