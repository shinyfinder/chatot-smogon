import { Collection, Message } from 'discord.js';
import { pool } from './createPool.js';
import { rmtChannels } from './manageRMTCache.js';
import fetch from 'node-fetch';
import { overwriteTier } from './overwriteTier.js';
import { psFormats } from './loadDex.js';
import { Modes, botConfig } from '../config.js';

// cooldown time in hours
const cd = 6;

/**
 * Handler to determine whether to ping raters for a new rate.
 * Triggered by messageCreate event.
 * Messages are parsed for their channel and content to determine which team of raters to ping.
 */

export async function rmtMonitor(msg: Message) {
    // check channel list
    if (!rmtChannels.some(chan => chan.channelid === msg.channelId)) {
        return;
    }

    // if the message contains an @, they already pinged someone so no need to do it again
    const tagRegex = /@/;
    if (tagRegex.test(msg.content)) {
        return;
    }

    // check to make sure the person who made the message isn't a comp helper
    // if they are, return
    const helperid = botConfig.MODE === Modes.Dev ? '1046554598783062066' : '630430864634937354';
    const isHelper = msg.member?.roles.cache.some(role => role.id === helperid);
    if (isHelper) {
        return;
    }


    // parse message
    const pokePasteRegex = /https:\/\/pokepast\.es\/[0-9a-z]{16}/;
    const pokeURL = msg.content.match(pokePasteRegex);

    // if the message content doesn't include a pokepaste link, return
    if (!pokeURL) {
        return;
    }

    // if they posted a pokepoaste link, fetch it
    // just take the first one if they posted multiple
    const res = await fetch(`${pokeURL[0]}/json`);

    // if something went wrong with the fetch, quit
    if (!res.ok) {
        return;
    }

    // parse the resposne as a json
    const pasteJson = await res.json() as { author: string, notes: string, paste: string, title: string };

    // check the notes for the format
    const rmtFormat = pasteJson.notes.match(/(?<=Format: ).*$/m);
    
    // if it somehow doensn't have a format, nope out because we don't know what it's for
    if (!rmtFormat) {
        return;
    }

    // overwrite the vgc and bss formats
    const unifiedFormat = overwriteTier(rmtFormat[0]);

    // form the cooldown identifier
    const identifier = `rmt-${unifiedFormat}`;

    // if this channel isn't setup to track this meta, return
    if (!rmtChannels.some(chan => chan.channelid === msg.channelId && chan.meta === unifiedFormat)) {
        return;
    }

    // check cooldown
    let cooldown = 0;
    const cooldowns: { date: Date }[] | [] = (await pool.query('SELECT date FROM chatot.cooldown WHERE channelID = $1 AND identifier = $2', [msg.channelId, identifier])).rows;
    
    if (cooldowns.length) {
        cooldown = new Date(cooldowns[0].date).valueOf();
    }

    // if the CD exists, check if the current time is after the end of the CD
    // if we haven't waited the full cooldown for this tier, return and don't ping
	if (cooldown && cooldown + (cd * 60 * 60 * 1000) >= Date.now()) {
        return;
    }


    // ping the relevant parties
    // retrieve the info from the db
    const ratersdbmatches: { userid: string, ping: string }[] | [] = (await pool.query('SELECT userid, ping FROM chatot.raterlists WHERE meta=$1', [unifiedFormat])).rows;
    
    // if you didn't get a match from the raters db, return because we don't know who to ping
    if (!ratersdbmatches.length) {
        return;
    }

    // format the userids as taggable output
    const taggablePings: string[] = [];
    for (const user of ratersdbmatches) {
        // fetch the id to check their online status
        const member = await msg.guild?.members.fetch({ user: user.userid, withPresences: true });
        /**
         * Get their status
         * Because invisible returns null (is this intended?) we need another check to make sure the user is actually in the guild
         * Let's use the id
         */
        // if member does not exist, we didn't fetch the member, probably because they aren't in the guild
        if (!member || member instanceof Collection && !member.size) {
            continue;
        }

        // get their status
        // options are online, idle, dnd, undefined (technically should be invisible and offline as well but idk if discord is handling those properly)
        const status = member.presence?.status;

        // determine whether we should ping them based on their desired settings
        if (user.ping === 'Online') {
            if (status !== 'online') {
                continue;
            }
        }
        else if (user.ping === 'Idle') {
            if (status !== 'idle') {
                continue;
            }
        }
        else if (user.ping === 'Busy') {
            if (status !== 'dnd') {
                continue;
            }
        }
        else if (user.ping === 'Offline') {
            if (status !== undefined) {
                continue;
            }
        }
        else if (user.ping === 'Avail') {
            if (status !== 'online' && status !== 'idle') {
                continue;
            }
        }
        else if (user.ping === 'Around') {
            if (status === undefined) {
                continue;
            }
        }
        else if (user.ping === 'None') {
            continue;
        }

        taggablePings.push(`<@${user.userid}>`);
    }

    // concat the taggable ids as a single string
    const pingOut = taggablePings.join(', ');

    // return if no one wants to be pinged
    if (pingOut === '') {
        return;
    }

    // save the entry to the postgres database
    // if the cooldown is 0, that means we didn't have this entry yet for the gen/channel combo. So we need to INSERT a new row into the db
    // if the cooldown is not 0, then the gen/channel combo did exist. So we need to UPDATE the row in the db
    // the table is setup so that it uses the time on the db server for the timestamp by default
    await pool.query('INSERT INTO chatot.cooldown (channelid, identifier) VALUES ($1, $2) ON CONFLICT (channelid, identifier) DO UPDATE SET date=default', [msg.channelId, identifier]);

    // ping them, but first get the name from the n-v pair used in autocomplete
    const metaName = psFormats.find(format => format.value === unifiedFormat)?.name ?? unifiedFormat;
    await msg.channel.send(`New ${metaName} RMT ${pingOut}. I won't notify you again for at least ${cd} hours.`);
}