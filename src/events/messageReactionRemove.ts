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
    name: 'messageReactionRemove',
    // execute the code for this event
    async execute(reaction: MessageReaction, user: User) {
        // if it's not a cached message, we don't care about it because we purposefully cached the ones we need
        if (reaction.partial) {
            return;
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

        // if we didn't get a match, then we don't care about this emoji
        if (!dbmatches.length) {
            return;
        }

        // fetch the user as a guild member so we can access their roles
        const member = await reaction.message.guild?.members.fetch(user.id);

        // return if there was an error fetching
        if (member === undefined) {
            return;
        }
        // remove the role
        await member.roles.remove(dbmatches[0].roleid);

        return;
    },
};
