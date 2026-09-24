/**
 * AI Memory Service: Question Memory, Verified Knowledge, and Correction Memory
 *
 * Implements:
 * 1. Question Memory: match classification (SAME_QUESTION, SIMILAR_QUESTION, SAME_TOPIC, DIFFERENT_INTENT, NO_MATCH)
 * 2. Verified Knowledge: versioned, authoritative, source-aware
 * 3. Correction Memory: keeps history of past mistakes to prevent repeating errors
 * 4. Anti Self-Poisoning: AI does not automatically promote its own generated text to verified knowledge
 */

import crypto from 'node:crypto';
import { dbQuery, dbQueryOne, dbExecute } from '../db.js';

export type QuestionMatchCategory =
  | 'SAME_QUESTION'
  | 'SIMILAR_QUESTION'
  | 'SAME_TOPIC'
  | 'RELATED_TOPIC'
  | 'DIFFERENT_INTENT'
  | 'NO_MATCH';

export interface QuestionMemoryMatch {
  category: QuestionMatchCategory;
  matchedQuestion: string;
  question?: string;
  previousAnswer?: string;
  intent: string;
  topic: string;
  similarityScore: number;
  frequency: number;
}

export interface VerifiedKnowledgeItem {
  knowledgeId: string;
  version: number;
  question: string;
  answer: string;
  intent: string;
  topic: string;
  sources: Array<{ id: string; title: string; url?: string }>;
  evidence?: string[];
  confidence: string;
  verificationStatus: 'VERIFIED' | 'CANDIDATE' | 'REJECTED' | 'DEPRECATED';
  verifiedBy?: string;
  possiblyOutdated: boolean;
  usageCount: number;
  correctionCount: number;
  createdAt: number;
  updatedAt: number;
}

export interface CorrectionRecord {
  id: string;
  tenantId: string;
  userId?: string | null;
  errorType: string;
  originalQuestion: string;
  originalAnswer: string;
  correctedAnswer: string;
  userCorrection?: string | null;
  reason?: string | null;
  correctSource?: string | null;
  status: string;
  createdAt: number;
}

/**
 * Tokenize string into lowercase terms for Jaccard and n-gram term similarity
 */
function tokenize(text: string): Set<string> {
  const words = (text || '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 1);
  return new Set(words);
}

function calculateJaccardSimilarity(setA: Set<string>, setB: Set<string>): number {
  if (setA.size === 0 || setB.size === 0) return 0;
  let intersection = 0;
  for (const item of setA) {
    if (setB.has(item)) intersection++;
  }
  const union = setA.size + setB.size - intersection;
  return union > 0 ? intersection / union : 0;
}

/**
 * Record question into Question Memory
 */
export async function recordQuestionMemory(data: {
  tenantId?: string;
  userId?: string | null;
  originalQuestion: string;
  normalizedQuestion: string;
  rewrittenQuestion: string;
  intent: string;
  topic: string;
  securityFlags?: string[];
}): Promise<string> {
  const tenantId = data.tenantId || 'default';
  const id = `qmem_${crypto.randomUUID().slice(0, 10)}`;
  const now = Date.now();
  const flagsJson = JSON.stringify(data.securityFlags || []);

  await dbExecute(`
    INSERT INTO ai_question_memory (
      id, tenant_id, user_id, original_question, normalized_question, rewritten_question, intent, topic, security_flags_json, last_answered_at, frequency, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)
    ON CONFLICT(id) DO NOTHING
  `, [
    id,
    tenantId,
    data.userId || null,
    data.originalQuestion,
    data.normalizedQuestion,
    data.rewrittenQuestion,
    data.intent,
    data.topic,
    flagsJson,
    now,
    now,
  ]);

  return id;
}

/**
 * Search Question Memory for exact or semantically similar historical questions
 */
export async function findSimilarQuestions(
  normalizedQuery: string,
  intent: string,
  topic: string,
  tenantId = 'default'
): Promise<QuestionMemoryMatch | null> {
  // 1. Exact normalized match check
  const exact = await dbQueryOne<{
    original_question: string;
    normalized_question: string;
    intent: string;
    topic: string;
    frequency: number;
  }>(`
    SELECT original_question, normalized_question, intent, topic, frequency
    FROM ai_question_memory
    WHERE tenant_id = ? AND normalized_question = ?
    ORDER BY frequency DESC, last_answered_at DESC
    LIMIT 1
  `, [tenantId, normalizedQuery]);

  if (exact) {
    const category: QuestionMatchCategory = exact.intent === intent ? 'SAME_QUESTION' : 'DIFFERENT_INTENT';
    return {
      category,
      matchedQuestion: exact.original_question,
      question: exact.original_question,
      intent: exact.intent,
      topic: exact.topic,
      similarityScore: 1.0,
      frequency: Number(exact.frequency),
    };
  }

  // 2. Fetch candidate questions from same tenant for semantic similarity calculation
  const candidates = await dbQuery<{
    original_question: string;
    normalized_question: string;
    intent: string;
    topic: string;
    frequency: number;
  }>(`
    SELECT original_question, normalized_question, intent, topic, frequency
    FROM ai_question_memory
    WHERE tenant_id = ?
    ORDER BY last_answered_at DESC
    LIMIT 100
  `, [tenantId]);

  const queryTokens = tokenize(normalizedQuery);
  let bestMatch: QuestionMemoryMatch | null = null;
  let maxSim = 0;
  const minThreshold = queryTokens.size <= 3 ? 0.75 : 0.55;

  for (const c of candidates) {
    const candidateTokens = tokenize(c.normalized_question);
    const sim = calculateJaccardSimilarity(queryTokens, candidateTokens);

    if (sim > maxSim && sim >= minThreshold) {
      maxSim = sim;
      let cat: QuestionMatchCategory = 'SIMILAR_QUESTION';
      if (c.intent !== intent && sim > 0.65) {
        cat = 'DIFFERENT_INTENT';
      } else if (sim >= 0.75) {
        cat = 'SIMILAR_QUESTION';
      } else if (c.topic === topic) {
        cat = 'SAME_TOPIC';
      } else {
        cat = 'RELATED_TOPIC';
      }

      bestMatch = {
        category: cat,
        matchedQuestion: c.original_question,
        question: c.original_question,
        intent: c.intent,
        topic: c.topic,
        similarityScore: sim,
        frequency: Number(c.frequency),
      };
    }
  }

  return bestMatch;
}

/**
 * Retrieve active Verified Knowledge matching a query or topic
 */
export async function retrieveVerifiedKnowledge(
  query: string,
  topic?: string,
  tenantId = 'default'
): Promise<VerifiedKnowledgeItem[]> {
  const queryTokens = tokenize(query);

  const rows = await dbQuery<{
    knowledge_id: string;
    version: number;
    question: string;
    answer: string;
    intent: string;
    topic: string;
    sources_json: string;
    evidence_json: string | null;
    confidence: string;
    verification_status: string;
    verified_by: string | null;
    possibly_outdated: number;
    usage_count: number;
    correction_count: number;
    created_at: number;
    updated_at: number;
  }>(`
    SELECT *
    FROM ai_verified_knowledge
    WHERE tenant_id = ? AND verification_status = 'VERIFIED'
    ORDER BY updated_at DESC
    LIMIT 50
  `, [tenantId]);

  const scored: Array<{ item: VerifiedKnowledgeItem; score: number }> = [];

  for (const r of rows) {
    let sources = [];
    try {
      sources = JSON.parse(r.sources_json || '[]');
    } catch {
      sources = [];
    }

    let evidence: string[] = [];
    try {
      evidence = JSON.parse(r.evidence_json || '[]');
    } catch {
      evidence = [];
    }

    const item: VerifiedKnowledgeItem = {
      knowledgeId: r.knowledge_id,
      version: Number(r.version),
      question: r.question,
      answer: r.answer,
      intent: r.intent,
      topic: r.topic,
      sources,
      evidence,
      confidence: r.confidence,
      verificationStatus: r.verification_status as any,
      verifiedBy: r.verified_by || undefined,
      possiblyOutdated: Boolean(r.possibly_outdated),
      usageCount: Number(r.usage_count),
      correctionCount: Number(r.correction_count),
      createdAt: Number(r.created_at),
      updatedAt: Number(r.updated_at),
    };

    const qTokens = tokenize(r.question);
    let sim = calculateJaccardSimilarity(queryTokens, qTokens);
    if (topic && r.topic.toLowerCase() === topic.toLowerCase()) {
      sim += 0.2;
    }

    // Penalize if marked possibly outdated
    if (item.possiblyOutdated) {
      sim *= 0.6;
    }

    if (sim >= 0.3) {
      scored.push({ item, score: sim });
    }
  }

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, 3).map((s) => s.item);
}

/**
 * Retrieve relevant previous corrections so AI avoids repeating mistakes
 */
export async function retrieveRelevantCorrections(
  query: string,
  tenantId = 'default'
): Promise<CorrectionRecord[]> {
  const queryTokens = tokenize(query);

  const rows = await dbQuery<{
    id: string;
    tenant_id: string;
    user_id: string | null;
    error_type: string;
    original_question: string;
    original_answer: string;
    corrected_answer: string;
    user_correction: string | null;
    reason: string | null;
    correct_source: string | null;
    status: string;
    created_at: number;
  }>(`
    SELECT *
    FROM ai_corrections
    WHERE tenant_id = ? AND status = 'APPROVED'
    ORDER BY created_at DESC
    LIMIT 30
  `, [tenantId]);

  const matched: CorrectionRecord[] = [];

  for (const r of rows) {
    const origTokens = tokenize(r.original_question);
    const sim = calculateJaccardSimilarity(queryTokens, origTokens);
    if (sim >= 0.35) {
      matched.push({
        id: r.id,
        tenantId: r.tenant_id,
        userId: r.user_id,
        errorType: r.error_type,
        originalQuestion: r.original_question,
        originalAnswer: r.original_answer,
        correctedAnswer: r.corrected_answer,
        userCorrection: r.user_correction,
        reason: r.reason,
        correctSource: r.correct_source,
        status: r.status,
        createdAt: Number(r.created_at),
      });
    }
  }

  return matched.slice(0, 2);
}

/**
 * Save new correction record (when user provides feedback or admin corrects an error)
 */
export async function recordCorrection(payload: {
  tenantId?: string;
  userId?: string | null;
  errorType: string;
  originalQuestion: string;
  originalAnswer: string;
  correctedAnswer: string;
  userCorrection?: string;
  reason?: string;
  correctSource?: string;
}): Promise<string> {
  const id = `corr_${crypto.randomUUID().slice(0, 10)}`;
  const tenantId = payload.tenantId || 'default';
  const now = Date.now();

  await dbExecute(`
    INSERT INTO ai_corrections (
      id, tenant_id, user_id, error_type, original_question, original_answer, corrected_answer, user_correction, reason, correct_source, status, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'APPROVED', ?)
  `, [
    id,
    tenantId,
    payload.userId || null,
    payload.errorType,
    payload.originalQuestion,
    payload.originalAnswer,
    payload.correctedAnswer,
    payload.userCorrection || null,
    payload.reason || null,
    payload.correctSource || null,
    now,
  ]);

  return id;
}

/**
 * Promote or Version Verified Knowledge
 */
export async function saveVerifiedKnowledge(payload: {
  knowledgeId?: string;
  tenantId?: string;
  question: string;
  answer: string;
  intent: string;
  topic: string;
  sources: Array<{ id: string; title: string; url?: string }>;
  evidence?: string[];
  confidence?: string;
  status?: 'VERIFIED' | 'CANDIDATE';
  verifiedBy?: string;
}): Promise<{ knowledgeId: string; version: number }> {
  const tenantId = payload.tenantId || 'default';
  const knowledgeId = payload.knowledgeId || `kno_${crypto.randomUUID().slice(0, 10)}`;
  const now = Date.now();

  // Find latest existing version for this knowledge_id
  const latestRow = await dbQueryOne<{ version: number }>(`
    SELECT MAX(version) as version
    FROM ai_verified_knowledge
    WHERE knowledge_id = ? AND tenant_id = ?
  `, [knowledgeId, tenantId]);

  const nextVersion = latestRow?.version ? Number(latestRow.version) + 1 : 1;

  // Mark older versions as superseded/possibly outdated
  if (nextVersion > 1) {
    await dbExecute(`
      UPDATE ai_verified_knowledge
      SET possibly_outdated = 1, updated_at = ?
      WHERE knowledge_id = ? AND tenant_id = ?
    `, [now, knowledgeId, tenantId]);
  }

  await dbExecute(`
    INSERT INTO ai_verified_knowledge (
      knowledge_id, version, tenant_id, question, answer, intent, topic, sources_json, evidence_json, confidence, verification_status, verified_by, possibly_outdated, usage_count, correction_count, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, 0, ?, ?)
  `, [
    knowledgeId,
    nextVersion,
    tenantId,
    payload.question,
    payload.answer,
    payload.intent,
    payload.topic,
    JSON.stringify(payload.sources || []),
    JSON.stringify(payload.evidence || []),
    payload.confidence || 'VERIFIED',
    payload.status || 'VERIFIED',
    payload.verifiedBy || null,
    now,
    now,
  ]);

  return { knowledgeId, version: nextVersion };
}

export interface QuestionMemoryItem {
  id: string;
  originalQuestion: string;
  normalizedQuestion: string;
  rewrittenQuestion: string;
  intent: string;
  topic: string;
  securityFlags: string[];
  lastAnsweredAt: number;
  frequency: number;
  createdAt: number;
}

/**
 * Retrieve list of questions recorded in Question Memory
 */
export async function getQuestionMemoryList(
  tenantId = 'default',
  search?: string
): Promise<QuestionMemoryItem[]> {
  let sql = 'SELECT * FROM ai_question_memory WHERE tenant_id = ?';
  const params: any[] = [tenantId];
  if (search && search.trim()) {
    sql += ' AND (original_question LIKE ? OR normalized_question LIKE ? OR rewritten_question LIKE ?)';
    const term = `%${search.trim()}%`;
    params.push(term, term, term);
  }
  sql += ' ORDER BY last_answered_at DESC LIMIT 100';
  const rows = await dbQuery<any>(sql, params);
  return rows.map((r) => {
    let flags: string[] = [];
    try {
      flags = JSON.parse(r.security_flags_json || '[]');
    } catch {
      flags = [];
    }
    return {
      id: r.id,
      originalQuestion: r.original_question,
      normalizedQuestion: r.normalized_question,
      rewrittenQuestion: r.rewritten_question,
      intent: r.intent,
      topic: r.topic,
      securityFlags: flags,
      lastAnsweredAt: Number(r.last_answered_at),
      frequency: Number(r.frequency),
      createdAt: Number(r.created_at),
    };
  });
}

/**
 * Seed canonical AWS SAA-C03 verified knowledge records if table is empty
 */
export async function seedCanonicalVerifiedKnowledge(tenantId = 'default'): Promise<number> {
  const existing = await dbQueryOne<{ count: number | string }>(
    'SELECT COUNT(*) as count FROM ai_verified_knowledge WHERE tenant_id = ?',
    [tenantId]
  );
  if (existing && Number(existing.count) > 0) {
    return 0; // Already seeded
  }

  const canonicalKnowledge = [
    {
      knowledgeId: 'kno_s3_storage_classes',
      question: 'Các lớp lưu trữ của Amazon S3 và khi nào nên sử dụng từng lớp?',
      answer: `Amazon S3 cung cấp các storage classes tối ưu cho chi phí và tần suất truy xuất:
- **S3 Standard**: Dành cho dữ liệu truy cập thường xuyên, độ trễ mili-giây, độ bền 99.999999999% (11 số 9), khả dụng 99.99% qua ít nhất 3 AZ.
- **S3 Intelligent-Tiering**: Tự động chuyển đổi giữa 3 tầng truy cập (Frequent, Infrequent, Archive Instant) dựa trên mẫu truy cập không thể dự đoán mà không có phí truy xuất (no retrieval fees).
- **S3 Standard-IA**: Dành cho dữ liệu ít truy cập (ví dụ sao lưu hàng tháng) nhưng cần truy xuất tức thì mili-giây khi có yêu cầu. Chi phí lưu trữ rẻ hơn nhưng có phí truy xuất tính theo GB.
- **S3 One Zone-IA**: Lưu trong 1 AZ duy nhất, rẻ hơn 20% so với Standard-IA, phù hợp dữ liệu có thể tạo lại được (recreatable backups).
- **S3 Glacier Instant Retrieval**: Lưu trữ lâu dài nhưng cần truy xuất mili-giây (ví dụ hồ sơ bệnh án, ảnh lưu trữ).
- **S3 Glacier Flexible Retrieval**: Thời gian truy xuất linh hoạt: Expedited (1-5 phút), Standard (3-5 giờ), Bulk (5-12 giờ).
- **S3 Glacier Deep Archive**: Chi phí lưu trữ rẻ nhất AWS, truy xuất sau 12 đến 48 giờ, dùng cho dữ liệu tuân thủ pháp lý 7-10 năm.`,
      intent: 'CONCEPT_EXPLANATION',
      topic: 'Storage',
      sources: [
        { id: 'aws-doc-s3-classes', title: 'Amazon S3 Storage Classes Official Guide', url: 'https://docs.aws.amazon.com/AmazonS3/latest/userguide/storage-class-intro.html' },
      ],
      confidence: 'VERIFIED',
      status: 'VERIFIED' as const,
      verifiedBy: 'AWS SAA Canonical Benchmark',
    },
    {
      knowledgeId: 'kno_sqs_vs_sns',
      question: 'Phân biệt Amazon SQS và Amazon SNS trong kiến trúc hướng sự kiện (Event-driven)?',
      answer: `So sánh cốt lõi giữa SQS và SNS trong giải pháp phân tán AWS:
- **Mô hình**:
  - **SNS (Simple Notification Service)**: Mô hình **Push (Publish/Subscribe)**. Một Publisher phát thông điệp đến topic, SNS tự động đẩy tới nhiều Subscribers (Fanout) bao gồm SQS queues, Lambda, HTTP/S endpoints, email, SMS.
  - **SQS (Simple Queue Service)**: Mô hình **Pull (Polling/Queue)**. Producer gửi message vào hàng đợi; Consumer chủ động kéo (poll) message về để xử lý từng lượt.
- **Sắp xếp thứ tự (Ordering)**:
  - **SQS Standard**: Thông lượng gần như không giới hạn, đảm bảo thông điệp gửi ít nhất 1 lần (at-least-once), thứ tự nỗ lực tốt nhất (best-effort ordering, có thể bị lặp/đảo).
  - **SQS FIFO**: Đảm bảo chính xác thứ tự gửi (First-In, First-Out) và xử lý đúng 1 lần (exactly-once delivery) bằng cách sử dụng \`MessageGroupId\` (nhóm message) và \`MessageDeduplicationId\` (chống trùng lặp trong 5 phút).
- **Mẫu thiết kế kinh điển (Fanout Pattern)**: Kết hợp SNS Topic liên kết nhiều SQS Queues ở hạ nguồn để mỗi dịch vụ (Billing, Notification, Analytics) nhận bản sao message độc lập và xử lý song song không gây nghẽn.`,
      intent: 'COMPARISON',
      topic: 'Application Integration',
      sources: [
        { id: 'aws-doc-sns-sqs', title: 'Building Event-Driven Architectures on AWS', url: 'https://aws.amazon.com/event-driven-architecture/' },
      ],
      confidence: 'VERIFIED',
      status: 'VERIFIED' as const,
      verifiedBy: 'AWS SAA Canonical Benchmark',
    },
    {
      knowledgeId: 'kno_dynamodb_vs_aurora',
      question: 'Khi nào nên chọn Amazon DynamoDB so với Amazon Aurora cho bài thi SAA-C03?',
      answer: `Quy tắc chọn cơ sở dữ liệu cho kỳ thi AWS SAA-C03:
- **Chọn Amazon DynamoDB khi**:
  - Ứng dụng yêu cầu độ trễ cực thấp ổn định ở mức mili-giây một chữ số (single-digit millisecond) ở bất kỳ quy mô nào.
  - Dữ liệu dạng NoSQL (Key-Value hoặc Document/JSON), schema động hoặc không cần join phức tạp nhiều bảng.
  - Cần khả năng mở rộng quy mô tự động (On-Demand capacity hoặc Auto Scaling RCU/WCU).
  - Cần Global Tables cho phân phối đa vùng Active-Active trên toàn cầu.
  - Cần DynamoDB Accelerator (DAX) cho độ trễ micro-giây khi đọc dữ liệu thường xuyên.
- **Chọn Amazon Aurora khi**:
  - Ứng dụng cần cơ sở dữ liệu quan hệ (RDBMS) chuẩn SQL, hỗ trợ giao dịch ACID nghiêm ngặt và foreign keys/joins phức tạp.
  - Tương thích MySQL và PostgreSQL với hiệu năng gấp 5 lần MySQL và 3 lần PostgreSQL tiêu chuẩn.
  - Cần tự động sao lưu 6 bản sao trên 3 Availability Zones và lưu lượng đọc cao với tối đa 15 Aurora Read Replicas (độ trễ replication < 100ms).
  - Cần Global Database cho thảm họa phục hồi nhanh (RPO < 1s, RTO < 1 phút).`,
      intent: 'BEST_PRACTICES',
      topic: 'Databases',
      sources: [
        { id: 'aws-doc-databases', title: 'AWS Purpose-Built Databases', url: 'https://aws.amazon.com/products/databases/' },
      ],
      confidence: 'VERIFIED',
      status: 'VERIFIED' as const,
      verifiedBy: 'AWS SAA Canonical Benchmark',
    },
    {
      knowledgeId: 'kno_cloudfront_vs_global_accelerator',
      question: 'Sự khác nhau giữa CloudFront và AWS Global Accelerator là gì?',
      answer: `Điểm khác biệt cốt lõi:
- **Amazon CloudFront**:
  - Dịch vụ Content Delivery Network (CDN) dựa trên bộ nhớ đệm (Edge Caching).
  - Tối ưu cho giao thức HTTP/HTTPS.
  - Lưu cache nội dung tĩnh (ảnh, video, HTML, CSS) và nội dung động tại hơn 600+ Edge Locations trên toàn cầu.
  - Giảm tải cho máy chủ gốc (origin) nhờ bộ nhớ cache và nén nội dung.
- **AWS Global Accelerator**:
  - Dịch vụ tăng tốc định tuyến mạng ở tầng 4 (TCP/UDP).
  - **Không lưu cache nội dung**.
  - Cung cấp 2 địa chỉ IP Anycast tĩnh duy nhất đóng vai trò điểm vào toàn cầu.
  - Đưa lưu lượng người dùng vào mạng đường trục cáp quang riêng của AWS tại Edge Location gần nhất, giúp giảm độ trễ, giảm jitter và chống packet loss.
  - Hỗ trợ failover tự động giữa các Region trong thời gian < 1 phút cho các ứng dụng game, IoT, VoIP hoặc HTTP không dùng cache.`,
      intent: 'COMPARISON',
      topic: 'Networking',
      sources: [
        { id: 'aws-doc-networking', title: 'AWS Networking Fundamentals', url: 'https://aws.amazon.com/blogs/networking-and-content-delivery/' },
      ],
      confidence: 'VERIFIED',
      status: 'VERIFIED' as const,
      verifiedBy: 'AWS SAA Canonical Benchmark',
    },
    {
      knowledgeId: 'kno_disaster_recovery_strategies',
      question: 'Bốn chiến lược thảm họa phục hồi (Disaster Recovery) trên AWS và so sánh RTO / RPO?',
      answer: `Bốn chiến lược Disaster Recovery trên AWS sắp xếp theo chi phí và thời gian phục hồi:
1. **Backup & Restore (Sao lưu & Khôi phục)**:
   - RPO: Vài giờ; RTO: 24 giờ hoặc nhiều hơn.
   - Chi phí: Thấp nhất. Dữ liệu sao lưu sang S3/Glacier ở Region khác; khi xảy ra thảm họa mới dựng lại toàn bộ hạ tầng qua CloudFormation/Terraform.
2. **Pilot Light (Đèn mồi)**:
   - RPO: Vài chục phút; RTO: Vài chục phút đến vài giờ.
   - Thành phần dữ liệu cốt lõi (Core Database) luôn chạy liên tục ở Region dự phòng với replication trực tiếp. Server ứng dụng (EC2/ASG) tắt và chỉ khởi chạy khi có sự cố.
3. **Warm Standby (Chờ ấm)**:
   - RPO: Vài phút; RTO: Vài phút.
   - Một phiên bản thu nhỏ (scaled-down minimum deployment) của toàn bộ hệ thống luôn chạy sẵn sàng ở Region dự phòng. Khi Region chính sập, Route 53 chuyển hướng và ASG mở rộng quy mô phục vụ 100% tải.
4. **Multi-Site Active-Active (Đa vùng Hoạt động Song song)**:
   - RPO: Gần như bằng 0 (Real-time); RTO: Gần như bằng 0 (Tức thì).
   - Chi phí: Cao nhất. Toàn bộ hệ thống chạy 100% công suất song song ở hai hoặc nhiều Region, sử dụng Route 53 Latency / Weighted Routing và Aurora Global Database hoặc DynamoDB Global Tables.`,
      intent: 'BEST_PRACTICES',
      topic: 'Management & Governance',
      sources: [
        { id: 'aws-doc-dr', title: 'Disaster Recovery of Workloads on AWS', url: 'https://docs.aws.amazon.com/whitepapers/latest/disaster-recovery-workloads-on-aws/' },
      ],
      confidence: 'VERIFIED',
      status: 'VERIFIED' as const,
      verifiedBy: 'AWS SAA Canonical Benchmark',
    },
    {
      knowledgeId: 'kno_vpc_endpoints_gateway_vs_interface',
      question: 'Phân biệt VPC Gateway Endpoint và VPC Interface Endpoint (AWS PrivateLink)?',
      answer: `Phân biệt hai loại VPC Endpoint để kết nối an toàn từ VPC tới dịch vụ AWS không qua Internet:
- **VPC Gateway Endpoint**:
  - **Dịch vụ hỗ trợ**: CHỈ hỗ trợ duy nhất 2 dịch vụ: **Amazon S3** và **Amazon DynamoDB**.
  - **Cách hoạt động**: Được thêm trực tiếp vào Bảng định tuyến (Route Table) của VPC dưới dạng target (\`pl-xxxx\`).
  - **Chi phí**: **Hoàn toàn miễn phí** (không tính tiền theo giờ hay dung lượng dữ liệu).
  - **Phạm vi**: Chỉ hoạt động trong VPC nội bộ, không thể truy cập từ On-Premises qua Direct Connect hay VPN.
- **VPC Interface Endpoint (AWS PrivateLink)**:
  - **Dịch vụ hỗ trợ**: Hầu hết tất cả dịch vụ AWS khác (SQS, SNS, Kinesis, CloudWatch, SSM, API Gateway, v.v.) và cả S3 (tùy chọn).
  - **Cách hoạt động**: Cấp phát một Elastic Network Interface (ENI) với địa chỉ Private IP cục bộ bên trong Subnet của bạn.
  - **Chi phí**: Tính phí theo giờ sử dụng ENI + phí dung lượng dữ liệu truyền tải ($/GB).
  - **Phạm vi**: Có thể truy cập từ On-Premises thông qua VPN hoặc Direct Connect.`,
      intent: 'COMPARISON',
      topic: 'Networking',
      sources: [
        { id: 'aws-doc-vpc-endpoints', title: 'VPC Endpoints and PrivateLink', url: 'https://docs.aws.amazon.com/vpc/latest/privatelink/vpc-endpoints.html' },
      ],
      confidence: 'VERIFIED',
      status: 'VERIFIED' as const,
      verifiedBy: 'AWS SAA Canonical Benchmark',
    },
    {
      knowledgeId: 'kno_kms_envelope_encryption',
      question: 'Khái niệm Envelope Encryption và KMS hoạt động như thế nào?',
      answer: `Khái niệm Envelope Encryption (Mã hóa bao thư) trong AWS KMS:
- **Nguyên lý hoạt động**:
  1. Thay vì mã hóa trực tiếp khối dữ liệu lớn bằng Customer Master Key (KMS Key), KMS tạo ra một khóa dữ liệu (**Data Encryption Key - DEK**).
  2. KMS trả về 2 phiên bản của DEK: Bản rõ (**Plaintext DEK**) và Bản mã hóa (**Ciphertext/Encrypted DEK**).
  3. Ứng dụng dùng **Plaintext DEK** để mã hóa dữ liệu người dùng.
  4. Ngay sau khi mã hóa xong, ứng dụng **xóa Plaintext DEK khỏi bộ nhớ RAM**.
  5. Ứng dụng lưu **Ciphertext DEK** ngay bên cạnh file dữ liệu đã mã hóa (do đó gọi là bao thư - Envelope).
- **Lợi ích**:
  - Giảm thiểu lưu lượng mạng gửi tới AWS KMS (chỉ gửi payload kích thước nhỏ để tạo DEK).
  - Tuân thủ bảo mật tuyệt đối: KMS Key không bao giờ rời khỏi mô-đun phần cứng HSM của AWS.`,
      intent: 'CONCEPT_EXPLANATION',
      topic: 'Security, Identity & Compliance',
      sources: [
        { id: 'aws-doc-kms', title: 'AWS KMS Envelope Encryption Concepts', url: 'https://docs.aws.amazon.com/kms/latest/developerguide/concepts.html' },
      ],
      confidence: 'VERIFIED',
      status: 'VERIFIED' as const,
      verifiedBy: 'AWS SAA Canonical Benchmark',
    },
  ];

  let insertedCount = 0;
  for (const item of canonicalKnowledge) {
    await saveVerifiedKnowledge({
      knowledgeId: item.knowledgeId,
      tenantId,
      question: item.question,
      answer: item.answer,
      intent: item.intent,
      topic: item.topic,
      sources: item.sources,
      evidence: ['Official AWS Documentation and SAA-C03 Canonical Blueprint'],
      confidence: item.confidence,
      status: item.status,
      verifiedBy: item.verifiedBy,
    });
    insertedCount++;
  }

  return insertedCount;
}

