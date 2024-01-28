import { Message } from 'discord.js';
import { pool } from './createPool.js';
import { genAbbreviations, genAliases, latestGen, rmtChannels } from './constants.js';

// cooldown time in hours
const cd = 6;

/**
 * Handler to determine whether to ping raters for a new rate.
 * Triggered by messageCreate event.
 * Messages are parsed for their channel and content to determine which team of raters to ping.
 */

export async function rmtMonitorFetch(msg: Message) {
    // check whether the message is a valid case to consider for pinging RMT raters
    // we need to check: channel, cooldown, pokepaste
    
    // so we don't have to keep typing it out, get the latest gen abbreviation (last element in the array)
    const latestAbbr = genAbbreviations[latestGen - 1];

    // check channel list
    if (!rmtChannels.includes(msg.channelId)) {
        return;
    }

    // if the message contains an @, they already pinged someone so no need to do it again
    const tagRegex = /@/;
    if (tagRegex.test(msg.content)) {
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
    const genAliasArr = [...Object.keys(genAliases), ...Object.values(genAliases)];
    const genRegex = new RegExp(`\\b((Gen|G|Generation)\\s*([1-${latestGen}])|(${genAliasArr.join('|')}))[ou]*\\b`, 'i');
    // const genRegex = /\b((Gen|G|Generation)\s*([1-9])|(SV|SWSH|SS|BDSP|LGPE|USUM|USM|SM|ORAS|XY|B2W2|BW2|BW|HGSS|DPP|DP|RSE|RS|ADV|GSC|GS|RBY|RB))[ou]*\b/i;
    const matchArr = msg.content.match(genRegex);

    // if there are no gen matches, they didn't specify the gen
    // there are exceptions (i.e. OM) where users don't need to specify the gen, so instead we'll need to filter by meta later

    const specialCases = [
        // old gen OU
        '1060339824537641152',
    ];

    // if they didn't specify a gen and there are multiple options, return
    if (matchArr === null && specialCases.includes(msg.channelId)) {
        return;
    }
    // get the descriptor for the gen
    // index 3 is gen number, index 4 is abbreviation in matchArr
    let identifier = '';
    // if there was a match from the regex test...
    if (matchArr !== null) {
        // if you matched the number, we just need to get the index of that number - 1 in the array of gen abbreviations
        if (matchArr[3]) {
            identifier = genAbbreviations[Number(matchArr[3]) - 1];
        }
        // if it's some sort of gen abbreviation, figure out which one it was, then get that index
        else if (matchArr[4]) {
            if (matchArr[4].toUpperCase() === 'LGPE' || matchArr[4] === 'BDSP') {
                identifier = matchArr[4].toUpperCase();
            }
            else {
                // translation: combine all of the values of the genAlias array into a single array (results in string[][]).
                // Then, find the index in the top level array where an element in the nested array (the aliases) is the same as the regex match.
                const genMatchIdx = Object.values(genAliases).findIndex(aliasArr => aliasArr.some(alias => alias.toUpperCase() === matchArr[4].toUpperCase()));
                identifier = genAbbreviations[genMatchIdx - 1];
            }
            
        }
    }
    // else, no gen was specified, so assume they mean the latest gen
    else {
        identifier = latestAbbr;
    }

    /**
     * At this point, the identifier is either 1-9, lgpe, or bdsp
     * For some channels, that is enough because we only care about pinging for the current gen (gen 9)
     * For other channels, like OMs and ND, we assume by default everything is the current gen, so we need to identify by the meta
     * So now we need to check for whether they specified by an old gen or the meta, when applicable
     */

    // if the channel is not a special case (can have multiple gens) and they specified a gen other than 9, return
    if (identifier !== latestAbbr && !specialCases.includes(msg.channelId)) {
        return;
    }

    // Check for metas
    const metaRegex = /\b(?:om ?|nd ?|National Dex ?)*(BH|AAA|MnM|M&M|STABmons|Godly Gift|GG|NFE|2v2|OMM|Mashup|PH|UU|AG|PiC|Inh|Monotype|Mono)\b/i;
    const metamatchArr = msg.content.match(metaRegex);

    // check to see if you're in the right channel and if you found a meta match
    // if you did, use the name of the meta as the cooldown storage key
    if (metamatchArr !== null) {
        let meta = metamatchArr[1];
        // only try to parse if it's in the OM or ND non-ou channels
        // om
        if (meta !== undefined && msg.channelId === '1059657287293222912') {
            meta = meta.toLowerCase();
            if (meta == 'godly gift' || meta == 'gg') {
                identifier = 'GG';
            }
            else if (meta == 'mashup' || meta == 'omm') {
                identifier = 'OM Mashup';
            }
            else if (meta == 'mnm' || meta == 'm&m') {
                identifier = 'M&M';
            }
            else if (meta == '2v2') {
                identifier = '2v2';
            }
            else if (meta == 'stabmons') {
                identifier = 'STABmons';
            }
            else if (meta === 'pic') {
                identifier = 'PiC';
            }
            else if (meta === 'inh') {
                identifier = 'Inh';
            }
            // bh, aaa, nfe, ph
            else {
                identifier = meta.toUpperCase();
            }
        }
        // nd
        else if (meta !== undefined && msg.channelId == '1060037469472555028') {
            meta = meta.toLowerCase();
            if (meta == 'mono' || meta == 'monotype') {
                identifier = 'NatDex Mono';
            }
            else if (meta == 'uu' || meta == 'ag') {
                identifier = `NatDex ${meta.toUpperCase()}`;
            }
        }

    }
    // if this is in OM or ND non-OU and they didn't specify a meta, return
    else if (metamatchArr === null && (msg.channelId == '1059657287293222912' || msg.channelId == '1060037469472555028')) {
        return;
    }

    /**
     * The identifier is now anything in the following list
     * SV, SS, SM, XY, BW, DP, RS, GS, RB, LGPE, BDSP
     * Mono
     * GG
     * OM Mashup
     * BH
     * AAA
     * M&M
     * STABmons
     * NFE
     * 2v2
     * UU
     * AG
     * Mono
     * PH
     * Inh
     * PiC
     */


    // check cooldown
    let cooldown = 0;
    interface pgres {
        date: Date
    }
    
    const cooldownPostgres = await pool.query('SELECT date FROM chatot.cooldown WHERE channelID = $1 AND identifier = $2', [msg.channelId, identifier]);
    const dbmatches = cooldownPostgres.rows[0] as pgres;
    
    if (dbmatches !== undefined) {
        cooldown = new Date(dbmatches.date).valueOf();
    }

    // cooldown = cooldowns[msg.channelId]?.[genNum];
    // if the CD exists, check if the current time is after the end of the CD
    // if we haven't waited the full cooldown for this tier, return and don't ping
	if (cooldown && cooldown + (cd * 60 * 60 * 1000) >= Date.now()) {
        return;
    }

    // check to make sure the person who made the message isn't a comp helper
    // if they are, return
    const isHelper = msg.member?.roles.cache.some(role => role.id === '630430864634937354');
    if (isHelper) {
        return;
    }

    // ping the relevant parties
    // retrieve the info from the db
    let ratersdbmatches: { meta: string, userid: string, ping: string }[] | undefined;
    
    // if you're in the OM or ND nonou channels, we need to earch by the meta
    // otherwise, you can search by gen
    if (msg.channelId == '1059657287293222912' || msg.channelId == '1060037469472555028') {
        const ratersPostgres = await pool.query('SELECT meta, userid, ping FROM chatot.raters WHERE channelID = $1 AND meta = $2', [msg.channelId, identifier]);
        ratersdbmatches = ratersPostgres.rows;
    }
    else {
        const ratersPostgres = await pool.query('SELECT meta, userid, ping FROM chatot.raters WHERE channelID = $1 AND gen = $2', [msg.channelId, identifier]);
        ratersdbmatches = ratersPostgres.rows;
    }

    // if you didn't get a match from the raters db, return because we don't know who to ping
    if (ratersdbmatches === undefined || ratersdbmatches.length === 0) {
        return;
    }
    // format the userids as taggable output
    const taggablePings: string[] = [];
    for (const element of ratersdbmatches) {
        const id = element.userid;

        // fetch the id to check their online status
        const member = await msg.guild?.members.fetch({ user: id, withPresences: true });
        /**
         * Get their status
         * Because invisible returns null (is this intended?) we need another check to make sure the user is actually in the guild
         * Let's use the id
         */
        // if member.id does not exist, we didn't fetch the member, probably because they aren't in the guild
        if (!member?.id || member === undefined) {
            continue;
        }

        // get their status
        // options are online, idle, dnd, undefined (technically should be invisible and offline as well but idk if discord is handling those properly)
        const status = member.presence?.status;

        // get their ping settings from the db
        const pingConstraint = element.ping;

        // determine whether we should ping them based on their desired settings
        if (pingConstraint === 'Online') {
            if (status !== 'online') {
                continue;
            }
        }
        else if (pingConstraint === 'Idle') {
            if (status !== 'idle') {
                continue;
            }
        }
        else if (pingConstraint === 'Busy') {
            if (status !== 'dnd') {
                continue;
            }
        }
        else if (pingConstraint === 'Offline') {
            if (status !== undefined) {
                continue;
            }
        }
        else if (pingConstraint === 'Avail') {
            if (status !== 'online' && status !== 'idle') {
                continue;
            }
        }
        else if (pingConstraint === 'Around') {
            if (status === undefined) {
                continue;
            }
        }
        else if (pingConstraint === 'None') {
            continue;
        }

        taggablePings.push('<@' + id + '>');
    }

    // concat the taggable ids as a single string
    const pingOut = taggablePings.join(', ');

    // return if no one wants to be pinged
    if (pingOut === '') {
        return;
    }

    // save the entry to the postgres database
    // if the cooldown is 0, that means we did have this entry yet for the gen/channel combo. So we need to INSERT a new row into the db
    // if the cooldown is not 0, then the gen/channel combo did exist. So we need to UPDATE the row in the db
    // the table is setup so that it users the time on the db server for the timestamp by default
    if (cooldown === 0) {
        await pool.query('INSERT INTO chatot.cooldown (channelid, identifier) VALUES ($1, $2)', [msg.channelId, identifier]);
    }
    else {
        await pool.query('UPDATE chatot.cooldown SET date = default WHERE channelid = $1 AND identifier = $2', [msg.channelId, identifier]);
    }
    // ping them
    await msg.channel.send(`New ${ratersdbmatches[0].meta} RMT ${pingOut}. I won't notify you again for at least ${cd} hours.`);
}