import pkg from 'pg';
const { Pool } = pkg;
import { botConfig } from '../config.js';
import mysql from 'mysql2/promise';
/**
 * Helper file to instantiate the connection to the postgres / mySQL pools
 */

export let pool: pkg.Pool;
export let sqlPool: mysql.Pool;

// connect to the databases
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

    return;
}
