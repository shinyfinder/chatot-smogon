import { ICAStatus, IXFCAStatus } from '../types/ca';
import { loadCAStatus, pollCAForum, updateCACache } from './caQueries.js';
import { Modes, botConfig } from '../config.js';
import { Client, ChannelType, AttachmentBuilder, SnowflakeUtil } from 'discord.js';
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

    // in the past we've emptied the cache if there was nothing there, but this seems to create more problems than it's worth
    // this should be handled further down in the call stack anyway
    if (!newCAStatus.length) {
        // await uncacheRemovedCAThreads(newCAStatus, oldCAStatus);
        // release the lock
        lockout.ca = false;
        return;
    }

    // filter out the threads from the most recent xf poll that are updated so we can update their values in the db
    const updatedThreads: IXFCAStatus[] = [];
    for (const nthread of newCAStatus) {
        // sometimes redirects or multiple attachments will cause the thread to show up multiple times
        // so ensure we only process a thread once
        if (updatedThreads.some(uthread => uthread.thread_id === nthread.thread_id)) {
            continue;
        }

        // we want to get the threads where the thread ID matches the old, but the stage is different
        // or where the id is present in new but not old
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
    if (botConfig.MODE === Modes.Dev) {
        targetChan = '1040378543626002445';
    }
    // otherwise, post in the appropriate chan in smeargle
    else {
        targetChan = '1135599889825415168';
    }

    // wrap in a try/catch block so that if anything errors we can process as many as we can
    try {
        const chan = await client.channels.fetch(targetChan);

        // typecheck chan
        if (!chan || !(chan.type === ChannelType.GuildText || chan.type === ChannelType.PublicThread || chan.type === ChannelType.PrivateThread)) {
            return;
        }

        // if there are too many updates at once, update the database but don't ping anyone
        // this may be because of a db reset
        const threadsInQC = newDataArr.filter(d => d.phrase_text === 'QC');
        if (threadsInQC.length > 5) {
            throw `Too many updated CA threads to ping. Total: ${threadsInQC.length}`;
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
                    const msg = await chan.send({ content: `${newData.title} ready for QC <@&1132969853087658045>\n<https://www.smogon.com/forums/threads/${newData.thread_id}/>`, files: [attachment], enforceNonce: true, nonce: SnowflakeUtil.generate().toString() });
                    // react
                    await msg.react('👍');
                }
                else {
                    await chan.send({ content: `${newData.title} ready for QC <@&1132969853087658045>\n<https://www.smogon.com/forums/threads/${newData.thread_id}/>`, enforceNonce: true, nonce: SnowflakeUtil.generate().toString() });
                }
                
            }
            
        }
    }
    catch (e) {
        errorHandler(e);
    }
    
    
}


/**
 * Recursively creates a timer to check for updates on Custom avatar status
 * @param client Discord js client object
 */
export function createCATimer(client: Client) {
    setTimeout(() => {
        void checkCAs(client)
            .catch(e => (errorHandler(e), lockout.ca = false))
            .finally(() => createCATimer(client));
    }, caTimeInterval + Math.random() * 1000);
    
}


function getAttachmentPath(id: number, hash: string) {
    let filepath = '';
    if (botConfig.MODE === Modes.Dev) {
        filepath = `${botConfig.INTERNAL_DATA_PATH}/attachments/${Math.floor(id / 1000)}/${id}-${hash}.data`;
    }
    else {
        filepath = `${botConfig.INTERNAL_DATA_PATH}/attachments/${Math.floor(id / 1000)}/${id}-${hash}.data`;
    }

    return filepath;
}