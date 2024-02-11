import { Message, MessageFlags } from 'discord.js';
import { Modes, botConfig } from '../config.js';

// reset the sayings if lily apologizes
// also create a counter per server so that people can't spam it
let apologized = false;
const counter: { [key: string]: number } = {};

export async function justForFun(msg: Message) {
    const lilyID = botConfig.MODE === Modes.Dev ? '212315209740713984' : '150324099988586496';

    /**
     * Reply to thank you
     */
    const replyText = [
        'thank you chatot',
        'ty chatot',
        'thanks chatot',
    ];
    
    if (replyText.includes(msg.content.toLowerCase())) {
        if (msg.author.id === lilyID && !apologized) {
            await msg.channel.send(`you're welcome ${msg.author.displayName}`);
        }
        else {
            await msg.channel.send(`you're welcome ${msg.author.displayName} <3`);
        }
        
        return;
    }

    /**
     * Reply to hello
     * Except for lily, who's mean to the bot
     */
    // if lily aplogizes, set the flag to give her a normal response to hello

    if (msg.author.id === lilyID) {
        if (!apologized && (msg.content.toLowerCase() === `I'm sorry ${msg.client.user.displayName}`.toLowerCase() || msg.content.toLowerCase() === `I'm sorry ${msg.client.user.toString()}`.toLowerCase())) {
            apologized = true;
            await msg.channel.send(`Thank you ${msg.author.toString()}. I forgive you.`);
            return;
        }
    }
    
    // setup the regex to check for hello's
    const greeting1 = new RegExp(`^hi,*\\s*(?:chatot|${msg.client.user.toString()})`, 'mi');
    const greeting2 = new RegExp(`^(?:chatot|${msg.client.user.toString()})*,*\\s*say hi to (.*?)(?:,*\\s*chatot|${msg.client.user.toString()})*$`, 'mi');
    const apologyReset = new RegExp(`^(?:chatot|${msg.client.user.toString()})*,*\\s*lily was being mean to you again(?:,*\\s*chatot|${msg.client.user.toString()})*$`, 'mi');
    
    // first case: saying hi to chatot
    if (greeting1.test(msg.content)) {
        const normalGreetings = [
            `Hi <@${msg.author.id}>!`,
            `I hope you have a great day, <@${msg.author.id}>!`,
            `Hey! Thanks for saying hi, <@${msg.author.id}>. You're so kind <3`,
            `Hiya! What's up <@${msg.author.id}>`,
            `Hey <@${msg.author.id}>! Don't tell anyone, but you're one of my favorite users.`,
        ];
    
        const lilyGreetings = [
            '.',
            'We\'re still not talking...',
            'lol. No.',
            `You hurt my feelings <@${msg.author.id}>, why should I say hi?`,
            `Apologize first. I want to hear you say "I'm sorry ${msg.client.user.displayName}".`,
        ];
    
        if (msg.author.id == lilyID && !apologized) {
            const res = lilyGreetings[Math.floor(Math.random() * lilyGreetings.length)];
            await msg.channel.send(res);
        }
        else {
            const res = normalGreetings[Math.floor(Math.random() * normalGreetings.length)];
            await msg.channel.send(res);
        }
        
    }
    // second case: asking the bot to say hi to someone
    else if (greeting2.test(msg.content)) {
        const matchArr = msg.content.match(greeting2);
        if (matchArr) {
            // get the username they mentioned
            const mentionedUser = matchArr[1];

            // search the cord for a display name matching what they entered
            await msg.guild?.members.fetch({ time: 3000 });
            const member = msg.guild?.members.cache.find(mem => mem.displayName.toLowerCase() === mentionedUser.toLowerCase() || mem.user.displayName.toLowerCase() === mentionedUser || mem.user.username === mentionedUser.toLowerCase() || mem.user.toString() === mentionedUser);

            if (!member) {
                await msg.channel.send('Who? I couldn\'t find them in this server.');
                return;
            }

            // formulate it into a tag
            const taggedUser = member.toString();

            // build the responses depending on the user
            const normalGreetings = [
                `Hi ${taggedUser}! ${msg.author.displayName} asked me to check in on you. I hope you're well! <3`,
                `Hi ${taggedUser}! Thanks for being here. ${msg.author.displayName} and I appreciate having you around!`,
                `Hey ${taggedUser}, ${msg.author.displayName} and I are sending you good vibes!`,
                `Hi ${taggedUser}! You're amazing and ${msg.author.displayName} and I hope you have a great day!`,
            ];
    
            const lilyGreetings = [
                'No thanks',
                `Hey ${taggedUser}, you need a hug? My friend Maractus gives great ones!`,
                'lol',
                `I won't say hi until she apologises to me and says "I'm sorry ${msg.client.user.displayName}".`,
            ];

            // and respond
            if (taggedUser == `<@${lilyID}>` && !apologized) {
                const res = lilyGreetings[Math.floor(Math.random() * lilyGreetings.length)];
                if (msg.inGuild()) {
                    // set a tigger limit so we don't spam
                    if (!counter[msg.guildId] || counter[msg.guildId] <= 5) {
                        // if the counter hasn't been cleared yet, set a timer to clear it
                        if (!counter[msg.guildId]) {
                            clearCooldown(msg.guildId);
                        }

                        await msg.channel.send({ content: res, flags: MessageFlags.SuppressNotifications });
                        // increment the counter
                        counter[msg.guildId] = (counter[msg.guildId] || 0) + 1;
                    }
                    else {
                        await msg.channel.send('I\'m feeling kind of shy right now, maybe later.');
                        
                    }
                }
                
            }
            else {
                const res = normalGreetings[Math.floor(Math.random() * normalGreetings.length)];
                if (msg.inGuild()) {
                    // set a trigger limit so we don't spam
                    if (!counter[msg.guildId] || counter[msg.guildId] <= 5) {
                        // if the counter hasn't been cleared yet, set a timer to clear it
                        if (!counter[msg.guildId]) {
                            clearCooldown(msg.guildId);
                        }

                        await msg.channel.send({ content: res, flags: MessageFlags.SuppressNotifications });

                        // increment the counter
                        counter[msg.guildId] = (counter[msg.guildId] || 0) + 1;
                    }
                    else {
                        await msg.channel.send('I\'m feeling kind of shy right now, maybe later.');
                        
                    }
                }
            }
        }
    }

    else if (apologyReset.test(msg.content)) {
        apologized = false;
        await msg.channel.send(':(');
    }
}

/**
 * Creates a timer to clear the cooldown on the fun functions.
 * This cooldown rate limits the functions so that they can't be spammed over a short period.
 * @param server ID of the server that's on cooldown
 */
function clearCooldown(server: string) {
    setTimeout(() => { delete counter[server]; }, 5 * 60 * 1000);
}