import { ChatInputCommandInteraction, User } from 'discord.js';
import { pool } from './createPool.js';
import { updatePublicRatersList } from './updatePublicRatersList.js';
import { validateAutocomplete } from './autocomplete.js';
import { psFormats } from './loadDex.js';
/**
 * Command to add a team rater
 * @param user Username or ID to add to the list of raters
 */
export async function addRater(interaction: ChatInputCommandInteraction, meta: string, user: User) {
    // if it's invalid input, let them know and return
    if (!validateAutocomplete(meta, psFormats)) {
        await interaction.followUp('I did not recognize that meta or am not setup to track it.');
        return;
    }
    
    // try to find their ping preferences
    const pingPG = await pool.query('SELECT ping FROM chatot.raterlists WHERE userid=$1', [user.id]);
    const pingMatch: { ping: string }[] | [] = pingPG.rows;
    let pingOut = '';
    // if they're already a rater for something, use their preferences for this new add
    // otherwise, default to All
    if (pingMatch.length) {
        pingOut = pingMatch[0].ping;
    }
    else {
        pingOut = 'All';
    }

    // push it to the db
    const addedRaters: { meta: string }[] | [] = (await pool.query('INSERT INTO chatot.raterlists (meta, userid, ping) VALUES ($1, $2, $3) ON CONFLICT (meta, userid) DO NOTHING RETURNING meta', [meta, user.id, pingOut])).rows;

    // update the public list as well
    if (addedRaters.length) {
        await updatePublicRatersList(interaction.client, meta);
    }
    
    // get the type-cased name of the meta so that the output is pretty
    // we already know what they entered is in the list of formats, but we need to typecheck the find to make TS happy
    const metaName = psFormats.find(format => format.value === meta)?.name ?? meta;
    await interaction.followUp(`${user.username} was added to the list of ${metaName} raters.`);
    return;
}