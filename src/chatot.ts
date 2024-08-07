/**
 * Main launch file for the app
 * This file has 5 main sections: create the client with the intents, load the commands, setup the event handler, connect to db, and login
 */

import { Client, GatewayIntentBits, Collection, Partials } from 'discord.js';
import type { SlashCommand } from './types/slash-command-base';
import type { eventHandler } from './types/event-base';
import { readdir } from 'node:fs/promises';
import fs from 'fs';
import { createPool } from './helpers/createPool.js';
import { loadCustoms } from './helpers/manageCustomsCache.js';
import { updateState } from './helpers/updateState.js';
import { loadItems, loadMoves, loadSpriteDex, loadAllDexNames, loadPSFormats, getImageCommitHash } from './helpers/loadDex.js';
import { loadRRMessages } from './helpers/loadReactRoleMessages.js';
import { createCCTimer } from './helpers/ccWorkers.js';
import { createCATimer } from './helpers/caWorkers.js';
import { loadCCCooldowns } from './helpers/manageCCCooldownCache.js';
import { Modes, botConfig } from './config.js';
import { recreateReminders } from './helpers/reminderWorkers.js';
import { ContextCommand } from './types/context-command-base';
import { initGarbageCollection } from './helpers/garbage.js';
import { createCacheTimer } from './helpers/updateCache.js';
import { recreateLiveTours } from './helpers/livetourWorkers.js';
import { startupFlags } from './helpers/constants.js';
import { loadRMTChans } from './helpers/manageRMTCache.js';
import { createDraftTimer } from './helpers/draft_notifty.js';

/**
 * Note: Loading of enviornment variables, contained within config.js, is abstracted into a separate file to allow for any number of inputs.
 * Env variables are saved in the ./.env file and accessed as botConfig.VARIABLE_NAME
 */


/**
 * Create a new client instance
 * A list of intents can be found here: https://discord.com/developers/docs/topics/gateway#list-of-intents
 * GUILD_PRESENCES, GUILD_MEMBERS, and MESSAGE_CONTENT are privileged and must be manually enabled in the discord developer portal
 * intents should follow the principle of least privilege
 */
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMessageReactions,
        GatewayIntentBits.GuildPresences,
        GatewayIntentBits.GuildModeration,
    ],
    partials: [
        Partials.GuildMember,
        Partials.Message,
    ],
});

// error handling and graceful shutdown
process.on('SIGTERM', () => process.exit(0));


/**
 * Create the command handler
 * Commands are stored as separate files in ./commands and are the custom SlashCommand type
 * The list of commands is loaded dynamically and stored in the client
 */

// create the command collection
client.commands = new Collection();
// set the path to the commands directory
const commandsPath = new URL('commands', import.meta.url);

// in dev, we use ts-node to run the ts files directly
// in production, the ts files are converted to .js before running the app
const ext = botConfig.MODE === Modes.Dev ? '.ts' : '.js';

// get a list of all the .js files in the commands directory
// this returns an array of strings
interface cmdModule {
    command: SlashCommand | ContextCommand;
}

const commandFiles = await readdir(commandsPath);
const modulePromiseArr: Promise<SlashCommand | eventHandler | ContextCommand>[] = [];

// assign dynamically loading all of the local command files to an array so we can load them in parallel
for (const file of commandFiles) {
    // if the file doesn't end in .js, don't consider it. It's not a command.
    if (!file.endsWith(ext)) {
        continue;
    }

    // get the path to the specific command file
    const filePath = new URL(`commands/${file}`, import.meta.url);

    // add loading the module to the awaitable array
    modulePromiseArr.push(loadModule(filePath.toString(), 'command'));
}

// create a collection to contain the command cooldowns
client.cmdCooldowns = new Collection();

/**
 * Build the event handler
 * The different events we wish to act on are exposed to the client via separate files in the ./events directory
 * Each event gets its own file with the name as the event trigger
 * Events are loaded and parsed dynamically to eliminate repetivite client.on(...) blocks of code
 */

// set the path to the events directory
const eventsPath = new URL('events', import.meta.url);

interface eventModule {
    clientEvent: eventHandler
}

const eventFiles = await readdir(eventsPath);

// loop over the list of events
for (const eventfile of eventFiles) {
    // if it's not a js file, ignore it.
    if (!eventfile.endsWith(ext)) {
        continue;
    }

    // get the path to the specific event file
    const eventfilePath = new URL(`events/${eventfile}`, import.meta.url);
    
   // add loading the module to the awaitable array
   modulePromiseArr.push(loadModule(eventfilePath.toString(), 'event'));
}

// await loading of the command and event files in parallel
const localMods = await Promise.all(modulePromiseArr);

if (!localMods.length) {
    throw 'No command or event files found! Something went wrong';
}

// assign the commands and events to the client
for (const mod of localMods) {
    // typecheck mod to make sure we use the proper method to add it to the client
    // because global is unique to commands, we can use it as a discriminator
    if ('global' in mod) {
        client.commands.set(mod.data.name, mod);
    }
    // otherwise, it's an event
    // so add the event handler based on whether it's once or every time
    else if (mod.once) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
        client.once(mod.name, (...args) => mod.execute(...args));
    }
    // else (event.once is not set or set to false), trigger whenever the event occurs
    else {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
        client.on(mod.name, (...args) => mod.execute(...args));
    }
}

// do we need this anymore?
if (!botConfig.SKIP_DB) {
    /**
     * Connect to the postgres DB
     */
    createPool();

    /**
     * Cache the info from the db so we don't overload postgres with queries
     */
    await Promise.all([
        updateState(client),
        loadCustoms(),
        loadCCCooldowns(),
        recreateReminders(client),
        loadSpriteDex(),
        loadAllDexNames(),
        loadMoves(),
        loadItems(),
        loadPSFormats(),
        recreateLiveTours(client),
        loadRMTChans(),
        getImageCommitHash(),
    ]);


    /**
     * Login to Discord with your client's token, or log any errors
     */
    await client.login(botConfig.TOKEN);

    /**
     * Cache the monitored messages for role reactions
     * Has to be done after login since we are fetching messages
     */

    await loadRRMessages(client);

    /**
     * Schedule timers
     */

    // schedule checking for new/updated QC threads
    createCCTimer(client);
    createCATimer(client);
    createDraftTimer(client);

    // garbage day
    initGarbageCollection(client);

    // set a timer to update the cached data from the db/PS
    createCacheTimer(client);
}
else {
    /**
     * Login to Discord with your client's token, or log any errors
     */
    await client.login(botConfig.TOKEN);
}


/**
 * Everything is done, so close fd 3 to signal ready.
 * Only do this in production so we can test in dev mode
 */
if (botConfig.MODE === Modes.Production) {
    // const server = new net.Server().listen({ fd: 3 });
    fs.close(3);
    startupFlags.success = true;
}
else {
    startupFlags.success = true;
}


/**
 * Dynamically Loads a local module
 */
async function loadModule(path: string, type: string) {
    let mod;
    if (type === 'command') {
        mod = (await import(path) as cmdModule).command;
    }
    else {
        mod = (await import(path) as eventModule).clientEvent;
    }
    return mod;
}