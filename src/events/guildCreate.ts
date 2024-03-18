import { Guild, ButtonBuilder, ButtonStyle, ActionRowBuilder, PermissionFlagsBits, ChannelType } from 'discord.js';
import { eventHandler } from '../types/event-base';
import { Modes, botConfig } from '../config.js';

/**
 * Add guild handler
 *
 * Event handler for when the bot joins a guild
 */

export const clientEvent: eventHandler = {
    // define the name of the trigger event
    name: 'guildCreate',
    // execute the code for this event
    async execute(guild: Guild) {
        // get the output channel and guild
        const logChanID = botConfig.MODE === Modes.Dev ? '1040378543626002445' : '1219382359929917490';
        const logGuildID = botConfig.MODE === Modes.Dev ? '1040378543626002442' : '192713314399289344';

        const logChan = await guild.client.channels.fetch(logChanID);
        const logGuild = await guild.client.guilds.fetch(logGuildID);

        /**
         * Error check
         */

        if (!logChan) {
            throw `I could not fetch the server join log channel. I recently joined server ${guild.name} (${guild.id})`;
        }

        // fetch our discord client
        const me = await logGuild.members.fetchMe();

        // then get our permissions for the log channel
        const chanPerms = me.permissionsIn(logChanID);

        // make sure we have the permissions we need
        if (!chanPerms.has(['ViewChannel', 'SendMessages'])) {
            throw `I cannot post in the server join log channel. Make sure I can see it and send messages there. I recently joined server ${guild.name} (${guild.id})`;
        }

        // this should never happen, but we need to typecheck logchan anyway
        if (!logChan.isTextBased()) {
            throw `Server join log channel is not the appropriate type. I recently joined server I recently joined server ${guild.name} (${guild.id})`;
        }

        
        /**
         * Setup the buttons
         */

        // we can just use the serverid in the custom id since that is guaranteed to be unique
        // it also allows us to pass the server id to the button click handler
        // build a button to give to the user to confirm their actions
        const confirm = new ButtonBuilder()
        .setCustomId(`${guild.id}-gban-confirm`)
        .setLabel('Yes')
        .setStyle(ButtonStyle.Success);

        const cancel = new ButtonBuilder()
            .setCustomId(`${guild.id}-gban-deny`)
            .setLabel('No')
            .setStyle(ButtonStyle.Secondary);

        const row = new ActionRowBuilder<ButtonBuilder>()
            .addComponents(confirm, cancel);

        // post the buttons for confirmation
        const owner = await guild.fetchOwner();

        await logChan.send({
            content: `I joined a new server: ${guild.name} (${guild.id}) | Owned by ${owner.user.username} (${owner.id}). Would you like to enforce gbans there and be alerted if there are issues?`,
            components: [row],
        });

        // try to send the welcome message
        // DM the owner
        const welcomeMsg = `
Hey! Thanks for adding Chatot to your server! We hope you'll find its resource and moderation features useful.

One of Chatot's many capabilities is automatic removal of Smogon-banned users through a command that can only be run by Smogon's Senior Staff and PS!'s Upper Staff. This functionality is mandatory for official Smogon servers, but it's not necessarily something most smaller servers will need.

**Chatot's ability to gban is disabled by default in your server.** However, if you'd like to turn it on, please run the \`/opt in\` command within your server (available to your server mods+). If you'd like to remain opted out, no further action is required.
        
If you have any questions about Chatot or its functionality, please refer to its [wiki](<https://github.com/shinyfinder/chatot-smogon/wiki/Commands>). This page is also available via Chatot's profile and the \`/wiki\` command.

Happy botting!`;

        try {
            await owner.send(welcomeMsg);
        }
        catch (e) {
            // if this trips, the owner probably has their DMs turned off.
            // instead, try to send the message to the guild's system message channel
            try {
                const sysChan = guild.systemChannel;

                if (sysChan && sysChan.permissionsFor(botConfig.CLIENT_ID)?.has(PermissionFlagsBits.SendMessages)) {
                    await sysChan.send(welcomeMsg);
                }
            }
            catch (e2) {
                // if we don't have access to the system channel, just send it to the first text channel we have access to
                // first sort the channels by lowest to highest id
                // the lowest id is probably the general chat
                const sortedChans = guild.channels.cache.sort((a, b) => parseInt(a.id) - parseInt(b.id));

                const firstChan = sortedChans.find(chan => chan.type === ChannelType.GuildText && chan.permissionsFor(botConfig.CLIENT_ID)?.has(PermissionFlagsBits.SendMessages));

                // if this fails, well...we tried.
                if (firstChan?.type === ChannelType.GuildText) {
                    await firstChan?.send(welcomeMsg);
                }
            }
        }

    },
};
