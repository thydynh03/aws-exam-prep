/**
 * RAG Retrieval Service
 *
 * Grounding knowledge retrieval across:
 * 1. 42 AWS Architecture Service Guides
 * 2. 1,019 SAA-C03 Canonical Exam Questions with verified explanations
 * 3. Approved Custom & Community Questions from DB
 * 4. Active Verified Knowledge from Memory Service
 * 5. Correction Records
 */

import { AWS_SERVICES, SERVICE_COMPARISONS } from '../../core/serviceDatabase.js';
import { questionRepository } from '../../core/questionRepository.js';
import { retrieveVerifiedKnowledge, retrieveRelevantCorrections } from './aiMemoryService.js';

export type SourceTrustLevel = 'TRUSTED' | 'VERIFIED' | 'INTERNAL' | 'USER_PROVIDED' | 'UNVERIFIED';

export interface RAGCandidateChunk {
  id: string;
  source: string;
  sourceType: 'AWS_GUIDE' | 'CANONICAL_QUESTION' | 'VERIFIED_KNOWLEDGE' | 'CORRECTION' | 'COMMUNITY_QUESTION' | 'SERVICE_COMPARISON';
  trustLevel: SourceTrustLevel;
  title: string;
  snippet: string;
  url?: string;
  authority: number; // 0.0 - 1.0
  retrievalScore: number;
}

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

export interface RetrievalOptions {
  query: string;
  topic?: string;
  currentQuestionId?: number | null;
  topK?: number;
  tenantId?: string;
}

/**
 * Retrieve candidate knowledge chunks across all knowledge bases
 */
export async function retrieveKnowledgeChunks(options: RetrievalOptions): Promise<RAGCandidateChunk[]> {
  const { query, topic, currentQuestionId, topK = 15, tenantId = 'default' } = options;
  const chunks: RAGCandidateChunk[] = [];
  const queryLower = query.toLowerCase();
  const queryTokens = tokenize(query);

  // 1. Retrieve matching AWS Services (42 services)
  for (const svc of AWS_SERVICES) {
    let score = 0;
    const nameMatch = svc.name.toLowerCase().includes(queryLower);
    const idMatch = queryLower.includes(svc.id.toLowerCase());
    const abbrMatch = svc.abbreviation && queryLower.includes(svc.abbreviation.toLowerCase());

    if (nameMatch || idMatch || abbrMatch) {
      score += 0.8;
    }

    const svcTokens = tokenize(`${svc.name} ${svc.summary} ${(svc.coreConcepts || []).join(' ')} ${(svc.commonTraps || []).join(' ')}`);
    const jaccard = calculateJaccardSimilarity(queryTokens, svcTokens);
    score += jaccard * 0.7;

    if (score >= 0.25) {
      chunks.push({
        id: `guide_${svc.id}`,
        source: `AWS Architecture Guide: ${svc.name}`,
        sourceType: 'AWS_GUIDE',
        trustLevel: 'TRUSTED',
        title: `${svc.name} (${svc.category})`,
        snippet: `Tổng quan: ${svc.summary}\nKhái niệm cốt lõi:\n${(svc.coreConcepts || []).slice(0, 3).map((c) => `- ${c}`).join('\n')}\nBẫy đề thi AWS:\n${(svc.commonTraps || []).slice(0, 2).map((t) => `⚠️ ${t}`).join('\n')}\nTrọng tâm SAA-C03: ${svc.examRelevance}`,
        url: svc.docsUrl,
        authority: 1.0,
        retrievalScore: score,
      });
    }
  }

  // 2. Retrieve matching Service Comparisons
  for (const comp of SERVICE_COMPARISONS) {
    const servicesList = (comp.services || []).join(' vs ');
    const compText = `${comp.title || ''} ${servicesList} ${comp.examTip || ''} ${comp.commonTrap || ''}`;
    const compTokens = tokenize(compText);
    const sim = calculateJaccardSimilarity(queryTokens, compTokens);

    const matchesService = (comp.services || []).some((s) => s && queryLower.includes(s.toLowerCase()));

    if (
      (comp.title && queryLower.includes(comp.title.toLowerCase())) ||
      matchesService ||
      sim >= 0.3
    ) {
      chunks.push({
        id: `comp_${comp.id}`,
        source: `So sánh dịch vụ: ${comp.title || comp.id}`,
        sourceType: 'SERVICE_COMPARISON',
        trustLevel: 'INTERNAL',
        title: `So sánh: ${comp.title || servicesList}`,
        snippet: `Khái quát: ${comp.title || ''}\nDịch vụ: ${servicesList}\nLời khuyên phòng thi: ${comp.examTip || ''}\nBẫy đề thi: ${comp.commonTrap || ''}`,
        authority: 0.95,
        retrievalScore: 0.5 + sim * 0.5,
      });
    }
  }

  // 3. Current Question (if active exam question context)
  if (currentQuestionId) {
    const allQ = questionRepository.getAllQuestions();
    const currQ = allQ.find((q) => q.id === currentQuestionId);
    if (currQ) {
      chunks.push({
        id: `curr_q_${currQ.id}`,
        source: `Câu hỏi bài thi hiện tại #${currQ.id}`,
        sourceType: 'CANONICAL_QUESTION',
        trustLevel: 'TRUSTED',
        title: `Đề thi #${currQ.id} (${currQ.domain})`,
        snippet: `Đề bài: ${currQ.text}\nĐáp án chuẩn: ${currQ.answer}\nGiải thích chính thức: ${currQ.answerDescription || 'Không có'}`,
        authority: 1.0,
        retrievalScore: 1.5, // Priority
      });
    }
  }

  // 4. Retrieve matching questions from 1,019 bank
  const allQuestions = questionRepository.getAllQuestions();
  let questionMatches = 0;
  for (const q of allQuestions) {
    if (q.id === currentQuestionId) continue;
    const qTokens = tokenize(`${q.text} ${q.topic} ${(q.serviceTags || []).join(' ')}`);
    const sim = calculateJaccardSimilarity(queryTokens, qTokens);

    if (sim >= 0.35) {
      chunks.push({
        id: `q_${q.id}`,
        source: `Ngân hàng câu hỏi SAA-C03: #${q.id}`,
        sourceType: 'CANONICAL_QUESTION',
        trustLevel: 'TRUSTED',
        title: `Câu hỏi #${q.id} (Chủ đề: ${q.topic})`,
        snippet: `Nội dung: ${q.text.slice(0, 240)}...\nĐáp án: ${q.answer}\nTrọng tâm: ${(q.answerDescription || '').slice(0, 200)}`,
        authority: 0.95,
        retrievalScore: 0.4 + sim * 0.6,
      });
      questionMatches++;
      if (questionMatches >= 6) break;
    }
  }

  // 5. Retrieve from Verified Knowledge table
  try {
    const verifiedKnowledge = await retrieveVerifiedKnowledge(query, topic, tenantId);
    for (const vk of verifiedKnowledge) {
      chunks.push({
        id: `vk_${vk.knowledgeId}_v${vk.version}`,
        source: `Tri thức đã xác thực (v${vk.version})`,
        sourceType: 'VERIFIED_KNOWLEDGE',
        trustLevel: 'VERIFIED',
        title: `Verified Knowledge: ${vk.question}`,
        snippet: vk.answer,
        authority: vk.possiblyOutdated ? 0.6 : 0.98,
        retrievalScore: vk.possiblyOutdated ? 0.4 : 0.9,
      });
    }
  } catch (err) {
    console.warn('Could not query verified knowledge in RAG:', err);
  }

  // 6. Retrieve from Corrections table (past mistake prevention)
  try {
    const corrections = await retrieveRelevantCorrections(query, tenantId);
    for (const corr of corrections) {
      chunks.push({
        id: `corr_${corr.id}`,
        source: `Bản ghi sửa sai đã duyệt: ${corr.errorType}`,
        sourceType: 'CORRECTION',
        trustLevel: 'VERIFIED',
        title: `Correction (${corr.errorType}): ${corr.originalQuestion}`,
        snippet: `⚠️ LỖI TỪNG MẮC TRONG QUÁ KHỨ: "${corr.originalAnswer}"\nĐÁP ÁN ĐÚNG ĐÃ ĐƯỢC CHỨNG MINH: "${corr.correctedAnswer}"\nLý do: ${corr.reason || 'Sửa lỗi thực tế'} (Nguồn: ${corr.correctSource || 'Tài liệu chuẩn AWS'})`,
        authority: 0.95,
        retrievalScore: 0.85,
      });
    }
  } catch (err) {
    console.warn('Could not query corrections in RAG:', err);
  }

  // 7. Sort by score * authority descending and limit to topK
  chunks.sort((a, b) => (b.retrievalScore * b.authority) - (a.retrievalScore * a.authority));
  return chunks.slice(0, topK);
}
