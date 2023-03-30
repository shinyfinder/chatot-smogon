import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import { SlashCommand } from '../types/slash-command-base';

/**
 * Command to post a timestamp that shows up relative to the viewer's locale
 * Hours should be entered in 24 hour format
 * 
 * @param month Month of timestamp
 * @param day Day of timestamp
 * @param year Year of timestamp
 * @param hour Hour of timestamp (24 hr format)
 * @param minute Minute of timestamp
 * @param second Second of timestamp
 * @param offset The GMT/UTC offset of the time you have entered
 * @param format Desired format for the timestamp to show up as
 * 
 * @returns Replies with embedded date object and code to post the timestamp elsewhere
 *
 * Can be used as a template for future commands
 */
export const command: SlashCommand = {
    global: true,
    guilds: [],
    // setup the slash command builder
    data: new SlashCommandBuilder()
        .setName('timestamp')
        .addIntegerOption(option => 
            option.setName('month')
            .setDescription('Date month (number)')
            .setMinValue(1)
            .setMaxValue(12)
            .setRequired(true))
        .addIntegerOption(option => 
            option.setName('day')
            .setDescription('Date day')
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
            .setDescription('The UTC/GMT offset of the datetime you entered')
            .setRequired(true))
        .addStringOption(option =>
            option.setName('format')
            .setDescription('Format datetime shows up as (conversion to European formats are automatic')
            .addChoices(
                { name: 'Jan 1 2023, 1:23 AM', value: 'f' },
                { name: '1:23 AM', value: 't' },
                { name: '1:23:45 AM', value: 'T' },
                { name: '1/23/2023', value: 'd' },
                { name: 'Jan 1, 2023', value: 'D' },
                { name: 'Mon, Jan 1, 2023 1:23 AM', value: 'F' },
                { name: '1 year ago/from now', value: 'R' },
            )
            .setRequired(true))
        .setDescription('Converts the entered date/time into a discord timestamp. Please use 24 HR format for time'),

    // execute our desired task
    async execute(interaction: ChatInputCommandInteraction) {
        // get the entered info
        const mon = interaction.options.getInteger('month', true).toLocaleString('en-US', { minimumIntegerDigits: 2 });
        const day = interaction.options.getInteger('day', true).toLocaleString('en-US', { minimumIntegerDigits: 2 });
        const year = interaction.options.getInteger('year', true).toString();
        const hour = interaction.options.getInteger('hour', true).toLocaleString('en-US', { minimumIntegerDigits: 2 });
        const min = interaction.options.getInteger('minute', true).toLocaleString('en-US', { minimumIntegerDigits: 2 });
        const sec = interaction.options.getInteger('second', true).toLocaleString('en-US', { minimumIntegerDigits: 2 });
        const offset = interaction.options.getNumber('offset', true);
        const format = interaction.options.getString('format', true);

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

        // get the unix time
        const dateUnix = Math.floor(date.valueOf() / 1000);

        // construct the object needed for discord
        const cordTime = `<t:${dateUnix}:${format}>`;

        // post it 
        await interaction.reply({ content: `${cordTime} (\`${cordTime}\`)` });
    },
};