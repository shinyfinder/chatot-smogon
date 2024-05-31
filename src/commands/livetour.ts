import { SlashCommandBuilder, ChatInputCommandInteraction, ChannelType, EmbedBuilder, SlashCommandSubcommandBuilder } from 'discord.js';
import { SlashCommand } from '../types/slash-command-base';
import { Modes, botConfig } from '../config.js';
import { checkChanPerms } from '../helpers/checkChanPerms.js';
import { getLTPlayers } from '../helpers/livetourWorkers.js';
import { errorHandler } from '../helpers/errorHandler.js';
import { pool } from '../helpers/createPool.js';

/**
 * Creates a live tour signup message to collect reactions.
 * At the end of the signup period, a list of entrants is created
 */
export const command: SlashCommand = {
    global: false,
    guilds: ['192713314399289344'],
    data: new SlashCommandBuilder()
        .setName('livetour')
        .setDescription('Creates a new live tour')
        .setDMPermission(false)
        .setDefaultMemberPermissions(0)

        .addSubcommand(new SlashCommandSubcommandBuilder()
            .setName('create')
            .setDescription('Opens signups for a new live tour')
            .addStringOption(option =>
                option.setName('title')
                .setDescription('The title for the tour')
                .setRequired(true))
            .addNumberOption(option =>
                option.setName('duration')
                .setDescription('How long signups are open')
                .setRequired(true)
                .setMinValue(0))
            .addIntegerOption(option =>
                option.setName('units')
                .setDescription('The units of your entered duration')
                .addChoices(
                    { name: 'Minutes', value: 60 * 1000 },
                    { name: 'Hours', value: 60 * 60 * 1000 },
                    { name: 'Days', value: 24 * 60 * 60 * 1000 },
                    { name: 'Weeks', value: 7 * 24 * 60 * 60 * 1000 },
                )
                .setRequired(true)))

        .addSubcommand(new SlashCommandSubcommandBuilder()
        .setName('extend')
        .setDescription('Extends signups for a live tour')
        .addStringOption(option =>
            option.setName('post')
            .setDescription('The message link to or id of the signup post')
            .setRequired(true))
        .addNumberOption(option =>
            option.setName('duration')
            .setDescription('How long to extend signups from their previous close date')
            .setRequired(true)
            .setMinValue(0))
        .addIntegerOption(option =>
            option.setName('units')
            .setDescription('The units of your entered extension')
            .addChoices(
                { name: 'Minutes', value: 60 * 1000 },
                { name: 'Hours', value: 60 * 60 * 1000 },
                { name: 'Days', value: 24 * 60 * 60 * 1000 },
                { name: 'Weeks', value: 7 * 24 * 60 * 60 * 1000 },
            )
            .setRequired(true)))
            
        .addSubcommand(new SlashCommandSubcommandBuilder()
        .setName('close')
        .setDescription('Forcibly closes signups for the provided tour')
        .addStringOption(option =>
            option.setName('post')
            .setDescription('The message link to or id of the signup post')
            .setRequired(true))) as SlashCommandBuilder,
 

    // execute our desired task
    async execute(interaction: ChatInputCommandInteraction) {
        // defer the reply to give us time to process
        await interaction.deferReply({ ephemeral: true });

        // make sure command was used in a guild channel
        if (!interaction.channel || interaction.channel.type === ChannelType.DM) {
            return;
        }

        const interChan = interaction.channel;

        // make sure we have the necessary perms to post in the proper channels
        const announcementChanID = botConfig.MODE === Modes.Dev ? '1159564166655389856' : '1143857624333439007';
        const announcementChan = interaction.client.channels.cache.get(announcementChanID);

        // if the fetch failed, return
        if (announcementChan === undefined) {
            await interaction.followUp('Cannot fetch the annoucement channel. Does it still exist? Do I have access?');
            return;
        }

        // typecheck the annoucement chan too
        // this only allows for announcement type channels, but that's what the current one is setup as anyway
        // if the type changes, the ID would have to change too, so this would already break.
        if (announcementChan.type !== ChannelType.GuildAnnouncement) {
            return;
        }


        let canComplete = true;
        // check the announcement chan
        canComplete = await checkChanPerms(interaction, announcementChan, ['ViewChannel', 'SendMessages', 'AddReactions']);

        // check the interaction chan
        if (canComplete) {
            canComplete = await checkChanPerms(interaction, interChan, ['ViewChannel', 'SendMessages']);
        }
        
        // if we don't have the perms we need, return
        if (!canComplete) {
            return;
        }

        // set a cap on the duration limit
        // this is so that people don't enter a number that's too big for setTimeout()
        // for now, set it to 2 weeks because that should be sufficient
        const durationCap = 2 * 7 * 24 * 60 * 60 * 1000;

        if (interaction.options.getSubcommand() === 'create') {
             // get the user inputs
            const title = interaction.options.getString('title', true);
            const durationLength = interaction.options.getNumber('duration', true);
            const units = interaction.options.getInteger('units', true);

            // make sure the delay they entered is reasonable
            const duration = durationLength * units;

            if (duration > durationCap) {
                await interaction.followUp('Duration is too long! The max is 2 weeks.');
                return;
            }

            // get the close date timestamp
            const closeDate = Date.now() + duration;

            // convert to unix time for discord
            const closeUnix = Math.floor(closeDate / 1000);

            // construct the object needed for discord
            const cordTime = `<t:${closeUnix}:R>`;

            // build the embed
            const embed = new EmbedBuilder()
                .setTitle(`${title}`)
                .setDescription(`Signups are now open for: ${title}! Please react to this message with 👍 to participate. Signups will close automatically after the allotted time.`)
                .setColor('LuminousVividPink')
                .setThumbnail('https://raw.githubusercontent.com/shinyfinder/chatot-assets/main/images/pokemon_fighting_type.png')
                .addFields([
                    { name: 'Host', value: `<@${interaction.user.id}>`, inline: true },
                    { name: 'Signups Close', value: `${cordTime}`, inline: true },
                ]);

            // create a timeout for the signups
            const timer = setTimeout(() => {
                void getLTPlayers(interaction.user.id, title, msg.id, interChan.id, interaction.client, announcementChanID)
                    .catch(e => errorHandler(e));
            }, duration);

            // coerce the timer to a primative so we can cancel it later
            const timerPrim = timer[Symbol.toPrimitive]();

            // send it off, returning the message that we create
            const msg = await announcementChan.send({ embeds: [embed] });

            // seed the message with the reaction
            await msg.react('👍');

            // insert into the db
            await pool.query('INSERT INTO chatot.livetours (interactionchanid, messageid, hostid, title, timerid, tstamp, announcechanid) VALUES ($1, $2, $3, $4, $5, to_timestamp($6), $7)', [interaction.channelId, msg.id, interaction.user.id, title, timerPrim, closeUnix, announcementChanID]);

            // done
            await interaction.followUp('Live tour scheduled');
        }

        else if (interaction.options.getSubcommand() === 'extend') {
            // get the user input
            const signupMsg = interaction.options.getString('post', true);
            const extensionLength = interaction.options.getNumber('duration', true);
            const units = interaction.options.getInteger('units', true);

            const extension = extensionLength * units;

            // parse the signupmsg string to get the id
            // url format is discord.com/channels/[serverid]/[channelid]/[messageid]
            let msgid = '';
            if (signupMsg.includes('discord.com/channels/')) {
                const ids = signupMsg.match(/\d{16,}/g);
                
                // if you didn't find anything, idk what they linked so just return
                if (!ids) {
                    await interaction.followUp('I do not recognize that link. Please enter either the Message Link or message ID.');
                    return;
                }

                msgid = ids[2];
            }
            else {
                msgid = signupMsg;
            }

            // fetch that message
            const msg = await announcementChan.messages.fetch(msgid);

            // build a new embed using the old one as a template
            const oldEmbed = msg.embeds[0];
            const newEmbed = EmbedBuilder.from(oldEmbed);

            const fieldMatch = newEmbed.data.fields?.findIndex(field => field.name === 'Signups Close');

            // make sure the old embed is what we think it is
            if (!fieldMatch || fieldMatch < 0 || !newEmbed.data.fields) {
                await interaction.followUp('Embed was not what I expected. If it was deleted, you need to make a new signup');
                return;
            }

            // get the old close date
            const oldClose = newEmbed.data.fields[fieldMatch].value.match(/\d+/);

            if (!oldClose) {
                await interaction.followUp('Embed was not what I expected. If it was deleted, you need to make a new signup');
                return;
            }
            const oldDateUnix = Number(oldClose[0]);

            // get the new close date unix timestamp
            const closeUnix = oldDateUnix + Math.floor(extension / 1000);
            const duration = closeUnix * 1000 - Date.now();

            // make sure it's a reasonable length
            if (duration > durationCap) {
                await interaction.followUp('Duration is too long! The live tour cannot end more than 2 week from now.');
                return;
            }
            else if (duration < 0) {
                await interaction.followUp('Extending the close time by this amount would still have ended in the past. If you are trying to reopen the live tour, either pick a longer extension or just post a new one.');
                return;
            }

            // construct the object needed for discord
            const cordTime = `<t:${closeUnix}:R>`;
            newEmbed.data.fields[fieldMatch].value = cordTime;

            // get the old timer id from the db
            const oldIDs: { timerid: number }[] | [] = (await pool.query('SELECT timerid FROM chatot.livetours WHERE messageid=$1', [msg.id])).rows;
            
            // grab the first element
            // there should only be 1 anyway
            const oldID = oldIDs.map(id => id.timerid)[0];

            // cancel it
            clearTimeout(oldID);

            // get the title from the old embed
            const title = oldEmbed.title ?? 'live tour';

            // make a new timer
            // create a timeout for the signups
            const timer = setTimeout(() => {
                void getLTPlayers(interaction.user.id, title, msg.id, interChan.id, interaction.client, announcementChanID)
                    .catch(e => errorHandler(e));
            }, duration);

            // coerce the timer to a primative so we can cancel it later
            const timerPrim = timer[Symbol.toPrimitive]();

            // edit the post
            await msg.edit({ embeds: [newEmbed] });

            // update the db
            await pool.query(`
            INSERT INTO chatot.livetours (interactionchanid, messageid, hostid, title, timerid, tstamp, announcechanid)
            VALUES ($1, $2, $3, $4, $5, to_timestamp($6), $7)
            ON CONFLICT (messageid)
            DO UPDATE SET interactionchanid=EXCLUDED.interactionchanid, messageid=EXCLUDED.messageid, hostid=EXCLUDED.hostid, title=EXCLUDED.title, timerid=EXCLUDED.timerid, tstamp=EXCLUDED.tstamp, announcechanid=EXCLUDED.announcechanid`, 
            [interChan.id, msg.id, interaction.user.id, title, timerPrim, closeUnix, announcementChanID]);

            // done
            await interaction.followUp('Live tour signups extended');

        }

        else if (interaction.options.getSubcommand() === 'close') {
            // get the user input
            const signupMsg = interaction.options.getString('post', true);
            
            // parse the signupmsg string to get the id
            // url format is discord.com/channels/[serverid]/[channelid]/[messageid]
            let msgid = '';
            if (signupMsg.includes('discord.com/channels/')) {
                const ids = signupMsg.match(/\d{16,}/g);
                
                // if you didn't find anything, idk what they linked so just return
                if (!ids) {
                    await interaction.followUp('I do not recognize that link. Please enter either the Message Link or message ID.');
                    return;
                }

                msgid = ids[2];
            }
            else {
                msgid = signupMsg;
            }

            // fetch that message
            const msg = await announcementChan.messages.fetch(msgid);

            // build a new embed using the old one as a template
            const oldEmbed = msg.embeds[0];
            const newEmbed = EmbedBuilder.from(oldEmbed);

            const fieldMatch = newEmbed.data.fields?.findIndex(field => field.name === 'Signups Close');

            // make sure the old embed is what we think it is
            if (!fieldMatch || fieldMatch < 0 || !newEmbed.data.fields) {
                await interaction.followUp('Embed was not what I expected. If it was deleted, you need to make a new signup');
                return;
            }

            // get the new close date unix timestamp
            const closeUnix = Math.floor(Date.now() / 1000);

            // construct the object needed for discord
            const cordTime = `<t:${closeUnix}:R>`;
            newEmbed.data.fields[fieldMatch].value = cordTime;

            // send the updated embed
            await msg.edit({ embeds: [newEmbed] });

            // collect the reactions
            await getLTPlayers(interaction.user.id, oldEmbed.title ?? 'live tour', msg.id, interChan.id, interaction.client, announcementChanID);

            // done
            await interaction.followUp('Live tour signups closed');

            // get the old timer id
            // we can skip a step by deleting the row from the db since we don't need it anymore
            const oldIDs: { timerid: number, title: string }[] | [] = (await pool.query('DELETE FROM chatot.livetours WHERE messageid=$1 RETURNING timerid, title', [msg.id])).rows;
            if (!oldIDs) {
                return;
            }
            // grab the first element
            // there should only be 1 anyway
            const oldID = oldIDs.map(id => id.timerid)[0];

            // cancel it
            clearTimeout(oldID);
        }
    },
};
