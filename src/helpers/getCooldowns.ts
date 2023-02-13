import { getWorkingDir } from './getWorkingDir.js';
import * as path from 'path';
import fs from 'fs';

/**
 * Returns the directory name of the current module
 * @returns Working directory as string
 * 
 * Useful when creating paths to files
 */



interface cooldownData {
  [key: string]: {[key: string]: number},
}

export let cooldowns: cooldownData;

export function getCooldowns() {
    // array of times when the ping was last issued
    const __dirname = getWorkingDir();

    const rmtPingPath = path.join(__dirname, './db/cooldown.json');
    const cooldownDB = fs.readFileSync(rmtPingPath, 'utf8');

    return cooldowns = JSON.parse(cooldownDB);
    
};
