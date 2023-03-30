import { pool } from './createPool.js';
import type { IState, IStateRes } from '../types/state.js';
import { REST, RESTPostAPIApplicationCommandsJSONBody, Routes } from 'discord.js';
import config from '../config.js';


/**
 * Checks the current state of the commands in the code against the database versions.
 * If the states do not match, it deploys the commands and updates the database
 * @param states Array containing command definitions and hashes to determine their versions and deployment status
 */
export async function deployCommands(states: IState[]) {
    const rest = new REST({ version: '10' }).setToken(config.TOKEN);
    const updates: IState[] = [];
    // query the db to get the current command definitions
    const statePG = await pool.query('SELECT name, global, guilds, hash FROM chatot.cmdstate');
    const dbmatches: IStateRes[] | [] = statePG.rows;
    
    // if there is nothing in the database, populate it
    if (!dbmatches.length) {
        for (const newState of states) {
            updates.push(newState);
            await pool.query('INSERT INTO chatot.cmdstate (name, global, guilds, hash) VALUES ($1, $2, $3, $4)', [newState.command.data.name, newState.command.global, newState.command.guilds, newState.hash]);
        }
    }
    else {
        // determine if any of the commands are different
        // if they are, queue them for update
        for (const newState of states) {
            const oldState = dbmatches.find(s => s.name === newState.command.data.name);
            // if you didn't find a match, it's a new command
            if (oldState === undefined) {
                updates.push(newState);
                // add it to the db
                await pool.query('INSERT INTO chatot.cmdstate (name, global, guilds, hash) VALUES ($1, $2, $3, $4)', [newState.command.data.name, newState.command.global, newState.command.guilds, newState.hash]);
            }
            // if you did find a match, see if the hash changed
            // if it did, queue it for update and update the db
            else if (newState.hash !== oldState.hash) {
                await pool.query('UPDATE chatot.cmdstate SET global=$1, guilds=$2, hash=$3 WHERE name=$4', [newState.command.global, newState.command.guilds, newState.hash, newState.command.data.name]);
                updates.push(newState);
            }
        }
    }
    // see what scopes have to be updated
    // technically we could only update the modified commands
    // but it's easier to give discord everything and let it figure it out

    const globalUpdates = updates.filter(u => u.command.global);
    const guildUpdates = updates.filter(u => u.command.guilds.length !== 0);

    /**
     * check to make sure the guild commands were not previous global commands
     * if moving from global -> guild, we'll need to redeploy the globals again
     * otherwise the old global will still exist
     * since we aren't doing anything targeted, we just need to push something to the globalUpdates
     * so that the length is nonzero and we trigger the update
    */
    if (!globalUpdates.length && guildUpdates.length) {
        for (const newGuildCmd of guildUpdates) {
            // get the old command again
            const oldState = dbmatches.find(s => s.name === newGuildCmd.command.data.name);
            // see if its scope changed
            if (oldState?.global !== newGuildCmd.command.global) {
                globalUpdates.push(newGuildCmd);
            }
        }
    }
    
    // if there's a global scope, push all the globals again
    if (globalUpdates.length) {
        // get all of the defined global commands
        const globals = states.filter(s => s.command.global);
        // create the API call payload
        const cmdBody: RESTPostAPIApplicationCommandsJSONBody[] = [];
        for (const gcommand of globals) {
            const cmdJson = gcommand.command.data.toJSON();
            cmdBody.push(cmdJson);
        }
        // call the api
        await rest.put(Routes.applicationCommands(config.CLIENT_ID), { body: cmdBody });
    }
    
    // if there are also guild commands, figure out which guilds need to be updated
    // then loop over each guild, updating everything as you go
    const updatedGuilds: string[] = [];
    if (guildUpdates.length || globalUpdates.length) {
        // get all of the guild commands the bot has
        const guildCmds = states.filter(s => !s.command.global);
        // loop over all of the updated commands to find the affected guilds
        for (const updatedguildCmd of updates) {
            // get the IDs of the guilds we need to push this command to
            const newGuildIDs = updatedguildCmd.command.guilds;

            // and the ones associated with this command that it used to have
            let oldGuildIDs: string[] = [];

            if (dbmatches.length) {
                const oldGuildCommands = dbmatches.filter(old => old.name === updatedguildCmd.command.data.name);
                oldGuildIDs = oldGuildCommands.map(g => g.guilds).flat();
            }
            
            // concat the 2, taking the unique values
            const affectedIDs = newGuildIDs.concat(oldGuildIDs);
            const uniqIDs = [...new Set(affectedIDs)];
            
            // loop over the IDs and update everything as you go
            for (const id of uniqIDs) {
                // if we haven't updated this guild yet, do so
                if (!updatedGuilds.includes(id)) {
                    // get the list of the bot's guild commands that target this guild
                    const allTargetedGuildsCommands = guildCmds.filter(c => c.command.guilds.includes(id));

                    // create the array API payload
                    const cmdBody: RESTPostAPIApplicationCommandsJSONBody[] = [];
                    for (const targetCommands of allTargetedGuildsCommands) {
                        const cmdJson = targetCommands.command.data.toJSON();
                        cmdBody.push(cmdJson);
                    }
                    // call the api
                    await rest.put(Routes.applicationGuildCommands(config.CLIENT_ID, id), { body: cmdBody });
                    
                    // log that we updated this guild so we don't do it again
                    updatedGuilds.push(id);
                }
            }
        }
        
       /*
        // and the IDs of those that used to be guilds
        let oldGuildIDs: string[] = [];

        if (dbmatches.length) {
            const oldGuildCommands = dbmatches.filter(old => old.global === false && old.guilds);
            oldGuildIDs = oldGuildCommands.map(g => g.guilds).flat();
        }
        
        // get the new IDs
        const newGuildIDs = guildUpdates.map(g => g.command.guilds).flat();

        // concat the 2, taking the unique values
        const affectedIDs = newGuildIDs.concat(oldGuildIDs);
        const uniqIDs = [...new Set(affectedIDs)];

        // get the ids of the guilds in the updated commands list
        for (const id of uniqIDs) {
            // get the list of the bot's guild commands that target this guild
            const allTargetedGuildsCommands = guildCmds.filter(c => c.command.guilds.includes(id));

            // create the array API payload
            const cmdBody: RESTPostAPIApplicationCommandsJSONBody[] = [];
            for (const targetCommands of allTargetedGuildsCommands) {
                const cmdJson = targetCommands.command.data.toJSON();
                cmdBody.push(cmdJson);
            }
            // push to discord
            await rest.put(Routes.applicationGuildCommands(config.CLIENT_ID, id), { body: cmdBody });
        }
        */


    }

    return;
}
