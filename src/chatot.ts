/**
 * Main launch file for the app
 * This file has 4 main sections: create the client with the intents, load the commands, setup the event handler, and login
 */

import { Client, GatewayIntentBits, Collection, Partials } from 'discord.js';
import type { SlashCommand } from './types/slash-command-base';
import type { eventHandler } from './types/event-base';
import { readdir } from 'node:fs/promises';
import * as net from 'node:net';
import { createPool, pool } from './helpers/createPool.js';


/**
 * Load in the environment variables
 * This is abstracted into a separate file to allow for any number of inputs (token, client id, and guild id are required)
 * Env variables are saved in the ./.env file and accessed as config.VARIABLE_NAME
 */
import config from './config.js';


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
    GatewayIntentBits.GuildBans,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMessageReactions,
  ],
  partials: [
    Partials.GuildMember,
    Partials.Message,
    Partials.Reaction,
  ],
});


/**
 * Create the command handler
 * Commands are stored as separate files in ./commands and are the custom SlashCommand type
 * The list of commands is loaded dynamically and stored in the client
 */

// create the command collection
client.commands = new Collection();
// set the path to the commands directory
const commandsPath = new URL('commands', import.meta.url);

// get a list of all the .js files in the commands directory
// this returns an array of strings
interface cmdModule {
  command: SlashCommand;
}

try {
  const commandFiles = await readdir(commandsPath);
  // loop over the array of commands and set them to the collection as (name, command) pairs
  for (const file of commandFiles) {
    // if the file doesn't end in .js, don't consider it. It's not a command.
    if (!file.endsWith('.js')) {
      continue;
    }

    // get the path to the specific command file
    const filePath = new URL(`commands/${file}`, import.meta.url);

    // load the module
    const command = await import(filePath.toString()).then((obj: cmdModule) => {
      const obj2: SlashCommand = obj.command;
      return obj2;
    });
    // set it to the client
    client.commands.set(command.data.name, command);
  }
}
catch (error) {
  console.error(error);
  process.exit();
}


/**
 * Build the event handler
 * The different events we wish to act on are exposed to the client via separate files in the ./events directory
 * Each event gets its own file with the name as the event trigger
 * Reactions are loaded and parsed dynamically to eliminate repetivite client.on(...) blocks of code
 */

// set the path to the events directory
const eventsPath = new URL('events', import.meta.url);

interface eventModule {
  clientEvent: eventHandler
}

// get a list of all of the trigger events we want to act on. Loads into an array of strings
try {
  const eventFiles = await readdir(eventsPath);

  // loop over the list of events
  for (const file of eventFiles) {
    // if it's not a js file, ignore it.
    if (!file.endsWith('.js')) {
      continue;
    }

    // get the path to the specific event file
    const filePath = new URL(`events/${file}`, import.meta.url);
    // load the module
    const event = await import(filePath.toString()).then((obj: eventModule) => {
      const obj2 = obj.clientEvent;
      return obj2;
    });
    // load it onto the client
    if (event.once) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
      client.once(event.name, (...args) => event.execute(...args));
    }
    // else (event.once is not set or set to false), trigger whenever the event occurs
    else {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
        client.on(event.name, (...args) => event.execute(...args));
    }
  }

}
catch (error) {
  console.error(error);
  process.exit();
}


/**
 * Connect to the postgres DB
 */
createPool();


// initialize variable for server on fd 3
let server: net.Server;

/**
 * Login to Discord with your client's token, or log any errors
 * Then, once the Discord connection is established, create a new net.Server listening on fd 3
 */
client.login(config.TOKEN)
  .then(() => {
    server = new net.Server().listen({ fd: 3 });
  })
  .catch(e => {
    console.error(e);
  });

// error handling and graceful shutdown
process.on('uncaughtException', err => console.error(err));
process.on('unhandledRejection', err => console.error(err));
process.on('SIGTERM', () => {
  void (async () => {
    server.close();
    await pool.end();
  })();
});