import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import { readFileSync, writeFileSync } from 'fs';
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
        .setName('addrater')
        .setDescription('Adds a team rater to the specified meta')
        .addStringOption(option =>
            option.setName('meta')
            .setDescription('Meta which the user rates teams for')
            .setRequired(true))
        .addUserOption(option =>
            option.setName('user')
            .setDescription('User to be added (can accept IDs)')
            .setRequired(true))
        .setDMPermission(false)
        .setDefaultMemberPermissions(0),

    // execute our desired task
    async execute(interaction: ChatInputCommandInteraction) {
         // get the inputs
         const meta = interaction.options.getString('meta')?.toLowerCase();
         const user = interaction.options.getUser('user');

         // check for null user and meta to make TS happy
        // this should never be null since it is a required field
        if (user === null || meta === undefined) {
            return;
        }

        // make sure the provided meta is accurate
        const [valid, channel, gen] = validateMeta(meta);

        // if it's invalid input, let them know and return
        // we resuse the channel variable to include the list of allowable names if it's invalid
        if (!valid) {
            await interaction.reply({ content: `I did not recognize that meta or am not setup to track it. Please choose one from the following (case insensitive) and try again:\`\`\`${channel}\`\`\``, ephemeral: true });
        }

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

        // retrieve the rater list from the json
        const currentRaters = json[channel][gen];

        // if this user already exists in the list, let the user know -- nothing to do
        // else, create the entry and save the file
        if (currentRaters.includes(user.id)) {
            await interaction.reply({ content: 'User is already a team rater for this meta!', ephemeral: true });
            return;
        }
        else {
            // add the entry to the json
            json[channel][gen] = currentRaters.concat(user.id);
            // write the json to local storage and catch any errors
            try {
                writeFileSync(filepath, JSON.stringify(json));
                await interaction.reply(`${user.username} added to the list of ${meta} raters.`);
            }
            catch (err) {
                console.error(err);
            }
        }


    },
};