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
    timer_id: number,
    userid: string,
    loc: string,
    tstamp: Date,
    msg: string,
}


/**
 * Loads the stored reminders from the database and recreates the timers
 */
export async function recreateReminders(client: Client) {
    // load the db
    const reminderPG = (await pool.query('SELECT timer_id, userid, loc, tstamp, msg FROM chatot.reminders'));
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
        const timer = setTimeout(() => {
            void alertUser(reminder.loc, reminder.msg, reminder.userid, client)
                .catch(e => errorHandler(e));
        }, delay);

        // update the timer_primitive in the db with the new value
        const timerPrim = timer[Symbol.toPrimitive]();
        await pool.query('UPDATE chatot.reminders SET timer_primitive=$1 WHERE userid=$2 AND msg=$3 AND loc=$4', [timerPrim, reminder.userid, reminder.msg, reminder.loc]);
    }
}


export async function alertUser(loc: string, message: string, userID: string, client: Client) {
    if (loc === 'dm') {
        // fetch the user object again to make sure it's still in the cache
        const user = await client.users.fetch(userID);

        // send them the alert
        await user.send(`Reminder to ${message}`);
    }
    else {
        // make sure the user and channel objects are cached
        const chan = client.channels.cache.get(loc);

        if (!chan || !(chan.type === ChannelType.GuildText || chan.type === ChannelType.PublicThread || chan.type === ChannelType.PrivateThread)) {
            return;
        }
        await client.users.fetch(userID);

        // send them the alert
        await chan.send(`<@${userID}>, reminder to ${message}`);
    }

    // remove the info from the db
    await pool.query('DELETE FROM chatot.reminders WHERE userid=$1 AND msg=$2 and loc=$3', [userID, message, loc]);
}