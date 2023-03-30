import type { SlashCommand } from '../types/slash-command-base';
import type { IJSONBody, IState } from '../types/state';
import config from '../config.js';

export const states: IState[] = [];
/**
 * Creates a 32-bit hash from a string
 * @param {SlashCommand} cmd  Slash command object
 */
export function hashCommands(cmd: SlashCommand) {
    // get the data JSON that is sent to discord
    // and turn it into a string for hashing
    const cmdData = cmd.data.toJSON();
    
    // if we're in dev mode, overwrite the command defs with the dev guild
    if (config.CLIENT_ID === '1040375769798557826' && cmd.global === false) {
        cmd.guilds = [config.GUILD_ID];
    }
    // ignore any guild defs for global commands
    else if (cmd.global) {
        cmd.guilds = [];
    }
    
    // extract the bits we want to hash into a separate object
    const hashObj = cmdData as IJSONBody;
    hashObj.global = cmd.global;
    hashObj.guilds = cmd.guilds;

    // convert to string
    const cmdDef = JSON.stringify(cmdData);

    // JS implementation of Java str hash
    let hash = 0;
    for (let i = 0; i < cmdDef.length; i++) {
        const chr = cmdDef.charCodeAt(i);
        hash = (hash << 5) - hash + chr;
        // convert to 32bit int
        hash |= 0;
    }
    
    // create the obj to define the state
    const state = {
        command: cmd,
        hash: hash,
    };
    // mutate the array
    states.push(state);
}