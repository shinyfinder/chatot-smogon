import { Message, Collection, GuildTextBasedChannel, ChannelType, SnowflakeUtil } from 'discord.js';
import { eventHandler } from '../types/event-base.js';
import { pool } from '../helpers/createPool.js';
import { ILogChan } from '../helpers/logging.js';
/**
 * messageDeleteBulk handler
 *
 * Event handler for when messages are deleted in bulk.
 * Deleted messages have their author, content, and person who deleted the message logged to the specified channel in /config logging.
 */

export const clientEvent: eventHandler = {
    // define the name of the trigger event
    name: 'messageDeleteBulk',
    // execute the code for this event
    async execute(messages: Collection<string, Message>, channel: GuildTextBasedChannel) {
        // create a holder for the messages that were deleted
        const arrOut: string[] = [];

        // extract the info we care about
        for (const message of messages.values()) {
            // if this message wasn't cached, skip it because there's nothing meaningful we can output
            if (message.partial) {
                continue;
            }
            const strOut = `${message.createdAt.toString()} - ${message.author.username} (${message.author.id}) - ${message.content} - ${message.attachments.map(a => a.url).join(', ')}`;
            arrOut.push(strOut);
        }

        // return early if there's nothing in the holding array
        if (!arrOut.length) {
            return;
        }

        // add a header to define the syntax
        // we do this last because we ultimately reverse the order of the array so that it's in the order sent
        arrOut.push('Timestamp - username (id) - content - attachments\n');

        // reverse the array order
        arrOut.reverse();

        // we do this last because we 
        // see if logging is enabled in the server
        const pgres = await pool.query('SELECT channelid, logtype FROM chatot.logchan WHERE serverid=$1', [channel.guild.id]);
        const logchan: ILogChan[] | [] = pgres.rows;

        if (logchan.length) {
            const targetChans = logchan.filter(row => ['all', 'nonedits', 'modex', 'msgtarget'].includes(row.logtype));
            
            // loop over the list of relevant channels and send the file
            // there'll only be 1, but technically there could be more
            for (const chan of targetChans) {
                const chanOut = channel.client.channels.cache.get(chan.channelid);

                // typecheck
                if (!(chanOut?.type === ChannelType.GuildText || chanOut?.type === ChannelType.PublicThread || chanOut?.type === ChannelType.PrivateThread)) {
                    continue;
                }

                // create a buffer so we can send it as an attachment
                const buf = Buffer.from(arrOut.join('\n\n'));

                await chanOut.send({ 
                    content: 'Messages were deleted in bulk',
                    files: [{ attachment: buf, name: `${channel.name}_bulkDelete.txt` }],
                    enforceNonce: true,
                    nonce: SnowflakeUtil.generate().toString()
                });
            }
        }
    },
};
