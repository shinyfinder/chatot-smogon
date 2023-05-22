import { AuditLogEvent, GuildMember, EmbedBuilder, User, ChannelType } from 'discord.js';
import { eventHandler } from '../types/event-base';
import { sleep } from '../helpers/sleep.js';
import { pool } from '../helpers/createPool.js';
import config from '../config.js';

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
        // TODO: add in check for verified
        if (member.pending) {
            return;
        }
        else {
            // get the unverified role
            const role = member.guild.roles.cache.get('bot-unverified');
            if (role === undefined) {
                return;
            }
            await member.roles.add(role);
        }
    },
};
