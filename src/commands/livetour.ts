import { SlashCommandBuilder, ChatInputCommandInteraction, ChannelType, EmbedBuilder, SlashCommandSubcommandBuilder } from 'discord.js';
import { SlashCommand } from '../types/slash-command-base';
import config from '../config.js';
import { checkChanPerms } from '../helpers/checkChanPerms.js';
import { getLTPlayers } from '../helpers/livetours.js';
import { errorHandler } from '../helpers/errorHandler.js';

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
            .addIntegerOption(option =>
                option.setName('duration')
                .setDescription('How long in minutes signups are open')
                .setRequired(true)
                .setMinValue(0)))

        .addSubcommand(new SlashCommandSubcommandBuilder()
        .setName('extend')
        .setDescription('Extends signups for a live tour')
        .addStringOption(option =>
            option.setName('post')
            .setDescription('The message link to or id of the signup post')
            .setRequired(true))
        .addIntegerOption(option =>
            option.setName('duration')
            .setDescription('How long in minutes to extend signups')
            .setRequired(true)
            .setMinValue(0)))
            
        .addSubcommand(new SlashCommandSubcommandBuilder()
        .setName('close')
        .setDescription('Forcibly closes signups for the provided tour')
        .addStringOption(option =>
            option.setName('post')
            .setDescription('The message link to or id of the signup post')
            .setRequired(true))),
 

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
        const annoucementChanID = config.MODE === 'dev' ? '1159564166655389856' : '1143857624333439007';
        const annoucementChan = interaction.client.channels.cache.get(annoucementChanID);

        // if the fetch failed, return
        if (annoucementChan === undefined) {
            await interaction.followUp('Cannot fetch the annoucement channel. Does it still exist? Do I have access?');
            return;
        }

        // typecheck the annoucement chan too
        // this only allows for announcement type channels, but that's what the current one is setup as anyway
        // if the type changes, the ID would have to change too, so this would already break.
        if (annoucementChan.type !== ChannelType.GuildAnnouncement) {
            return;
        }


        let canComplete = true;
        // check the announcement chan
        canComplete = await checkChanPerms(interaction, annoucementChan, ['ViewChannel', 'SendMessages', 'AddReactions']);

        // check the interaction chan
        if (canComplete) {
            canComplete = await checkChanPerms(interaction, interChan, ['ViewChannel', 'SendMessages']);
        }
        
        // if we don't have the perms we need, return
        if (!canComplete) {
            return;
        }

        if (interaction.options.getSubcommand() === 'create') {
             // get the user inputs
            const title = interaction.options.getString('title', true);
            // assume duration is in minutes
            const duration = interaction.options.getInteger('duration', true) * 60 * 1000;

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
                void getLTPlayers(interaction.user, title, msg, interChan)
                    .catch(e => errorHandler(e));
            }, duration);

            // coerce the timer to a primative so we can cancel it later
            const timerPrim = timer[Symbol.toPrimitive]();

            // add it to the embed so we can reference it later
            embed.setFooter({ text: `id: ${timerPrim}` });

            // send it off, returning the message that we create
            const msg = await annoucementChan.send({ embeds: [embed] });

            // seed the message with the reaction
            await msg.react('👍');

            // done
            await interaction.followUp('Live tour scheduled');
        }

        else if (interaction.options.getSubcommand() === 'extend') {
            // get the user input
            const signupMsg = interaction.options.getString('post', true);
            const extension = interaction.options.getInteger('duration', true) * 60;

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
            const msg = await annoucementChan.messages.fetch(msgid);

            // build a new embed using the old one as a template
            const oldEmbed = msg.embeds[0];
            const newEmbed = EmbedBuilder.from(oldEmbed);

            const fieldMatch = newEmbed.data.fields?.findIndex(field => field.name === 'Signups Close');

            // make sure the old embed is what we think it is
            if (!fieldMatch || fieldMatch < 0 || !newEmbed.data.fields || !oldEmbed.footer) {
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
            const closeUnix = oldDateUnix + extension;

            // construct the object needed for discord
            const cordTime = `<t:${closeUnix}:R>`;
            newEmbed.data.fields[fieldMatch].value = cordTime;

            // get the old timer id from the embed
            const oldFooterText = oldEmbed.footer.text;
            const oldIDArr = oldFooterText.match(/\d+/);

            // this should never trigger, but gotta typecheck
            if (!oldIDArr) {
                await interaction.followUp('Embed was not what I expected. If it was deleted, you need to make a new signup');
                return;
            }
            const oldID = oldIDArr[0];

            // cancel it
            clearTimeout(oldID);

            // make a new timer
            // create a timeout for the signups
            const timer = setTimeout(() => {
                void getLTPlayers(interaction.user, oldEmbed.title ?? 'live tour', msg, interChan)
                    .catch(e => errorHandler(e));
            }, closeUnix * 1000 - Date.now());

            // coerce the timer to a primative so we can cancel it later
            const timerPrim = timer[Symbol.toPrimitive]();

            // add it to the embed so we can reference it later
            newEmbed.setFooter({ text: `id: ${timerPrim}` });

            // edit the post
            await msg.edit({ embeds: [newEmbed] });

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
            const msg = await annoucementChan.messages.fetch(msgid);

            // build a new embed using the old one as a template
            const oldEmbed = msg.embeds[0];
            const newEmbed = EmbedBuilder.from(oldEmbed);

            const fieldMatch = newEmbed.data.fields?.findIndex(field => field.name === 'Signups Close');

            // make sure the old embed is what we think it is
            if (!fieldMatch || fieldMatch < 0 || !newEmbed.data.fields || !oldEmbed.footer) {
                await interaction.followUp('Embed was not what I expected. If it was deleted, you need to make a new signup');
                return;
            }

            // get the new close date unix timestamp
            const closeUnix = Math.floor(Date.now() / 1000);

            // construct the object needed for discord
            const cordTime = `<t:${closeUnix}:R>`;
            newEmbed.data.fields[fieldMatch].value = cordTime;

            // get the old timer id from the embed
            const oldFooterText = oldEmbed.footer.text;
            const oldIDArr = oldFooterText.match(/\d+/);

            // this should never trigger, but gotta typecheck
            if (!oldIDArr) {
                await interaction.followUp('Embed was not what I expected. If it was deleted, you need to make a new signup');
                return;
            }
            const oldID = oldIDArr[0];

            // cancel it
            clearTimeout(oldID);

            // send the updated embed
            await msg.edit({ embeds: [newEmbed] });

            // collect the reactions
            await getLTPlayers(interaction.user, oldEmbed.title ?? 'live tour', msg, interChan);

            // done
            await interaction.followUp('Live tour signups closed');
        }
    },
};
