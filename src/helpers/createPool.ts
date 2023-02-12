import { getWorkingDir } from './getWorkingDir.js';
import * as path from 'path';
import fs from 'fs';
import pkg from 'pg';
const { Pool } = pkg;
import config from '../config.js';

/**
 * Helper file to instantiate the connection to the postgres pool
 */

export let pool: pkg.Pool;

// connect to the Postgres DB
export async function createPool() {
    try {
      return pool = await new Pool({
        user: config.PGUSER,
        host: config.PGHOST,
        database: config.PGDATABASE,
        password: config.PGPASSWORD,
        port: config.PGPORT,
      });
    }
    catch(error) {
      console.error(error);
      process.exit();
    }
  }
