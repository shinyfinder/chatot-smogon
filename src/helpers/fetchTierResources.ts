import { ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import { pool } from './createPool.js';
import { dexGenNumAbbrMap, dexFormats, commitHash } from './loadDex.js';

export async function fetchTierResources(tier: string, gen: string, interaction: ChatInputCommandInteraction) {
    // get the gen number for the supplied gen
    // null check if it can't find it, but that will never happen because we already validated the input above
    let genNum = dexGenNumAbbrMap.find(g => g.abbr === gen)!.num;
    const embedColor = 0x6363b0;

    // query the db to get the info we want
    const dtQuery = await pool.query(`
    SELECT resource_name, url, gen_id FROM dex.format_resources
    JOIN dex.formats USING (format_id)
    JOIN dex.gens USING (gen_id)
    WHERE dex.formats.alias=$1
    ORDER BY dex.gens.order DESC`, [tier]);

    interface IDBData {
        resource_name: string,
        url: string,
        gen_id: string,
    }

    const dbData: IDBData[] | [] = dtQuery.rows;

    // get the gen they requested
    let genData = dbData.filter(r => r.gen_id === gen);
    
    // if you didn't find a matching row, get the latest one there is
    // only do this if they didn't specify a gen
    // if they did, it can just 404. Will peopple really be searching on specific nonsensical stuff anyway?
    // we already got the input above, but we default to the latest gen for other logic. So we can just retrieve their input again
    const gaveInput = interaction.options.getString('gen');
    if (!genData.length && !gaveInput) {
        // filter by the latest available  gen
        const latestAvailGen = dbData[0].gen_id;
        genData = dbData.filter(r => r.gen_id === latestAvailGen);

        // update the gen number
        genNum = dexGenNumAbbrMap.find(g => g.abbr === latestAvailGen)?.num ?? -1;
    }
    // extract the name-url pairs so we can join them into a bulleted list
    const maskedURLs = genData.map(row => (`* [${row.resource_name}](${row.url})`));
    
    // get the name of the format they entered
    // we can't just get it from the database, because some formats may not have resources (yet)
    // so get it from the autocomplete
    const formatName = dexFormats.find(format => format.value === tier)?.name ?? tier;

    // build the embed
    const embed = new EmbedBuilder()
    .setTitle(`${formatName} (Gen ${genNum})`)
    .setDescription(maskedURLs.join('\n') || 'No resources found')
    .setThumbnail(`https://raw.githubusercontent.com/shinyfinder/chatot-assets/${commitHash}/images/formats.png`)
    .addFields([
        { name: 'Overview', value: `For more info, see this format's [Dex page](https://www.smogon.com/dex/${gen}/formats/${tier}/).` },
    ])
    .setColor(embedColor);

    return embed;

}