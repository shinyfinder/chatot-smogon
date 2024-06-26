import { ButtonInteraction, DiscordAPIError } from 'discord.js';
import { pool } from './createPool.js';
import { ServerClass } from './constants.js';
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

    try {
        // get the guild name for better reporting
        const guildName = (await interaction.client.guilds.fetch(guildID)).name;

        // whether we care or not
        const action = splitCustomID[splitCustomID.length - 1];

        if (action === 'confirm') {
            // insert into the db
            await pool.query(`
            INSERT INTO chatot.servers (serverid, class)
            VALUES ($1, $2)
            ON CONFLICT (serverid) DO
            UPDATE SET class = EXCLUDED.class`, [guildID, ServerClass.Official]);

            // update log message
            await interaction.message.edit({ content: `Ok, I will try to gban in ${guildName} (${guildID}) from now on. If I have any issues, I'll let you know.`, components: [] });
        }
        else if (action === 'deny') {
            // update log message
            await interaction.message.edit({ content: `Ok, I'll ignore gban errors in ${guildName} (${guildID}).`, components: [] });
        }
    }
    catch (e) {
        if (e instanceof DiscordAPIError && e.message.includes('Unknown Guild')) {
            await interaction.message.edit({ content: 'I\'m no longer in this guild, nothing to do.', components: [] });
        }
        else {
            throw e;
        }
    }
    
}