import { SlashCommandBuilder, ChatInputCommandInteraction, AutocompleteInteraction, EmbedBuilder, APIEmbedField } from 'discord.js';
import { SlashCommand } from '../types/slash-command-base';
import { pokedex, allNames, fullDexNameQuery, items, moves } from '../helpers/loadDex.js';
import { genAbbreviations, latestGen, myColors } from '../helpers/constants.js';
import { pool } from '../helpers/createPool.js';

/**
 * Posts detailed information about the provided query
 * @param name Name of the pokemon/item/nature/etc
 * @param gen Which gen to pull up the data for
 *
 */
export const command: SlashCommand = {
    global: true,
    guilds: [],
    // setup the slash command builder
    data: new SlashCommandBuilder()
        .setName('dt')
        .setDescription('Gives the details of the provided Pokemon, move, item, etc using the SmogDex')
        .addStringOption(option =>
            option.setName('name')
            .setDescription('Name of the object to search')
            .setRequired(true)
            .setAutocomplete(true))
        .addIntegerOption(option =>
            option.setName('gen')
            .setDescription('Which gen number to search. If blank, the latest is used')
            .setMinValue(1)
            .setMaxValue(latestGen)
            .setRequired(false))
        .setDMPermission(false),

    // prompt the user with autocomplete options since there are too many tiers to have a selectable list
    async autocomplete(interaction: AutocompleteInteraction) {
        const focusedOption = interaction.options.getFocused(true);

        if (focusedOption.name === 'name') {
            const enteredText = focusedOption.value.toLowerCase();
            const filteredOut: {name: string, value: string }[] = [];
            // filter the options shown to the user based on what they've typed in
            // everything is cast to lower case to handle differences in case
            for (const pair of allNames) {
                if (filteredOut.length < 25) {
                    const nameLower = pair.name.toLowerCase();
                    // return the pairs
                    if (nameLower.includes(enteredText)) {
                        filteredOut.push(pair);
                    }
                }
                else {
                    break;
                }
            }

            await interaction.respond(filteredOut);
        }
    },
    // execute our desired task
    async execute(interaction: ChatInputCommandInteraction) {
        await interaction.deferReply();
        // make sure this command is used in a guild
        if (!interaction.guild) {
            await interaction.reply('This command can only be used in a server!');
            return;
        }

        // get the inputs
        const queryStr = interaction.options.getString('name', true).toLowerCase();
        const gen = interaction.options.getInteger('gen') ?? latestGen;

        // gen_ids in the dex db are stored as the lowercase abbreciations
        // so we need to convert the number to the letters
        const genAbbr = genAbbreviations[gen - 1].toLowerCase();

        /**
         * POKEDEX
         */
        if (fullDexNameQuery.pokemon.some(obj => obj.alias === queryStr)) {
            const dtQuery = await pool.query(`
            SELECT dex.pokemon.name, hp, atk, def, spa, spd, spe, weight, dex.types.name AS type, dex.abilities.name AS ability
            FROM dex.pokemon
            INNER JOIN dex.pokemon_types USING (pokemon_id)
            INNER JOIN dex.types USING (type_id)
            INNER JOIN dex.pokemon_abilities USING (pokemon_id)
            INNER JOIN dex.abilities USING (ability_id)
            WHERE dex.pokemon.alias=$1 AND dex.pokemon.gen_id=$2 ORDER BY dex.pokemon_types.order, dex.pokemon_abilities.order`, [queryStr, genAbbr]);

            interface IDBData {
                name: string,
                hp: number,
                atk: number,
                def: number,
                spa: number,
                spd: number,
                spe: number,
                weight: number,
                type: string,
                ability: string,
            }

            const dbData: IDBData[] | [] = dtQuery.rows;

            if (!dbData.length) {
                await interaction.followUp('No data found for that Pokemon!');
                return;
            }
            // extract the unique types
            // because we order by type in the PG query, the unique entries should be returned in the right order
            const typesArr = [...new Set(dbData.map(row => row.type))];

            // similarly, get the unique abilities
            const abilityArr = [...new Set(dbData.map(row => row.ability))];

            // to get the gender info and whether the abliity is hidden, we need the PS API
            // so get the mon data from that
            // ps mon keys are all lower case and remove all special characters
            const psData = pokedex[queryStr.replace(/[^a-z]/g, '')] ?? {};
  
            // get the base power of Low Kick based on the weight
            // all of the rows should have the same weight/stats, so just take the first entry
            const firstRow = dbData[0];

            let lkbp = 50;
            
            if (firstRow.weight < 10) {
                lkbp = 20;
            }
            else if (firstRow.weight < 25) {
                lkbp = 40;
            }
            else if (firstRow.weight < 50) {
                lkbp = 60;
            }
            else if (firstRow.weight < 100) {
                lkbp = 80;
            }
            else if (firstRow.weight < 200) {
                lkbp = 100;
            }
            else {
                lkbp = 120;
            }


            // forumulate the gender string
            let genderOut = '';

            if (psData.gender === 'N') {
                genderOut = 'Genderless';
            }
            else if (psData.gender === 'M') {
                genderOut = 'Male Only';
            }
            else if (psData.gender === 'F') {
                genderOut = 'Female Only';
            }
            else if (psData.genderRatio) {
                genderOut = (psData.genderRatio.F * 100).toString() + '% Female';
            }
            else {
                genderOut = '50% Female';
            }


            // set the embed color
            let embedColor = 0;
            for (const [color, value] of Object.entries(myColors)) {
                if (color.toLowerCase() === psData.color.toLowerCase()) {
                    embedColor = value;
                }
            }

            // get the sprite
            // remove any special characters that aren't - from the mon name
            let spriteName = psData.name.replace(/[^a-z0-9-]/gi, '').toLowerCase();

            // we need a special overwrite for the jangmo-o line and ho-oh because they have a dash that gets replaced
            if (spriteName === 'jangmo-o' || spriteName === 'hakamo-o' || spriteName === 'kommo-o' || spriteName === 'ho-oh') {
                spriteName = spriteName.replace('-', '');
            }

            // build the ability field
            const abilityList: string[] = [];
            for (const ability of abilityArr) {
                // get the ability key in the PS data
                const key = Object.keys(psData.abilities).find(k => psData.abilities[k as '0' | '1' | 'H'] === ability);
                abilityList.push(`${key}: ${ability}`);
            }

            // compute the BST
            const stats = [firstRow.hp, firstRow.atk, firstRow.def, firstRow.spa, firstRow.spd, firstRow.spe];
            const bst = stats.reduce((previous, current) => previous + current, 0).toString();

            // build the embed
            const embed = new EmbedBuilder()
                .setTitle(`${firstRow.name} (Gen ${gen})`)
                .addFields(
                    { name: 'Typing', value: typesArr.join(' / ') },
                    { name: 'Abilities', value: abilityList.join(' | ') },
                    { name: `Base Stats (BST: ${bst})`, value: Object.values(stats).join(' / ') },
                    { name: 'Weight', value: `${firstRow.weight} kg (${lkbp} BP)`, inline: true },
                    { name: 'Gender Rate', value: genderOut, inline: true },
                )
                .setColor(embedColor)
                .setThumbnail(`https://raw.githubusercontent.com/shinyfinder/chatot-assets/main/home-sprites/normal/${spriteName}.png`);

            if (queryStr === 'koffing') {
                embed.setDescription('Official mascot of Smogon University. Check out our [Discord](https://discord.gg/smogon)!');
                const newField: APIEmbedField = { name: 'Birthday', value: 'December 18, 2004', inline: true };
                embed.addFields(newField);
            }
            else if (queryStr === 'chatot') {
                embed.setDescription('If you\'re reading this, I hope you have a great day! ❤');
                const newField: APIEmbedField = { name: 'Favorite User', value: `<@${interaction.user.id}>`, inline: true };
                embed.addFields(newField);
                // update the avatar url if we have one
                const aviURL = interaction.client.user.avatarURL();
                if (aviURL) {
                    embed.setThumbnail(aviURL);
                }
                
            }

            await interaction.followUp({ embeds: [embed] });
        }
        /**
         * ITEMS
         */
        else if (fullDexNameQuery.items.some(obj => obj.alias === queryStr)) {
            // query the db to get the info we want
            const dtQuery = await pool.query(`
            SELECT name, description
            FROM dex.items
            WHERE dex.items.alias=$1 AND dex.items.gen_id=$2`, [queryStr, genAbbr]);

            interface IDBData {
                name: string,
                description: string,
            }

            const dbData: IDBData[] | [] = dtQuery.rows;

            if (!dbData.length) {
                await interaction.followUp('No data found for that item!');
                return;
            }

            // to get the fling/nature power info from the PS API
            // ps mon keys are all lower case and remove all special characters
            const psData = items[queryStr.replace(/[^a-z]/g, '')] ?? {};


            // build the embed
            const embed = new EmbedBuilder()
            .setTitle(`${dbData[0].name} (Gen ${gen})`)
            .setDescription(dbData[0].description)
            .setThumbnail(`https://play.pokemonshowdown.com/sprites/itemicons/${queryStr}.png`);

            if (gen >= 4) {
                if (psData.naturalGift) {
                    // const flingStr = `${psData.fling.basePower} BP` + (psData.fling.status ? ` + ${psData.fling.status}` : '') + (psData.fling.volatileStatus ? ` + ${psData.fling.volatileStatus}` : '');
                    if (gen === 4 || gen === 5) {
                        embed.addFields(
                            { name: 'Fling', value: '10 BP', inline: true },
                            { name: 'Natural Gift', value: `${psData.naturalGift.basePower - 20} BP (${psData.naturalGift.type})`, inline: true },
                        );
                    }
                    else if (gen === 6) {
                        embed.addFields(
                            { name: 'Fling', value: '10 BP', inline: true },
                            { name: 'Natural Gift', value: `${psData.naturalGift.basePower} BP (${psData.naturalGift.type})`, inline: true },
                        );
                    }
                    else {
                        embed.addFields(
                            { name: 'Fling', value: '10 BP' },
                        );
                    }
                }
                else if (psData.fling) {
                    const bp = queryStr === 'big-nugget' && gen < 8 ? '30' : psData.fling.basePower;
                    const flingStr = `${bp} BP` + (psData.fling.status ? ` + ${psData.fling.status}` : '') + (psData.fling.volatileStatus ? ` + ${psData.fling.volatileStatus}` : '');
                    embed.addFields(
                        { name: 'Fling', value: flingStr },
                    );
                }
            }
            
            await interaction.followUp({ embeds: [embed] });
        }

        /**
         * ABILITIES
         */
        else if (fullDexNameQuery.abilities.some(obj => obj.alias === queryStr)) {
            // query the db to get the info we want
            const dtQuery = await pool.query(`
            SELECT name, description
            FROM dex.abilities
            WHERE dex.abilities.alias=$1 AND dex.abilities.gen_id=$2`, [queryStr, genAbbr]);

            interface IDBData {
                name: string,
                description: string,
            }

            const dbData: IDBData[] | [] = dtQuery.rows;

            if (!dbData.length) {
                await interaction.followUp('No data found for that ability!');
                return;
            }

            // build the embed
            const embed = new EmbedBuilder()
            .setTitle(`${dbData[0].name} (Gen ${gen})`)
            .setDescription(dbData[0].description)
            .setThumbnail('https://raw.githubusercontent.com/shinyfinder/chatot-assets/main/images/abilities.png');

            await interaction.followUp({ embeds: [embed] });
        }

        /**
         * MOVES
         */
        else if (fullDexNameQuery.moves.some(obj => obj.alias === queryStr)) {
            // query the db to get the info we want
            const dtQuery = await pool.query(`
            SELECT dex.moves.name, power, accuracy, priority, target, category, pp, dex.moves.description, dex.types.name AS type
            FROM dex.moves
            INNER JOIN dex.types USING (type_id)
            WHERE dex.moves.alias=$1 AND dex.moves.gen_id=$2`, [queryStr, genAbbr]);

            interface IDBData {
                name: string,
                power: number,
                accuracy: number,
                priority: number,
                target: string,
                category: string,
                pp: number,
                description: string,
                type: string,
            }

            const dbData: IDBData[] | [] = dtQuery.rows;

            if (!dbData.length) {
                await interaction.followUp('No data found for that move!');
                return;
            }

            const firstRow = dbData[0];

            // move target
            let targetText = '';
            if (firstRow.target === 'Scripted') {
                targetText = 'Damage dealer';
            }
            else if (firstRow.target === 'Normal') {
                targetText = 'Any adjacent';
            }
            else if (firstRow.target === 'RandomNormal') {
                targetText = 'Random adjacent';
            }
            else {
                targetText = firstRow.target;
            }

            // look up the move flags from the PS data
            const psData = moves[queryStr.replace(/[^a-z]/g, '')];
            const flagArr: string[] = [];
            if (psData) {
                for (const flag of Object.keys(psData.flags)) {
                    if (flag === 'allyanim') {
                        continue;
                    }
                    else if (flag === 'bypasssub') {
                        flagArr.push('* Bypasses Substitute');
                    }
                    else if (flag === 'bite') {
                        flagArr.push('* Boosted by Strong Jaw');
                    }
                    else if (flag === 'bullet') {
                        flagArr.push('* Bullet move; blocked by Bulletproof');
                    }
                    else if (flag === 'cantusetwice') {
                        flagArr.push('* Cannot be used successfully consecutively');
                    }
                    else if (flag === 'charge') {
                        flagArr.push('* Requires charge turn');
                    }
                    else if (flag === 'contact') {
                        flagArr.push('* Makes Contact');
                    }
                    else if (flag === 'dance') {
                        flagArr.push('* Copied by Dancer');
                    }
                    else if (flag === 'defrost') {
                        flagArr.push('* Thaws user');
                    }
                    else if (flag === 'distance') {
                        flagArr.push('* Can target anywhere in Triples');
                    }
                    else if (flag === 'failcopycat') {
                        flagArr.push('* Cannot be selected byy Copycat');
                    }
                    else if (flag === 'failencore') {
                        flagArr.push('* Causes Encore to fail');
                    }
                    else if (flag === 'failinstruct') {
                        flagArr.push('* Cannoy be repeated by Instruct');
                    }
                    else if (flag === 'failmefirst') {
                        flagArr.push('* Cannot be selected by Me First');
                    }
                    else if (flag === 'failmimic') {
                        flagArr.push('* Cannot be selected by Mimic');
                    }
                    else if (flag === 'futuremove') {
                        flagArr.push('* Damanges slot after 2 turns');
                    }
                    else if (flag === 'gravity') {
                        flagArr.push('* Blocked by Gravity');
                    }
                    else if (flag === 'heal') {
                        flagArr.push('* Blocked by Heal Block');
                    }
                    else if (flag === 'mirror') {
                        flagArr.push('* Copied by Mirror Move');
                    }
                    else if (flag === 'mustpressure') {
                        flagArr.push('* Affected by Pressure when ordinarily it would not');
                    }
                    else if (flag === 'noassist') {
                        flagArr.push('* Cannot be selected by Assist');
                    }
                    else if (flag === 'nosky') {
                        flagArr.push('* Cannot be used in Sky Battle');
                    }
                    else if (flag === 'noparentalbond') {
                        flagArr.push('* Not affected by Parental Bond');
                    }
                    else if (flag === 'nosleeptalk') {
                        flagArr.push('* Cannot be selected by Sleep Talk');
                    }
                    else if (flag === 'pledgecombo') {
                        flagArr.push('* Gems will not activate. Cannot be redirected by Storm Drain / Lightning Rod.');
                    }
                    else if (flag === 'powder') {
                        flagArr.push('* Powder move; blocked by Grass-type, Overcoat, and Safety Goggles.');
                    }
                    else if (flag === 'protect') {
                        flagArr.push('* Blocked by Protect');
                    }
                    else if (flag === 'pulse') {
                        flagArr.push('* Pulse move; Boosted by Mega Launcher');
                    }
                    else if (flag === 'punch') {
                        flagArr.push('* Punching move; boosted by Iron Fist');
                    }
                    else if (flag === 'recharge') {
                        flagArr.push('* Requires recharge turn');
                    }
                    else if (flag === 'reflectable') {
                        flagArr.push('* Bounced back by Magic Coat or Magic Bounce');
                    }
                    else if (flag === 'slicing') {
                        flagArr.push('* Boosted by Sharpness');
                    }
                    else if (flag === 'snatch') {
                        flagArr.push('* Snatch-able');
                    }
                    else if (flag === 'sound') {
                        flagArr.push('* Sound-based; blocked by Soundproof');
                    }
                    else if (flag === 'wind') {
                        flagArr.push('* Activates Wind Power and Wind Rider');
                    }
                    else {
                        continue;
                    }

                }
            }

            // set the embed color
            let embedColor = 0;
            for (const [color, value] of Object.entries(myColors)) {
                if (color.toLowerCase() === firstRow.type.toLowerCase()) {
                    embedColor = value;
                }
            }

            // build the embed
            const embed = new EmbedBuilder()
            .setTitle(`${firstRow.name} (Gen ${gen})`)
            .setDescription(firstRow.description)
            .addFields(
                { name: 'Type', value: firstRow.type, inline: true },
                { name: 'Category', value: firstRow.category, inline: true },
                { name: 'Power', value: firstRow.power.toString(), inline: true },
                { name: 'Accuracy', value: firstRow.accuracy.toString(), inline: true },
                { name: 'PP', value: `${firstRow.pp} (${firstRow.pp * 1.6})`, inline: true },
                { name: 'Priority', value: firstRow.priority.toString(), inline: true },
                { name: 'Target', value: targetText },
                { name: 'Flags', value: flagArr.join('\n') || 'None' },
            )
            .setColor(embedColor)
            .setThumbnail('https://raw.githubusercontent.com/shinyfinder/chatot-assets/main/images/moves.png');
            
            
            await interaction.followUp({ embeds: [embed] });
        }

        /**
         * NATURES
         */
        else if (fullDexNameQuery.natures.some(obj => obj.alias === queryStr)) {
            // query the db to get the info we want
            const dtQuery = await pool.query(`
            SELECT name, summary
            FROM dex.natures
            WHERE dex.natures.alias=$1 AND dex.natures.gen_id=$2`, [queryStr, genAbbr]);

            interface IDBData {
                name: string,
                summary: string,
            }

            const dbData: IDBData[] | [] = dtQuery.rows;

            if (!dbData.length) {
                await interaction.followUp('No data found for that nature!');
                return;
            }

            // build the embed
            const embed = new EmbedBuilder()
            .setTitle(`${dbData[0].name} (Gen ${gen})`)
            .setDescription(dbData[0].summary)
            .setThumbnail('https://raw.githubusercontent.com/shinyfinder/chatot-assets/main/images/natures.png');

            await interaction.followUp({ embeds: [embed] });
        }

        /**
         * TYPES
         */
        else if (fullDexNameQuery.types.some(obj => obj.alias === queryStr)) {
            // query the db to get the info we want
            const dtQuery = await pool.query(`
            SELECT description, json_build_object(
                'name', name,
                'atk_effectives',
                    (SELECT coalesce(json_agg(json_build_array(tdef.name, te.modifier) ORDER BY tdef.name), '[]')
                    FROM dex.type_effectives te
                    JOIN dex.types tdef ON te.type_id_defending = tdef.type_id
                    WHERE te.type_id_attacking = types.type_id),
                'def_effectives',
                    (SELECT coalesce(json_agg(json_build_array(tatk.name, te.modifier) ORDER BY tatk.name), '[]')
                    FROM dex.type_effectives te
                    JOIN dex.types tatk ON te.type_id_attacking = tatk.type_id
                    WHERE te.type_id_defending = types.type_id)
            ) as json
            FROM dex.types
            WHERE dex.types.alias=$1 AND dex.types.gen_id=$2`, [queryStr, genAbbr]);

            interface IDBJson {
                name: string,
                atk_effectives: [string, number][],
                def_effectives: [string, number][],
            }
            
            // unpack the data
            // there should only be 1 row since we are filtering by type alias and gen_id, a combo which has a UNIQUE constraint in the schema
            const dbData: { description: string, json: IDBJson }[] | [] = dtQuery.rows;

            if (!dbData.length) {
                await interaction.followUp('No data found for that type!');
                return;
            }

            // set the embed color
            let embedColor = 0;
            for (const [color, value] of Object.entries(myColors)) {
                if (color.toLowerCase() === dbData[0].json.name.toLowerCase()) {
                    embedColor = value;
                }
            }

            // build arrays of type matchups
            // when using this type to attack another
            const atkWeak: string[] = [];
            const atkStrong: string[] = [];
            const atkImmune: string[] = [];

            // when this type gets attacked by another
            const defWeak: string[] = [];
            const defStrong: string[] = [];
            const defImmune: string[] = [];

            for (const [type, mod] of dbData[0].json.atk_effectives) {
                // no effect
                if (mod === 0) {
                    atkImmune.push(type);
                }
                // NVE
                if (mod === 0.5) {
                    atkWeak.push(type);
                }
                // SE
                else if (mod === 2) {
                    atkStrong.push(type);
                }

            }

            for (const [type, mod] of dbData[0].json.def_effectives) {
                // no effect
                if (mod === 0) {
                    defImmune.push(type);
                }
                // NVE
                if (mod === 0.5) {
                    defStrong.push(type);
                }
                // SE
                else if (mod === 2) {
                    defWeak.push(type);
                }
            }

            // build the embed
            const embed = new EmbedBuilder()
            .setTitle(`${dbData[0].json.name} (Gen ${gen})`)
            .setDescription(dbData[0].description || 'No notable interactions')
            .setColor(embedColor)
            .addFields(
                { name: `Attacking with ${dbData[0].json.name}`, value: '** **' },
                { name: 'Super effective (2x)', value: atkStrong.join(', ') || '-', inline: true },
                { name: 'Not very effective (0.5x)', value: atkWeak.join(', ') || '-', inline: true },
                { name: 'No effect (0x)', value: atkImmune.join(', ') || '-', inline: true },
                { name: '\u200b', value: '\u200b' },
                { name: `Defending as ${dbData[0].json.name}`, value: '** **' },
                { name: 'Weak to (2x)', value: defWeak.join(', ') || '-', inline: true },
                { name: 'Resists (0.5x)', value: defStrong.join(', ') || '-', inline: true },
                { name: 'Immune to (0x)', value: defImmune.join(', ') || '-', inline: true },
            )
            .setThumbnail('https://raw.githubusercontent.com/shinyfinder/chatot-assets/main/images/types.png');

            await interaction.followUp({ embeds: [embed] });
        }
        else {
            await interaction.followUp('I did not understand that input. Please select an option from the list');
        }
    },
};