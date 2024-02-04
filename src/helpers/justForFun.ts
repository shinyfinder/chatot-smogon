import { Message } from 'discord.js';

let apologized = false;

export async function justForFun(msg: Message) {
    const lilyID = '150324099988586496';
    // const lilyID = '212315209740713984';

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
        if (!apologized && msg.content.toLowerCase() === `I'm sorry ${msg.client.user.displayName}`.toLowerCase() || msg.content.toLowerCase() === `I'm sorry ${msg.client.user.toString()}`.toLowerCase()) {
            apologized = true;
            await msg.channel.send(`Thank you ${msg.author.toString()}. I forgive you.`);
            return;
        }
    }
    
    // setup the regex to check for hello's
    const greeting1 = new RegExp(`^hi,*\\s*(?:chatot|${msg.client.user.toString()})`, 'mi');
    const greeting2 = new RegExp(`^(?:chatot|${msg.client.user.toString()})*,*\\s*say hi to (.*?)(?:,*\\s*chatot|${msg.client.user.toString()})*$`, 'mi');
    
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
            await msg.guild?.members.fetch();
            const user = msg.guild?.members.cache.find(mem => mem.displayName === mentionedUser || mem.user.displayName === mentionedUser);

            if (!user) {
                return;
            }

            // formulate it into a tag
            const taggedUser = user.toString();
            
            // build the responses depending on the user
            const normalGreetings = [
                `Hi ${taggedUser}! <3`,
                `Oh ok. Hi ${taggedUser}!`,
                `${taggedUser}, ${msg.author.username} told me to say hi, so....Hi!`,
                `Hi ${taggedUser}! You're amazing and I hope you have a great day!`,
            ];
    
            const lilyGreetings = [
                'No thanks',
                `Hey ${taggedUser}, you need a hug? My friend Maractus gives great ones!`,
                'lol',
                `Fiiiine. Hello ${taggedUser}`,
                `I won't say hi until she apologises to me and says "I'm sorry ${msg.client.user.displayName}".`,
            ];

            // and respond
            if (taggedUser == `<@${lilyID}>` && !apologized) {
                const res = lilyGreetings[Math.floor(Math.random() * lilyGreetings.length)];
                await msg.channel.send(res);
            }
            else {
                const res = normalGreetings[Math.floor(Math.random() * normalGreetings.length)];
                await msg.channel.send(res);
            }
        }
    }
}

