import { ChatInputCommandInteraction, User } from 'discord.js';
import { validateMeta } from './validateMeta.js';
import { pool } from './createPool.js';

/**
 * Command to add a team rater
 * @param user Username or ID to add to the list of raters
 */
export async function addRater(interaction: ChatInputCommandInteraction, metaIn: string, gen: string, user: User) {
    // make sure the provided meta is accurate
    // autocomplete doesn't check like static options do
    const [valid, meta, channel] = validateMeta(metaIn, gen);

    // if it's invalid input, let them know and return
    // we resuse the meta variable to include the list of allowable names if it's invalid
    if (!valid) {
        await interaction.followUp({ content: `I did not recognize that meta or am not setup to track it. Please choose one from the following (case insensitive) and try again:\`\`\`${meta}\`\`\`` });
        return;
    }

    // load the rater file
    // postgres
    try {
        // query the db and extract the matches
        const ratersPostgres = await pool.query('SELECT userid FROM raters WHERE meta = $1 AND gen = $2', [meta, gen]);
        const dbmatches: { userid: string}[] = ratersPostgres.rows;
        
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
        // push it to the db
        await pool.query('INSERT INTO raters (channelid, meta, gen, userid) VALUES ($1, $2, $3, $4)', [channel, meta, gen, user.id]);
        await interaction.followUp(`${user.username} added to the list of ${gen} ${meta} raters.`);
        return;
    }
    catch(err) {
        console.error(err);
        await interaction.followUp({ content: 'An error occurred and the user was not added to the database.' });
        return;
    }
};