import { AuditLogEvent, GuildMember, EmbedBuilder, User, ChannelType } from 'discord.js';
import { eventHandler } from '../types/event-base';
import { sleep } from '../helpers/sleep.js';
import { pool } from '../helpers/createPool.js';
import config from '../config.js';
import { checkVerified } from '../helpers/checkVerified.js';

/**
 * Update member handler
 *
 * Event handler for when a user is timed out or has their roles changed.
 * Timeout events are logged with the user, the mod, duration, and the reason to the specified channel in the config file.
 * Content information is supplied by the audit log.
 *
 * Boost/Unboosts are logged with the user's name.
 *
 * Note that there is no guarantee when the audit log is populated, nor an event when it is.
 * If the person who deleted the message is a bot or the author, no audit log event is created.
 */

export const clientEvent: eventHandler = {
    // define the name of the trigger event
    name: 'guildMemberUpdate',
    // execute the code for this event
    async execute(oldMember: GuildMember, newMember: GuildMember) {
        // ignore DMs and events pertaining to the bot
        if (!newMember.guild || newMember.user.id === config.CLIENT_ID) {
            return;
        }
        
        // check if they changed pending states
        // if so, try to give them the unverified role
        if (oldMember.pending && !newMember.pending) {
            await checkVerified(newMember);
            return;
        }

        // wait a bit for the audit log to update
        await sleep(10000);

        // for boosting/unboosting, there isn't an audit log entry, so we need to compare the user before and after the change that triggered this event
        // for main, the boosting role ID is 585582311710654464
        // check the list of roles assigned to this member for this role id
        // const oldBoost = oldMember.roles.cache.some(role => role.id === '585582311710654464');
        // const newBoost = newMember.roles.cache.some(role => role.id === '585582311710654464');
        const oldBoost = oldMember.premiumSince;
        const newBoost = newMember.premiumSince;

        // is now boosting
        if (!oldBoost && newBoost) {
            // get the channel
            const pgres = await pool.query('SELECT channelid FROM chatot.logchan WHERE serverid=$1', [newMember.guild.id]);
            const logchan: { channelid: string }[] | [] = pgres.rows;
            if (logchan.length) {
                const channel = newMember.client.channels.cache.get(logchan[0].channelid);
                // make sure you fetched the channel
                if (channel?.type !== ChannelType.GuildText) {
                    return;
                }
                // send the message
                await channel.send(`${newMember.user.tag} is now boosting! Their profile is <@${newMember.id}>`);
                return;
            }
            else {
                return;
            }
        }
        // no longer boosting :(
        else if (oldBoost && !newBoost) {
            // get the channel
            const pgres = await pool.query('SELECT channelid FROM chatot.logchan WHERE serverid=$1', [newMember.guild.id]);
            const logchan: { channelid: string }[] | [] = pgres.rows;
            if (logchan.length) {
                const channel = newMember.client.channels.cache.get(logchan[0].channelid);
                // make sure you fetched the channel
                if (channel?.type !== ChannelType.GuildText) {
                    return;
                }
                // send the message
                await channel.send(`${newMember.user.tag} is no longer boosting. Their profile is <@${newMember.id}>`);
                return;
            }
            else {
                return;
            }
        }

        // since we're only updating 1 user at a time, fetch the latest event from the audit log of type update
        const fetchedLogs = await newMember.guild.fetchAuditLogs({
            limit: 1,
            type: AuditLogEvent.MemberUpdate,
        });

        // Since there's only 1 audit log entry in this collection, grab the first one
        const updateLog = fetchedLogs.entries.first();

        // If there's nothing in the audit log, return
        if (!updateLog) {
            // await buildEmbed('Self', null);
            return;
        }

        // Now grab the user object of the person who updated the member
        // Also grab the target of this action to double-check things
        const { executor, target, reason, changes } = updateLog;

        // make sure executor and target isn't null to make TS happy. It shouldn't be
        if (!executor || !target) {
            await buildEmbed('Inconclusive. No audit log entry at this time.', null, 'N/A', newMember);
            return;
        }

        // if the executor is the same as the person who was updated, they modified it on their own, so don't log it.
        if (target.id === executor.id) {
            return;
        }

        // Also run a check to make sure that the log returned was for the same member
        if (target.id !== newMember.id) {
            return;
        }

        // we only want to log timeouts, so check if the changes are the communication_disabled_until
        if (changes[0].key !== 'communication_disabled_until') {
            return;
        }

        // get the current timestamp and the timestamp of the timeout
        // if the new time is undefined, the timeout is being removed
        if (changes[0].new === undefined) {
            await buildEmbed(executor, reason, 'Removed', newMember);
            return;
        }

        const newTimeOut = new Date(changes[0].new.toString()).getTime();
        const currentTime = Date.now();

        // if the disabled timestamp is less than the current one, they were timed out in the past
        // do nothing
        if (newTimeOut < currentTime) {
            return;
        }

        // else determine how long they were timed out for
        /* timeout options are:
            60 sec = 60000 ms
            5 min = 300000 ms
            10 min = 600000 ms
            1 hour = 3600000 ms
            1 day = 86400000 ms
            1 week = 604800000 ms
        */
        const timeDiff = newTimeOut - currentTime;

        // output the length of the timeout based on the differential
        // because if statements are short circuited, we don't need to check the lower bound on each test
        let duration = '';
        if (timeDiff <= 60000) {
            // 1 minute
            duration = '1 minute';
        }
        else if (timeDiff <= 300000) {
            // 5 min
            duration = '5 minutes';
        }
        else if (timeDiff <= 600000) {
            // 10 min
            duration = '10 minutes';
        }
        else if (timeDiff <= 3600000) {
            // 1 hour
            duration = '1 hour';
        }
        else if (timeDiff <= 86400000) {
            // 1 day
            duration = '1 day';
        }
        else {
            // 1 week
            duration = '1 week';
        }

        // log the timeout
        await buildEmbed(executor, reason, duration, newMember);

    },
};

/**
 * Builds the discord embed logging the mod action
 * @param executor Person who initiated the mod action
 * @param reason Provided reason for the mod action
 * @param duration How long the timeout lasts for
 * @returns void. Posts embed to log channel
 */
async function buildEmbed(executor: User | string, reason: string | null, duration: string, newMember: GuildMember) {
    // if the executor is a User type, that means we found an audit log entry
    // we only care about their id, so grab that.
    // Otherwise output the string we passed
    let executorOut = '';
    let executorName = '';
    let executorID = '';
    if (executor instanceof User) {
        executorOut = `<@${executor.id}>`;
        executorName = executor.tag;
        executorID = executor.id;
    }
    else {
        executorOut = executor;
        executorName = 'Unknown';
        executorID = 'N/A';
    }

    // typecheck reason
    if (reason === null) {
        reason = 'N/A';
    }

    // build the title and description based on whether the timeout was removed or not
    let titleOut = '';
    let descOut = '';
    let modAction = '';
    if (duration === 'Removed') {
        titleOut = 'Timeout Removed';
        descOut = `${newMember.user.tag}'s timeout was removed by ${executorName}.`;
        modAction = 'Untimeout';
    }
    else {
        titleOut = 'User Timed Out';
        descOut = `${newMember.user.tag} was timed out by ${executorName}.`;
        modAction = 'Timeout';
    }
    // build the embed for output
    const embed = new EmbedBuilder()
        .setColor(0xFEE75C)
        .setTitle(`${titleOut}`)
        .setDescription(`${descOut}`)
        .addFields(
            { name: 'User', value: `<@${newMember.id}>`, inline: true },
            { name: 'Duration', value: `${duration}`, inline: true },
            { name: 'Performed by', value: `${executorOut}` },
            { name: 'Reason', value: `${reason}` },
        );


    // save to modlog for the server
    await pool.query('INSERT INTO chatot.modlog (serverid, executor, target, action, reason) VALUES ($1, $2, $3, $4, $5)', [newMember.guild.id, executorID, newMember.user.id, modAction, reason]);

    // log to the logging channel specified in the config file
    const pgres = await pool.query('SELECT channelid FROM chatot.logchan WHERE serverid=$1', [newMember.guild.id]);
    const logchan: { channelid: string }[] | [] = pgres.rows;

    if (logchan.length) {
        const channel = newMember.client.channels.cache.get(logchan[0].channelid);
        if (channel?.type !== ChannelType.GuildText) {
            return;
        }
        await channel.send({ embeds: [embed] });
    }
    
    /**
     * Main discord uses a separate channel to specifically log punishments.
     * If this action occurred in main, echo to that channel as well.
     */
    
    if (newMember.guild.id === '192713314399289344' && duration !== 'Removed') {
        // get the log-punishements channel
        const punishChan = newMember.client.channels.cache.get('768187740956917821');
        // typecheck to make TS happy
        if (punishChan?.type !== ChannelType.GuildText) {
            return;
        }
        // echo to the other chan
        await punishChan.send(`${newMember.user.id} / ${newMember.user.tag} / timeout for ${duration} / ${reason}`);
    }
    
   return;
}
