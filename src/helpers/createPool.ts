import pkg from 'pg';
const { Pool } = pkg;
import config from '../config.js';

/**
 * Helper file to instantiate the connection to the postgres pool
 */

export let pool: pkg.Pool;

// connect to the Postgres DB
export function createPool() {
  return pool = new Pool({
    user: config.PGUSER,
    host: config.PGHOST,
    database: config.PGDATABASE,
    password: config.PGPASSWORD,
    port: config.PGPORT,
  });
}
