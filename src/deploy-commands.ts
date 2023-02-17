/**
 * Registers the command list to the guild specified in .env, or globally depending on which version of the code is run.
 * This script will need to be run whenever you create a new or edit an existing command.
 * This script can be run from the terminal, from the root folder, with: npm run deploy
 *
 * If you start the bot without first deploying your commands, it will log in but have no command list.
 * Commands are not updated on the front end until this code is run
 */

import { readdir } from 'node:fs/promises';
import { REST, Routes } from 'discord.js';
import config from './config.js';
import { SlashCommand } from './types/slash-command-base';

// setup a container for the command info to be pushed to discord
// discord only needs the data entry from the command, formatted as a JSON array
const commands: unknown[] = [];

// locate the command directory
const commandsPath = new URL('commands', import.meta.url);

// get a list of all of the command files
interface cmdModule {
  command: SlashCommand;
}

try {
  const commandFiles = await readdir(commandsPath);
  // push the commands to the array
  for (const file of commandFiles) {
    // get the path to the specific command file
    const filePath = new URL(`commands/${file}`, import.meta.url);

    // load the module
    const command = await import(filePath.toString()).then((obj: cmdModule) => {
      const obj2 = obj.command;
      return obj2;
    });

    // push the command data to the array formatted as a JSON
    // commands.push(JSON.stringify(command.data));
    commands.push(command.data.toJSON());
  }
}
catch (err) {
  console.error(err);
  process.exit();
}


// setup the API call, specifying the API version number and providing the bot's authentication token
const rest = new REST({ version: '10' }).setToken(config.TOKEN);


/**
 * Push the command data to discord.
 * Commands are either pushed to the guild specified in the .env file, or globally (all servers the bot is in)
 * The only difference between the code sets is whether you provide the guild ID
 */

// guild commands
rest.put(Routes.applicationGuildCommands(config.CLIENT_ID, config.GUILD_ID), { body: commands })
	.then(() => console.log('Successfully registered application commands.'))
	.catch(console.error);

// global commands
/*
rest.put(Routes.applicationGuildCommands(config.CLIENT_ID), { body: commands })
	.then(() => console.log('Successfully registered application commands.'))
	.catch(console.error);
*/