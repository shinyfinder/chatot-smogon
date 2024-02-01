import { SlashCommandBuilder, ChatInputCommandInteraction, Channel, ChannelType, PermissionFlagsBits, SlashCommandSubcommandBuilder, SlashCommandSubcommandGroupBuilder, AutocompleteInteraction } from 'discord.js';
import { SlashCommand } from '../types/slash-command-base';
import config from '../config.js';
import { checkChanPerms } from '../helpers/checkChanPerms.js';
import { formats } from '../helpers/loadDex.js';
import { pool } from '../helpers/createPool.js';
import { validateAutocomplete } from '../helpers/validateAutocomplete.js';
/**
 * Command to dump the line count of the comp helpers in the RMT channels of the main Smogon discord.
 * Line counts are calcuated over a specified date range.
 *
 * @param start Start date to search over
 * @param end End date to search over
 * @returns CSV to the channel of userID, username, line count pairs
 *
 */
export const command: SlashCommand = {
    global: false,
    guilds: ['192713314399289344'],
    // setup the slash command
	data: new SlashCommandBuilder()
		.setName('rmt')
		.setDescription('Manages the RMT channels and extracts linecounts')
        .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
        .setDMPermission(false)
        /**
         * LINECOUNTS
         */
        .addSubcommand(new SlashCommandSubcommandBuilder()
            .setName('linecount')
            .setDescription('Dumps line counts from RMT channels over a specified date range')
            .addStringOption(option =>
                option.setName('start')
                .setDescription('Search range start date. E.g. Jan 1 2022')
                .setRequired(true))
            .addStringOption(option =>
                option.setName('end')
                .setDescription('Search range end date. E.g. Jan 31 2022')
                .setRequired(true)))

        
        /**
         * CHANNELS
         */
        .addSubcommandGroup(new SlashCommandSubcommandGroupBuilder()
            .setName('channel')
            .setDescription('Manages the tracked RMT channels')

            /**
             * CHANNEL - ADD
             */
            .addSubcommand(new SlashCommandSubcommandBuilder()
                .setName('add')
                .setDescription('Adds a channel to the track list for the specified meta')
                .addChannelOption(option =>
                    option.setName('channel')
                    .setDescription('The channel to track')
                    .setRequired(true)
                    .addChannelTypes(ChannelType.GuildText, ChannelType.PublicThread, ChannelType.PrivateThread))
                .addStringOption(option =>
                    option.setName('meta')
                    .setDescription('The meta to track in the specified channel')
                    .setRequired(true)
                    .setAutocomplete(true)))

            /**
             * CHANNEL - REMOVE
             */
            .addSubcommand(new SlashCommandSubcommandBuilder()
                .setName('remove')
                .setDescription('Stops tracking a channel for RMT, optionally for the specified meta')
                .addChannelOption(option =>
                    option.setName('channel')
                    .setDescription('The channel to no longer track')
                    .setRequired(true)
                    .addChannelTypes(ChannelType.GuildText, ChannelType.PublicThread, ChannelType.PrivateThread))
                .addStringOption(option =>
                    option.setName('meta')
                    .setDescription('The meta to no longer track in the specified channel')
                    .setRequired(false)
                    .setAutocomplete(true)))),

    // prompt the user with autocomplete options since there are too many tiers to have a selectable list
    async autocomplete(interaction: AutocompleteInteraction) {
        const focusedOption = interaction.options.getFocused(true);

        if (focusedOption.name === 'meta') {
            const enteredText = focusedOption.value.toLowerCase();

            const filteredOut: {name: string, value: string }[] = [];
            // filter the options shown to the user based on what they've typed in
            // everything is cast to lower case to handle differences in case
            for (const pair of formats) {
                if (filteredOut.length < 25) {
                    const nameLower = pair.name.toLowerCase();
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

    // execute the code
	async execute(interaction: ChatInputCommandInteraction) {
        
        if (interaction.options.getSubcommand() === 'linecount') {
            await interaction.deferReply();
            // check to make sure it's actually in a guild and used in the main server
            // this should always happen, since this command is a guild command
            const allowedGuildID = config.MODE === 'dev' ? '1040378543626002442' : '192713314399289344';
            const roleFetchID = config.MODE === 'dev' ? '1046554598783062066' : '630430864634937354';

            if (!interaction.guild || interaction.guild.id !== allowedGuildID) {
                await interaction.followUp('You must use this command in the Smogon main server!');
                return;
            }

            // fetch the userlist from the interaction channel
            const smogon = interaction.client.guilds.cache.get(allowedGuildID);

            if (smogon === undefined) {
                return;
            }
            await smogon?.members.fetch();
            // await interaction.guild.members.fetch();

            // filter the users by the desired role
            // here the id is the role id for comp helpers
            const roleFetch = interaction.guild.roles.cache.get(roleFetchID);
            

            // typecheck roleFetch to make sure you got the data
            if (roleFetch === undefined) {
                await interaction.followUp('An error occured fetching the data from the API');
                return;
            }

            // filter the members with the comp helper role out of the userlist
            const compHelpers = roleFetch.members.map(m => m.user.id);

            // extract the start and end dates from the input
            const startEntry = interaction.options.getString('start', true);
            const endEntry = interaction.options.getString('end', true);

            // try to parse the inputs as dates
            const startDateIn = new Date(startEntry);
            const endDateIn = new Date(endEntry);

            // if either of the inputs are not valid dates, return
            if (isNaN(startDateIn.valueOf()) || isNaN(endDateIn.valueOf())) {
                await interaction.followUp(`There was an error parsing your dates. I received ${startDateIn.toString()} and ${endDateIn.toString()}. Check your input and try again.`);
                return;
            }

            // format the dates for output to confirm to the user the range you're searching over
            const options: Intl.DateTimeFormatOptions = { month : 'long' };

            // convert the month to words so there's no ambiguity in date formats
            const startMonth = new Intl.DateTimeFormat('en-US', options).format(startDateIn);
            const endMonth = new Intl.DateTimeFormat('en-US', options).format(endDateIn);

            // concatinate the month, day, and year into a string
            const startFilename = startDateIn.getDate().toString() + startMonth + startDateIn.getFullYear().toString();
            const endFilename = endDateIn.getDate().toString() + endMonth + endDateIn.getFullYear().toString();

            // shift the end date so that it searches until the end of the day
            const endDate = endDateIn.setHours(23, 59, 59, 999);

            // get the timestamp for the end of the current day to prevent searching into the future
            const curTime = new Date().setHours(23, 59, 59, 999);


            // convert the timestamps to discord snowflakes
            // see https://discord.com/developers/docs/reference#snowflakes

            const startDateDisc = Math.floor((startDateIn.valueOf() - 1420070400000) * Math.pow(2, 22));
            const endDateDisc = Math.floor((endDate - 1420070400000) * Math.pow(2, 22));
            const curTimeDisc = Math.floor((curTime - 1420070400000) * Math.pow(2, 22));

            // check if either date is into the future or less than the discord epoch
            if (startDateDisc < 0 || startDateDisc > curTimeDisc || endDateDisc > curTimeDisc) {
                await interaction.followUp('Dates entered are either too far into the future or past. Please retry');
                return;
            }

            // check for the necessary permissions based on where it's used
            // also make sure it's used in a channel (which it has to be, but we have to type check it anyway)
            let canComplete = true;
            if (interaction.channel?.type === ChannelType.GuildText) {
                canComplete = await checkChanPerms(interaction, interaction.channel, ['ViewChannel', 'SendMessages', 'AttachFiles']);
            }
            else if (interaction.channel?.type === ChannelType.PublicThread || interaction.channel?.type === ChannelType.PrivateThread) {
                canComplete = await checkChanPerms(interaction, interaction.channel, ['ViewChannel', 'SendMessagesInThreads', 'AttachFiles']);
            }
            // this should never trigger, but technically we should typecheck
            else {
                await interaction.followUp('This command must be used in a channel.');
                return;
            }
            // if we lack the perms, return
            // we already let them know
            if (!canComplete) {
                return;
            }

            // all checks have passed, so let the user know you're processing messages
            await interaction.followUp(`Parsing messages from ${ startDateIn.toString() } to ${ endDateIn.toString() }...`);

            // loop through the different RMT channels to get all of the messages
            // forums
            let channelIDs: string[] = [];
            if (config.MODE === 'dev') {
                channelIDs = [
                    '1060628096442708068',
                ];
            }
            else {
                channelIDs = [
                    // pu
                    '1061136198208344084',
                    // nu
                    '1061136091056439386',
                    // ru
                    '1061135917160607766',
                    // lc
                    '1061135027599048746',
                    // bss
                    '1060690402711183370',
                    // other
                    '1060682530094862477',
                    // ag
                    '1060682013453078711',
                    // old gen ou
                    '1060339824537641152',
                    // natdex non ou
                    '1060037469472555028',
                    // uber
                    '1059901370477576272',
                    // uu
                    '1059743348728004678',
                    // nat dex ou'
                    '1059714627384115290',
                    // cap
                    '1059708679814918154',
                    // vgc
                    '1059704283072831499',
                    // 1v1 -- old
                    '1059673638145622096',
                    // 1v1 -- new
                    '1089349311080439882',
                    // mono
                    '1059658237097545758',
                    // om
                    '1059657287293222912',
                    // dou
                    '1059655497587888158',
                    // ou
                    '1059653209678950460',
                    // rmt1 -- legacy system
                    '630478290729041920',
                    // rmt2 -- legacy system
                    '635257209416187925',
                ];
            }
            

            // variable preallocation for getting the users who posted messages in the RMT channels
            const users: string[] = [], userIDs: string[] = [], charCount: number[] = [];
            let ID = '', msgPointer = '', channel: Channel | null, username = '';
            let breakflag = false;
            let characters = 0;

            // loop over the different channels
            for (let i = 0; i < channelIDs.length; i++) {
                // load the channel
                channel = await interaction.client.channels.fetch(channelIDs[i]);

                if (!(channel?.type === ChannelType.GuildText || channel?.type === ChannelType.PublicThread)) {
                    await interaction.followUp({ content: 'There was an error fetching the channels in the API, please retry', ephemeral: true });
                    return;
                }

                // set the pointer to be the current timestamp for the first iteration
                msgPointer = endDateDisc.toString();

                // reset the breakflag on the next iteration
                breakflag = false;

                // call the API to get the messages, 100 at a time (API limit)
                while (msgPointer >= startDateDisc.toString() && !breakflag) {
                    const messages = await channel.messages.fetch({ limit: 100, cache: false, before: msgPointer });
                    // once a set of 100 has been fetched, parse each message to get the author
                    // loop through each message
                    messages.forEach(msg => {
                        // get the snowflake for the last processed message from the list
                        // this becomes the pointer for the next iteration
                        msgPointer = msg.id;

                        // if the user is not a comp helper, don't log the message
                        if (!compHelpers.includes(msg.author.id)) {
                            return;
                        }

                        // check if the fetched message is greater than the start date
                        // if we still have not reached the start date (message newer than inputted start), keep looping
                        // mesages are fetched newest to oldest
                        if (Number(msgPointer) >= startDateDisc) {
                            // extract the ID and account name of the user who sent the message
                            // also get the character length of the message
                            ID = msg.author.id;
                            username = msg.author.tag;
                            characters = msg.content.length;

                            // if the username includes a comma, remove it
                            if (username.includes(',')) {
                                username = username.replaceAll(',', '');
                            }

                            // log it to the arrays for further processing
                            userIDs.push(ID);
                            users.push(username);
                            charCount.push(characters);
                        }
                    });

                    // once you've processed the set of fetched messages, check how many you processed
                    // if this is less than the requested limit (100), there are no more messages to fetch
                    // break the loop
                    if (messages.size < 100) {
                        breakflag = true;
                    }
                }

            }

            // create object to hold the line count, with the keys as the user ID
            // format: { "ID": num }
            const counts: { [key: string]: number; } = {};

            // create an object to hold (ID, username) pairs
            // format: { "ID": "username" }
            const filteredUsers: { [key: string]: string; } = {};

            // create an object to hold (ID, characterCount) pairs
            // format: { "ID": num }
            const filteredChars: { [key: string]: number; } = {};

            // index of the ID in the userID array to get the associated account name from the users array
            let idIndex = 0;

            /**
             * Build the line count and filtered username objects
             *
             * At the moment, we have arrays that log the ID and username of every message from users with the desired role.
             * First, count the total number of times an ID appears in the ID array userIDs. This is the line count over the time period.
             * This will reduce the size of the array so that each ID appears once, along with the number of times it appeared in userIDs array.
             * Store this in the counts object.
             *
             * To filter the usernames, find the first index each ID appears in the original ID array (userIDs)
             * The ID index in userIDs corresponds to username index in the users array.
             * Use this value to pair the username with the ID, and store it in the filteredUsers object.
             * If an ID is repeated in the userIDs array, the name is overwritten in the filteredUsers object.
             * This means if the user changed their account name during the time period, the name that is returned is their most recent one.
             * This does not affect the line counts since they are summed based on user ID, which is immutable.
             */

            // loop through the array of user IDs
            // counts[id] || 0 returns the value of counts[id] if it is set, otherwise 0
            // then add 1
            userIDs.forEach(id => {
                // talley the number of lines from the user
                // if this is a new ID, intiate the entry with a count of 1
                // otherwise, add 1 to the previous number
                counts[id] = (counts[id] || 0) + 1;

                // get the index of the id in the userID array, to lookup the username in the users array
                idIndex = userIDs.indexOf(id);

                // add the id/username pair to the filteredUsers object, with the key as the user ID and the value as their username
                filteredUsers[id] = users[idIndex];
            });

            // find the average character count
            // the data has already been filtered, so we can loop through the filtered objects to compute the average
            // we can use this same loop to constructed the object for output
            const list: [string, string, number, number][] = [];
            for (const id in counts) {
                // find all occurances of the ID in the userIDs array
                const indices: number[] = [];

                for (let i = 0; i < userIDs.length; i++) {
                    if (userIDs[i] === id) {
                        indices.push(i);
                    }
                }

                // add the id/character count pair to the filteredChars object, with the key as the ID as the value as the sum of the charCounts
                // if the entry exists, add the character count to the existing value
                // else, add 0 and initialize to the character count
                for (let i = 0; i < indices.length; i++) {
                    filteredChars[id] = (filteredChars[id] || 0) + charCount[indices[i]];
                }

                // compute the average
                // if they don't have any lines, don't do any math
                if (counts[id] === 0) {
                    filteredChars[id] = 0;
                }
                else {
                    filteredChars[id] = Number((filteredChars[id] / counts[id]).toFixed(3));
                }

                // push it to the array for sorting
                list.push([
                    id,
                    filteredUsers[id],
                    counts[id],
                    filteredChars[id],
                ]);
            }

            // sort the list by linecount (most to least)
            list.sort((a, b) => b[2] - a[2]);

            // convert [userIDs, usernames, counts, avgChar] to a CSV for output
            // first, preallocate the variable containing the CSV
            let csv = '';

            // loop through the sorted list and concat to a CSV
            for (let i = 0; i < list.length; i++) {
                csv += `${list[i][0]},${list[i][1]},${list[i][2]},${list[i][3]}\n`;
            }

            // output the CSV to wherever the interaction occurred
            // this will take a variable amount of time, so it's best to send as a new message
            // data must be stored in a buffer to create an attachment, so do that first
            const buf = Buffer.from(csv);

            // do one last bit of type checking
            if (interaction.channel === null || interaction.member === null) {
                await interaction.followUp({ content: 'An error occurred.', ephemeral: true });
                return;
            }

            // let the user know there aren't any lines rather than posting a blank file
            if (csv == '') {
                await interaction.followUp('No lines found over that time period.');
                return;
            }
            // post it to the channel the interaction occurred and tag the person who initiated
            await interaction.channel.send({ content: `Here is the file, <@${interaction.member.user.id}>`, files: [
                { attachment: buf, name: `${startFilename}-${endFilename}_linecount.csv` },
            ] });
        }
        else if (interaction.options.getSubcommand() === 'add') {
            await interaction.deferReply({ ephemeral: true });

            // inputs
            const chan = interaction.options.getChannel('channel', true, [ChannelType.GuildText, ChannelType.PublicThread, ChannelType.PrivateThread]);
            const meta = interaction.options.getString('meta', true);

            // make sure we have the necessary perms to post there
            let canComplete = true;
            if (chan.type === ChannelType.PublicThread || chan.type === ChannelType.PrivateThread) {
                canComplete = await checkChanPerms(interaction, chan, ['ViewChannel', 'SendMessagesInThreads']);
            }
            else if (chan.type === ChannelType.GuildText) {
                canComplete = await checkChanPerms(interaction, chan, ['ViewChannel', 'SendMessages']);
            }

            if (!canComplete) {
                return;
            }

            if (!validateAutocomplete(meta, formats)) {
                await interaction.followUp('Invalid meta choice; please pick one from the list');
                return;
            }

            // add it to the db
            await pool.query('INSERT INTO chatot.rmts (channelid, meta) VALUES ($1, $2) ON CONFLICT (channelid, meta) DO NOTHING', [chan.id, meta]);

            // done
            await interaction.followUp('Channel tracking updated');

        }
        else if (interaction.options.getSubcommand() === 'remove') {
            await interaction.deferReply({ ephemeral: true });
            
            // inputs
            const chan = interaction.options.getChannel('channel', true, [ChannelType.GuildText, ChannelType.PublicThread, ChannelType.PrivateThread]);
            const meta = interaction.options.getString('meta');
            
            if (meta) {
                if (!validateAutocomplete(meta, formats)) {
                    await interaction.followUp('Invalid meta choice; please pick one from the list');
                    return;
                }
                
                // remove from the db
                await pool.query('DELETE FROM chatot.rmts WHERE channelid=$1 AND meta=$2', [chan.id, meta]);
            }
            else {
                // delete all the rows using this channel from the db
                await pool.query('DELETE FROM chatot.rmts WHERE channelid=$1', [chan.id]);
            }

            // done
            await interaction.followUp('Channel tracking updated');

        }

     
	},
};