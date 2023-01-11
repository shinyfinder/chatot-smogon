/**
 * Main launch file for the app
 * This file has 4 main sections: create the client with the intents, load the commands, setup the event handler, and login
 */

import { Client, GatewayIntentBits, Collection, Partials } from 'discord.js';
import type { SlashCommand } from './types/slash-command-base';
import type { eventHandler } from 'src/types/event-base';
import fs from 'fs';
import * as path from 'path';

/**
 * Load in the environment variables
 * This is abstracted into a separate file to allow for any number of inputs (token, client id, and guild id are required)
 * Env variables are saved in the ./.env file and accessed as config.VARIABLE_NAME
 */
import config from './config';


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
  ],
  partials: [
    Partials.GuildMember,
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
	const command = require(filePath) as SlashCommand;
	// Set a new item in the Collection and store it in the client
	// With the key as the command name and the value as the exported module
	client.commands.set(command.data.name, command);
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
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const event = require(filePath) as eventHandler;

  // parse and apply each event depending on whether it should be run once (on startup) or multiple times (while running)
  // if event.once is defined to true, only trigger once
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

// array of times when the rmt ping was last issued
export const cooldowns: {[key: string]: {[key: string]: number}} = {};

/**
 * Login to Discord with your client's token, or log any errors
 */
void (async () => client.login(config.TOKEN).catch(e => console.error(e)))();
