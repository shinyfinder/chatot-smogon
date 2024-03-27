import { Message, MessageMentions } from 'discord.js';


export async function relayPings(msg: Message) {
    // we already checked in guild and from us
    // so make sure there's a role mention 
    if (!msg.mentions.roles.size) {
        return;
    }

    // get the pinged roles
    // fsr there is no global roles pattern, so make it ourselves
    // the ids are stored in the group property as groups: { id: '' }
    const GlobalRolesPattern = new RegExp(MessageMentions.RolesPattern.source, MessageMentions.RolesPattern.flags + 'g');
    const taggedRoles = [...msg.content.matchAll(GlobalRolesPattern)];
    // technically idt these should be undefined since we already validated there's a role mention above
    // but TS doesn't give a great way to check that
    const ids = taggedRoles.map(m => m?.groups?.id);

    await msg.channel.send(ids.join(', '));
}