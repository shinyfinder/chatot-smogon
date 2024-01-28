import { ChatInputCommandInteraction, User } from 'discord.js';
import { mapRMTMeta } from './mapRMTMeta.js';
import { pool } from './createPool.js';
import { updatePublicRatersList } from './updatePublicRatersList.js';
import { validateAutocomplete } from './validateAutocomplete.js';
import { supportedMetaPairs } from './constants.js';
/**
 * Command to add a team rater
 * @param user Username or ID to add to the list of raters
 */
export async function addRater(interaction: ChatInputCommandInteraction, metaIn: string, gen: string, user: User) {
    // if it's invalid input, let them know and return
    if (!validateAutocomplete(metaIn, supportedMetaPairs)) {
        await interaction.followUp('I did not recognize that meta or am not setup to track it.');
        return;
    }

    // get the channel for the provided meta and gen
    const [meta, channel] = mapRMTMeta(metaIn, gen);

    // if it doesn't map to a channel, return
    if (channel === '') {
        return;
    }

    // query the db and extract the matches
    const ratersPostgres = await pool.query('SELECT userid FROM chatot.raters WHERE meta = $1 AND gen = $2', [meta, gen]);
    const dbmatches: { userid: string}[] | [] = ratersPostgres.rows;

    // if there are matches (people already are listed to rate for this meta), check the list against the person we are trying to add
    // if they are already listed, return
    if (dbmatches.length) {
        const alreadyARater = dbmatches.some(e => e.userid === user.id);
        if (alreadyARater) {
            await interaction.followUp({ content: 'User is already a team rater for this meta!' });
            return;
        }
    }
    
    // if you're still here, then this is a valid case.
    // try to find their ping preferences
    const pingPG = await pool.query('SELECT ping FROM chatot.raters WHERE userid=$1', [user.id]);
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
    await pool.query('INSERT INTO chatot.raters (channelid, meta, gen, userid, ping) VALUES ($1, $2, $3, $4, $5)', [channel, meta, gen, user.id, pingOut]);
    // update the public list as well
    await updatePublicRatersList(interaction.client, meta, gen);
    await interaction.followUp(`${user.username} was added to the list of ${gen === 'XY' ? 'ORAS' : gen} ${meta} raters.`);
    return;
}