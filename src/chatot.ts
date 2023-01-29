/**
 * Main launch file for the app
 * This file has 4 main sections: create the client with the intents, load the commands, setup the event handler, and login
 */

import { Client, GatewayIntentBits, Collection, Partials, SlashCommandBuilder } from 'discord.js';
import type { SlashCommand } from './types/slash-command-base';
import type { eventHandler } from './types/event-base';
import fs from 'fs';
import * as path from 'path';
import * as net from 'node:net';
import pkg from 'pg';
const { Pool } = pkg;
import { getWorkingDir } from './helpers/getWorkingDir.js';
//import * as messageCreateModule from './events/messageCreate.js';
//const messageCreateEvent = messageCreateModule.clientEvent;


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
const __dirname = getWorkingDir();

// array of times when the ping was last issued
const rmtPingPath = path.join(__dirname, './db/cooldown.json');
const cooldownDB = fs.readFileSync(rmtPingPath, 'utf8');
interface cooldownData {
  [key: string]: {[key: string]: number},
}
export const cooldowns: cooldownData = JSON.parse(cooldownDB);


const commandsPath = path.join(__dirname, 'commands');

// get a list of all the .js files in the commands directory
// this returns and array of strings
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

// loop over the array of commands and set them to the collection as (name, command) pairs
for (const file of commandFiles) {
  // get the path to the specific command file
	const filePath = path.join(commandsPath, file);
  // load the module
  // eslint-disable-next-line @typescript-eslint/no-var-requires
	// const command = require(filePath) as SlashCommand;
  try {
    const command = await import(filePath).then((obj) =>{
      const obj2: SlashCommand = obj.command;
      return obj2;
    });

    client.commands.set(command.data.name, command);
  }
  catch(error) {
    console.error(error);
    process.exit();
  }
}


/**
 * Build the event handler
 * The different events we wish to act on are exposed to the client via separate files in the ./events directory
 * Each event gets its own file with the name as the event trigger
 * Reactions are loaded and parsed dynamically to eliminate repetivite client.on(...) blocks of code
 */

// set the path to the events directory
const eventsPath = path.join(__dirname, 'events');
// get a list of all of the trigger events we want to act on. Loads into an array of strings
const eventFiles = fs.readdirSync(eventsPath).filter(file => file.endsWith('.js'));

// loop over the list of events
for (const file of eventFiles) {
  // get the path to the specific event file
  const filePath = path.join(eventsPath, file);
  // load the module

  /**
   * HACK
   * 
   * import() does not like the rmt-monitor logic
   * Anything that invokes the code causes the build process to end without warning
   * This happens even if the rmt-monitor.ts code is directly written to messageCreate.ts (with or without the async function)
   * The program runs fine using a top level import statement
   * 
   */
  if (file == 'messageCreate.js') {
    //continue;
  }
  try {
    const event = await import(filePath).then((obj) =>{
      const obj2: eventHandler = obj.clientEvent;
      return obj2;
    });
    if (event.once) {
      client.once(event.name, (...args) => event.execute(...args));
  }
  // else (event.once is not set or set to false), trigger whenever the event occurs
  else {
      client.on(event.name, (...args) => event.execute(...args));
  }
  }
  catch(error) {
    console.error(error);
    process.exit();
  }
}

// HACK -- see above note on messageCreate()
// client.on(messageCreateEvent.name, (...args) => messageCreateEvent.execute(...args));

// initialize variable for server on fd 3
let server: net.Server;


// connect to the Postgres DB
async function createPool() {
  try {
    return await new Pool({
      user: config.PGUSER,
      host: config.PGHOST,
      database: config.PGDATABASE,
      password: config.PGPASSWORD,
      port: config.PGPORT,
    });
  }
  catch(error) {
    console.error(error);
    process.exit();
  }
}

const pool = await createPool();
export {pool}; 

const moo = {'test1': 'test'};

export {moo};



/**
 * Login to Discord with your client's token, or log any errors
 * Then, once the Discord connection is established, create a new net.Server listening on fd 3
 */
client.login(config.TOKEN)
  .then(() => {
    server = new net.Server().listen({fd: 3})
  })
  .catch(e => {
    console.error(e);
  });

// error handling and graceful shutdown
process.on('uncaughtException', err => console.error(err));
process.on('unhandledRejection', err => console.error(err));
process.on('SIGTERM', async () => {
  server.close();
  await pool.end();
});