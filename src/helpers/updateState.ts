import { pool } from './createPool.js';
import type { IState } from '../types/state.js';
import { Client, REST, Routes } from 'discord.js';
import config from '../config.js';
import { hashCommands } from './hashCommands.js';

/**
 * Checks the current state of the commands in the code against the database versions.
 * If the states do not match, it deploys the commands and updates the database
 * @param {Client} client Mutated discord.js client containing the commands
 */
export async function updateState(client: Client) {
    // query the db
    const statePG = await pool.query('SELECT target, hash FROM chatot.states');
    const dbmatches: IState[] | [] = statePG.rows;

    // compute the hashes
    const states: IState[] = hashCommands(client, dbmatches);

    // check for no updates
    if (states.length === 0) {
        return;
    }

    // compare the new hashes with the old ones
    for (const state of states) {
        const oldHash = dbmatches.filter(old => old.target === state.target);

        // if the old hash is not the same as the new one, update discord and the db
        // we can get away with indexing 0 because there can only be at most 1 entry
        // 2914 is the hash of '[]'
        if (oldHash[0]?.hash !== state.hash && state.target !== 'all') {
            // update discord
            await deployCommands(client, state.target);

            // upsert the db
            // if the hash is that of an empty set, remove the row from the db instead so that we don't keep computing the hash for this guild on future restarts
            if (state.hash !== 2914) {
                await pool.query('INSERT INTO chatot.states (target, hash) VALUES ($1, $2) ON CONFLICT (target) DO UPDATE SET hash=EXCLUDED.hash', [state.target, state.hash]);
            }
            else {
                await pool.query('DELETE FROM chatot.states WHERE target=$1', [state.target]);
            }

        }
    }

    // update the hash of everything
    // this doesn't need a call to the discord API
    // we need to do this last because if the above fails, we won't trigger an update again
    // get the state entry corresponding to all
    const newAllState = states.filter(s => s.target === 'all')[0];
    await pool.query('INSERT INTO chatot.states (target, hash) VALUES ($1, $2) ON CONFLICT (target) DO UPDATE SET hash=EXCLUDED.hash', [newAllState.target, newAllState.hash]);
    
    
    return;
}


/**
 * Deploys the commands to discord.
 * The PUT endpoint is used to wipe the deployed commands and insert/update the new definitions
 * @param client Mutated discord.js client containing the commands
 * @param target Target guild ID as string or 'global'
 * @returns Promise<void>
 */
async function deployCommands(client: Client, target: string) {
    const rest = new REST({ version: '10' }).setToken(config.TOKEN);

    // global
    if (target === 'global') {
        // get all of the defined global commands
        const globals = client.commands.filter(c => c.global);

        // create the API call payload
        const cmdBody = globals.map(cmd => cmd.data.toJSON());

        // call the api
        await rest.put(Routes.applicationCommands(config.CLIENT_ID), { body: cmdBody });
    }

    // guild
    else {
        // get all of the commands targeting this id
        const guilds = client.commands.filter(c => !c.global && c.guilds.includes(target));

        // create the API call payload
        const cmdBody = guilds.map(cmd => cmd.data.toJSON());

        // call the api
        await rest.put(Routes.applicationGuildCommands(config.CLIENT_ID, target), { body: cmdBody });
    }
    return; 
}