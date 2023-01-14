import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
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
            .setRequired(true))
            /*
            .addChoices(
                { name: 'SV OU', value: 'SV OU' },
                { name: 'SV Ubers', value: 'SV Ubers' },
                { name: 'SV DOU', value: 'SV DOU' },
                { name: 'SV UU', value: 'SV UU' },
                { name: 'SV LC', value: 'SV LC' },
                { name: 'SV Mono', value: 'SV Mono' },
                { name: 'SV NatDex OU', value: 'SV NatDex OU' },
                { name: 'SV NatDex UU', value: 'SV NatDex UU' },
                { name: 'SV NatDex AG', value: 'SV NatDex AG' },
                { name: 'SV NatDex Mono', value: 'SV NatDex Mono' },
                { name: 'SV 1v1', value: 'SV 1v1' },
                { name: 'SV AG', value: 'SV AG' },
                { name: 'SV CAP', value: 'SV CAP' },
                { name: 'SS OU', value: 'SS OU' },
                { name: 'USUM OU', value: 'USUM OU' },
                { name: 'ORAS OU', value: 'ORAS OU' },
                { name: 'BW OU', value: 'BW OU' },
                { name: 'DPP OU', value: 'DPP OU' },
                { name: 'ADV OU', value: 'ADV OU' },
                { name: 'GSC OU', value: 'GSC OU' },
                { name: 'RBY OU', value: 'RBY OU' },
                { name: 'LGPE OU', value: 'LGPE OU' },
                { name: 'BDSP OU', value: 'BDSP OU' },
                { name: 'OM (General)', value: 'OM' },
                { name: '2v2', value: '2v2' },
                { name: 'OM Mashup', value: 'Mashup' },
                { name: 'BH', value: 'BH' },
                { name: 'MnM', value: 'MnM' },
                { name: 'STABmons', value: 'STABmons' },
                { name: 'AAA', value: 'AAA' },
                { name: 'Godly Gift', value: 'GG' },
                { name: 'NFE', value: 'NFE' },
                { name: 'VGC', value: 'VGC' },
                { name: 'BSS', value: 'BSS' },
                { name: 'test', value: 'test' },
            ))
            */
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
                const tier = json[allChannels[i]].name[0];

                // ...and the names (gen) of the meta within that tier
                const metas = Object.keys(json[allChannels[i]]);

                // loop through all of them and build the output string (gen num + tier) and rater arrays
                for (let j = 0; j < metas.length; j++) {
                    if (metas[j] === 'name') {
                        continue;
                    }
                    let stringOut = '';
                    // if the gen is a number format it as Gen + #
                    if (Number(metas[j]) < 10) {
                        stringOut = `Gen ${metas[j]} ${tier}`;
                        stringArr.push(stringOut);
                        raterArr.push(json[allChannels[i]][metas[j]]);
                    }
                    // else if it's a word, just capitalize it
                    else {
                        stringOut = `${metas[j].toUpperCase()} ${tier}`;
                        stringArr.push(stringOut);
                        raterArr.push(json[allChannels[i]][metas[j]]);
                    }
                }
            }
        }
        // if they did specify a meta, parse it and return the list of raters
        else {
            const [valid, channel, gen] = validateMeta(meta);
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
            const pingOut = taggablePings.join(', ');


            // build the embed for output
            const embed = new EmbedBuilder()
                .setTitle(`Raters for ${meta}`)
                .setDescription(`${pingOut}`);

            // post it to the channel
            await interaction.channel?.send({ embeds: [embed] });
        }


    },
};