import { Message, MessageFlags } from 'discord.js';
import { Modes, botConfig } from '../config.js';
import { pool } from './createPool.js';

// reset the sayings if lily apologizes
// also create a counter per server so that people can't spam it
let apologized = false;
const lastUsed: { [key: string]: number } = {};

interface IFUNPERMS {
    allowance: { allow: boolean }[],
    cooldowns: { cooldown: number }[],
    roles: { roleid: string }[],
    channels: { channelid: string }[],
    exemptions: { roleid: string }[],
}


export async function justForFun(msg: Message) {
    if (!msg.inGuild()) {
        return;
    }
    
    // HACK
    // we aren't mean to lily anymore, but in case people want this feature again, I'd rather not completely undo all the logic
    // so just use a dummy value for lily's id that'll never resolve

    // const lilyID = botConfig.MODE === Modes.Dev ? '212315209740713984' : '150324099988586496';
    const lilyID = botConfig.MODE === Modes.Dev ? '212315209740713984' : '-1';

    /**
     * Reply to thank you
     */
    const replyText = [
        'thank you chatot',
        'ty chatot',
        'thanks chatot',
    ];
    
    if (replyText.some(str => str === msg.content.toLowerCase())) {
        // check for permitted usage
        const respond = await isPermitted(msg);
        if (!respond) {
            return;
        }

        // if it's permitted, respond
        if (msg.author.id === lilyID && !apologized) {
            await msg.channel.send(`you're welcome ${msg.author.displayName}`);
        }
        else {
            await msg.channel.send(`you're welcome ${msg.author.displayName} <3`);
        }
        
        lastUsed[msg.channelId] = Date.now();
        return;
    }

    /**
     * Reply to hello
     * Except for lily, who's mean to the bot
     */
    // if lily aplogizes, set the flag to give her a normal response to hello

    if (msg.author.id === lilyID) {
        if (!apologized && (msg.content.toLowerCase() === `I'm sorry ${msg.client.user.displayName}`.toLowerCase() || msg.content.toLowerCase() === `I'm sorry ${msg.client.user.toString()}`.toLowerCase())) {

            // check for permitted usage
            const respond = await isPermitted(msg);
            if (!respond) {
                return;
            }

            apologized = true;
            await msg.channel.send(`Thank you ${msg.author.toString()}. I forgive you.`);
            lastUsed[msg.channelId] = Date.now();
            return;
        }
    }
    
    // setup the regex to check for hello's
    const greeting1 = new RegExp(`^hi,*\\s+(?:chatot|${msg.client.user.toString()})$`, 'mi');
    const greeting2a = new RegExp(`^(?:chatot|${msg.client.user.toString()}),*\\s+say hi to (.*?)$`, 'mi');
    const greeting2b = new RegExp(`^say hi to (.*?)(?:,*\\s+chatot|,*\\s+${msg.client.user.toString()})$`, 'mi');
    const apologyReseta = new RegExp(`^(?:chatot|${msg.client.user.toString()}),*\\s+lily was being mean to you again$`, 'mi');
    const apologyResetb = new RegExp(`^lily was being mean to you again(?:,*\\s+chatot|,*\\s+${msg.client.user.toString()})$`, 'mi');
    
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

        // check for permitted usage
        const respond = await isPermitted(msg);
        if (!respond) {
            return;
        }
    
        if (msg.author.id == lilyID && !apologized) {
            const res = lilyGreetings[Math.floor(Math.random() * lilyGreetings.length)];
            await msg.channel.send(res);
        }
        else {
            const res = normalGreetings[Math.floor(Math.random() * normalGreetings.length)];
            await msg.channel.send(res);
        }

        lastUsed[msg.channelId] = Date.now();
        
    }
    // second case: asking the bot to say hi to someone
    else if (greeting2a.test(msg.content) || greeting2b.test(msg.content)) {
        // try to match the first one
        let matchArr = msg.content.match(greeting2a);

        // if that fails, match the second
        if (!matchArr) {
            matchArr = msg.content.match(greeting2b);
        }

        if (matchArr) {

            // check for permitted usage
            const respond = await isPermitted(msg);
            if (!respond) {
                return;
            }


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
            // to lily
            if (taggedUser == `<@${lilyID}>` && !apologized) {
                const res = lilyGreetings[Math.floor(Math.random() * lilyGreetings.length)];
                await msg.channel.send({ content: res, flags: MessageFlags.SuppressNotifications });
                // update the last used timestamp
                lastUsed[msg.channelId] = Date.now();
            }
            // to everyone else
            else {
                const res = normalGreetings[Math.floor(Math.random() * normalGreetings.length)];
                await msg.channel.send({ content: res, flags: MessageFlags.SuppressNotifications });
                // update the last used timestamp
                lastUsed[msg.channelId] = Date.now();
            }
        }
    }

    /**
     * Reset Lily's apology
     */
    else if (apologyReseta.test(msg.content) || apologyResetb.test(msg.content)) {
        // check for permitted usage
        const respond = await isPermitted(msg);
        if (!respond) {
            return;
        }

        apologized = false;
        await msg.channel.send(':(');
        lastUsed[msg.channelId] = Date.now();
    }
}


/**
 * Checks a message against the server settings to determine whether it should trigger the fun response
 * @param msg Discord Message object
 * @returns Whether this message should trigger the fun response based on server config
 */
async function isPermitted(msg: Message) {
    // this should never be the case, as I don't think this could ever be triggered on a partial
    // but let's guard it anyway to be safe
    if (!msg.inGuild() || !msg.member) {
        return false;
    }

    // we need to check: permitted roles, permitted channels, cooldowns, allowance, and exemptions
    const permSetQ = await pool.query(`
    WITH allowance AS
    (SELECT allow FROM chatot.fun_settings WHERE serverid=$1),

    cooldowns AS
    (SELECT cooldown FROM chatot.fun_settings WHERE serverid=$1),

    roles AS
    (SELECT roleid FROM chatot.fun_permitted_roles WHERE serverid=$1),

    channels AS
    (SELECT channelid FROM chatot.fun_permitted_channels WHERE serverid=$1),

    exemptions AS
    (SELECT roleid FROM chatot.fun_exemptions WHERE serverid=$1)

    SELECT json_build_object(
        'allowance', (SELECT COALESCE(JSON_AGG(allowance.*), '[]') FROM allowance),
        'cooldowns', (SELECT COALESCE(JSON_AGG(cooldowns.*), '[]') FROM cooldowns),
        'roles', (SELECT COALESCE(JSON_AGG(roles.*), '[]') FROM roles),
        'channels', (SELECT COALESCE(JSON_AGG(channels.*), '[]') FROM channels),
        'exemptions', (SELECT COALESCE(JSON_AGG(exemptions.*), '[]') FROM exemptions)
    ) AS perms`, [msg.guildId]);

    // unpack and update cache
    const permSet = permSetQ.rows.map((row: { perms: IFUNPERMS }) => row.perms)[0];

    // check if the user is exempt
    const exemptIDS = permSet.exemptions.map(id => id.roleid);
    if (msg.member.roles.cache.hasAny(...exemptIDS)) {
        return true;
    }
    
    // check whether this is turned off completely
    if (permSet.allowance.length) {
        if (permSet.allowance[0].allow === false) {
            return false;
        }
    }

    // check if the user has the permitted roles
    // if they don't, return early
    if (permSet.roles.length) {
        const allowedRoles = permSet.roles.map(r => r.roleid);
        if (!msg.member.roles.cache.hasAny(...allowedRoles)) {
            return false;
        }
    }
    

    // check the cooldown
    if (permSet.cooldowns.length) {
        const serverCD = permSet.cooldowns[0].cooldown;

        if (lastUsed[msg.channelId]) {
            if (lastUsed[msg.channelId] + serverCD * 1000 > Date.now()) {
                return false;
            }
        }
    }

    // check the channel
    if (permSet.channels.length) {
        const allowedChans = permSet.channels.map(c => c.channelid);
        if (!allowedChans.some(id => id === msg.channel.id || id === msg.channel.parentId)) {
            return false;
        }
    }
    

    // if you're still here, it's a valid use case
    return true;

}