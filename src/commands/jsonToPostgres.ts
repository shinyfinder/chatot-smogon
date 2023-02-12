import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import { SlashCommand } from '../types/slash-command-base';
import { getWorkingDir } from '../helpers/getWorkingDir.js';
import { readFileSync } from 'fs';
import * as path from 'path';
import { pool } from '../helpers/createPool.js';
/**
 * Command to test the bot is online and working.
 * @param data SlashCommandBuilder() instance from discord.js
 * @returns Replies Pong! in the chat
 *
 * Can be used as a template for future commands
 */
interface Data {
    [key: string]: { [key: string]: string[] },
}
export const command: SlashCommand = {
    // setup the slash command builder
    data: new SlashCommandBuilder()
        .setName('json2postgres')
        .setDescription('Converts a json file to a Postgres table')
        .setDefaultMemberPermissions(0),

    // execute our desired task
    async execute(interaction: ChatInputCommandInteraction) {
        // load the json
        // ping the relevant parties
        // retrieve the info from the db
        const __dirname = getWorkingDir();
        const filepath = path.join(__dirname, '../src/db/raters.json');
        const raterDB = readFileSync(filepath, 'utf8');
        const json = JSON.parse(raterDB) as Data;

        // loop over the json
        for (const key in json) {
            // key is the channelid

            // get the name for this key (the meta)
            let name = json[key].name[0];

            // skip over 'Other'
            if (name === 'Other') {
                continue;
            }

            // rename old-gen OU
            if (name === 'Old Gen OU') {
                name = 'OU';
            }

            // extract the object
            const obj = json[key];
            let nameOut = name;
            let key2Out = '';
            // loop over the entries in the extracted object
            for (let key2 in obj) {
                // key2 is the gen
                
                // skip over the name field
                if (key2 === 'name') {
                    continue;
                }

                // convert the numbers to the gen prefix
                if (key2 === '1') {
                    key2Out = 'RB';
                }
                else if (key2 === '2') {
                    key2Out = 'GS';
                }
                else if (key2 === '3') {
                    key2Out = 'RS';
                }
                else if (key2 === '4') {
                    key2Out = 'DP';
                }
                else if (key2 === '5') {
                    key2Out = 'BW';
                }
                else if (key2 === '5') {
                    key2Out = 'BW';
                }
                else if (key2 === '6') {
                    key2Out = 'XY';
                }
                else if (key2 === '7') {
                    key2Out = 'SM';
                }
                else if (key2 === '8') {
                    key2Out = 'SS';
                }
                else if (key2 === '9') {
                    key2Out = 'SV';
                }
                else if (key2 === 'lgpe') {
                    key2Out = 'LGPE';
                }
                else if (key2 === 'bdsp') {
                    key2Out = 'BDSP';
                }


                /* rename lgpe to lgpe ou and bdsp to bdsp ou
                if (name === 'OU' && (key2 === 'lgpe' || key2 === 'bdsp')) {
                    nameOut = `${key2.toUpperCase()} ${name}`;
                }
                */

                // get the array of raters
                const raters = obj[key2];
                
                // natdex non-ou handler
                if (name === 'Natdex Non-OU') {
                    if (key2 === 'mono') {
                        nameOut = 'NatDex Mono';
                        key2Out = 'SV';
                    }
                    else {
                        nameOut = `NatDex ${key2.toUpperCase()}`;
                        key2Out = 'SV';
                    }

                }

                // OM handler
                if (name === 'OM') {
                    if (key2 === 'mnm') {
                        nameOut = 'MnM';
                    }
                    else if (key2 === 'stabmons') {
                        nameOut = 'STABmons';
                    }
                    else if (key2 === 'omm') {
                        nameOut = 'OM Mashup';
                    }
                    else if (key2 === 'om') {
                        nameOut = 'General OM';
                    }
                    else {
                        nameOut = key2.toUpperCase();
                    }
                    key2Out = 'SV';
                }

                // loop over the array of userids
                for (const element of raters) {
                    await pool.query('INSERT INTO raters (channelid, meta, gen, userid) VALUES ($1, $2, $3, $4)', [key, nameOut, key2Out, element]);    
                }
            }
        }
        await interaction.reply('done');

    },
};