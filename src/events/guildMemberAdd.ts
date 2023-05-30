import { GuildMember } from 'discord.js';
import { eventHandler } from '../types/event-base';
import config from '../config.js';
import { checkVerified } from '../helpers/checkVerified.js';

/**
 * Add member handler
 *
 * Event handler for when a user joins a guild
 */

export const clientEvent: eventHandler = {
    // define the name of the trigger event
    name: 'guildMemberAdd',
    // execute the code for this event
    async execute(member: GuildMember) {
        // ignore DMs and events pertaining to the bot
        if (!member.guild || member.user.id === config.CLIENT_ID) {
            return;
        }
        // check if the user is pending (needs to accept the rule screening)
        // if they are, return
        // otherwise, give them the new user role
        if (member.pending) {
            return;
        }

        // try to add the verification role
        await checkVerified(member);
    },
};
