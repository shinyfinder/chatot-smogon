import { ChannelType, Message, MessageMentions } from 'discord.js';
import { pool } from './createPool.js';
import { errorHandler } from './errorHandler.js';
import { INVPair } from '../types/discord';

interface ISUBS {
    roleid: string,
    channelid: string,
    tour: string,
}

let lastCheck = 0;
export let tourPingPairs: INVPair[];

export async function relayPings(msg: Message) {
    // we already checked in guild and from a bit
    // so make sure there's a role mention 
    if (!msg.mentions.roles.size) {
        return;
    }

    // get the pinged roles
    // fsr there is no global roles pattern, so make it ourselves
    // the ids are stored in the group property as groups: { id: '' }
    const GlobalRolesPattern = new RegExp(MessageMentions.RolesPattern.source, MessageMentions.RolesPattern.flags + 'g');
    const taggedRoles = [...msg.content.matchAll(GlobalRolesPattern)];

    // technically idt these should be undefined since we already validated there's a role mention above
    // but TS doesn't give a great way to check that
    const ids = taggedRoles.map(m => m?.groups?.id);

    // get the linked game and the tier from the linked game
    // formats are https://smogtours.psim.us/battle-tier-numbers
    // or https://play.pokemonshowdown.com/battle-tier-numbers
    // i.e.
    // https://play.pokemonshowdown.com/battle-gen9randombattle-2091317204
    // https://smogtours.psim.us/battle-gen9doublesou-756490
    const matchArr = [...msg.content.matchAll(/(?:https?:\/\/)?(?:www\.)?(?:smogtours\.psim\.us|play\.pokemonshowdown\.com)\/battle-(\w+)-(?:\d+)\/?/g)];
    // destructure the match array to extract the url and tier
    const [url, tier] = matchArr.length ? matchArr[0] : '';

    if (!url || !tier) {
        return;
    }   

    // get the subs from the db
    const subRows: ISUBS[] | [] = (await pool.query(`
    SELECT chatot.crossping_subs.roleid, channelid, tour FROM chatot.crossping_subs
    JOIN chatot.crossping_sources ON source = tour_alias
    WHERE psladder=$1 AND chatot.crossping_sources.roleid=ANY($2)`, [tier, ids])).rows;

    // alert the subbed cords
    for (const sub of subRows) {
        try {
            const chan = await msg.client.channels.fetch(sub.channelid);

            if (!chan || chan.type !== ChannelType.GuildText) {
                continue;
            }

            await chan.send(`${sub.tour} game is starting <@&${sub.roleid}>! <${url}>`);
        }
        catch (e) {
            errorHandler(e);
            continue;
        }
        
    }
}

export async function cacheTourPingOptions(force = false) {
    if (force) {
        const idRows: { tour: string, tour_alias: string }[] | [] = (await pool.query('SELECT tour, tour_alias FROM chatot.crossping_sources')).rows;
        tourPingPairs = idRows.map(id => ({ name: id.tour, value: id.tour_alias }));
        lastCheck = Date.now();
    }
    // recache every minute on use
    else if (Date.now() - lastCheck >= 60 * 1000) {
        const idRows: { tour: string, tour_alias: string }[] | [] = (await pool.query('SELECT tour, tour_alias FROM chatot.crossping_sources')).rows;
        tourPingPairs = idRows.map(id => ({ name: id.tour, value: id.tour_alias }));
        lastCheck = Date.now();
    }
}