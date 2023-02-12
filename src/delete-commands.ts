/**
 * Script to delete slash commands from the interface
 * You only need to run this once, to delete a specified command ID from a specified guild ID
 * Discord's API doesn't currently provide an easy way to delete guild-based commands that occur on multiple guilds from all places at once.
 * Each will need a call of this endpoint, while specifying the respective guild and command id.
 * Note that the same command will have a different id, if deployed to a different guild!
 *
 * This code can be run from the terminal, from the root directory, with: npm run delete
 */


import { REST, Routes } from 'discord.js';
import config from './config.js';

// setup the API call, specifying the API version number and providing the bot's authentication token
const rest = new REST({ version: '10' }).setToken(config.TOKEN);

// specify the ID of the command you want to delete
// To delete a specific command, you will need its ID. Head to Server Settings -> Integrations -> Bots and Apps and choose your bot. Then, right click a command and click Copy ID.
const commandID = '';


/**
 * Call the API, telling it to delete the command
 * Variations of this code are provided, depending on the task you want to perform.
 */

/**
 * for SINGLE guild-based command
 * delete specfied command from specified guild
 */
/*
rest.delete(Routes.applicationGuildCommand(config.CLIENT_ID, config.GUILD_ID, commandID))
	.then(() => console.log('Successfully deleted guild command from your specified guild.'))
	.catch(console.error);
*/

/**
 * for SINGLE global command
 * delete specified global command
 */

/*
rest.delete(Routes.applicationCommand(config.CLIENT_ID, commandID'))
	.then(() => console.log('Successfully deleted specified global application command'))
	.catch(console.error);
*/


/**
 * for ALL guild-based commands
 * delete all guild-based commands in specified guild
 */


rest.put(Routes.applicationGuildCommands(config.CLIENT_ID, config.GUILD_ID), { body: [] })
	.then(() => console.log('Successfully deleted all guild commands from your specified guild.'))
	.catch(console.error);



/**
 * for ALL global commands
 * delete all global commands
 */

/*
rest.put(Routes.applicationCommands(config.CLIENT_ID), { body: [] })
	.then(() => console.log('Successfully deleted all global application commands.'))
	.catch(console.error);
*/