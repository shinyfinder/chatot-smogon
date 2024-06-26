import { SlashCommandBuilder, ChatInputCommandInteraction, SlashCommandSubcommandBuilder, ChannelType, SnowflakeUtil } from 'discord.js';
import { SlashCommand } from '../types/slash-command-base';
import { errorHandler } from '../helpers/errorHandler.js';
import { pool } from '../helpers/createPool.js';
import { alertUser } from '../helpers/reminderWorkers.js';
import { checkChanPerms } from '../helpers/checkChanPerms.js';
/**
 * Creates a timer to DM a user after a specifc time with a specified message
 */
export const command: SlashCommand = {
    global: true,
    guilds: [],
    // setup the slash command builder
    data: new SlashCommandBuilder()
        .setName('remindme')
        .setDescription('Has the bot send you a reminder at the specified time')
        /**
         * BASIC
         */
        .addSubcommand(new SlashCommandSubcommandBuilder()
            .setName('basic')
            .setDescription('Set a reminder from a list of timeframes')
            .addStringOption(option =>
                option.setName('method')
                .setDescription('The method the bot will use to remind you. Choosing post will remind you in the interaction channel.')
                .addChoices(
                    { name: 'DM', value: 'dm' },
                    { name: 'post', value: 'post' },
                )
                .setRequired(true))
            .addNumberOption(option =>
                option.setName('time')
                .setDescription('When the bot will remind you')
                .addChoices(
                    { name: '30 Min', value: 0.5 * 60 * 60 * 1000 },
                    { name: '1 Hour', value: 1 * 60 * 60 * 1000 },
                    { name: '1.5 Hour', value: 1.5 * 60 * 60 * 1000 },
                    { name: '2 Hour', value: 2 * 60 * 60 * 1000 },
                    { name: '2.5 Hour', value: 2.5 * 60 * 60 * 1000 },
                    { name: '3 Hour', value: 3 * 60 * 60 * 1000 },
                    { name: '4 Hour', value: 4 * 60 * 60 * 1000 },
                    { name: '5 Hour', value: 5 * 60 * 60 * 1000 },
                    { name: '6 Hour', value: 6 * 60 * 60 * 1000 },
                    { name: '12 Hour', value: 12 * 60 * 60 * 1000 },
                    { name: '18 Hour', value: 18 * 60 * 60 * 1000 },
                    { name: '1 Day', value: 24 * 60 * 60 * 1000 },
                    { name: '2 Day', value: 2 * 24 * 60 * 60 * 1000 },
                    { name: '3 Day', value: 3 * 24 * 60 * 60 * 1000 },
                    { name: '4 Day', value: 4 * 24 * 60 * 60 * 1000 },
                    { name: '5 Day', value: 5 * 24 * 60 * 60 * 1000 },
                )
                .setRequired(true))
            .addStringOption(option =>
                option.setName('message')
                .setDescription('Your reminder')
                .setRequired(true)))


        /**
         * CUSTOM
         */
        .addSubcommand(new SlashCommandSubcommandBuilder()
            .setName('custom')
            .setDescription('Set a reminder for a custom time')
            .addStringOption(option =>
                option.setName('method')
                .setDescription('The method the bot will use to remind you. Choosing post will remind you in the interaction channel.')
                .addChoices(
                    { name: 'DM', value: 'dm' },
                    { name: 'post', value: 'post' },
                )
                .setRequired(true))
            .addIntegerOption(option => 
                option.setName('month')
                .setDescription('Date month (number)')
                .setMinValue(1)
                .setMaxValue(12)
                .setRequired(true))
            .addIntegerOption(option => 
                option.setName('day')
                .setDescription('Date day (number)')
                .setMinValue(1)
                .setMaxValue(31)
                .setRequired(true))
            .addIntegerOption(option => 
                option.setName('year')
                .setDescription('Date year')
                .setMinValue(2000)
                .setMaxValue(3000)
                .setRequired(true))
            .addIntegerOption(option => 
                option.setName('hour')
                .setDescription('Date hour (USE 24 HR FORMAT)')
                .setMinValue(0)
                .setMaxValue(23)
                .setRequired(true))
            .addIntegerOption(option => 
                option.setName('minute')
                .setDescription('Date mintue')
                .setMinValue(0)
                .setMaxValue(59)
                .setRequired(true))
            .addIntegerOption(option => 
                option.setName('second')
                .setDescription('Date second')
                .setMinValue(0)
                .setMaxValue(59)
                .setRequired(true))
            .addNumberOption(option => 
                option.setName('offset')
                .setDescription('The UTC/GMT offset of the datetime you entered. Positive/negative number')
                .setRequired(true))
            .addStringOption(option =>
                option.setName('message')
                .setDescription('Your reminder')
                .setRequired(true)))
        
        /**
         * MANAGE
         */
        .addSubcommand(new SlashCommandSubcommandBuilder()
            .setName('manage')
            .setDescription('Retrieves the reminders set for the current user or deletes the provided reminder')
            .addIntegerOption(option =>
                option.setName('delete')
                .setDescription('Reminder ID to remove.')
                .setRequired(false)))
        .setDMPermission(false) as SlashCommandBuilder,

    // execute our desired task
    async execute(interaction: ChatInputCommandInteraction) {
        await interaction.deferReply({ ephemeral: true });

        if (interaction.options.getSubcommand() === 'manage') {
            // retrieve user input
            const deletionID = interaction.options.getInteger('delete');

            interface IReminderPG {
                timerid: number,
                channelid: string,
                tstamp: Date,
                msg: string,
            }

            // if they didn't enter a number, retrieve all of the ones for the user
            if (deletionID === null) {
                const allRemsPG = await pool.query('SELECT timerid, channelid, tstamp, msg FROM chatot.reminders WHERE userid=$1', [interaction.user.id]);
                const allRem: IReminderPG[] | [] = allRemsPG.rows;

                let remOut = 'Here are your reminders. Format is ID: `time` message\n';

                // loop over the reminders to create the output string
                for (const rem of allRem) {
                    remOut += `- ${ rem.timerid }: <t:${ Math.floor(rem.tstamp.valueOf() / 1000) }:f> ${ rem.msg }\n`;
                }

                // post 
                await interaction.followUp(remOut);
            }
            // if they did enter a number, delete the reminder from the db and deschedule
            // also match with their userid so that someone else can't delete it
            else {
                // try to delete from the db
                const deleteReminderPG = await pool.query('DELETE FROM chatot.reminders WHERE userid=$1 AND timerid=$2 RETURNING timerid, channelid, tstamp, msg', [interaction.user.id, deletionID]);
                const deletedRows: IReminderPG[] | [] = deleteReminderPG.rows;

                if (deletedRows.length) {
                    await interaction.followUp('Reminder deleted');
                }
                else {
                    await interaction.followUp('Timer ID not found for this user. No reminders were deleted');
                }
            }

            return;
        }

        // UNIX timestamp of reminder
        let unixTimestamp = 0;
        // the delay for setting the timer (difference between now and timestamp)
        let delay = 0;
        
        // get the user inputs
        const method = interaction.options.getString('method', true);
        const message = interaction.options.getString('message', true);

        const loc = method === 'dm' ? interaction.user.id : interaction.channelId;

        if (interaction.options.getSubcommand() === 'basic') {
            // get the timestamp from the value of the selected option
            const time = interaction.options.getNumber('time', true);
            const timestamp = Date.now().valueOf() + (time);
            unixTimestamp = Math.floor(timestamp / 1000);
            delay = time;
        }
        else if (interaction.options.getSubcommand() === 'custom') {
            // get the entered info
            const mon = interaction.options.getInteger('month', true).toLocaleString('en-US', { minimumIntegerDigits: 2 });
            const day = interaction.options.getInteger('day', true).toLocaleString('en-US', { minimumIntegerDigits: 2 });
            const year = interaction.options.getInteger('year', true).toString();
            const hour = interaction.options.getInteger('hour', true).toLocaleString('en-US', { minimumIntegerDigits: 2 });
            const min = interaction.options.getInteger('minute', true).toLocaleString('en-US', { minimumIntegerDigits: 2 });
            const sec = interaction.options.getInteger('second', true).toLocaleString('en-US', { minimumIntegerDigits: 2 });
            const offset = interaction.options.getNumber('offset', true);

            // format the entered text as a date with the specified offset
            // get the fraction of the offset
            let offsetHour = Math.trunc(offset).toLocaleString('en-US', { minimumIntegerDigits: 2 });
            if (offset >= 0) {
                offsetHour = '+' + offsetHour;
            }
            const offsetMin = (offset % 1) * 60;
            const offsetMinStr = Math.abs(offsetMin).toString().padStart(2, '0');

            // format the date string
            const dateStr = `${year}-${mon}-${day}T${hour}:${min}:${sec}${offsetHour}:${offsetMinStr}`;
            // construct the date object
            const date = new Date(dateStr);

            // find the delay needed to reach the target time
            delay = date.valueOf() - Date.now().valueOf();

            // if the desired time is in the past, return
            if (delay < 0) {
                await interaction.followUp('Reminder cannot be set to the past!');
                return;
            }
            // timers have a max delay value of signed 32-bit max
            else if (delay > 2147483646) { 
                await interaction.followUp('Reminder too far into the future! Longest allowable delay is about 24 days');
                return;
            }

            // get the unix time of the reminder
            unixTimestamp = Math.floor(date.valueOf() / 1000);
        }

        // create a timer
        const timer = setTimeout(() => {
            void alertUser(loc, message, interaction.user.id, interaction.client)
                .catch(e => errorHandler(e));
        }, delay);

        // attempt to message them in the specified manner
        if (method === 'dm') {
            try {
                // send a test message
                await interaction.user.send({ content: `Ok, I will remind you on <t:${unixTimestamp}:f>`, enforceNonce: true, nonce: SnowflakeUtil.generate().toString() });

                // store in the db so we don't forget
                await pool.query('INSERT INTO chatot.reminders (userid, channelid, tstamp, msg) VALUES ($1, $2, to_timestamp($3), $4)', [interaction.user.id, loc, unixTimestamp, message]);

                // respond to interaction
                await interaction.followUp('Reminder set');
            }
            // if any error occurred while trying to set the reminder, cancel the timer and let them know
            catch (e) {
                clearTimeout(timer);
                throw e;
            }
        }
        else if (method === 'post') {
            // check for the necessary permissions based on where it's used
            // also make sure it's used in a channel (which it has to be, but we have to type check it anyway)
            let canComplete = true;
            const chan = interaction.channel;

            if (chan?.type === ChannelType.GuildText) {
                canComplete = await checkChanPerms(interaction, chan, ['ViewChannel', 'SendMessages']);

            }
            else if (chan?.type === ChannelType.PublicThread || chan?.type === ChannelType.PrivateThread) {
                canComplete = await checkChanPerms(interaction, chan, ['ViewChannel', 'SendMessagesInThreads']);
            }
            else {
                await interaction.followUp('This command must be used in a text channel.');
                clearTimeout(timer);
                return;
            }

            if (!canComplete) {
                clearTimeout(timer);
                return;
            }

            try {
                // store in the db so we don't forget
                await pool.query('INSERT INTO chatot.reminders (userid, channelid, tstamp, msg) VALUES ($1, $2, to_timestamp($3), $4)', [interaction.user.id, loc, unixTimestamp, message]);

                // respond to interaction
                await interaction.followUp(`Ok, <@${interaction.user.id}> I will post to this channel to remind you on <t:${unixTimestamp}:f>`);
            }
            // if any error occurred while trying to set the reminder, cancel the timer and let them know
            catch (e) {
                clearTimeout(timer);
                throw e;
            }
        }
    },
};

