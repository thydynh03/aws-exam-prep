import pg from 'pg';

const { Pool } = pg;

const DEFAULT_SUPABASE_URL =
  'postgresql://postgres.vmqhalhlexrqnpwgkank:Thithithi%400305@aws-0-ap-northeast-1.pooler.supabase.com:6543/postgres';

let poolInstance: pg.Pool | null = null;
let isPgAvailable: boolean | null = null;

export function getDatabaseUrl(): string {
  return process.env.DATABASE_URL || DEFAULT_SUPABASE_URL;
}

export function isTestEnvironment(): boolean {
  return Boolean(process.env.NODE_ENV === 'test' || process.env.VITEST);
}

/**
 * Returns singleton pg.Pool or null if in test mode
 */
export function getPgPool(): pg.Pool | null {
  if (isTestEnvironment()) {
    return null;
  }

  if (!poolInstance) {
    const connStr = getDatabaseUrl();
    poolInstance = new Pool({
      connectionString: connStr,
      ssl: {
        rejectUnauthorized: false,
      },
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 8000,
    });

    poolInstance.on('error', (err) => {
      console.warn('Unexpected error on idle PostgreSQL client:', err.message);
    });
  }

  return poolInstance;
}

/**
 * Test connectivity to PostgreSQL
 */
export async function testPgConnection(): Promise<boolean> {
  if (isTestEnvironment()) {
    isPgAvailable = false;
    return false;
  }

  const pool = getPgPool();
  if (!pool) {
    isPgAvailable = false;
    return false;
  }

  try {
    const client = await pool.connect();
    try {
      const res = await client.query('SELECT 1 as connected');
      isPgAvailable = Boolean(res.rows && res.rows[0]?.connected === 1);
      return isPgAvailable;
    } finally {
      client.release();
    }
  } catch (err) {
    console.warn('PostgreSQL connection check failed, falling back to local storage:', err instanceof Error ? err.message : err);
    isPgAvailable = false;
    return false;
  }
}

/**
 * Close pool gracefully
 */
export async function closePgPool(): Promise<void> {
  if (poolInstance) {
    await poolInstance.end();
    poolInstance = null;
    isPgAvailable = null;
  }
}
