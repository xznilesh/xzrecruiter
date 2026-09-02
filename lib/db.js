import pg from 'pg';
const { Pool } = pg;

const url = process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.SUPABASE_DB_URL;
const globalForDb = globalThis;

export function isDbConfigured(){ return Boolean(url); }

export function db(){
  if (!url) throw new Error('DATABASE_URL is not configured');
  if (!globalForDb.__xzRecruiterPool) {
    globalForDb.__xzRecruiterPool = new Pool({
      connectionString: url,
      max: 4,
      idleTimeoutMillis: 20000,
      connectionTimeoutMillis: 8000,
      ssl: { rejectUnauthorized: false }
    });
  }
  return globalForDb.__xzRecruiterPool;
}

export async function query(text, params=[]){ return db().query(text, params); }
