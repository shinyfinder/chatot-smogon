import { ChatInputCommandInteraction, User } from 'discord.js';
import { pool } from '../helpers/createPool.js';
import { updatePublicRatersList } from './updatePublicRatersList.js';
import { validateAutocomplete } from './validateAutocomplete.js';
import { formats } from './loadDex.js';
/**
 * Helper function to renove a team rater from a specific gen+meta
 */
export async function removeRater(interaction: ChatInputCommandInteraction, meta: string, user: User) {
    // if it's invalid input, let them know and return
    if (!validateAutocomplete(meta, formats)) {
        await interaction.followUp('I did not recognize that meta or am not setup to track it.');
        return;
    }

    // remove it from the db
    const removedRater: { meta: string }[] | [] = (await pool.query('DELETE FROM chatot.raterlists WHERE meta=$1 AND userid=$2 RETURNING meta', [meta, user.id])).rows;

    // update the public list as well
    if (removedRater.length) {
        await updatePublicRatersList(interaction.client, meta);
    }
    

    // get the type-cased name of the meta so that the output is pretty
    // we already know what they entered is in the list of formats, but we need to typecheck the find to make TS happy
    const metaName = formats.find(format => format.value === meta)?.name ?? meta;

    // let them know we're done
    await interaction.followUp(`${user.username} was removed from the list of ${metaName} raters.`);
}

/**
 * Helper function to remove a team rater from all of their metas
 */
export async function removeRaterAll(interaction: ChatInputCommandInteraction, id: string[]) {
    // remove them from the db
    const removedRates: { meta: string }[] | [] = (await pool.query('DELETE FROM chatot.raterlists WHERE userid=ANY($1) RETURNING meta', [id])).rows;
    
    // if something was deleted, update the public rater list
    if (removedRates.length) {
        for (const rateObj of removedRates) {
            await updatePublicRatersList(interaction.client, rateObj.meta);
        }
    }
}