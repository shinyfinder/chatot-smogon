import type { IState } from '../types/state';
import { Client } from 'discord.js';
import { computeHash } from './computeHash.js';
import { Modes, botConfig } from '../config.js';

// export const states: IState[] = [];

export function hashCommands(client: Client, dbmatches: IState[] | []) {
    const states: IState[] = [];

    /**
     * Compute the hash of all commands
     * This is done so that we can try to shortcircuit the startup process
     */
    // create an array of objects containing the definitions
    // this includes the global flag, the list of guilds, and the command defs sent to discord
    const allHashObj = client.commands.map(cdef => ({
        global: cdef.global,
        guilds: cdef.guilds,
        data: cdef.data,
    }));

    // find the hash of everything
    const allHash = computeHash(JSON.stringify(allHashObj));
    // get the old hash from the db
    const allOldHash = dbmatches.filter(old => old.target === 'all')[0];

    // if they're the same, there's nothing to deploy
    if (allOldHash?.hash === allHash) {
        return states;
    }
    // if they're different, compute the other hashes so that we know what needs to be updated
    // also queue the new everything hash for update
    else {
        states.push({ target: 'all', hash: allHash });
    }


    /**
     * Compute the guild hashes 
     * Only the guilds that currently have commands deployed 
     * or will have commands deployed are considered
     * This is a hash of the command definitions to be sent to discord
     */
    // get the list of current guild and global commands
    const currentGuildCommands = client.commands.filter(cmd => !cmd.global);
    const currentGlobalCommands = client.commands.filter(cmd => cmd.global);

    // get the current list of affected guild IDs for the guild commands
    let currentGuildIDs = currentGuildCommands.map(c => c.guilds).flat();

    // if we're in dev mode, overwrite the list of unique IDs and the command defs with the one for the dev server
    if (botConfig.MODE === Modes.Dev) {
        currentGuildIDs = [botConfig.GUILD_ID];
        currentGuildCommands.forEach(cmd => cmd.guilds = currentGuildIDs);
    }

    // get the old list of IDs
    let oldGuildIDs: string[] = [];
    // if you got results on the query...
    if (dbmatches.length) {
        // filter out the globals and everything hash
        const oldGuildCommands = dbmatches.filter(old => old.target !== 'global' && old.target !== 'all');
        // and get the ids
        oldGuildIDs = oldGuildCommands.map(row => row.target);
    }

    // concat the 2, taking the unique values
    const affectedIDs = currentGuildIDs.concat(oldGuildIDs);
    const uniqIDs = [...new Set(affectedIDs)];

    // loop over the unique list of guild IDs and compute the hash for each one
    // this will tell us if there's a pending update for this guild
    for (const id of uniqIDs) {
        // get the current list targeting this guild
        const targetCommands = currentGuildCommands.filter(cmd => cmd.guilds.includes(id));

        // extract the info to be sent to discord so we can hash it
        const targetBodies = targetCommands.map(slash => slash.data.toJSON());

        // find the hash  
        const hash = computeHash(JSON.stringify(targetBodies));

        // store it in the object
        states.push(
            { target: id, hash: hash },
        );
    }
    

    /**
     * Compute the global hash
     * This is a hash of the global command definitions sent to discord
     */
    // compute the hash for the globals
    const currentGlobalBodies = currentGlobalCommands.map(slash => slash.data.toJSON());
    const hash = computeHash(JSON.stringify(currentGlobalBodies));

    // store it in the object
    states.push(
        { target: 'global', hash: hash },
    );
   
    return states;
}