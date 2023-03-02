import { pool } from './createPool.js';
import { ChatInputCommandInteraction, EmbedBuilder, ChannelType, Embed, Message } from 'discord.js';


interface raterGroup {
    meta: string,
    raters: string[],
    gen: number,
}


/**
 * Creates and updates a visible list of public raters
 * Most of this logic is from ./listrater
 * Since the names are posted in an embed and not post per meta, we need to rubuild/requery each time
 */
export async function updatePublicRatersList(interaction: ChatInputCommandInteraction) {

    // fetch all of the messages from the relevant channel so that we can edit the bot's message
    // load the channel
    const raterListChannel = await interaction.client.channels.fetch('1079156451609686026');

    if (!(raterListChannel?.type === ChannelType.GuildText || raterListChannel?.type === ChannelType.PublicThread)) {
        return;
    }

    // fetch the messages from the channel
    let postEmbeds: Embed[] = [];
    let targetMessage: Message | undefined;
    await raterListChannel.messages.fetch({ limit: 100, cache: false })
    // then find the id of the message that is from the bot and has the embeds
    .then(messages => {
        messages.forEach(msg => {
            // search for the bot's ID and multiple embeds in the message
            // the bot is currently only designed to post multiple embeds in a message in the specified channel for this purpose, so this is probably good enough
            // albeit a bit hard coded
            if (msg.author.id === '1022962688508313690' && msg.embeds.length >= 3) {
                postEmbeds = msg.embeds;
                targetMessage = msg;
            }
        });
    })
    .catch(err => {
        console.error(err);
        return;
    });

    const stringArr: string[] = [];
    const raterArr: string[][] = [];
    const genArr: number[] = [];

    // create a map of prefix to gen number for sorting
    // we put bdsp/lgpe further below because we want less priority on those (lower listed)
    const genConversion: { [key: string] : number} = {
        'SV': 9,
        'SS': 8,
        'SM': 7,
        'XY': 6,
        'BW': 5,
        'DP': 4,
        'RS': 3,
        'GS': 2,
        'RB': 1,
    };

    // get the entire raters db
    interface ratersTable {
        channelid: string,
        meta: string,
        gen: string,
        userid: string,
    }
    let dbmatches: ratersTable[] | [];
    try {
        const ratersPostgres = await pool.query('SELECT channelid, meta, gen, userid FROM chatot.raters ORDER BY channelid ASC, meta ASC, gen DESC');
        dbmatches = ratersPostgres.rows;
        if (!dbmatches.length) {
            return;
        }
    }
    catch (err) {
        console.error(err);
        return;
    }

    // loop over the object
    // the database is organized by channel id, then meta, then gen
    let tempRaterArr: string[] = [];
    let oldMeta = '';
    let oldGen = '';
    for (const dbRow of dbmatches) {
        // extraxt the data from the row
        const metaDB = dbRow.meta;
        const genDB = dbRow.gen;
        // create a header string based on the gen/meta
        const stringOut = `${genDB} ${metaDB}`;
        const genNum = genConversion[genDB];
        // push the header to the array of headers if it's not already there
        if (!stringArr.includes(stringOut)) {
            stringArr.push(stringOut);
            genArr.push(genNum);
            // we don't want to push an empty array on the first iteration, so check for the trackers equal to their initial values
            if (oldGen === '' && oldMeta === '') {
                oldMeta = metaDB;
                oldGen = genDB;
            }
        }
        // if we are looking at the same combination of gens and metas, push the userid to a temp array
        if (metaDB === oldMeta && genDB === oldGen) {
            tempRaterArr.push(dbRow.userid);
        }
        // if we've come across a new combo, push the temp array to the main array of raters and reset the temp array and trackers
        else {
            raterArr.push(tempRaterArr);
            oldMeta = metaDB;
            oldGen = genDB;
            tempRaterArr = [dbRow.userid];
        }
    }
    // the last row doesn't get appended in the above loop, so do 1 more append to get the last set of raters
    // alternatively you can setup a counter based on the length of the returned DB to know when you're on the last iteration
    raterArr.push(tempRaterArr);

    // combine the ararys into objects for sorting
    /* interface raterGroup {
        meta: string,
        raters: string[],
        gen: number,
    }*/
    const raterList: raterGroup[] = [];

    for (let i = 0; i < stringArr.length; i++) {
        raterList.push({ 'meta': stringArr[i], 'raters': raterArr[i], gen: genArr[i] });
    }

    // now that they are grouped together, we can sort them into current gen official, old gen official, and misc groups
    const currentOfficial: raterGroup[] = [];
    const oldOfficial: raterGroup[] = [];
    const misc: raterGroup[] = [];
    const officialTiers = [
        'OU',
        'Ubers',
        'DOU',
        'UU',
        'RU',
        'NU',
        'PU',
        'LC',
        'Mono',
    ];

    for (const raterGroups of raterList) {
        if (raterGroups.meta.includes('NatDex') || raterGroups.meta.includes('LGPE') || raterGroups.meta.includes('BDSP')) {
            misc.push(raterGroups);
        }
        else if (officialTiers.some(str => raterGroups.meta.includes(str)) && raterGroups.meta.includes('SV')) {
            currentOfficial.push(raterGroups);
        }
        else if (officialTiers.some(str => raterGroups.meta.includes(str))) {
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

    currentOfficial.sort(function(a, b) {
        function getNumber(s: raterGroup) {
            let index = -1;
            officialTiers.some(function(c, i) {
                if (~s.meta.indexOf(c)) {
                    index = i;
                    return true;
                }
            });
            return index;
        }
        return getNumber(a) - getNumber(b);
    });
    // sort by gen
    oldOfficial.sort((a, b) => b.gen - a.gen);
    // alphabetical sort
    misc.sort((a, b) => ((a.meta < b.meta) ? -1 : ((a.meta == b.meta) ? 0 : 1)));

    /**
     * build the embeds
     */
    // set the max number of fields we want per embed
    const maxFields = 25;
    const embedHolder: EmbedBuilder[] = [];


    // current gen official
    // find the number of embeds needed to cover this
    let maxPages = Math.ceil(currentOfficial.length / (maxFields));
    buildEmbed('Current Gen Official Tiers', currentOfficial, maxPages, embedHolder);

    // old gen official
    maxPages = Math.ceil(oldOfficial.length / (maxFields));
    buildEmbed('Old Gen Official Tiers', oldOfficial, maxPages, embedHolder);

    // misc
    maxPages = Math.ceil(misc.length / (maxFields));
    buildEmbed('Miscellaneous Tiers', misc, maxPages, embedHolder);

    // post it to the channel
    // if we found a message, we just need to edit the content of the embeds
    // otherwise we need to make a new post with them
    if (postEmbeds.length) {
        // edit the message in the channel
        if (targetMessage instanceof Message) {
            await targetMessage.edit({ embeds: embedHolder });
        }
    }
    else {
        await raterListChannel.send({ embeds: embedHolder });
    }
}


function buildEmbed(title: string, obj: raterGroup[], maxPages: number, holder: EmbedBuilder[]) {
    for (let k = 0; k < maxPages; k++) {
        // instantiate the embed object
        const embed = new EmbedBuilder().setTitle(title);
        // loop through each set of raters for this grouping of metas
        for (const raterGroups of obj) {
            // extract the name of the meta
            const fieldName = raterGroups.meta;

            // format the raters as a string of taggable ids
            const taggablePings: string[] = [];
            let pingOut = '';
            for (const id of raterGroups.raters) {
                taggablePings.push('<@' + id + '>');
            }
            // if there are no raters stored for this meta, just say 'none' for output
            if (!taggablePings.length) {
                pingOut = 'None';
            }
            else {
                pingOut = taggablePings.join(', ');
            }

            // create the embed field
            embed.addFields({ name: fieldName, value: pingOut });
        }
        // add the embed to the array to be posted later
        holder.push(embed);
    }
    return holder;
}