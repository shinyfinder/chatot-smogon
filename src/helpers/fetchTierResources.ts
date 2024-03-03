import { ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import { pool } from './createPool.js';
import { dexGenNumAbbrMap, dexFormats, commitHash } from './loadDex.js';

export async function fetchTierResources(tier: string, gen: string, interaction: ChatInputCommandInteraction) {
    const gaveInput = interaction.options.getString('gen');
    let latestAvailGen = '';
    
    if (!gaveInput) {
        // get the lastest available gen descriptor
        const genQ = await pool.query(`
        SELECT gen_id FROM dex.gens
        JOIN dex.formats USING (gen_id)
        WHERE dex.formats.alias=$1
        ORDER BY dex.gens.order DESC
        LIMIT 1`, [tier]);

        const latestAvailGenRes: { gen_id: string }[] | [] = genQ.rows;

        // there will only be at most 1
        if (latestAvailGenRes.length) {
            latestAvailGen = latestAvailGenRes[0].gen_id;
        }
    }

    const genQuery = gaveInput ? gen : latestAvailGen;

    // query the db to get the info we want
    const resQuery = await pool.query(`
    SELECT resource_name, url FROM dex.format_resources
    JOIN dex.formats USING (format_id)
    WHERE dex.formats.alias=$1 AND dex.formats.gen_id=$2`, [tier, genQuery]);

    const resData: { resource_name: string, url: string }[] | [] = resQuery.rows;

    // extract the name-url pairs so we can join them into a bulleted list
    const maskedURLs = resData.map(row => (`* [${row.resource_name}](${row.url})`));
    
    // get the name of the format they entered
    // we can't just get it from the database, because some formats may not have resources (yet)
    // so get it from the autocomplete
    const formatName = dexFormats.find(format => format.value === tier)?.name ?? tier;

    // get the gen number for the supplied gen   
    const genNum = dexGenNumAbbrMap.find(g => g.abbr === genQuery)?.num;

    // genNum should be defined given we validated the input and/or retrieved it from the database
    // but just in case
    if (!genNum) {
        await interaction.followUp('I can\'t find any gen informaation for that tier. Something went wrong...');
        return;
    }
    // build the embed
    const embed = new EmbedBuilder()
    .setTitle(`${formatName} (Gen ${genNum})`)
    .setDescription(maskedURLs.join('\n') || 'No resources found')
    .setThumbnail(`https://raw.githubusercontent.com/shinyfinder/chatot-assets/${commitHash}/images/formats.png`)
    .addFields([
        { name: 'Overview', value: `For more info, see this format's [Dex page](https://www.smogon.com/dex/${genQuery}/formats/${tier}/).` },
    ])
    .setColor(0x6363b0);

    return embed;

}