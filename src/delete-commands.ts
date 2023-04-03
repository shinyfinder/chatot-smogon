/**
 * Script to delete slash commands from the interface
 * You only need to run this once, to delete a specified command ID from a specified guild ID
 * Discord's API doesn't currently provide an easy way to delete guild-based commands that occur on multiple guilds from all places at once.
 * Each will need a call of this endpoint, while specifying the respective guild and command id.
 * Note that the same command will have a different id, if deployed to a different guild!
 *
 * Expected syntax is node deploy-commands.js -[guild|global] cmdid1 cmdid2 ...
 * 
 */


import { REST, RESTGetAPIApplicationCommandResult, RESTGetAPIApplicationGuildCommandResult, Routes } from 'discord.js';
import config from './config.js';
import { errorHandler } from './helpers/errorHandler.js';

// setup the API call, specifying the API version number and providing the bot's authentication token
const rest = new REST({ version: '10' }).setToken(config.TOKEN);

// get the command line arguments
const args = process.argv.slice(2);
const flags = process.argv.filter(arg => arg.startsWith('-'));

// arguments assume a format of
// node deploy-commands.js -[guild|global] cmdname1 cmdname2 ...

// determine the scope of this command
// define the list of possible scopes
const possibleScopes = [
    'guild',
    'global',
  ];
  
let scope = flags[0];
if (scope === undefined) {
    console.error(`Expected scope ${possibleScopes.join(' | ')} but received nothing`);
    process.exit();
}
else {
    scope = scope.replaceAll('-', '');
}

if (!possibleScopes.some(s => s === scope)) {
    console.error(`Expected scope ${possibleScopes.join(' | ')} but received ${scope}`);
    process.exit();
}

// specify the ID of the command you want to delete
// To delete a specific command, you will need its ID. Head to Server Settings -> Integrations -> Bots and Apps and choose your bot. Then, right click a command and click Copy ID.
const commandName = args.slice(1);


try {
	/**
	 *  delete specified commands from the guild specified in .env
	 */
	if (scope === 'guild' && commandName.length) {
		// get the list of commands from the server specified in the .env
		const guildCommands = await rest.get(Routes.applicationGuildCommands(config.CLIENT_ID, config.GUILD_ID)) as RESTGetAPIApplicationGuildCommandResult[];
		const guildCommandIDs = guildCommands.map(cmd => cmd.id);
		const guildCommandNames = guildCommands.map(cmd => cmd.name);

		// check if the entire list of entered names is in the list of global commands
		const areGuild = commandName.every(name => guildCommandNames.includes(name));

		if (!areGuild) {
			console.error('Entered names not recognized. Are the commands deployed and spelled correctly?');
			process.exit();
		}


		for (const name of commandName) {
			// find the index of the name in the list of global command names
			const index = guildCommandNames.findIndex(n => n === name);
			// call api
			await rest.delete(Routes.applicationGuildCommand(config.CLIENT_ID, config.GUILD_ID, guildCommandIDs[index]));
		}
		console.log(`Removed command(s) ${commandName.join(', ')} from guild ${config.GUILD_ID}`);
		process.exit();
	}


	/**
	 * all guild commands from guild specified in .env
	 */
	else if (scope === 'guild' && !commandName.length) {
		await rest.put(Routes.applicationGuildCommands(config.CLIENT_ID, config.GUILD_ID), { body: [] });
		console.log(`Deleted all guild commands from guild ${config.GUILD_ID}`);
		process.exit();
	}


	/**
	 * specified global command from guild specified in .env
	 */
	else if (scope === 'global' && commandName.length) {
		// get the list of commands from the server specified in the .env
		const globalCommands = await rest.get(Routes.applicationCommands(config.CLIENT_ID)) as RESTGetAPIApplicationCommandResult[];
		const globalCommandIDs = globalCommands.map(cmd => cmd.id);
		const globalCommandNames = globalCommands.map(cmd => cmd.name);

		// check if the entire list of entered names is in the list of global commands
		const areGlobal = commandName.every(name => globalCommandNames.includes(name));

		if (!areGlobal) {
			console.error('Entered names not recognized. Are the commands deployed and spelled correctly?');
			process.exit();
		}
		
		for (const name of commandName) {
			// find the index of the name in the list of global command names
			const index = globalCommandNames.findIndex(n => n === name);
			// call api
			await rest.delete(Routes.applicationCommand(config.CLIENT_ID, globalCommandIDs[index]));
			console.log(`Deleted global command(s) ${commandName.join(', ')} from guild ${config.GUILD_ID}`);
			process.exit();
		}
	}


	/**
	 * all global commands from all guilds
	 */
	else if (scope === 'global' && !commandName.length) {
		await rest.put(Routes.applicationCommands(config.CLIENT_ID), { body: [] });
		console.log('Deleted all global commands');
		process.exit();
	}
}
catch (err) {
	errorHandler(err);
	process.exit();
}
