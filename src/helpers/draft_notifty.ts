import { sqlPool } from './createPool.js';
import { Modes, botConfig } from '../config.js';
import { Client, ChannelType, SnowflakeUtil, EmbedBuilder } from 'discord.js';
import { draftInterval, myColors } from './constants.js';
import { errorHandler } from './errorHandler.js';

interface IDraftAds {
    post_id: number,
    message_state: 'visible' | 'moderated' | 'deleted',
    message: string
}

let cachedStatus: Map<number, IDraftAds> = new Map();
/**
 * Looks for new posts in the Draft league advertisement thread and posts content to the chan on discord
 * https://www.smogon.com/forums/threads/draft-league-advertisement-thread.3710830/
 * 
 * Ultimately combine with C&C/CA stuff?
 * 
 */
export async function pollDraftAds() {

    // filter results to only newish posts
    // one day I'll combine this into a function or method or something
    // but that day is not today
    const unixThreshold = Math.floor(Date.now() / 1000) - 60 * 60 * 24; // current - 1 day
    
    const [newPosts] = await sqlPool.execute('SELECT post_id, message_state, message FROM xenforo.chatot_posts WHERE thread_id = ? AND post_date > ?', [3710830, unixThreshold]);

    // cast to meaningful array
    const draftAds = newPosts as IDraftAds[] ?? [];

    const currentStatus: Map<number, IDraftAds> = new Map();
    for (const ad of draftAds) {
        currentStatus.set(ad.post_id, ad);
    }

    return currentStatus;

}

/**
 * Worker functions related to monitoring the status of draft ad submissions
 */

async function checkDraftLeagues(client: Client) {
    // get the current statuses
    const dbStatus = await pollDraftAds();

    // iterate over the map and compare to the cache
    // get any new values that are visible
    const alertablePosts: Map<number, IDraftAds> = new Map();
    for (const [id, data] of dbStatus) {

        const cachedVal = cachedStatus.get(id);

        // we only want to alert visible posts
        if (data.message_state === 'visible') {
            // it's totally new
            // or is now visible
            if (!cachedVal || cachedVal.message_state !== 'visible') {
                alertablePosts.set(id, data);
            }
        }
       
    }

    // post any new values to discord
    // because we don't store what we've alerted for (or seen), if the bot restarts and a post is approved while it is down, it'll not alert
    // but this is probably good enough for now?
    // we check cachedVal.size !== 0 so that it doesn't alert on startup
    if (cachedStatus.size > 0 && alertablePosts.size > 0) {
        await alertAds(alertablePosts, client);
    }
    
    // update the cache 
    cachedStatus = dbStatus;
}

/**
 * Posts an update to the relevant discord channel
 */
async function alertAds(posts: Map<number, IDraftAds>, client: Client) {
    let targetChan = '';
    // if in dev mode, alert to dev cord
    if (botConfig.MODE === Modes.Dev) {
        targetChan = '1040378543626002445';
    }
    // otherwise, post in the appropriate chan in draft cord
    else {
        targetChan = '1059208070921736192';
    }

    // wrap in a try/catch block so that if anything errors we can process as many as we can
    // will there ever be more than one?
    try {
        const chan = await client.channels.fetch(targetChan);

        // typecheck chan
        if (!chan || !(chan.type === ChannelType.GuildText || chan.type === ChannelType.PublicThread || chan.type === ChannelType.PrivateThread)) {
            return;
        }

        for (const [id, post] of posts) {
            // parse the messaage for the info we need
            const league = parseFormResponse(post);
            
            if (!league.name.length || !league.format.length) {
                continue;
            }

            const embed = new EmbedBuilder()
                .setTitle('New Draft League!')
                .setDescription(`A new Draft league has been announced! Check out the link in the title for more info!`)
                .addFields(
                    { name: 'League Name', value: league.name, inline: true },
                    { name: 'Format', value: league.format, inline: true }
                )
                .setColor(myColors.Smogon)
                .setURL(`https://www.smogon.com/forums/threads/3710830/post-${id}`);

            // post it 
            await chan.send({ embeds: [embed], enforceNonce: true, nonce: SnowflakeUtil.generate().toString() });
        }
    }
    catch (e) {
        errorHandler(e);
    }
    
    
}


/**
 * Recursively creates a timer to check for updates on draft leage ads
 * @param client Discord js client object
 */
export function createDraftTimer(client: Client) {
    setTimeout(() => {
        void checkDraftLeagues(client)
            .catch(e => errorHandler(e))
            .finally(() => createDraftTimer(client));
    }, draftInterval + Math.random() * 1000);
    
}


/**
 * Parses the respones from a forum survey
 * 
 * Adapted from https://github.com/smogon/smogon.com/blob/master/tools/parsers.ts
 */
function parseFormResponse(post: IDraftAds) {
    /**
     * BBCode tends to be allergic to having [B][/B] sequences, so we temporarily readd those sequences to aid in processing.
     * By adding them back in, all of the headers should be in a consistent format of [B]Question Text[/B].
     * Moreover, each post should have those same questions since they are automatically appended to the posts.
     * We can use that fact to determine all of the question prompts, then filter them out to get the responses.
     * 
     * Do we need to do this?
     */
    
    // for lines that end without closing the bold, add a closing tag
    let modStr = post.message.replace(/^\[B\]((?!\[\/B\]).)*$/gm, '$&[/B]');

    // for lines that don't have a starting [B], add one
    modStr = modStr.replace(/^((?!\[B\]).)*\[\/B\]/gm, '[B]$&');

    const name = (modStr.match(/(?<=League Name\[\/B\]\n).*/i) ?? '')[0];
    const format = (modStr.match(/(?<=League Format\[\/B\]\n).*/i) ?? '')[0];

    return { name, format};
}