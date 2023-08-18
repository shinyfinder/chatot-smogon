import { SlashCommandBuilder, ChatInputCommandInteraction, SlashCommandSubcommandBuilder, User, ChannelType, Client } from 'discord.js';
import { SlashCommand } from '../types/slash-command-base';
import { errorHandler } from '../helpers/errorHandler.js';
import { pool } from 'src/helpers/createPool';
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
                    { name: '6 Hour', value: 5 * 60 * 60 * 1000 },
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
                option.setName('message')
                .setDescription('Your reminder')
                .setRequired(true)))
        .setDMPermission(false),

    // execute our desired task
    async execute(interaction: ChatInputCommandInteraction) {
        await interaction.deferReply({ ephemeral: true });

        if (interaction.options.getSubcommand() === 'basic') {
            // get the user inputs
            const method = interaction.options.getString('method', true);
            const time = interaction.options.getNumber('time', true);
            const message = interaction.options.getString('message', true);

            // create a timer
            const tid = setTimeout(() => {
                void alertUser(method, message, interaction.user, interaction.channelId, interaction.client)
                    .catch(e => errorHandler(e));
            }, time * 1000);

            // attempt to message them in the specified manner
            if (method === 'dm') {
                try {
                    await interaction.user.send('Ok, I will remind you');

                    // store in the db so we don't forget
                    const loc = method === 'dm' ? method : interaction.channelId;
                    const timeframe = Date.now().valueOf() + (time * 1000);

                    await pool.query('INSERT INTO chatot.reminders (userid, loc, tstamp, msg) VALUES ($1, $2, to_timestamp($3), $4) ON CONFLICT (userid, msg) DO NOTHING', [interaction.user.id, loc, timeframe, message]);
                }
                // if any error occurred while trying to set the reminder, cancel the timeer and let them know
                catch (e) {
                    await interaction.followUp('An error occurred and a reminder was not set. Do you have DMs turned off?');
                    clearTimeout(tid);
                    throw e;
                }
            }
            
        }
    },
};

async function alertUser(method: string, message: string, user: User, chanid: string, client: Client) {
    if (method === 'dm') {
        // fetch the user object again to make sure it's still in the cache
        await client.users.fetch(user.id);

        // send them the alert
        await user.send(`Reminder to ${message}`);
    }
    else if (method === 'post') {
        // make sure the user and channel objects are cached
        const chan = client.channels.cache.get(chanid);

        if (!chan || !(chan.type === ChannelType.GuildText || chan.type === ChannelType.PublicThread || chan.type === ChannelType.PrivateThread)) {
            return;
        }
        await client.users.fetch(user.id);

        // send them the alert
        await chan.send(`<@${user.id}>, reminder to ${message}`);
    }

    // remove the info from the db
    await pool.query('DELETE FROM chatot.reminders WHERE userid=$1 AND msg=#2', [user.id, message]);
}