import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { DatabaseSync } from 'node:sqlite';

export interface RegistryLearner {
  id: string;
  username: string;
  role: 'LEARNER' | 'ADMIN';
  createdAt: number;
  lastActiveAt: number;
  device?: {
    deviceType?: string;
    os?: string;
    browser?: string;
  };
}

// Resolve persistent registry file path with serverless /tmp fallback
function getRegistryPaths(): { primary: string; fallback?: string } {
  if (process.env.NODE_ENV === 'test' || process.env.VITEST) {
    const tmpDataDir = path.join(os.tmpdir(), 'aws_test_registry');
    if (!fs.existsSync(tmpDataDir)) {
      try {
        fs.mkdirSync(tmpDataDir, { recursive: true });
      } catch {
        // Ignore
      }
    }
    return { primary: path.join(tmpDataDir, 'learners_registry.json') };
  }

  const isServerless = Boolean(
    process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME || process.env.NOW_REGION
  );

  const localDataDir = path.resolve(process.cwd(), 'data');
  const localRegistryPath = path.join(localDataDir, 'learners_registry.json');

  if (isServerless) {
    const tmpDataDir = path.join('/tmp', 'data');
    if (!fs.existsSync(tmpDataDir)) {
      try {
        fs.mkdirSync(tmpDataDir, { recursive: true });
      } catch {
        // Ignore mkdir error
      }
    }
    const tmpRegistryPath = path.join(tmpDataDir, 'learners_registry.json');
    return {
      primary: tmpRegistryPath,
      fallback: localRegistryPath,
    };
  }

  if (!fs.existsSync(localDataDir)) {
    try {
      fs.mkdirSync(localDataDir, { recursive: true });
    } catch {
      // Ignore
    }
  }

  return { primary: localRegistryPath };
}

export const BASELINE_LEARNERS: Record<string, RegistryLearner> = {
  thi: {
    id: 'usr_a5102bc6',
    username: 'thi',
    role: 'LEARNER',
    createdAt: 1789662649004,
    lastActiveAt: 1789662865990,
    device: {
      deviceType: 'Desktop',
      os: 'Windows 10/11',
      browser: 'Google Chrome',
    },
  },
  nguyenthanhdat: {
    id: 'usr_nguyenthanhdat',
    username: 'NguyenThanhDat',
    role: 'LEARNER',
    createdAt: 1789393541401,
    lastActiveAt: 1789652141401,
    device: {
      deviceType: 'Desktop',
      os: 'Windows 10/11',
      browser: 'Google Chrome',
    },
  },
  trung: {
    id: 'usr_trung',
    username: 'trung',
    role: 'LEARNER',
    createdAt: 1789220741401,
    lastActiveAt: 1789650941401,
    device: {
      deviceType: 'Desktop',
      os: 'Windows',
      browser: 'Edge',
    },
  },
  dxgsva: {
    id: 'usr_dxgsva',
    username: 'dxgsva',
    role: 'LEARNER',
    createdAt: 1789493213000,
    lastActiveAt: 1789663913000,
    device: {
      deviceType: 'Desktop',
      os: 'Windows',
      browser: 'Chrome',
    },
  },
  quang_aws: {
    id: 'usr_quang_aws',
    username: 'quang_aws',
    role: 'LEARNER',
    createdAt: 1788443141401,
    lastActiveAt: 1789651541401,
    device: {
      deviceType: 'Desktop',
      os: 'Windows',
      browser: 'Chrome',
    },
  },
  anh_tuan_cloud: {
    id: 'usr_tuan_cloud',
    username: 'anh_tuan_cloud',
    role: 'LEARNER',
    createdAt: 1787924741401,
    lastActiveAt: 1789641941401,
    device: {
      deviceType: 'Desktop',
      os: 'macOS',
      browser: 'Chrome',
    },
  },
  lan_devops: {
    id: 'usr_lan_devops',
    username: 'lan_devops',
    role: 'LEARNER',
    createdAt: 1788788741401,
    lastActiveAt: 1789634741401,
    device: {
      deviceType: 'Mobile',
      os: 'iOS',
      browser: 'Safari',
    },
  },
};

/**
 * Load all registered learners from persistent JSON file
 */
export function getLearnersRegistry(): Record<string, RegistryLearner> {
  const result: Record<string, RegistryLearner> = { ...BASELINE_LEARNERS };
  const { primary, fallback } = getRegistryPaths();

  // Try primary
  if (fs.existsSync(primary)) {
    try {
      const raw = fs.readFileSync(primary, 'utf8');
      if (raw && raw.trim().length > 0) {
        const parsed = JSON.parse(raw) as Record<string, RegistryLearner>;
        return { ...result, ...parsed };
      }
    } catch {
      // If primary is temporarily locked or incomplete, proceed to fallback
    }
  }

  // Try fallback (bundled from process.cwd())
  if (fallback && fs.existsSync(fallback)) {
    try {
      const raw = fs.readFileSync(fallback, 'utf8');
      if (raw && raw.trim().length > 0) {
        const data = JSON.parse(raw) as Record<string, RegistryLearner>;
        try {
          fs.writeFileSync(primary, raw, 'utf8');
        } catch {
          // Ignore
        }
        return { ...result, ...data };
      }
    } catch {
      // Ignore
    }
  }

  return result;
}

/**
 * Get all registered learners as an array
 */
export function getRegisteredLearnersList(): RegistryLearner[] {
  const registry = getLearnersRegistry();
  return Object.values(registry);
}

/**
 * Save / update a learner in the persistent registry file immediately
 */
export function persistLearnerToRegistry(learner: Partial<RegistryLearner> & { username: string }): void {
  if (!learner.username || learner.username.trim().toLowerCase() === 'admin') return;
  const username = learner.username.trim();
  const key = username.toLowerCase();
  const now = Date.now();

  const registry = getLearnersRegistry();
  const existing = registry[key];

  registry[key] = {
    id: learner.id || existing?.id || `usr_${key.replace(/[^a-z0-9_]/g, '_')}`,
    username,
    role: 'LEARNER',
    createdAt: learner.createdAt || existing?.createdAt || now,
    lastActiveAt: learner.lastActiveAt || now,
    device: learner.device || existing?.device,
  };

  const { primary, fallback } = getRegistryPaths();
  const jsonContent = JSON.stringify(registry, null, 2);

  const writeSafe = (targetPath: string) => {
    try {
      const dir = path.dirname(targetPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      const tmpPath = `${targetPath}.${Date.now()}.${Math.random().toString(36).substring(2, 6)}.tmp`;
      fs.writeFileSync(tmpPath, jsonContent, 'utf8');
      fs.renameSync(tmpPath, targetPath);
    } catch {
      try {
        fs.writeFileSync(targetPath, jsonContent, 'utf8');
      } catch {
        // Read-only filesystem in serverless container is expected
      }
    }
  };

  writeSafe(primary);
  if (fallback && fallback !== primary) {
    writeSafe(fallback);
  }
}

/**
 * Restore and upsert all learners from registry into the SQLite database
 */
export function restoreAllLearnersFromRegistry(database: DatabaseSync): number {
  const registry = getLearnersRegistry();
  const learners = Object.values(registry);
  if (learners.length === 0) return 0;

  const insertUser = database.prepare(`
    INSERT INTO users (id, username, role, created_at, last_active_at)
    VALUES (?, ?, 'LEARNER', ?, ?)
    ON CONFLICT(username) DO UPDATE SET
      last_active_at = max(users.last_active_at, excluded.last_active_at)
  `);

  const insertDevice = database.prepare(`
    INSERT INTO user_devices (id, user_id, device_type, os, browser, session_count, last_active_at)
    VALUES (?, ?, ?, ?, ?, 1, ?)
    ON CONFLICT(user_id, device_type, os, browser) DO UPDATE SET
      last_active_at = excluded.last_active_at
  `);

  let restoredCount = 0;
  for (const l of learners) {
    if (!l.username || l.username.toLowerCase() === 'admin') continue;
    try {
      insertUser.run(l.id, l.username, l.createdAt, l.lastActiveAt);
      restoredCount++;

      if (l.device && l.device.deviceType && l.device.os && l.device.browser) {
        const devId = `dev_${l.id.slice(4)}_${l.device.deviceType.toLowerCase()}`;
        insertDevice.run(
          devId,
          l.id,
          l.device.deviceType,
          l.device.os,
          l.device.browser,
          l.lastActiveAt
        );
      }
    } catch (err) {
      console.warn(`Lỗi khôi phục học viên ${l.username}:`, err);
    }
  }

  return restoredCount;
}

/**
 * Ensure initial registry exists and syncs with existing real database learners if any
 */
export function ensureInitialLearnersRegistry(database?: DatabaseSync): void {
  const registry = getLearnersRegistry();
  let changed = false;

  // Collect any existing real learners from the active database
  if (database) {
    try {
      const dbUsers = database.prepare(`
        SELECT id, username, role, created_at, last_active_at
        FROM users
        WHERE role = 'LEARNER'
      `).all() as unknown as Array<{ id: string; username: string; role: 'LEARNER'; created_at: number; last_active_at: number }>;

      for (const u of dbUsers) {
        const key = u.username.toLowerCase();
        if (!registry[key]) {
          registry[key] = {
            id: u.id,
            username: u.username,
            role: 'LEARNER',
            createdAt: u.created_at,
            lastActiveAt: u.last_active_at,
          };
          changed = true;
        }
      }
    } catch {
      // Ignore
    }
  }

  if (changed) {
    const { primary, fallback } = getRegistryPaths();
    const jsonContent = JSON.stringify(registry, null, 2);
    try {
      fs.writeFileSync(primary, jsonContent, 'utf8');
    } catch {
      // Ignore
    }
    if (fallback && fallback !== primary) {
      try {
        fs.writeFileSync(fallback, jsonContent, 'utf8');
      } catch {
        // Ignore
      }
    }
  }
}
