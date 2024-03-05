import pkg from 'pg';
const { Pool } = pkg;
import { botConfig } from '../config.js';
import mysql from 'mysql2/promise';

/**
 * Helper file to instantiate the connection to the postgres / mySQL pools
 */

export let pool: pkg.Pool;
export let sqlPool: mysql.Pool;
export let variablePool: pkg.Pool;
export let smogonPGPool: pkg.Pool;

/**
 * Loads the connections to the SQL databases.
 * Technically, we maintain 3 pools in SSH mode: the local pg and mysql connections + the remote connection to production.
 * variablePool allows us to query against either the local or SSH db via a env flag.
 * If we know we're only going to query against the local database (writes), we can define our calls referencing pool.
 * But if we want to allow for querying against either one, we reference variablePool.
 * In production or non-SSH dev mode, variablePool = pool
 */
export function createPool() {
    pool = new Pool({
        user: botConfig.PGUSER,
        host: botConfig.PGHOST,
        database: botConfig.PGDATABASE,
        password: botConfig.PGPASSWORD,
        port: botConfig.PGPORT,
    });

    // wrap the sqlpool in a promise
    sqlPool = mysql.createPool({
        host: botConfig.SQLHOST,
        user: botConfig.SQLUSER,
        password: botConfig.SQLPASSWORD,
        database: botConfig.SQLDATABASE,
        port: botConfig.SQLPORT,
        socketPath: botConfig.SQLSOCKETPATH,
    });

    if (botConfig.SSH) {
        smogonPGPool = new Pool({
            user: botConfig.SMOGON_PG_USER,
            host: botConfig.SMOGON_PG_HOST,
            database: botConfig.SMOGON_PG_DATABASE,
        });
    }

    variablePool = botConfig.SSH ? smogonPGPool : pool;
}
