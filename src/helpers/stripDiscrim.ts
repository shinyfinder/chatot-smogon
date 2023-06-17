import { User } from 'discord.js';

/**
 * Retrieves the user's username or tag depending on which nickname system they are on
 * @param user Discord User object
 * @returns username or tag if they are on the new or old system
 */
export function stripDiscrim(user: User) {
    return user.discriminator === '0' ? user.username : user.tag;
}