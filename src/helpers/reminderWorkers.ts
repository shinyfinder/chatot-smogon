import { Client, ChannelType } from 'discord.js';
import { pool } from './createPool.js';
import { errorHandler } from './errorHandler.js';

/**
 * Helper file to manage reminder database
 */

/**
 * Reminder database interface
 */
interface IReminderDB {
    timerid: number,
    userid: string,
    channelid: string,
    tstamp: Date,
    msg: string,
}


/**
 * Loads the stored reminders from the database and recreates the timers
 */
export async function recreateReminders(client: Client) {
    // load the db
    const reminderPG = (await pool.query('SELECT timerid, userid, channelid, tstamp, msg FROM chatot.reminders'));
    const reminderDB: IReminderDB[] | [] = reminderPG.rows;

    // recreate the timer for each
    // loop over the stored reminders
    for (const reminder of reminderDB) {
        // compute the delay
        const delay = reminder.tstamp.valueOf() - Date.now().valueOf();

        // on the off chance the delay is negative, we missed the alert, so delete the entry and move on
        if (delay < 0) {
            await pool.query('DELETE FROM chatot.reminders WHERE userid=$1 AND msg=$2', [reminder.userid, reminder.msg]);
            continue;
        }

        // create a new timer for each
        setTimeout(() => {
            void alertUser(reminder.channelid, reminder.msg, reminder.userid, client)
                .catch(e => errorHandler(e));
        }, delay);

    }
}


export async function alertUser(loc: string, message: string, userID: string, client: Client) {
    // make sure they didn't delete the row to cancel the timer
    // if they did (rowCount = 0), don't alert
    const storedTimer = await pool.query('SELECT timerid FROM chatot.reminders WHERE userid=$1 AND channelid=$2 AND msg=$3', [userID, loc, message]);
    if (!storedTimer.rowCount) {
        return;
    }

    if (loc === userID) {
        // fetch the user object again to make sure it's still in the cache
        const user = await client.users.fetch(userID);

        // send them the alert
        await user.send(`Reminder: ${message}`);
    }
    else {
        // make sure the user and channel objects are cached
        const chan = client.channels.cache.get(loc);

        if (!chan || !(chan.type === ChannelType.GuildText || chan.type === ChannelType.PublicThread || chan.type === ChannelType.PrivateThread)) {
            return;
        }
        await client.users.fetch(userID);

        // send them the alert
        await chan.send(`<@${userID}>, reminder: ${message}`);
    }

    // remove the info from the db
    await pool.query('DELETE FROM chatot.reminders WHERE userid=$1 AND channelid=$2 AND msg=$3', [userID, loc, message]);
}