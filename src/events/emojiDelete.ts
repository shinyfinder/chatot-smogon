import { GuildEmoji } from 'discord.js';
import { eventHandler } from '../types/event-base';
import { pool } from '../helpers/createPool.js';


/**
 * Channel deletion handler
 *
 * Used to delete the information from the database if this channel is used for something.
 */

export const clientEvent: eventHandler = {
    // define the name of the trigger event
    name: 'emojiDelete',
    // execute the code for this event
    async execute(emoji: GuildEmoji) {
        await pool.query('DELETE FROM chatot.reactroles WHERE emoji=$1 AND serverid=$2', [emoji.toString(), emoji.guild.id]);
    },
};
