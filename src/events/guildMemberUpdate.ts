import { GuildMember } from 'discord.js';
import { eventHandler } from '../types/event-base';
import config from '../config.js';
import { checkVerified } from '../helpers/checkVerified.js';
import { stripDiscrim } from '../helpers/stripDiscrim.js';
import { buildEmbed, postLogEvent } from '../helpers/logging.js';

/**
 * Update member handler
 *
 * Event handler for has their roles,  nickname, status, etc changed.
 * This includes boosting.
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

        // for boosting/unboosting, there isn't an audit log entry, so we need to compare the user before and after the change that triggered this event
        const oldBoost = oldMember.premiumSince;
        const newBoost = newMember.premiumSince;

        // is now boosting
        if (!oldBoost && newBoost) {
            // build the embed
            const title = 'Nitro Boost Gained';
            const description = `${stripDiscrim(newMember.user)} is now boosting! Their profile is <@${newMember.id}>`;
            const color = 0xFFBCFF;
            const embed = buildEmbed(title, { description: description, color: color });

            // send the message, if the logging channel exists
            await postLogEvent(embed, newMember.guild);
            return;
        }

        // no longer boosting :(
        else if (oldBoost && !newBoost) {
            // build the embed
            const title = 'Nitro Boost Lost';
            const description = `${stripDiscrim(newMember.user)} is no longer boosting. Their profile is <@${newMember.id}>`;
            const color = 0xFD00FD;
            const embed = buildEmbed(title, { description: description, color: color });

            // send the message, if the logging channel exists
            await postLogEvent(embed, newMember.guild);
            return;
        }

    },
};
