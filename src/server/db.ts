import { createRequire } from 'node:module';
import path from 'node:path';
import fs from 'node:fs';
import { getPgPool, isTestEnvironment } from './pgPool.js';
import { initializePostgresSchema } from './postgresSchema.js';
import {
  ensureInitialLearnersRegistry,
  restoreAllLearnersFromRegistry,
  getRegisteredLearnersList,
} from './learnerRegistry.js';

const require = createRequire(import.meta.url);

let DatabaseSyncClass: any = null;
try {
  // Safe dynamic load: Vercel serverless Node runtimes do not have native node:sqlite
  DatabaseSyncClass = require('node:sqlite')?.DatabaseSync || null;
} catch {
  DatabaseSyncClass = null;
}

// Resolve database directory & path with serverless / Vercel fallback
function getDbPath(): string {
  if (isTestEnvironment()) {
    return ':memory:';
  }

  const isServerless = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME || process.env.NOW_REGION);
  if (isServerless) {
    const tmpDir = path.join('/tmp', 'data');
    if (!fs.existsSync(tmpDir)) {
      try {
        fs.mkdirSync(tmpDir, { recursive: true });
      } catch {
        // Ignore
      }
    }
    const targetDbPath = path.join(tmpDir, 'app.db');
    const sourceDbPath = path.resolve(process.cwd(), 'data', 'app.db');
    if (fs.existsSync(sourceDbPath) && !fs.existsSync(targetDbPath)) {
      try {
        fs.copyFileSync(sourceDbPath, targetDbPath);
      } catch (err) {
        console.warn('Không thể sao chép app.db vào /tmp:', err);
      }
    }
    const sourceRegistry = path.resolve(process.cwd(), 'data', 'learners_registry.json');
    const targetRegistry = path.join(tmpDir, 'learners_registry.json');
    if (fs.existsSync(sourceRegistry) && !fs.existsSync(targetRegistry)) {
      try {
        fs.copyFileSync(sourceRegistry, targetRegistry);
      } catch {
        // Ignore
      }
    }
    return targetDbPath;
  }

  try {
    const dataDir = path.resolve(process.cwd(), 'data');
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    return path.join(dataDir, 'app.db');
  } catch {
    const tmpDir = path.join('/tmp', 'data');
    if (!fs.existsSync(tmpDir)) {
      try {
        fs.mkdirSync(tmpDir, { recursive: true });
      } catch {
        // Ignore
      }
    }
    return path.join(tmpDir, 'app.db');
  }
}

function initSqliteInstance(): any {
  if (!DatabaseSyncClass) {
    return null;
  }
  try {
    const dbPath = getDbPath();
    const instance = new DatabaseSyncClass(dbPath);
    try {
      instance.exec('PRAGMA busy_timeout = 5000;');
      instance.exec('PRAGMA foreign_keys = ON;');
      const isServerless = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME || process.env.NOW_REGION);
      if (!isServerless) {
        instance.exec('PRAGMA journal_mode = WAL;');
      }
    } catch {
      // Ignore pragma errors in constrained environments
    }
    return instance;
  } catch (err) {
    console.warn('Failed to initialize local SQLite instance:', err);
    return null;
  }
}

export const db = initSqliteInstance();

let isPgInitialized = false;

/**
 * Checks if Postgres is active and ready
 */
export function isUsingPostgres(): boolean {
  if (isTestEnvironment()) return false;
  const pool = getPgPool();
  return Boolean(pool && isPgInitialized);
}

function convertScalarMax(sql: string): string {
  let result = '';
  let i = 0;
  while (i < sql.length) {
    const match = sql.slice(i).match(/\bmax\s*\(/i);
    if (!match || match.index === undefined) {
      result += sql.slice(i);
      break;
    }
    result += sql.slice(i, i + match.index);
    const startParen = i + match.index + match[0].length - 1;
    let depth = 0;
    let commaCount = 0;
    let endParen = -1;
    for (let j = startParen; j < sql.length; j++) {
      const ch = sql[j];
      if (ch === '(') depth++;
      else if (ch === ')') {
        depth--;
        if (depth === 0) {
          endParen = j;
          break;
        }
      } else if (ch === ',' && depth === 1) {
        commaCount++;
      }
    }
    if (endParen !== -1 && commaCount >= 1) {
      const inside = sql.slice(startParen + 1, endParen);
      result += `GREATEST(${inside})`;
      i = endParen + 1;
    } else {
      result += match[0];
      i = startParen + 1;
    }
  }
  return result;
}

/**
 * Converts parameter placeholders from ? to $1, $2, ... for PostgreSQL
 */
export function toPostgresSql(sql: string): string {
  let idx = 1;
  let converted = sql.replace(/\?/g, () => `$${idx++}`);
  // Strip SQLite specific COLLATE NOCASE
  converted = converted.replace(/COLLATE\s+NOCASE/gi, '');
  // Convert scalar max(a, b, ...) to GREATEST(a, b, ...)
  converted = convertScalarMax(converted);
  return converted;
}

/**
 * Execute a query that returns multiple rows
 */
export async function dbQuery<T = any>(sql: string, params: any[] = []): Promise<T[]> {
  const pool = getPgPool();
  if (pool && !isTestEnvironment()) {
    try {
      const pgSql = toPostgresSql(sql);
      const res = await pool.query(pgSql, params);
      return res.rows as T[];
    } catch (err) {
      console.warn('Postgres query error, falling back to local SQLite:', err instanceof Error ? err.message : err);
    }
  }

  if (!db) {
    return [];
  }

  const stmt = db.prepare(sql);
  return stmt.all(...params) as T[];
}

/**
 * Execute a query that returns a single row or null
 */
export async function dbQueryOne<T = any>(sql: string, params: any[] = []): Promise<T | null> {
  const pool = getPgPool();
  if (pool && !isTestEnvironment()) {
    try {
      const pgSql = toPostgresSql(sql);
      const res = await pool.query(pgSql, params);
      return (res.rows[0] as T) || null;
    } catch (err) {
      console.warn('Postgres queryOne error, falling back to local SQLite:', err instanceof Error ? err.message : err);
    }
  }

  if (!db) {
    return null;
  }

  const stmt = db.prepare(sql);
  const row = stmt.get(...params);
  return (row as T) || null;
}

/**
 * Execute an INSERT, UPDATE, or DELETE query
 */
export async function dbExecute(
  sql: string,
  params: any[] = []
): Promise<{ changes: number; lastInsertRowid?: number | bigint }> {
  const pool = getPgPool();
  if (pool && !isTestEnvironment()) {
    try {
      const pgSql = toPostgresSql(sql);
      const res = await pool.query(pgSql, params);
      return { changes: res.rowCount || 0 };
    } catch (err) {
      console.warn('Postgres execute error, falling back to local SQLite:', err instanceof Error ? err.message : err);
    }
  }

  if (!db) {
    return { changes: 0 };
  }

  const stmt = db.prepare(sql);
  const res = stmt.run(...params);
  return { changes: Number(res.changes), lastInsertRowid: res.lastInsertRowid };
}

/**
 * Initialize SQLite schemas
 */
function initSqliteSchemas() {
  if (!db) return;
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL COLLATE NOCASE,
      role TEXT NOT NULL CHECK(role IN ('LEARNER', 'ADMIN')),
      created_at INTEGER NOT NULL,
      last_active_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sessions (
      token TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      expires_at INTEGER NOT NULL,
      device_info TEXT,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS user_devices (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      device_type TEXT NOT NULL,
      os TEXT NOT NULL,
      browser TEXT NOT NULL,
      session_count INTEGER DEFAULT 1,
      last_active_at INTEGER NOT NULL,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
      UNIQUE(user_id, device_type, os, browser)
    );

    CREATE TABLE IF NOT EXISTS study_progress (
      user_id TEXT NOT NULL,
      question_id INTEGER NOT NULL,
      selected_answer TEXT NOT NULL,
      is_submitted INTEGER NOT NULL,
      is_correct INTEGER NOT NULL,
      confidence TEXT,
      attempts_count INTEGER DEFAULT 1,
      last_attempted_at INTEGER NOT NULL,
      PRIMARY KEY (user_id, question_id),
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS exam_attempts (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      date TEXT NOT NULL,
      score_percent REAL NOT NULL,
      scaled_score INTEGER NOT NULL,
      passed INTEGER NOT NULL,
      total_questions INTEGER NOT NULL,
      correct_count INTEGER NOT NULL,
      incorrect_count INTEGER NOT NULL,
      unanswered_count INTEGER NOT NULL,
      time_used_seconds INTEGER NOT NULL,
      exam_type TEXT,
      created_at INTEGER NOT NULL,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS notes (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      question_id INTEGER NOT NULL,
      note_text TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
      UNIQUE(user_id, question_id)
    );

    CREATE TABLE IF NOT EXISTS bookmarks (
      user_id TEXT NOT NULL,
      question_id INTEGER NOT NULL,
      created_at INTEGER NOT NULL,
      PRIMARY KEY (user_id, question_id),
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS flashcards_progress (
      user_id TEXT NOT NULL,
      card_id TEXT NOT NULL,
      box INTEGER NOT NULL,
      reviews_count INTEGER NOT NULL,
      last_reviewed_at INTEGER NOT NULL,
      next_review_due INTEGER NOT NULL,
      PRIMARY KEY (user_id, card_id),
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS study_plans (
      user_id TEXT PRIMARY KEY,
      plan_data_json TEXT NOT NULL,
      updated_at INTEGER NOT NULL,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS question_sources (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      source_type TEXT NOT NULL CHECK(source_type IN ('CANONICAL', 'JSON_IMPORT', 'LEARNER_SUBMITTED', 'ADMIN_CREATED')),
      question_count INTEGER DEFAULT 0,
      created_by TEXT,
      created_at INTEGER NOT NULL,
      FOREIGN KEY(created_by) REFERENCES users(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS custom_questions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      creator_id TEXT NOT NULL,
      text TEXT NOT NULL,
      choices_json TEXT NOT NULL,
      choice_keys_json TEXT NOT NULL,
      answer TEXT NOT NULL,
      explanation_json TEXT,
      domain TEXT NOT NULL,
      difficulty TEXT NOT NULL,
      topic TEXT DEFAULT 'Custom',
      service_tags_json TEXT NOT NULL,
      status TEXT NOT NULL CHECK(status IN ('DRAFT', 'PENDING_REVIEW', 'APPROVED', 'REJECTED')),
      is_private INTEGER NOT NULL DEFAULT 1,
      rejection_reason TEXT,
      source_id TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      FOREIGN KEY(creator_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY(source_id) REFERENCES question_sources(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS feedback (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('bug', 'question_error', 'ui_ux', 'feature_request', 'general')),
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      status TEXT NOT NULL CHECK(status IN ('NEW', 'IN_REVIEW', 'RESOLVED', 'REJECTED')),
      priority TEXT NOT NULL CHECK(priority IN ('LOW', 'MEDIUM', 'HIGH', 'URGENT')),
      admin_response TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY,
      admin_id TEXT NOT NULL,
      action TEXT NOT NULL,
      target_type TEXT NOT NULL,
      target_id TEXT NOT NULL,
      metadata_json TEXT,
      created_at INTEGER NOT NULL,
      FOREIGN KEY(admin_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS ai_feedback (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      question_id INTEGER,
      rating TEXT NOT NULL CHECK(rating IN ('up', 'down')),
      reason_tags_json TEXT,
      comment TEXT,
      mode TEXT,
      provider TEXT,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS live_sessions (
      session_id TEXT PRIMARY KEY,
      user_id TEXT,
      username TEXT NOT NULL,
      ip_address TEXT NOT NULL,
      device_type TEXT NOT NULL,
      os TEXT NOT NULL,
      browser TEXT NOT NULL,
      screen_resolution TEXT,
      current_screen TEXT NOT NULL,
      current_action TEXT NOT NULL,
      question_id INTEGER,
      questions_attempted INTEGER DEFAULT 0,
      accuracy_percent INTEGER DEFAULT 0,
      started_at INTEGER NOT NULL,
      last_active_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS ai_queries (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      username TEXT NOT NULL,
      ip_address TEXT,
      question_id INTEGER,
      prompt TEXT NOT NULL,
      response TEXT,
      mode TEXT,
      provider TEXT,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS diagram_workbooks (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      name TEXT NOT NULL,
      active_sheet_id TEXT NOT NULL,
      sheets_json TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS ai_semantic_cache (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL DEFAULT 'default',
      query_hash TEXT NOT NULL,
      query_text TEXT NOT NULL,
      normalized_query TEXT NOT NULL,
      response_content TEXT NOT NULL,
      citations_json TEXT,
      confidence TEXT NOT NULL DEFAULT 'HIGH',
      model_used TEXT NOT NULL,
      intent TEXT,
      topic TEXT,
      expires_at INTEGER NOT NULL,
      hit_count INTEGER DEFAULT 0,
      last_accessed_at INTEGER NOT NULL,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS ai_question_memory (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL DEFAULT 'default',
      user_id TEXT,
      original_question TEXT NOT NULL,
      normalized_question TEXT NOT NULL,
      rewritten_question TEXT NOT NULL,
      intent TEXT NOT NULL,
      topic TEXT NOT NULL,
      security_flags_json TEXT,
      last_answered_at INTEGER NOT NULL,
      frequency INTEGER DEFAULT 1,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS ai_verified_knowledge (
      knowledge_id TEXT NOT NULL,
      version INTEGER NOT NULL DEFAULT 1,
      tenant_id TEXT NOT NULL DEFAULT 'default',
      question TEXT NOT NULL,
      answer TEXT NOT NULL,
      intent TEXT NOT NULL,
      topic TEXT NOT NULL,
      sources_json TEXT NOT NULL,
      evidence_json TEXT,
      confidence TEXT NOT NULL DEFAULT 'VERIFIED',
      verification_status TEXT NOT NULL CHECK(verification_status IN ('VERIFIED', 'CANDIDATE', 'REJECTED', 'DEPRECATED')),
      verified_by TEXT,
      possibly_outdated INTEGER NOT NULL DEFAULT 0,
      usage_count INTEGER DEFAULT 0,
      correction_count INTEGER DEFAULT 0,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      PRIMARY KEY (knowledge_id, version)
    );

    CREATE TABLE IF NOT EXISTS ai_corrections (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL DEFAULT 'default',
      user_id TEXT,
      error_type TEXT NOT NULL,
      original_question TEXT NOT NULL,
      original_answer TEXT NOT NULL,
      corrected_answer TEXT NOT NULL,
      user_correction TEXT,
      reason TEXT,
      correct_source TEXT,
      status TEXT NOT NULL DEFAULT 'APPROVED',
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS ai_sources (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL DEFAULT 'default',
      name TEXT NOT NULL,
      source_type TEXT NOT NULL,
      url TEXT,
      trust_level TEXT NOT NULL CHECK(trust_level IN ('TRUSTED', 'VERIFIED', 'INTERNAL', 'USER_PROVIDED', 'UNVERIFIED', 'POTENTIALLY_MALICIOUS')),
      authority_score REAL DEFAULT 1.0,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS ai_configurations (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL DEFAULT 'default',
      active_version INTEGER NOT NULL DEFAULT 1,
      status TEXT NOT NULL DEFAULT 'PUBLISHED',
      config_json TEXT NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS ai_configuration_versions (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL DEFAULT 'default',
      version INTEGER NOT NULL,
      config_json TEXT NOT NULL,
      change_summary TEXT,
      published_by TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS ai_security_events (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL DEFAULT 'default',
      user_id TEXT,
      ip_address TEXT,
      event_type TEXT NOT NULL,
      severity TEXT NOT NULL CHECK(severity IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
      attack_type TEXT NOT NULL,
      payload_snippet TEXT NOT NULL,
      blocked INTEGER NOT NULL DEFAULT 1,
      action_taken TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS ai_usage_telemetry (
      request_id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL DEFAULT 'default',
      user_id TEXT,
      model TEXT NOT NULL,
      input_tokens INTEGER DEFAULT 0,
      output_tokens INTEGER DEFAULT 0,
      retrieval_latency_ms INTEGER DEFAULT 0,
      rerank_latency_ms INTEGER DEFAULT 0,
      generation_latency_ms INTEGER DEFAULT 0,
      total_latency_ms INTEGER DEFAULT 0,
      cache_hit INTEGER DEFAULT 0,
      memory_hit INTEGER DEFAULT 0,
      rerank_used INTEGER DEFAULT 0,
      security_blocked INTEGER DEFAULT 0,
      cost_estimate_usd REAL DEFAULT 0.0,
      created_at INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
    CREATE INDEX IF NOT EXISTS idx_live_sessions_last_active ON live_sessions(last_active_at);
    CREATE INDEX IF NOT EXISTS idx_live_sessions_username ON live_sessions(username);
    CREATE INDEX IF NOT EXISTS idx_ai_queries_created_at ON ai_queries(created_at);
    CREATE INDEX IF NOT EXISTS idx_ai_queries_question_id ON ai_queries(question_id);
    CREATE INDEX IF NOT EXISTS idx_ai_queries_username ON ai_queries(username);
    CREATE INDEX IF NOT EXISTS idx_study_progress_user_id ON study_progress(user_id);
    CREATE INDEX IF NOT EXISTS idx_study_progress_question_id ON study_progress(question_id);
    CREATE INDEX IF NOT EXISTS idx_exam_attempts_user_id ON exam_attempts(user_id);
    CREATE INDEX IF NOT EXISTS idx_notes_user_id ON notes(user_id);
    CREATE INDEX IF NOT EXISTS idx_custom_questions_creator_id ON custom_questions(creator_id);
    CREATE INDEX IF NOT EXISTS idx_custom_questions_status ON custom_questions(status);
    CREATE INDEX IF NOT EXISTS idx_feedback_user_id ON feedback(user_id);
    CREATE INDEX IF NOT EXISTS idx_ai_cache_hash ON ai_semantic_cache(query_hash, tenant_id);
    CREATE INDEX IF NOT EXISTS idx_ai_qmem_norm ON ai_question_memory(normalized_question, tenant_id);
    CREATE INDEX IF NOT EXISTS idx_ai_vk_status ON ai_verified_knowledge(verification_status, tenant_id);
    CREATE INDEX IF NOT EXISTS idx_ai_sec_created ON ai_security_events(created_at, tenant_id);
    CREATE INDEX IF NOT EXISTS idx_ai_telemetry_created ON ai_usage_telemetry(created_at, tenant_id);
  `);

  try {
    db.exec('ALTER TABLE ai_queries ADD COLUMN response TEXT;');
  } catch {
    // Already exists
  }

  // Ensure canonical question source exists
  const canonicalSource = db.prepare('SELECT id FROM question_sources WHERE id = ?').get('canonical-saa-c03');
  if (!canonicalSource) {
    db.prepare(`
      INSERT INTO question_sources (id, name, description, source_type, question_count, created_by, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run('canonical-saa-c03', 'Official SAA-C03 Question Bank', '1019 Authentic AWS Certified Solutions Architect - Associate Exam Questions', 'CANONICAL', 1019, null, Date.now());
  }

  // Ensure default admin account exists
  const adminUser = db.prepare('SELECT id FROM users WHERE username = ?').get('admin');
  if (!adminUser) {
    db.prepare(`
      INSERT INTO users (id, username, role, created_at, last_active_at)
      VALUES (?, ?, ?, ?, ?)
    `).run('user_admin_default', 'admin', 'ADMIN', Date.now(), Date.now());
  }

  ensureInitialLearnersRegistry(db);
  restoreAllLearnersFromRegistry(db);
}

/**
 * Initialize all database schemas (PostgreSQL and SQLite fallback)
 */
export async function initDatabase(): Promise<void> {
  // Initialize SQLite schemas if local sqlite is available
  if (db) {
    initSqliteSchemas();
  }

  // If Postgres pool is configured and not in test environment, initialize Postgres
  if (!isTestEnvironment()) {
    const pool = getPgPool();
    if (pool) {
      try {
        await initializePostgresSchema(pool);
        isPgInitialized = true;

        // Sync registered learners to PostgreSQL
        const registered = getRegisteredLearnersList();
        const client = await pool.connect();
        try {
          for (const l of registered) {
            await client.query(`
              INSERT INTO users (id, username, role, created_at, last_active_at)
              VALUES ($1, $2, 'LEARNER', $3, $4)
              ON CONFLICT (username) DO UPDATE SET
                last_active_at = GREATEST(users.last_active_at, EXCLUDED.last_active_at);
            `, [l.id, l.username, l.createdAt || Date.now(), l.lastActiveAt || Date.now()]);
          }
        } finally {
          client.release();
        }
      } catch (err) {
        console.warn('Failed to initialize Supabase PostgreSQL schema, falling back to SQLite:', err instanceof Error ? err.message : err);
        isPgInitialized = false;
      }
    }
  }

  // Seed canonical AWS verified knowledge
  try {
    const { seedCanonicalVerifiedKnowledge } = await import('./ai/aiMemoryService.js');
    await seedCanonicalVerifiedKnowledge('default');
  } catch (seedErr) {
    console.warn('Seed canonical knowledge warning:', seedErr instanceof Error ? seedErr.message : seedErr);
  }
}

/**
 * Backward compatibility seed function
 */
export function seedDefaultLearners(): void {
  // Retained for backward compatibility
}

// Initial sync on module load
if (db) {
  initSqliteSchemas();
}
if (!isTestEnvironment()) {
  initDatabase().catch((e) => console.warn('Background DB init warning:', e));
}
