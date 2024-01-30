import { ChatInputCommandInteraction, EmbedBuilder, MessageReaction, User, APIEmbedField } from 'discord.js';
import { pool } from '../helpers/createPool.js';
import { fetchUser } from './updatePublicRatersList.js';
import { validateAutocomplete } from './validateAutocomplete.js';
import { formats } from './loadDex.js';

/**
 * Command to list a set of team raters from the database
 * @param interaction ChatInputCommandInteraction from discord.js
 * @param meta Optional - meta which you want the list of raters for
 * @returns Posts embed containing the list of team raters
 */
export async function listRater(interaction: ChatInputCommandInteraction, meta?: string) {
    // if they didn't specify a meta, list all of the raters
    if (meta === undefined) {
        const stringArr: string[] = [];
        const raterArr: string[][] = [];

        // get the entire raters db
        interface ratersTable {
            meta: string,
            userid: string,
        }
        // query the db
        const ratersPostgres = await pool.query('SELECT meta, userid FROM chatot.raterlists ORDER BY meta ASC');
        const dbmatches: ratersTable[] | [] = ratersPostgres.rows;
        if (!dbmatches.length) {
            await interaction.followUp('No raters found');
            return;
        }

        // loop over the object
        let tempRaterArr: string[] = [];
        let oldMeta = '';
        for (const dbRow of dbmatches) {
            // extraxt the data from the row
            const metaDB = dbRow.meta;
            
            // create a header string based on the gen/meta
            const stringOut = formats.find(format => format.value === metaDB)?.name ?? metaDB;

            // push the header to the array of headers if it's not already there
            if (!stringArr.includes(stringOut)) {
                stringArr.push(stringOut);
                // we don't want to push an empty array on the first iteration, so check for the trackers equal to their initial values
                if (oldMeta === '') {
                    oldMeta = metaDB;
                }
            }
            // if we are looking at the same combination of gens and metas, push the userid to a temp array
            if (metaDB === oldMeta) {
                tempRaterArr.push(dbRow.userid);
            }
            // if we've come across a new combo, push the temp array to the main array of raters and reset the temp array and trackers
            else {
                raterArr.push(tempRaterArr);
                oldMeta = metaDB;
                tempRaterArr = [dbRow.userid];
            }
        }
        // the last row doesn't get appended in the above loop, so do 1 more append to get the last set of raters
        // alternatively you can setup a counter based on the length of the returned DB to know when you're on the last iteration
        raterArr.push(tempRaterArr);


        // build the paginated embed
        // create a filter to only look for the page navigation emojis and only from those from the interaction initiator
        const filter = (reaction: MessageReaction, user: User) => {
            return (reaction.emoji.name === '◀️' || reaction.emoji.name === '▶️') && user.id === interaction.user.id;
        };
        // set the max number of fields we want per embed
        const maxFields = 10;
        // figure out how many pages we need depending on how many rater teams there are
        const maxPages = Math.ceil(stringArr.length / (maxFields));

        // build the pages for the embed
        // each page is an array of arrays of objects
        /**
         * page array
         * |
         * |__each element is an array containing each page of the embed
         * |
         * |______each page consists of an array of embed fields (objects)
         *
         */
        const embedFieldArr: APIEmbedField[][] = [];
        let page = 0;
        const embed = new EmbedBuilder().setTitle('Team Raters');
        for (let k = 0; k < maxPages; k++) {
            // get the meta names and lists of raters for each meta
            const embedPageStrings = stringArr.slice(k * maxFields, k * maxFields + maxFields);
            const embedPageRaters = raterArr.slice(k * maxFields, k * maxFields + maxFields);

            // build the pages in a loop
            const tempEmbedFieldArr: APIEmbedField[] = [];
            for (let i = 0; i < embedPageStrings.length; i++) {
                // format the raters into a taggable string list
                // '<@id>, <@id>, <@id>, ...'
                const taggablePings: string[] = [];
                let pingOut = '';
                for (const id of embedPageRaters[i]) {
                    taggablePings.push('<@' + id + '>');
                }
                // if there are no raters stored for this meta, just say 'none' for output
                if (!taggablePings.length) {
                    pingOut = 'None';
                }
                else {
                    pingOut = taggablePings.join(', ');
                }
                // formulate the fields for the embeds (objects) and push them into an array
                // this array is a page of the embed
                tempEmbedFieldArr.push(
                    { name: embedPageStrings[i], value: pingOut },
                );
            }
            // add each page to the overarching array
            embedFieldArr.push(tempEmbedFieldArr);
        }

        // intitialize an embed to attach the reaction collector to
        embedFieldArr[page].forEach(e => {
            embed.addFields(e);
        });

        // add a footer to track the page number
        embed.setFooter(
            { text: `Page ${page + 1} / ${maxPages}` },
        );

        // post it to the channel
        // we can't make this ephemeral because the bot cannot react to hidden messages
        const message = await interaction.followUp({ content: 'Please react to the following message to navigate through the pages. Embeds do not ping.', embeds: [embed] });
        if (message === undefined) {
            await interaction.editReply({ content: 'An error occurred. Please try again' });
            return;
        }

        // add reactions to the sent message
        await message.react('◀️');
        await message.react('▶️');

        // add the collector to the sent message
        // look for reactions for 5 min
        // edit the embed based on the reaction
        const collector = message.createReactionCollector({ filter, time: 1000 * 60 * 5 });
        collector.on('collect', (reaction: MessageReaction) => {
            void (async () => {
                if (reaction.emoji.name !== null) {
                    // decrement the page by 1
                    if (reaction.emoji.name === '◀️' && page !== 0) {
                        page--;
                        // build the new embed
                        // embeds are immutable, so we have to make a new one
                        const newEmbed = new EmbedBuilder().setTitle('Team Raters');
                        embedFieldArr[page].forEach(e => {
                            newEmbed.addFields(e);
                        });
                        // add a footer to track the page number
                        newEmbed.setFooter(
                            { text: `Page ${page + 1} / ${maxPages}` },
                        );
                        // post it
                        await interaction.editReply({ embeds: [newEmbed] });
                    }

                    // increment page by 1
                    else if (reaction.emoji.name === '▶️' && page < maxPages - 1) {
                        page++;
                        const newEmbed = new EmbedBuilder().setTitle('Team Raters');
                        embedFieldArr[page].forEach(e => {
                            newEmbed.addFields(e);
                        });
                        // add a footer to track the page number
                        newEmbed.setFooter(
                            { text: `Page ${page + 1} / ${maxPages}` },
                        );
                        await interaction.editReply({ embeds: [newEmbed] });
                    }

                    // remove the user's reaction so they can react again
                    await reaction.users.fetch();
                    await reaction.users.remove(interaction.user.id);
                    
                }
            })();
        });
    }
    else if (meta) {
        // if it's invalid input, let them know and return
        if (!validateAutocomplete(meta, formats)) {
            await interaction.followUp('I did not recognize that meta or am not setup to track it.');
            return;
        }

        // retrieve the rater list from the db
        const ratersPostgres = await pool.query('SELECT userid FROM chatot.raterlists WHERE meta=$1', [meta]);
        const dbmatches: { userid: string}[] | [] = ratersPostgres.rows;
        if (!dbmatches.length) {
            await interaction.followUp('No raters found');
            return;
        }

        // fetch the users so we can get their username
        const userPromiseArr: Promise<User>[] = [];
        
        for (const element of dbmatches) {
            const id = element.userid;
            userPromiseArr.push(fetchUser(id, interaction.client));
        }

        const userArr: User[] = await Promise.all(userPromiseArr);

        // populate an output array to include a user tag + username
        const taggablePings: string[] = [];
        for (const user of userArr) {
            taggablePings.push(`<@${user.id}> (${user.username})`);
        }

        // concat the taggable ids as a single string
        let pingOut = '';
        if (!taggablePings.length) {
            pingOut = 'None';
        }
        else {
            pingOut = taggablePings.join('\n');
        }

        // get the type-cased name of the meta so that the output is pretty
        // we already know what they entered is in the list of formats, but we need to typecheck the find to make TS happy
        const metaName = formats.find(format => format.value === meta)?.name ?? meta;

        // build the embed for output
        const embed = new EmbedBuilder()
            .setTitle(`Raters for ${metaName}`)
            .setDescription(`${pingOut}`);

        // post it to the channel
        await interaction.followUp({ embeds: [embed] });
        return;
    }
}