import { Client, SnowflakeUtil } from 'discord.js';
import { botConfig } from '../config.js';
import { pool } from './createPool.js';
import { errorHandler } from './errorHandler.js';

export async function getLTPlayers(hostID: string, title: string, messageID: string, intChannelID: string, client: Client, announcementChanID: string) {
    // fetch the live tour channel
    const announcementChan = await client.channels.fetch(announcementChanID);

    // if you couldn't fetch the channel, we don't have access to post (or something went wrong with discord)
    // so just return because we can't do anything
    if (!announcementChan || !announcementChan.isTextBased()) {
        return;
    }

    // get the livetour message
    const msg = await announcementChan.messages.fetch(messageID);

    // get the people who reacted to this message with the desired emoji
    const entrants = msg.reactions.cache.get('👍');

    // simiarly, get the interaction channel
    const intChan = await client.channels.fetch(intChannelID);

    if (!intChan || !intChan.isTextBased()) {
        return;
    }

    if (!entrants) {
        await intChan.send({ content: `No one signed up for ${title} <@${hostID}>`, enforceNonce: true, nonce: SnowflakeUtil.generate().toString() });
        return;
    }
    const filteredEntrants = (await entrants.users.fetch()).filter(entrant => entrant.id !== botConfig.CLIENT_ID);

    // if we were the only people to react, return;
    if (!filteredEntrants.size) {
        await intChan.send({ content: `No one signed up for ${title} <@${hostID}>`, enforceNonce: true, nonce: SnowflakeUtil.generate().toString() });
    }
    else {
        await intChan.send({ content: `Here are the signups for ${title} <@${hostID}>:\n\`\`\`\n${filteredEntrants.map(e => e.username).join('\n')}\n\`\`\``, enforceNonce: true, nonce: SnowflakeUtil.generate().toString() });
    }
}


interface IToursDB {
    interactionchanid: string,
    messageid: string,
    hostid: string,
    title: string,
    tstamp: Date,
    announcechanid: string,
}
/**
 * Loads the stored live tours from the database and recreates the timers
 */
export async function recreateLiveTours(client: Client) {
    // load the db
    const toursdb: IToursDB[] | [] = (await pool.query('SELECT interactionchanid, messageid, hostid, title, tstamp, announcechanid FROM chatot.livetours')).rows;
    
    // recreate the timer for each
    for (const tour of toursdb) {
        // compute the delay
        const delay = tour.tstamp.valueOf() - Date.now().valueOf();

        // on the off chance the delay is negative, we missed the alert, so delete the entry and move on
        if (delay < 0) {
            await pool.query('DELETE FROM chatot.livetours WHERE messageid=$1', [tour.messageid]);
            continue;
        }

        // make a new timer
        // create a timeout for the signups
        const timer = setTimeout(() => {
            void getLTPlayers(tour.hostid, tour.title, tour.messageid, tour.interactionchanid, client, tour.announcechanid)
                .catch(e => errorHandler(e));
        }, delay);

        // coerce the timer to a primative so we can cancel it later
        const timerPrim = timer[Symbol.toPrimitive]();
        
        // update the entries in the table
        await pool.query('UPDATE chatot.livetours SET timerid=$1 WHERE messageid=$2', [timerPrim, tour.messageid]);
    }
}