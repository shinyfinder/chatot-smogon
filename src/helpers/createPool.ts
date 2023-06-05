import pkg from 'pg';
const { Pool } = pkg;
import config from '../config.js';
import mysql from 'mysql2/promise';
/**
 * Helper file to instantiate the connection to the postgres / mySQL pools
 */

export let pool: pkg.Pool;
export let sqlPool: mysql.Pool;

// connect to the databases
export function createPool() {
    pool = new Pool({
        user: config.PGUSER,
        host: config.PGHOST,
        database: config.PGDATABASE,
        password: config.PGPASSWORD,
        port: config.PGPORT,
    });

    // wrap the sqlpool in a promise
    sqlPool = mysql.createPool({
        host: config.SQLHOST,
        user: config.SQLUSER,
        password: config.SQLPASSWORD,
        database: config.SQLDATABASE,
        port: config.SQLPORT,
        socketPath: config.SQLSOCKETPATH,
    });

    return;
}
