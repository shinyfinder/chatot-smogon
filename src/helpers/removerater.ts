import { ChatInputCommandInteraction, User } from 'discord.js';
import { validateMeta } from '../helpers/validateMeta.js';
import { pool } from '../helpers/createPool.js';
import { updatePublicRatersList } from './updatePublicRatersList.js';
/**
 * Command to add a team rater
 * @param user Username or ID to add to the list of raters
 */
export async function removeRater(interaction: ChatInputCommandInteraction, metaIn: string, gen: string, user: User) {
    // make sure the provided meta is accurate
    // autocomplete doesn't check like static options do
    const [valid, meta, channel] = validateMeta(metaIn, gen);

    // if it's invalid input, let them know and return
    // we resuse the meta variable to include the list of allowable names if it's invalid
    if (!valid) {
        await interaction.followUp({ content: `I did not recognize that meta or am not setup to track it. Please choose one from the following (case insensitive) and try again:\`\`\`${meta}\`\`\`` });
        return;
    }

    // query the db and extract the matches
    const ratersPostgres = await pool.query('SELECT userid FROM chatot.raters WHERE meta = $1 AND gen = $2', [meta, gen]);
    const dbmatches: { userid: string }[] | [] = ratersPostgres.rows;
    // if there are matches (people already are listed to rate for this meta), check the list against the person we are trying to add
    // if they are not already listed, return
    if (dbmatches.length) {
        const alreadyARater = dbmatches.some(e => e.userid === user.id);
        if (!alreadyARater) {
            await interaction.followUp({ content: 'User is not a team rater for this meta!' });
            return;
        }
    }

    // if you're still here, then this is a valid case.
    // remove them from the db
    await pool.query('DELETE FROM chatot.raters WHERE meta=$1 AND gen=$2 AND userid=$3', [meta, gen, user.id]);
    // update the public list as well
    await updatePublicRatersList(interaction.client, meta, gen);
    await interaction.followUp(`${user.username} removed from the list of ${gen === 'XY' ? 'ORAS' : gen} ${meta} raters.`);
    return;
}


export async function removeRaterAll(interaction: ChatInputCommandInteraction, user: User) {
    // remove them from the db
    const removedRates: { meta: string, gen: string }[] | [] = (await pool.query('DELETE FROM chatot.raters WHERE userid=$1 RETURNING meta, gen', [user.id])).rows;
    
    // if something was deleted, update the public rater list
    // only do this for the main cord
    if (removedRates.length) {
        for (const rateObj of removedRates) {
            await updatePublicRatersList(interaction.client, rateObj.meta, rateObj.gen);
        }
    }

    // done
    await interaction.followUp(`${user.username} was removed from all rater lists`);
}