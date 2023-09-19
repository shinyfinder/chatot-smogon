import { TextBasedChannel } from 'discord.js';
import { eventHandler } from '../types/event-base';
import { pool } from '../helpers/createPool.js';

/**
 * Channel pin update handler
 *
 * Whenever a pin is updated, the bot checks to see if it needs to update the sticky
 */

export const clientEvent: eventHandler = {
    // define the name of the trigger event
    name: 'channelPinsUpdate',
    // execute the code for this event
    async execute(channel: TextBasedChannel) {
        // ignroe dms
        // and voice? Can that even be a thing??
        if (channel.isDMBased() || channel.isVoiceBased()) {
            return;
        }
        // get the pins
        const pins = await channel.messages.fetchPinned();

        // get the stickied message for this channel from the db
        const stickyPG = await pool.query('SELECT messageid FROM chatot.stickies WHERE channelid=$1', [channel.id]);
        const stickyMsg: { messageid: string }[] | [] = stickyPG.rows;

        // if there is no sticky, return
        if (!stickyMsg.length) {
            return;
        }

        // check if the sticky is still pinned
        const pinned = pins.find(pin => pin.id === stickyMsg[0].messageid);
        const firstPin = pins.first();
        
        // if there aren't any pins, they unpinned it
        // delete the row from the db
        if (!pinned || firstPin === undefined) {
            await pool.query('DELETE FROM chatot.stickies WHERE channelid=$1', [channel.id]);
            return;
        }

        // if it is pinned and it's not the first, repin
        if (pinned.id !== firstPin.id) {
            await pinned.unpin();
            await pinned.pin();
        }
    },
};
