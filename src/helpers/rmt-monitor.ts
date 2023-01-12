import { Message } from 'discord.js';
import { cooldowns } from '../chatot';
import { readFileSync, writeFileSync } from 'fs';
import * as path from 'path';
/**
 * Handler to determine whether to ping raters for a new rate
 * Triggered by messageCreate event
 *
 */


// cooldown time in hours
const cd = 3;

// define the json structure to make TS happy
interface Data {
    [key: string]: { [key: string]: string[] },
}

export async function rmtMonitor(msg: Message) {
    // check whether the message is a valid case to consider for pinging RMT raters
    // we need to check: channel, cooldown, pokepaste
    // the only thing we track are current gen OU, so only ping for those

    // define the viable channel IDs
    // some of the channels are not ready for gen 9, so we don't track those
    const rmtChannels = [
        // uu
        '1059743348728004678',
        // ou
        '1059653209678950460',
        // uber
        '1059901370477576272',
        // dou
        '1059655497587888158',
        // lc
        '1061135027599048746',
        // mono
        '1059658237097545758',
        // old gen ou
        '1060339824537641152',
        // vgc
        '1059704283072831499',
        // bss
        '1060690402711183370',
        // natdex ou
        '1059714627384115290',
        // natdex non-ou
        '1060037469472555028',
        // 1v1
        '1059673638145622096',
        // ag
        '1060682013453078711',
        // cap
        '1059708679814918154',
        // om
        '1059657287293222912',
    ];

    // define the gen abbreviations
    // we need to store cooldowns for SS, BDSP, and LGPE separately because they have separate metas we need to ping for
    const gens: {[key: string]: string} = {
        'sv': '9',
        'swsh': '8',
        'ss': '8',
        'bdsp': 'bdsp',
        'lgpe': 'lgpe',
        'usum': '7',
        'usm': '7',
        'sm': '7',
        'oras': '6',
        'xy': '6',
        'b2w2': '5',
        'bw2': '5',
        'bw': '5',
        'hgss': '4',
        'dpp': '4',
        'dp': '4',
        'rse': '3',
        'adv': '3',
        'gsc': '2',
        'rby': '1',
    };

    // check channel list
    if (!rmtChannels.includes(msg.channelId)) {
        return;
    }


    // parse message
    const pokePasteRegex = /https:\/\/pokepast\.es\/[0-9a-z]{16}/;
    // if the message context doesn't include a pokepaste link, return
    if (!pokePasteRegex.test(msg.content)) {
        return;
    }

    // try to find the gen number
    // this regex tries to find Gen #, G#, or the smogon prefix used to denote the gen
    // it excludes possible matches within the pokepaste link
    // ... in theory
    const genRegex = /((Gen|G|Generation)\s*([1-9])|(?<!https:\/\/pokepast\.es\/|[0-9a-z])(SV|SWSH|SS|BDSP|LGPE|USUM|USM|SM|ORAS|XY|B2W2|BW2|BW|HGSS|DPP|DP|RSE|ADV|GSC|RBY))/i;
    let matchArr = msg.content.match(genRegex) || 'na';

    // if there are no gen matches, they didn't specify the gen
    // return, because we don't know who to ping
    // there are exceptions (i.e. OM) where users don't need to specify the gen, so instead we'll need to filter by meta later

    const specialCases = [
        // old gen OU
        '1060339824537641152',
    ];

    // if they didn't specify a gen and there are multiple options, return
    if (matchArr === 'na' && specialCases.includes(msg.channelId)) {
        return;
    }
    else if (matchArr === 'na') {
        matchArr = '9';
    }
    // get the descriptor for the gen
    // at this point, it is either the number or the smogon abbreviation
    // 3 is gen number, 4 is abbreviation
    let genNum = '';
    if (matchArr.length > 1) {
        const genDesr = (matchArr[3] || matchArr[4]).toLowerCase();
        // check if it's the abbreviation
        if (Object.keys(gens).includes(genDesr)) {
            genNum = gens[genDesr];
        }
        else {
            genNum = genDesr;
        }
    }
    else {
        genNum = '9';
    }


    // if the channel is not a special case (can have multiple gens) and they specified a gen other than 9, return
    if (genNum !== '9' && !specialCases.includes(msg.channelId)) {
        return;
    }

    // Check for metas
    const metaRegex = /.*(BH|AAA|MnM|STABmons|Godly Gift|GG|NFE|2v2|OMM|Mashup|ZU|UU|AG|Monotype|Mono)|(?<!https:\/\/pokepast\.es\/|[0-9a-z])/i;
    const metamatchArr = msg.content.match(metaRegex);

    // check to see if you're in the right channel and if you found a meta match
    // if you did, use the name of the meta as the cooldown storage key

    // specific OMs
    if (metamatchArr !== null) {
        let meta = metamatchArr[1];
        // only try to parse if it's in the OM or ND non-ou channels
        if (meta !== undefined && (msg.channelId == '1059657287293222912' || msg.channelId == '1060037469472555028')) {
            meta = meta.toLowerCase();
            if (meta == 'mono' || meta == 'monotype') {
                genNum = 'mono';
            }
            else if (meta == 'godly gift' || meta == 'gg') {
                genNum = 'gg';
            }
            else if (meta == 'mashup' || meta == 'omm') {
                genNum == 'omm';
            }
            else {
                genNum = meta;
            }
        }

    }
    // general OMs
    else if (msg.channelId == '1059657287293222912') {
        genNum = 'om';
    }


    // check cooldown
    const cooldown = cooldowns[msg.channelId]?.[genNum];
    // if the CD exists, check if the current time is after the end of the CD
    // if we haven't waited the full cooldown for this tier, return and don't ping
	if (cooldown && cooldown + (cd * 60 * 60 * 1000) >= Date.now()) {
        return;
    }
    // if the cooldown doesn't exist yet, log the current time into the array
	// and write the file to disc so that it persists across restarts
	if (!cooldowns[msg.channelId]) {
        cooldowns[msg.channel.id] = {};
        cooldowns[msg.channel.id][genNum] = Date.now();
        // write file
        const dbpath = path.join(__dirname, '../../src/db/cooldown.json');
        writeFileSync(dbpath, JSON.stringify(cooldowns));
    }
    else {
        cooldowns[msg.channel.id][genNum] = Date.now();
        // write file
        const dbpath = path.join(__dirname, '../../src/db/cooldown.json');
        writeFileSync(dbpath, JSON.stringify(cooldowns));
    }

    // ping the relevant parties
    // retrieve the info from the db
    const filepath = path.join(__dirname, '../db/raters.json');
    const raterDB = readFileSync(filepath, 'utf8');
    const json = JSON.parse(raterDB) as Data;

    // extract the raters list
    const pingsArr = json?.[msg.channelId]?.[genNum];

    // if the raters list is empty, return because we don't know who to ping
    if (pingsArr === undefined || !pingsArr.length) {
        return;
    }

    // build a taggable output
    const taggablePings: string[] = [];

    for (const id of pingsArr) {
        taggablePings.push('<' + id + '>');
    }
    // join into a single string and reply into the channel where the pokepaste was made
    const pingOut = taggablePings.join(', ');
    await msg.channel.send(`New ${json[msg.channelId].name[0]} RMT ${pingOut}. I won't notify you again for at least 3 hours.\n\nThis is a test of the monitor system and is not meant to ping.`);
}