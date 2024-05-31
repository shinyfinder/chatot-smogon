import { MessageReaction, User } from 'discord.js';
import { eventHandler } from '../types/event-base';
import { rrMessages } from '../helpers/loadReactRoleMessages.js';
import { pool } from '../helpers/createPool.js';

/**
 * Reaction handler
 *
 * Event is triggered whenever someone reacts to a message.
 * This is needed for reaction roles so that we can assign the proper role to them
 */

export const clientEvent: eventHandler = {
    // define the name of the trigger event
    name: 'messageReactionAdd',
    // execute the code for this event
    async execute(reaction: MessageReaction, user: User) {
        // if it's not a cached message, we don't care about it because we purposefully cached the ones we need

        // debug hack
        if (reaction.message.guildId === '192713314399289344' && rrMessages.includes(reaction.message.id)) {
            console.error(`Reaction received on RR message ${reaction.message.id}`);
        }

        if (reaction.partial) {
            return;
        }

        // debug hack
        if (reaction.message.guildId === '192713314399289344' && rrMessages.includes(reaction.message.id)) {
            console.error(`RR Message ${reaction.message.id} is cached`);
        }

        // ignore bot reactions
        if (user.bot) {
            return;
        }

        // see if the message is one we care about
        if (!rrMessages.includes(reaction.message.id)) {
            return;
        }

        // this is a message we care about, so try to fetch the row containing this emoji for this message
        const rrpg = await pool.query('SELECT roleid FROM chatot.reactroles WHERE serverid=$1 AND emoji=$2', [reaction.message.guildId, reaction.emoji.toString()]);
        const dbmatches: { roleid: string }[] | [] = rrpg.rows;


        // debug hack
        if (reaction.message.guildId === '192713314399289344' && !dbmatches.length) {
            console.error(`Reaction received on RR message ${reaction.message.id}, but it's not the right emoji`);
        }


        // if we didn't get a match, then we don't care about this emoji
        if (!dbmatches.length) {
            return;
        }

        // fetch the user as a guild member so we can access their roles
        const member = await reaction.message.guild?.members.fetch(user.id);

        // return if there was an error fetching
        if (member === undefined) {

            // debug hack
            if (reaction.message.guildId === '192713314399289344') {
                console.error(`Can't fetch member ${user.id}`);
            }
            return;
        }
        // add the role
        // debug hack
        try {
            await member.roles.add(dbmatches[0].roleid);
        }
        catch (e) {
            console.error(e);
            throw e;
        }        

        return;
    },
};
