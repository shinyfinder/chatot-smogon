import { ICAStatus, IXFCAStatus } from '../types/ca';
import { loadCAStatus, pollCAForum, updateCACache } from './caQueries.js';
import config from '../config.js';
import { Client, ChannelType, AttachmentBuilder } from 'discord.js';
import { lockout, caTimeInterval } from './constants.js';
import { errorHandler } from './errorHandler.js';

/**
 * Worker functions related to monitoring the status of custom avatar (CA) submissions
 */

async function checkCAs(client: Client) {
    // if we're locked out (the syncdb slash command is running), return
    // otherwise, engage the lock
    if (lockout.ca) {
        return;
    }
    else {
        lockout.ca = true;
    }
    // get the cached statuses
    const oldCAStatus = await loadCAStatus();

    // get the current statuses
    const newCAStatus = await pollCAForum();

    // if you didn't get a match, there's nothing in the forums
    // so empty the cache because nothing is there
    // this should never be the case
    if (!newCAStatus.length) {
        await uncacheRemovedCAThreads(newCAStatus, oldCAStatus);
        // release the lock
        lockout.ca = false;
        return;
    }

    // filter out the threads from the most recent xf poll that are updated so we can update their values in the db
    // we want to get the threads where the thread ID matches the old, but the stage is different
    // or where the id is present in new but not old
    const updatedThreads: IXFCAStatus[] = [];
    for (const nthread of newCAStatus) {
        if (!oldCAStatus.some(othread => othread.thread_id === nthread.thread_id)) {
            updatedThreads.push(nthread);
        }
        else if (oldCAStatus.some(othread => nthread.thread_id === othread.thread_id && nthread.phrase_text !== othread.phrase_text)) {
            updatedThreads.push(nthread);
        }
    }

    // update the cache 
    await updateCACache(updatedThreads);

    // alert for each new change
    await alertCAStatus(updatedThreads, client);

    // check for threads moved out of the forum, or deleted(?)
    await uncacheRemovedCAThreads(newCAStatus, oldCAStatus);
    
    // release the lock
    lockout.ca = false;
}


/**
 * Removes threads that have been moved out of the C&C forums from the cache
 * @param currentData Query result from polling C&C thread data from the xf tables
 * @param cachedData Query result from polling C&C thread data from the pg tables
 */
export async function uncacheRemovedCAThreads(currentData: IXFCAStatus[], cachedData: ICAStatus[]) {
    // get the list of thread IDs currently in the nodes we care about
    const currentThreadIDs = currentData.map(data => data.thread_id);

    // compare that list with the list from the cache
    // any IDs that are cached but no longer present should be removed from the cache
    const cachedRemoved = cachedData.filter(othread => !currentThreadIDs.includes(othread.thread_id));

    // if you found some, remove them from the cache
    await updateCACache(cachedRemoved, true);
}


/**
 * Posts an update to the relevant discord channel
 * @param newData Array of objects containing the parsed thread information regarding its C&C status
 * @param client Discord js client object
 */
async function alertCAStatus(newDataArr: IXFCAStatus[], client: Client) {
    let targetChan = '';
    // if in dev mode, alert to dev cord
    if (config.MODE === 'dev') {
        targetChan = '1040378543626002445';
    }
    // otherwise, post in the appropriate chan in smeargle
    else {
        targetChan = '1135599889825415168';
    }

    const chan = await client.channels.fetch(targetChan);

    // typecheck chan
    if (!chan || !(chan.type === ChannelType.GuildText || chan.type === ChannelType.PublicThread || chan.type === ChannelType.PrivateThread)) {
        return;
    }

    for (const newData of newDataArr) {
        if (newData.phrase_text === 'QC') {
            // get the attachment
            if (newData.filename && newData.data_id && newData.file_hash) {
                // determine the path to the attachment
                const filepath = getAttachmentPath(newData.data_id, newData.file_hash);
                // build the attachment 
                const attachment = new AttachmentBuilder(filepath, { name: newData.filename });
                // send
                await chan.send({ content: `${newData.title} ready for QC <@&1132969853087658045>\n<https://www.smogon.com/forums/threads/${newData.thread_id}/>`, files: [attachment] });
            }
            else {
                await chan.send(`${newData.title} ready for QC <@&1132969853087658045>\n<https://www.smogon.com/forums/threads/${newData.thread_id}/>`);
            }
            
        }
        
    }
    
}


/**
 * Recursively creates a timer to check for updates on Custom avatar status
 * @param client Discord js client object
 */
export function createCATimer(client: Client) {
    setTimeout(() => {
        void checkCAs(client)
            .catch(e => errorHandler(e))
            .finally(() => createCATimer(client));
    }, (caTimeInterval + Math.random()) * 1000);
    
}


function getAttachmentPath(id: number, hash: string) {
    let filepath = '';
    if (config.MODE === 'dev') {
        const baseFolder = new URL('../../../', import.meta.url);
        filepath = `${baseFolder.pathname}/chatot-attachments/internal_data/attachments/${Math.floor(id / 1000)}/${id}-${hash}.data`;
    }
    else {
        filepath = `/var/lib/xenforo/internal_data/attachments/${Math.floor(id / 1000)}/${id}-${hash}.data`;
    }

    return filepath;
}