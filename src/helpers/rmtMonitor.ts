import { Message } from 'discord.js';
import { pool } from './createPool.js';
import { genAbbreviations, genAliases, latestGen, rmtChannels } from './constants.js';
import fetch from 'node-fetch';
// cooldown time in hours
const cd = 6;

/**
 * Handler to determine whether to ping raters for a new rate.
 * Triggered by messageCreate event.
 * Messages are parsed for their channel and content to determine which team of raters to ping.
 */

export async function rmtMonitor(msg: Message) {
    // check channel list
    if (!rmtChannels.includes(msg.channelId)) {
        return;
    }

    // if the message contains an @, they already pinged someone so no need to do it again
    const tagRegex = /@/;
    if (tagRegex.test(msg.content)) {
        return;
    }

    // check to make sure the person who made the message isn't a comp helper
    // if they are, return
    const isHelper = msg.member?.roles.cache.some(role => role.id === '630430864634937354');
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

    
    // check cooldown
    let cooldown = 0;
    
    const cooldownPostgres = await pool.query('SELECT date FROM chatot.cooldown WHERE channelID = $1 AND identifier = $2', [msg.channelId, rmtFormat]);
    const dbmatches: { date: Date }[] | [] = cooldownPostgres.rows;
    
    if (dbmatches.length) {
        cooldown = new Date(dbmatches[0].date).valueOf();
    }

    // cooldown = cooldowns[msg.channelId]?.[genNum];
    // if the CD exists, check if the current time is after the end of the CD
    // if we haven't waited the full cooldown for this tier, return and don't ping
	if (cooldown && cooldown + (cd * 60 * 60 * 1000) >= Date.now()) {
        return;
    }


    // ping the relevant parties
    // retrieve the info from the db
    let ratersdbmatches: { meta: string, userid: string, ping: string }[] | undefined;
    
    // if you're in the OM or ND nonou channels, we need to earch by the meta
    // otherwise, you can search by gen
    if (msg.channelId == '1059657287293222912' || msg.channelId == '1060037469472555028') {
        const ratersPostgres = await pool.query('SELECT meta, userid, ping FROM chatot.raters WHERE channelID = $1 AND meta = $2', [msg.channelId, rmtFormat]);
        ratersdbmatches = ratersPostgres.rows;
    }
    else {
        const ratersPostgres = await pool.query('SELECT meta, userid, ping FROM chatot.raters WHERE channelID = $1 AND gen = $2', [msg.channelId, rmtFormat]);
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
        await pool.query('INSERT INTO chatot.cooldown (channelid, identifier) VALUES ($1, $2)', [msg.channelId, rmtFormat]);
    }
    else {
        await pool.query('UPDATE chatot.cooldown SET date = default WHERE channelid = $1 AND identifier = $2', [msg.channelId, rmtFormat]);
    }
    // ping them
    await msg.channel.send(`New ${ratersdbmatches[0].meta} RMT ${pingOut}. I won't notify you again for at least ${cd} hours.`);
}