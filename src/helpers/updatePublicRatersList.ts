import { pool } from './createPool.js';
import { EmbedBuilder, ChannelType, Embed, Channel, User, Client } from 'discord.js';
import { Modes, botConfig } from '../config.js';
import { psFormats, latestGen, dexGenNumAbbrMap } from './loadDex.js';

interface raterGroup {
    meta: string,
    alias: string,
    raters: string[],
}


/**
 * Creates and updates a visible list of public raters
 * Most of this logic is from ./listrater
 * Since the names are posted in an embed and not post per meta, we need to rebuild/requery each time
 * 
 * We rebuild the embeds from scratch each time so that any changes made upstream are propagated into the embeds (i.e. renaming categories).
 * It also simplifies the logic a bit because we don't need special handlers for removing a field that has all of its raters removed, or if we need an additional/fewer embed for a category
 */
export async function updatePublicRatersList(client: Client, editMeta?: string) {
    // fetch all of the messages from the relevant channel so that we can edit the bot's messages
    // load the channel
    let raterListChannel: Channel | null;
    // dev mode gate
    if (botConfig.MODE === Modes.Dev) {
        raterListChannel = await client.channels.fetch('1065764634562416680');
    }
    else {
        raterListChannel = await client.channels.fetch('1079156451609686026');
    }
    
    if (!(raterListChannel?.type === ChannelType.GuildText || raterListChannel?.type === ChannelType.PublicThread)) {
        return;
    }

    // fetch the messages from the channel
    const messages = await raterListChannel.messages.fetch({ limit: 100, cache: false });
    
    // then find the id of the messages that is from the bot and has the embeds
    const botMsgs = messages.filter(msg => msg.author.id === client.user?.id);

    // extract the embeds from the posts
    const postEmbeds = botMsgs.map(msg => msg.embeds).flat();
    const postEmbedTitles = botMsgs.map(msg => msg.embeds[0]?.title);
   
    // else, we didn't find the message, so we have to make a new one   
    const stringArr: string[] = [];
    const raterArr: string[][] = [];

    // get the entire raters db
    interface ratersTable {
        meta: string,
        userid: string,
    }
    
    const ratersPostgres = await pool.query('SELECT meta, userid FROM chatot.raterlists ORDER BY meta ASC');
    const dbmatches: ratersTable[] | [] = ratersPostgres.rows;
    if (!dbmatches.length) {
        return;
    }
    

    // loop over the object
    let tempRaterArr: string[] = [];
    let oldMeta = '';
    for (const dbRow of dbmatches) {
        // extraxt the data from the row
        const metaDB = dbRow.meta;
        
        // create a header string based on the meta
        const stringOut = psFormats.find(format => format.value === metaDB)?.name ?? metaDB;

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

    // combine the ararys into objects for sorting
    const raterList: raterGroup[] = [];

    for (let i = 0; i < stringArr.length; i++) {
        raterList.push({ meta: stringArr[i], alias: stringArr[i].replace(/[^a-z0-9]/gi, '').toLowerCase(), raters: raterArr[i] });
    }

    // now that they are grouped together, we can sort them into current gen official, old gen official, and misc groups
    const currentOfficial: raterGroup[] = [];
    const oldOfficial: raterGroup[] = [];
    const misc: raterGroup[] = [];
    const officialTiers = [
        'ou',
        'ubers',
        'doublesou',
        'uu',
        'ru',
        'nu',
        'pu',
        'lc',
        'monotype',
    ];
    
    // get the gen number for the latest gen
    const curGenNum = dexGenNumAbbrMap.find(g => g.abbr === latestGen)?.num ?? -1;

    const officialRegex = new RegExp(`gen(?:\\d+)(?:${officialTiers.join('|')})$`, 'im');
    for (const raterGroups of raterList) {
        if (raterGroups.alias.includes('nationaldex') || raterGroups.alias.includes('letsgo') || raterGroups.alias.includes('bdsp')) {
            misc.push(raterGroups);
        }
        /*
        else if (officialTiers.some(str => raterGroups.alias.includes(str)) && raterGroups.alias.includes(`gen${genNum}`)) {
            currentOfficial.push(raterGroups);
        }
        */
        else if (officialTiers.some(str => raterGroups.alias === `gen${curGenNum}${str}`)) {
            currentOfficial.push(raterGroups);
        }
        else if (officialRegex.test(raterGroups.alias)) {
            oldOfficial.push(raterGroups);
        }
        else {
            misc.push(raterGroups);
        }
    }

    /**
     * Sort the arrays
     */


    /**
     * sort by order in officialTiers
     * a and b are adjacent elements in the currentOfficial array
     * s is the raterGroup element being passed into the function
     * c is the element in officalTiers (the substring we are searching for)
     * i is the index of that substring
     * So...the following searches through the raterGroup.meta for the substring contained in officialTiers
     * When it finds a match, it returns the index of the matched substring
     * By comparing adjacent entries, it can swap entries around until they are in the same order as officialTiers
     *
     * Credit: https://stackoverflow.com/questions/34851713/sort-javascript-array-based-on-a-substring-in-the-array-element
     */

    currentOfficial.sort((a, b) => {
        function getNumber(s: raterGroup) {
            let index = -1;
            officialTiers.some((ot, i) => {
                if (~s.alias.indexOf(`gen${curGenNum}${ot}`)) {
                    index = i;
                    return true;
                }
            });
            return index;
        }
        return getNumber(a) - getNumber(b);
    });
    // sort by gen
    // all of the tiers start with genX, so as a first attempt just sort alphabetically (newest first)
    oldOfficial.sort((a, b) => ((a.alias < b.alias) ? 1 : ((a.alias == b.alias) ? 0 : -1)));
    // alphabetical sort
    misc.sort((a, b) => ((a.alias < b.alias) ? 1 : ((a.alias == b.alias) ? 0 : -1)));

    /**
     * build the embeds
     */
    // set the max number of fields we want per embed
    const maxFields = 25;
    const currentEmbedHolder: EmbedBuilder[] = [];
    const pastEmbedHolder: EmbedBuilder[] = [];
    const miscEmbedHolder: EmbedBuilder[] = [];

    // find the user who was added/removed
    let editHeader = '';
    if (editMeta) {
        editHeader = editMeta;
    }
        

    // current gen official
    // find the number of embeds needed to cover this
    await buildEmbed('Current Gen Official Tiers', currentOfficial, currentEmbedHolder, maxFields, client, editHeader, postEmbeds);

    // old gen official
    await buildEmbed('Old Gen Official Tiers', oldOfficial, pastEmbedHolder, maxFields, client, editHeader, postEmbeds);

    // misc
    await buildEmbed('Miscellaneous Tiers', misc, miscEmbedHolder, maxFields, client, editHeader, postEmbeds);

    // post it to the channel
    // if we found a message, we just need to edit the content of the embeds
    // otherwise we need to make a new post with them
    if (postEmbeds.length) {
        let delFlag = false;

        // assert we have the right number of posts and embeds in each
        // embeds and posts could be deleted, in which case we'd need to repost instead of edit
        const groupChecks = ['Current', 'Old', 'Miscellaneous'];

        for (const check of groupChecks) {
            // make sure each one has an embed
            for (const [, oldMsg] of botMsgs) {
                if (!oldMsg.embeds.length) {
                    delFlag = true;
                }
            }

            // make sure all of the categories are covered
            if (!postEmbedTitles.some(title => title?.includes(check))) {
                delFlag = true;
            }
        }
        

        // if something is off, delete the bot's messages so we can trigger a full refresh
        if (delFlag) {
            for (const [, msg] of botMsgs) {
                await msg.delete();
            }
            // put them in order of current, old, misc
            await raterListChannel.send({ embeds: currentEmbedHolder });
            await raterListChannel.send({ embeds: pastEmbedHolder });
            await raterListChannel.send({ embeds: miscEmbedHolder });
        }
        else {
            // edit the message in the channel
            for (const [, oldMsg] of botMsgs) {
                if (oldMsg.embeds[0].title?.includes('Current')) {
                    await oldMsg.edit({ embeds: currentEmbedHolder });
                }
                else if (oldMsg.embeds[0].title?.includes('Old')) {
                    await oldMsg.edit({ embeds: pastEmbedHolder });
                }
                else if (oldMsg.embeds[0].title?.includes('Miscellaneous')) {
                    await oldMsg.edit({ embeds: miscEmbedHolder });
                }
            }
        }
        
    }
    else {
        // post them in order of current, old, misc
        await raterListChannel.send({ embeds: currentEmbedHolder });
        await raterListChannel.send({ embeds: pastEmbedHolder });
        await raterListChannel.send({ embeds: miscEmbedHolder });
    }
    
}


async function buildEmbed(title: string, obj: raterGroup[], holder: EmbedBuilder[], maxFields: number, client: Client, editHeader: string, postEmbeds: Embed[]) {
    // determine how many embeds we need for this meta group
    const maxPages = Math.ceil(obj.length / (maxFields));

    if (maxPages === 0) {
        const embed = new EmbedBuilder().setTitle(title);
        // add the embed to the array to be posted later
        embed.addFields({ name: 'No raters', value: 'N/A' });
        holder.push(embed);
    }

    for (let k = 0; k < maxPages; k++) {
        const embedPageRaters = obj.slice(k * maxFields, k * maxFields + maxFields);
        // instantiate the embed object
        const embed = new EmbedBuilder().setTitle(title);
        // loop through each set of raters for this grouping of metas
        for (const raterGroups of embedPageRaters) {
            const userPromiseArr: Promise<User>[] = [];
            // extract the name of the meta
            const fieldName = raterGroups.meta;
            const fieldAlias = raterGroups.alias;

            // try to find the field name in the old embeds
            let inOldEmbeds = false;

            // try to reuse the old embeds if we added/removed someone
            if (editHeader !== '') {
                for (const oldEmbed of postEmbeds) {
                    // see if the embed contains the same field (meta)
                    const oldFieldMatch = oldEmbed.fields.findIndex(field => field.name === fieldName);
    
                    // if it does and it's not the one that was edited, use the old values
                    if (oldFieldMatch !== -1 && fieldAlias !== editHeader) {
                        embed.addFields({ name: oldEmbed.fields[oldFieldMatch].name, value: oldEmbed.fields[oldFieldMatch].value });
                        inOldEmbeds = true;
                        break;
                    }
                    // else move on to the next old embed
                    else {
                        continue;
                    }
                }
            }
            

            // if you get all the way through the old embeds and you never found a valid old match, make a new field
            if (!inOldEmbeds) {
                // format the raters as a string of taggable ids
                const taggablePings: string[] = [];
                let pingOut = '';
                
                for (const id of raterGroups.raters) {
                    // get the user
                    userPromiseArr.push(fetchUser(id, client));
                }
                // await all of the user fetches
                const userArr: User[] = await Promise.all(userPromiseArr);
                for (const user of userArr) {
                    taggablePings.push(`<@${user.id}> (${user.username})`);
                }
                
                /*
                for (const id of raterGroups.raters) {
                    taggablePings.push(`<@${id}>`);
                }
                */
                // if there are no raters stored for this meta, just say 'none' for output
                if (!taggablePings.length) {
                    pingOut = 'None';
                }
                else {
                    pingOut = taggablePings.join('\n');
                }

                // create the embed field
                embed.addFields({ name: fieldName, value: pingOut });
            }

            
        }
        // add the embed to the array to be posted later
        if (!embed.data.fields) { 
            embed.addFields({ name: 'No raters', value: 'N/A' });
        }
        holder.push(embed);
    }
    return holder;
}

/**
 * Fetches a User object from the Discord API given their id
 * @param id discord user id
 * @param client base client object for the process
 * @returns discord User object
 */
export async function fetchUser(id: string, client: Client) {
   const user = await client.users.fetch(id);
   return user;
}