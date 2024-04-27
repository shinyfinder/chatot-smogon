// import * as path from 'path';
import * as dotenv from 'dotenv';
// import { getWorkingDir } from './helpers/getWorkingDir.js';

// parse the env file
// running dotenv.config exposes the env variables as process.env
dotenv.config();


/**
 * Interface to load env variables
 * Note these variables can possibly be undefined, as someone could skip these varibales or not setup a .env file at all
 * By having 2 interfaces, we can require typings and give the user tooltip suggestions based on the variables they saved in .env
 * Any variables that could be there but are undefined are not exposed to the rest of the app
 */


/**
 * Set the types required in the env file
 *
 * This list should include all required values in the .env file
 * As the program grows, this list will need to be updated
 * By allowing for type: undefined, it allows for checking whether the user defined the required variables
 */

interface ENV {
    TOKEN: string | undefined;
    CLIENT_ID: string | undefined;
    GUILD_ID: string | undefined;
    PGUSER: string | undefined;
    PGPASSWORD: string | undefined;
    PGHOST: string | undefined;
    PGPORT: number | undefined;
    PGDATABASE: string | undefined;
    SQLUSER: string | undefined;
    SQLPASSWORD: string | undefined;
    SQLHOST: string | undefined;
    SQLPORT: number | undefined;
    SQLDATABASE: string | undefined;
    SQLSOCKETPATH: string | undefined;
    INTERNAL_DATA_PATH: string | undefined;
    SMOGON_PG_USER: string | undefined;
    SMOGON_PG_DATABASE: string | undefined;
    SMOGON_PG_HOST: string | undefined;
    MODE: string | undefined;
    SSH: boolean | undefined;
    // ...
}

/**
 * Set the type exposed to the app
 *
 * Should the entry exist, this is the type that it needs to be (will be the same as above, sans ' | undefined ')
 * Undefined is not allowed here beceause they need to be defined for the app to run
 */
export enum Modes {
    Dev = 'dev',
    Production = 'production',
}

interface Config {
    TOKEN: string;
    CLIENT_ID: string;
    GUILD_ID: string;
    PGUSER: string;
    PGPASSWORD: string;
    PGHOST: string;
    PGPORT: number;
    PGDATABASE: string;
    MODE: Modes;
    SQLUSER: string;
    SQLPASSWORD: string;
    SQLHOST: string;
    SQLPORT: number;
    SQLDATABASE: string;
    SQLSOCKETPATH: string;
    INTERNAL_DATA_PATH: string;
    SMOGON_PG_USER: string;
    SMOGON_PG_DATABASE: string;
    SMOGON_PG_HOST: string;
    SSH: boolean,
    // ...
}


/**
 * Loads the env variables and assigns them the ENV types
 * @returns typeset process.env
 * Note that process.env returns strings on each entry
 */

const envVar: ENV = {
    TOKEN: process.env.TOKEN,
    CLIENT_ID: process.env.CLIENT_ID,
    GUILD_ID: process.env.GUILD_ID,
    PGUSER: process.env.PGUSER,
    PGPASSWORD: process.env.PGPASSWORD || '',
    PGHOST: process.env.PGHOST,
    PGPORT: parseInt(process.env.PGPORT || '', 10),
    PGDATABASE: process.env.PGDATABASE,
    SQLUSER: process.env.SQLUSER,
    SQLPASSWORD: process.env.SQLPASSWORD || '',
    SQLHOST: process.env.SQLHOST || '',
    SQLPORT: parseInt(process.env.SQLPORT || '', 10),
    SQLDATABASE: process.env.SQLDATABASE,
    SQLSOCKETPATH: process.env.SQLSOCKETPATH || '',
    INTERNAL_DATA_PATH: process.env.INTERNAL_DATA_PATH,
    SMOGON_PG_USER: process.env.SMOGON_PG_USER || '',
    SMOGON_PG_DATABASE: process.env.SMOGON_PG_DATABASE || '',
    SMOGON_PG_HOST: process.env.SMOGON_PG_HOST || '',
    MODE: process.env.MODE || Modes.Production,
    SSH: process.env.SSH === 'true',
    // ...
};

/**
 * Checks whether the required variables are defined as they should be before exposing it to the rest of the client
 *
 * @param config Object containing the environment varaibles
 * @returns config typed as Config
 *
 * If the values in Config are undefined, the user did not define a required env variable. Throw and quit.
 * If everything is defined as it should be, retype config as config: Config
 */

const getSanitzedConfig = (envVar: ENV): Config => {
    // loop through the required entries in the Config interface
    for (const [key, value] of Object.entries(envVar)) {
        // if any of these entries are undefined, the user did not specify them (or you didn't update the interface)
        // throw an error and quit execution of the app
        if (value === undefined) {
            throw new Error(`Missing key ${key} in .env`);
        }
        // validate their entered mode
        else if (key === 'MODE' && !Object.values(Modes).includes(value as Modes)) {
            throw new Error(`Unsupported mode specified in .env. Supported values are: ${Object.values(Modes).join(', ')}`);
        }

    }

    // make sure they provided the SSH PG credentials if they set SSH to true
    if (envVar.SSH && !(envVar.SMOGON_PG_DATABASE && envVar.SMOGON_PG_HOST && envVar.SMOGON_PG_USER)) {
        throw new Error('Although optional parameters, you must specify the remote PostgreSQL credentials if SSH is set to true.');
    }
    // if everything is defined as it should be, save to config: Config
    return envVar as Config;
};

// check for undefined entries
export const botConfig = getSanitzedConfig(envVar);
