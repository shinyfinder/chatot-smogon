import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder, MessageReaction, User, APIEmbedField } from 'discord.js';
import { readFileSync } from 'fs';
import * as path from 'path';
import { validateMeta } from '../helpers/validateMeta';

/**
 * Command to add a team rater
 * @param user Username or ID to add to the list of raters
 */
interface Data {
    [key: string]: { [key: string]: string[] },
}

export = {
    // setup the slash command builder
    data: new SlashCommandBuilder()
        .setName('listraters')
        .setDescription('Replies with a list of all of the team raters, optionally of a specified meta')
        .addStringOption(option =>
            option.setName('meta')
            .setDescription('Meta which the user rates teams for')
            .setRequired(false))
        .setDMPermission(false)
        .setDefaultMemberPermissions(0),

    // execute our desired task
    async execute(interaction: ChatInputCommandInteraction) {
        // get the inputs
        const meta = interaction.options.getString('meta')?.toLowerCase();

        // load the rater file
        // we point back to the one in src so that if we have to rebuild/restart the bot is it not overwritten
        const filepath = path.join(__dirname, '../../src/db/raters.json');
        let json: Data = {};
        try {
            const raterDB = readFileSync(filepath, 'utf8');
            json = JSON.parse(raterDB) as Data;
        }
        catch (err) {
            console.error(err);
        }

        // if they didn't specify a meta, list all of the raters
        const stringArr: string[] = [];
        const raterArr: string[][] = [];
        if (meta === undefined) {
            // get the list of the stored metas
            const allChannels = Object.keys(json);
            for (let i = 0; i < allChannels.length; i++) {
                // get the name of the tier
                let tier = json[allChannels[i]].name[0];
                // mod the format a bit to clean up the output
                if (tier === 'Old Gen OU') {
                    tier = 'OU';
                }
                else if (tier === 'Other') {
                    tier = '';
                }

                // ...and the names (gen) of the meta within that tier
                const metas = Object.keys(json[allChannels[i]]);

                // loop through all of them and build the output string (gen num + tier) and rater arrays
                for (let j = 0; j < metas.length; j++) {
                    let metaOut = metas[j];
                    if (metaOut === 'name') {
                        continue;
                    }
                    else if (metaOut === 'om') {
                        metaOut = 'General';
                    }
                    let stringOut = '';
                    // if the gen is a number format it as Gen + #
                    if (Number(metaOut) < 10) {
                        stringOut = `GEN ${metaOut} ${tier.toUpperCase()}`;
                        stringArr.push(stringOut);
                        raterArr.push(json[allChannels[i]][metas[j]]);
                    }
                    // if the tier is NatDex Non-OU, format it a bit differently
                    else if (tier === 'NatDex Non-OU') {
                        stringOut = `GEN 9 NATDEX ${metaOut.toUpperCase()}`;
                        stringArr.push(stringOut);
                        raterArr.push(json[allChannels[i]][metas[j]]);
                    }
                    // else if it's a word, just capitalize it
                    else {
                        stringOut = `${metaOut.toUpperCase()} ${tier.toUpperCase()}`;
                        stringArr.push(stringOut);
                        raterArr.push(json[allChannels[i]][metas[j]]);
                    }
                }
            }

            // build the paginated embed
            // create a filter to only look for the page navigation emojis and only from those from the interaction initiator
            const filter = (reaction: MessageReaction, user: User) => {
                return (reaction.emoji.name === '◀️' || reaction.emoji.name === '▶️') && user.id === interaction.user.id;
            };

            const maxFields = 10;
            const maxPages = Math.ceil(stringArr.length / (maxFields));
            const embedFieldArr: APIEmbedField[][] = [];
            let page = 0;
            const embed = new EmbedBuilder().setTitle('Team Raters');
            for (let k = 0; k < maxPages; k++) {
                const embedPageStrings = stringArr.slice(k * maxFields, k * maxFields + maxFields);
                const embedPageRaters = raterArr.slice(k * maxFields, k * maxFields + maxFields);
                const tempEmbedFieldArr: APIEmbedField[] = [];
                for (let i = 0; i < embedPageStrings.length; i++) {
                    // format the raters into a taggable string list
                    const taggablePings: string[] = [];
                    let pingOut = '';
                    for (const id of embedPageRaters[i]) {
                        taggablePings.push('<@' + id + '>');
                    }
                    if (!taggablePings.length) {
                        pingOut = 'None';
                    }
                    else {
                        pingOut = taggablePings.join(', ');
                    }
                    tempEmbedFieldArr.push(
                        { name: embedPageStrings[i], value: pingOut },
                    );
                }
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
            await interaction.reply('Please react to the following message to navigate through the pages. Embeds do not ping.');
            const message = await interaction.channel?.send({ embeds: [embed] });
            if (message === undefined) {
                await interaction.reply({ content: 'An error occurred. Please try again', ephemeral: true });
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
                            await message.edit({ embeds: [newEmbed] });
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
                            await message.edit({ embeds: [newEmbed] });
                        }

                        // remove the user's reaction so they can react again
                        // const userReactions = message.reactions.cache.filter(rxn => rxn.users.cache.has(interaction.user.id));

                        await reaction.users.fetch();
                        try {
                            await reaction.users.remove(interaction.user.id);
                        }
                        catch (error) {
                            console.error(error);
                        }
                    }
                })();
            });
        }
        // if they did specify a meta, parse it and return the list of raters
        else {
            const [valid, channel, gen] = validateMeta(meta);
            let pingOut = '';
            // if it's invalid input, let them know and return
            // we resuse the channel variable to include the list of allowable names if it's invalid
            if (!valid) {
                await interaction.reply({ content: `I did not recognize that meta or am not setup to track it. Please choose one from the following (case insensitive) and try again:\`\`\`${channel}\`\`\``, ephemeral: true });
                return;
            }

            // retrieve the rater list from the json
            const currentRaters = json[channel][gen];

            // format the raters into a taggable string list
            const taggablePings: string[] = [];

            for (const id of currentRaters) {
                taggablePings.push('<@' + id + '>');
            }
            if (!taggablePings.length) {
                pingOut = 'None';
            }
            else {
                pingOut = taggablePings.join(', ');
            }

            // build the embed for output
            const embed = new EmbedBuilder()
                .setTitle(`Raters for ${meta}`)
                .setDescription(`${pingOut}`);

            // post it to the channel
            await interaction.reply('One second while I look those up');
            await interaction.channel?.send({ embeds: [embed] });
            return;
        }


    },
};