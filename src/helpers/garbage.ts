import { Client } from 'discord.js';
import { pool } from './createPool.js';
import config from '../config.js';
import { errorHandler } from './errorHandler.js';

/**
 * Recursively creates a timer to collect and delete unneeded data from the databases
 * @param client Discord bot client
 */
export function initGarbageCollection(client: Client) {
    setTimeout(() => {
        void pruneDatabase(client)
            .catch(e => errorHandler(e))
            .finally(() => initGarbageCollection(client));
    }, 48 * 60 * 60 * 1000);
    
}

interface IGarageCheck {
    reminders: { timerid: number, tstamp: Date }[],
    raters: { userid: string }[],
    fcs: { userid: string }[],
    tickets: { threadchanid: string, messageid: string}[],
}

/**
 * Polls the databases for old content and removes it
 * @param client Discord bot client
 */
async function pruneDatabase(client: Client) {
    // poll the db
    const oldDataPG = await pool.query(`
        WITH reminders AS
        (SELECT timerid, tstamp FROM chatot.reminders),

        raters AS
        (SELECT userid FROM chatot.raters),

        fcs AS
        (SELECT userid FROM chatot.fc),

        tickets AS
        (SELECT threadchanid, messageid FROM chatot.tickets)

        SELECT json_build_object(
            'reminders', (SELECT COALESCE(JSON_AGG(reminders.*), '[]') FROM reminders),
            'raters', (SELECT COALESCE(JSON_AGG(raters.*), '[]') FROM raters),
            'fcs', (SELECT COALESCE(JSON_AGG(fcs.*), '[]') FROM fcs),
            'tickets', (SELECT COALESCE(JSON_AGG(tickets.*), '[]') FROM tickets)
        ) AS data`);
    
    // unpack
    const oldData = oldDataPG.rows.map((row: { data: IGarageCheck }) => row.data)[0];

    // create garbage cans for each thing we have to clear
    const reminderCan: number[] = [];
    const raterCan: string[] = [];
    const ticketCan: string[] = [];

    // queue old reminders for deletion
    for (const oldReminder of oldData.reminders) {
        // if it has an old timestamp, throw it into the garbage can
        if (oldReminder.tstamp.valueOf() < Date.now().valueOf()) {
            reminderCan.push(oldReminder.timerid);
        }
    }

    // queue raters no longer in the server
    // first, get the current member list of the main cord
    const mainCord = await client.guilds.fetch(config.GUILD_ID);
    const mainCordMembers = await mainCord.members.fetch();

    for (const oldRater of oldData.raters) {
        // check to see if this member is still in the guild
        // if they aren't, can em
        if (!mainCordMembers.find(member => member.id === oldRater.userid)) {
            raterCan.push(oldRater.userid);
        }
    }

    // queue any FCs of users not in a server with the fc command
    // first get the fc command definition
    const fcDef = client.commands.filter(cdef => cdef.data.name === 'fc');
    // ... and the list of guilds the fc command is in
    const fcGuilds = fcDef.map(fcdef => fcdef.guilds).flat();

    // build an object so that we can track if the user is still in a guild with the fc command
    const isStillMember: { [key: string] : boolean } = {};
    for (const user of oldData.fcs) {
        isStillMember[user.userid] = false;
    }

    // loop over the list of guilds, checking the member lists for the stored user ids
    for (const guild of fcGuilds) {
        const guildObj = await client.guilds.fetch(guild);
        const fcMembers = await guildObj.members.fetch();

        // check to see if the stored members are still in the guild
        // if they are, flip the flag in the object
        for (const user of oldData.fcs) {
            if (fcMembers.find(member => member.id === user.userid)) {
                isStillMember[user.userid] = true;
            }
        }
    }

    // if by the end of this there are any flags that are still false,
    // add the userids to the deletion queue
    const fcCan = Object.keys(isStillMember).filter(uid => !isStillMember[uid]);

    // to see if the ticket button still exists, we need to try to fetch the message
    // if it fails, we can safely delete it from the db
    for (const ticketChannel of oldData.tickets) {
        const chan = await client.channels.fetch(ticketChannel.threadchanid);
        if (chan && chan.isTextBased()) {
            const buttonMessage = await chan.messages.fetch(ticketChannel.messageid);
            if (!buttonMessage) {
                ticketCan.push(ticketChannel.messageid);
            }

        }
    }

    // delete the leftover data from the databases
    // we want to delete as much as we can, so if it errors we'll just get it on the next garbage day
    if (reminderCan.length) {
        await pool.query('DELETE FROM chatot.reminders WHERE timerid=ANY($1)', [reminderCan]);
    }
    if (raterCan.length) {
        await pool.query('DELETE FROM chatot.raters WHERE userid=ANY($1)', [raterCan]);
    }
    if (fcCan.length) {
        await pool.query('DELETE FROM chatot.fc WHERE userid=ANY($1)', [fcCan]);
    }
    if (ticketCan.length) {
        await pool.query('DELETE FROM chatot.tickets WHERE messageid=ANY($1)', [ticketCan]);
    }
}
