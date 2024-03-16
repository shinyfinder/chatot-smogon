import { ButtonInteraction } from 'discord.js';
import { pool } from './createPool.js';

/**
 * Posts the discord server directory to the chat
 */
export async function markOfficial(interaction: ButtonInteraction) {
    // check if this button is for gbans
    // the easiest way to tell is by the custom id
    if (!(interaction.customId.includes('gban-confirm') || interaction.customId.includes('gban-deny'))) {
        return;
    }
    
    // split the custom id on -
    // the first and last element will tell us the scope
    const splitCustomID = interaction.customId.split('-');

    // error guard 0 length
    if (!splitCustomID.length) {
        return;
    }

    // id of new guild that was added
    const guildID = splitCustomID[0];

    // whether we care or not
    const action = splitCustomID[splitCustomID.length - 1];

    if (action === 'confirm') {
        // try to add the id to the db again
        // if it's already there, we don't have to do anything
        // but trying again will ensure the id is added in case the logic on server join failed before this step
        await pool.query('INSERT INTO chatot.officialservers (serverid) VALUES ($1) ON CONFLICT (serverid) DO NOTHING', [guildID]);
        await interaction.message.edit({ content: `Ok, I will try to gban in server ID ${guildID} from now on. If I have any issues, I'll let you know.`, components: [] });
    }
    else if (action === 'deny') {
        await pool.query('DELETE FROM chatot.officialservers WHERE serverid=$1', [guildID]);
        await interaction.message.edit({ content: `Ok, I'll ignore gban errors in server ID ${guildID}.`, components: [] });
    }
    else {
        return;
    }
}