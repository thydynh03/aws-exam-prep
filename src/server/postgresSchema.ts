import type pg from 'pg';

export const POSTGRES_TABLES_DDL = `
-- 1. Users table
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('LEARNER', 'ADMIN')),
  created_at BIGINT NOT NULL,
  last_active_at BIGINT NOT NULL
);

-- 2. Sessions table
CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at BIGINT NOT NULL,
  expires_at BIGINT NOT NULL,
  device_info TEXT
);

-- 3. User Devices table
CREATE TABLE IF NOT EXISTS user_devices (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  device_type TEXT NOT NULL,
  os TEXT NOT NULL,
  browser TEXT NOT NULL,
  session_count INTEGER DEFAULT 1,
  last_active_at BIGINT NOT NULL,
  UNIQUE(user_id, device_type, os, browser)
);

-- 4. Study Progress table
CREATE TABLE IF NOT EXISTS study_progress (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  question_id INTEGER NOT NULL,
  selected_answer TEXT NOT NULL,
  is_submitted INTEGER NOT NULL,
  is_correct INTEGER NOT NULL,
  confidence TEXT,
  attempts_count INTEGER DEFAULT 1,
  last_attempted_at BIGINT NOT NULL,
  PRIMARY KEY (user_id, question_id)
);

-- 5. Exam Attempts table
CREATE TABLE IF NOT EXISTS exam_attempts (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
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
  created_at BIGINT NOT NULL
);

-- 6. Notes table
CREATE TABLE IF NOT EXISTS notes (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  question_id INTEGER NOT NULL,
  note_text TEXT NOT NULL,
  created_at BIGINT NOT NULL,
  updated_at BIGINT NOT NULL,
  UNIQUE(user_id, question_id)
);

-- 7. Bookmarks table
CREATE TABLE IF NOT EXISTS bookmarks (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  question_id INTEGER NOT NULL,
  created_at BIGINT NOT NULL,
  PRIMARY KEY (user_id, question_id)
);

-- 8. Flashcards Progress table
CREATE TABLE IF NOT EXISTS flashcards_progress (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  card_id TEXT NOT NULL,
  box INTEGER NOT NULL,
  reviews_count INTEGER NOT NULL,
  last_reviewed_at BIGINT NOT NULL,
  next_review_due BIGINT NOT NULL,
  PRIMARY KEY (user_id, card_id)
);

-- 9. Study Plans table
CREATE TABLE IF NOT EXISTS study_plans (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  plan_data_json TEXT NOT NULL,
  updated_at BIGINT NOT NULL
);

-- 10. Question Sources table
CREATE TABLE IF NOT EXISTS question_sources (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  source_type TEXT NOT NULL CHECK(source_type IN ('CANONICAL', 'JSON_IMPORT', 'LEARNER_SUBMITTED', 'ADMIN_CREATED')),
  question_count INTEGER DEFAULT 0,
  created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at BIGINT NOT NULL
);

-- 11. Custom Questions table
CREATE TABLE IF NOT EXISTS custom_questions (
  id SERIAL PRIMARY KEY,
  creator_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
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
  source_id TEXT REFERENCES question_sources(id) ON DELETE SET NULL,
  created_at BIGINT NOT NULL,
  updated_at BIGINT NOT NULL
);

-- 12. Feedback table
CREATE TABLE IF NOT EXISTS feedback (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK(type IN ('bug', 'question_error', 'ui_ux', 'feature_request', 'general')),
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('NEW', 'IN_REVIEW', 'RESOLVED', 'REJECTED')),
  priority TEXT NOT NULL CHECK(priority IN ('LOW', 'MEDIUM', 'HIGH', 'URGENT')),
  admin_response TEXT,
  created_at BIGINT NOT NULL,
  updated_at BIGINT NOT NULL
);

-- 13. Audit Logs table
CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY,
  admin_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id TEXT NOT NULL,
  metadata_json TEXT,
  created_at BIGINT NOT NULL
);

-- 14. AI Feedback table
CREATE TABLE IF NOT EXISTS ai_feedback (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  question_id INTEGER,
  rating TEXT NOT NULL CHECK(rating IN ('up', 'down')),
  reason_tags_json TEXT,
  comment TEXT,
  mode TEXT,
  provider TEXT,
  created_at BIGINT NOT NULL
);

-- 15. Live Sessions table
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
  started_at BIGINT NOT NULL,
  last_active_at BIGINT NOT NULL
);

-- 16. AI Queries table
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
  created_at BIGINT NOT NULL
);

-- 17. Diagram Workbooks table
CREATE TABLE IF NOT EXISTS diagram_workbooks (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  name TEXT NOT NULL,
  active_sheet_id TEXT NOT NULL,
  sheets_json TEXT NOT NULL,
  created_at BIGINT NOT NULL,
  updated_at BIGINT NOT NULL
);

-- 18. AI Semantic Cache table
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
  expires_at BIGINT NOT NULL,
  hit_count INTEGER DEFAULT 0,
  last_accessed_at BIGINT NOT NULL,
  created_at BIGINT NOT NULL
);

-- 19. AI Question Memory table
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
  last_answered_at BIGINT NOT NULL,
  frequency INTEGER DEFAULT 1,
  created_at BIGINT NOT NULL
);

-- 20. AI Verified Knowledge table
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
  created_at BIGINT NOT NULL,
  updated_at BIGINT NOT NULL,
  PRIMARY KEY (knowledge_id, version)
);

-- 21. AI Corrections table
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
  created_at BIGINT NOT NULL
);

-- 22. AI Sources table
CREATE TABLE IF NOT EXISTS ai_sources (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL DEFAULT 'default',
  name TEXT NOT NULL,
  source_type TEXT NOT NULL,
  url TEXT,
  trust_level TEXT NOT NULL CHECK(trust_level IN ('TRUSTED', 'VERIFIED', 'INTERNAL', 'USER_PROVIDED', 'UNVERIFIED', 'POTENTIALLY_MALICIOUS')),
  authority_score REAL DEFAULT 1.0,
  created_at BIGINT NOT NULL
);

-- 23. AI Configurations table
CREATE TABLE IF NOT EXISTS ai_configurations (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL DEFAULT 'default',
  active_version INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'PUBLISHED',
  config_json TEXT NOT NULL,
  updated_at BIGINT NOT NULL
);

-- 24. AI Configuration Versions table
CREATE TABLE IF NOT EXISTS ai_configuration_versions (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL DEFAULT 'default',
  version INTEGER NOT NULL,
  config_json TEXT NOT NULL,
  change_summary TEXT,
  published_by TEXT NOT NULL,
  created_at BIGINT NOT NULL
);

-- 25. AI Security Events table
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
  created_at BIGINT NOT NULL
);

-- 26. AI Usage Telemetry table
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
  created_at BIGINT NOT NULL
);

-- Performance Indexes
CREATE INDEX IF NOT EXISTS idx_pg_sessions_user_id ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_pg_live_sessions_last_active ON live_sessions(last_active_at);
CREATE INDEX IF NOT EXISTS idx_pg_live_sessions_username ON live_sessions(username);
CREATE INDEX IF NOT EXISTS idx_pg_ai_queries_created_at ON ai_queries(created_at);
CREATE INDEX IF NOT EXISTS idx_pg_ai_queries_question_id ON ai_queries(question_id);
CREATE INDEX IF NOT EXISTS idx_pg_ai_queries_username ON ai_queries(username);
CREATE INDEX IF NOT EXISTS idx_pg_study_progress_user_id ON study_progress(user_id);
CREATE INDEX IF NOT EXISTS idx_pg_study_progress_question_id ON study_progress(question_id);
CREATE INDEX IF NOT EXISTS idx_pg_exam_attempts_user_id ON exam_attempts(user_id);
CREATE INDEX IF NOT EXISTS idx_pg_notes_user_id ON notes(user_id);
CREATE INDEX IF NOT EXISTS idx_pg_custom_questions_creator_id ON custom_questions(creator_id);
CREATE INDEX IF NOT EXISTS idx_pg_custom_questions_status ON custom_questions(status);
CREATE INDEX IF NOT EXISTS idx_pg_feedback_user_id ON feedback(user_id);
CREATE INDEX IF NOT EXISTS idx_pg_diagram_workbooks_user_id ON diagram_workbooks(user_id);
CREATE INDEX IF NOT EXISTS idx_pg_ai_cache_hash ON ai_semantic_cache(query_hash, tenant_id);
CREATE INDEX IF NOT EXISTS idx_pg_ai_qmem_norm ON ai_question_memory(normalized_question, tenant_id);
CREATE INDEX IF NOT EXISTS idx_pg_ai_vk_status ON ai_verified_knowledge(verification_status, tenant_id);
CREATE INDEX IF NOT EXISTS idx_pg_ai_sec_created ON ai_security_events(created_at, tenant_id);
CREATE INDEX IF NOT EXISTS idx_pg_ai_telemetry_created ON ai_usage_telemetry(created_at, tenant_id);
`;

/**
 * Executes all DDL statements in Supabase PostgreSQL
 */
export async function initializePostgresSchema(pool: pg.Pool): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(POSTGRES_TABLES_DDL);

    // Ensure default canonical source
    await client.query(`
      INSERT INTO question_sources (id, name, description, source_type, question_count, created_by, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT (id) DO NOTHING;
    `, [
      'canonical-saa-c03',
      'Official SAA-C03 Question Bank',
      '1019 Authentic AWS Certified Solutions Architect - Associate Exam Questions',
      'CANONICAL',
      1019,
      null,
      Date.now(),
    ]);

    // Ensure default admin user
    await client.query(`
      INSERT INTO users (id, username, role, created_at, last_active_at)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (id) DO NOTHING;
    `, ['user_admin_default', 'admin', 'ADMIN', Date.now(), Date.now()]);

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
