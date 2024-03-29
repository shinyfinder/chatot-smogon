import { Message, MessageMentions } from 'discord.js';
import { pool } from './createPool.js';

export async function relayPings(msg: Message) {
    // we already checked in guild and from a bit
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

    // get the linked game and the tier from the linked game
    // formats are https://smogtours.psim.us/battle-tier-numbers
    // or https://play.pokemonshowdown.com/battle-tier-numbers
    // i.e.
    // https://play.pokemonshowdown.com/battle-gen9randombattle-2091317204
    // https://smogtours.psim.us/battle-gen9doublesou-756490
    const matchArr = [...msg.content.matchAll(/<?(?:https?:\/\/)?(?:www\.)?(?:smogtours\.psim\.us|play\.pokemonshowdown\.com)\/battle-(\w+)-(?:\d+)\/?>?/g)];
    // destrucr
    const [url, tier] = matchArr.length ? matchArr[0] : '';



}