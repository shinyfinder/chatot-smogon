/**
 * Registers the command list to the guild specified in .env, or globally depending on which version of the code is run.
 * This script will need to be run whenever you create a new or edit an existing command.
 * This script can be run from the terminal, from the root folder, with: npm run deploy
 *
 * If you start the bot without first deploying your commands, it will log in but have no command list.
 * Commands are not updated on the front end until this code is run
 */

import { readdir } from 'node:fs/promises';
import { REST, RESTPostAPIApplicationCommandsJSONBody, RESTGetAPIApplicationGuildCommandResult, Routes } from 'discord.js';
import config from './config.js';
import { SlashCommand } from './types/slash-command-base';
import { errorHandler } from './helpers/errorHandler.js';

// get the command line arguments
const args = process.argv.slice(2);
const flags = process.argv.filter(arg => arg.startsWith('-'));

// arguments assume a format of
// node deploy-commands.js -[guild|global|update|u] cmd1 cmd2 cmd3 ...

// determine the scope of this command
// define the list of possible scopes
const possibleScopes = [
    'guild',
    'global',
  ];

// make sure they passed scope flags
if (!flags.length) {
    console.error(`Expected scope ${possibleScopes.join(' | ')} but received nothing`);
    process.exit();
}

// validate all passed flags
for (let scope of flags) {
    scope = scope.replace('-', '');
    if (!possibleScopes.some(s => s === scope)) {
        console.error(`Expected scope ${possibleScopes.join(' | ')} but received ${scope}`);
        process.exit();
    }
}

// loop over the args and ogranize the passed values
const orgCommands: string[][] = [];
let tempArr: string[] = [];
let buildTemp = false;
let argsRemaining = args.length;

for (const passedName of args) {
    argsRemaining--;
    // set whether we should be looking for command names
    if (passedName === '-guild') {
        buildTemp = true;
    }
    else if (passedName === '-global') {
        buildTemp = false;
    }
    // if we're looking for command names, push them to a temp array
    // otherwise, push them to the final array and reset temp
    if (buildTemp === true && !passedName.startsWith('-')) {
        tempArr.push(passedName);
    }
    else if (buildTemp === false && passedName.startsWith('-')) {
        orgCommands.push(tempArr);
        tempArr = [];
    }
    // if this is the last iteration, push the temp array
    if (argsRemaining === 0) {
        orgCommands.push(tempArr);
    }
    
}

// get a list of all of the command files
interface cmdModule {
    command: SlashCommand;
}

// setup the API call, specifying the API version number and providing the bot's authentication token
const rest = new REST({ version: config.API_VER }).setToken(config.TOKEN);

for (let i = 0; i < flags.length; i++) {
    try {
        const scope = flags[i].replace('-', '');
        if (scope === 'guild') {
            // determine whether they specified commands
            // const targetCommands = args.slice(1);
            const targetCommands = orgCommands[i];
            if (targetCommands.length) {
                // get the list of current commands for the guild specified in .env
                const currentCommandsAPI = await rest.get(Routes.applicationGuildCommands(config.CLIENT_ID, config.GUILD_ID)) as RESTGetAPIApplicationGuildCommandResult[];
                // extract the names of the current commands
                const currentCommandNames = currentCommandsAPI.map(c => c.name);
    
                // concat the current names with the specified targets
                // only take the unique entries in case they use this flag to update an existing command
                const uniqNames = [...new Set(currentCommandNames.concat(targetCommands))];
                    
                // append js to the unique names so we can load the files
                uniqNames.forEach((n, index) => uniqNames[index] = n.concat('.js'));
    
                // load the files
                const guildCommands = await loadFiles(uniqNames, scope);
                
                // push them to discord
                await rest.put(Routes.applicationGuildCommands(config.CLIENT_ID, config.GUILD_ID), { body: guildCommands });
                console.log('Successfullly pushed guild commands');
        
            }
            else {
                // deploy all currently registered guild commands to guild in .env
                
                // locate the command directory
                const commandsPath = new URL('commands', import.meta.url);
    
                // get the list of current commands for the guild specified in .env
                const currentCommandsAPI = await rest.get(Routes.applicationGuildCommands(config.CLIENT_ID, config.GUILD_ID)) as RESTGetAPIApplicationGuildCommandResult[];
                // extract the names of the current commands
                const currentCommandNames = currentCommandsAPI.map(c => c.name);
    
                // append js to the end of the name of each command so we can load the local file
                // if there are currently no guild commands, load all of them because they didn't choose one
                let commandNameList: string[] = [];
                if (currentCommandNames.length) {
                    currentCommandNames.forEach((n, index) => currentCommandNames[index] = n.concat('.js'));
                    commandNameList = currentCommandNames;
                }
                else {
                    commandNameList = await readdir(commandsPath);
                }
                
                // load the files
                const guildCommands = await loadFiles(commandNameList, scope);
                
                // push it to discord
                await rest.put(Routes.applicationGuildCommands(config.CLIENT_ID, config.GUILD_ID), { body: guildCommands });
                console.log('Successfully registered application commands.');
                
            }
        }
        else if (scope === 'global') {
            // locate the command directory
            const commandsPath = new URL('commands', import.meta.url);
            
            // load the files in the commands directory
            const commandFiles = await readdir(commandsPath);
            
            // load the files
            const globalCommands = await loadFiles(commandFiles, scope);
            
            // push to discord
            await rest.put(Routes.applicationCommands(config.CLIENT_ID), { body: globalCommands });
            console.log('Successfully registered global application commands.');
           
        }
    }
    catch (err) {
        errorHandler(err);
        process.exit();
    }
}


async function loadFiles(nameArr: string[], cmdScope: string) {
    // check if global or guild
    // the syntax in the command definitions is guild = true
    const targetScope = (cmdScope === 'global');
    const commandArr: RESTPostAPIApplicationCommandsJSONBody[] = [];
    // push the commands to the array
    for (const file of nameArr) {
        // if the file doesn't end in .js, don't consider it. It's not a command.
        if (!file.endsWith('.js')) {
          continue;
        }
        // get the path to the specific command file
        const filePath = new URL(`commands/${file}`, import.meta.url);

        // load the module
        const command = (await import(filePath.toString()) as cmdModule).command;
    
        // push the command data to the array formatted as a JSON
        // only return commands that are of the same specified scope
        if (command.global === targetScope) {
            commandArr.push(command.data.toJSON());
        }
        
      }
    return commandArr;
}