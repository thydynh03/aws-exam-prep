/**
 * Answer Verification & Grounding Service
 *
 * Responsibilities:
 * 1. Evidence coverage check: verifies that factual statements in answer have support in retrieved chunks.
 * 2. Hallucination detection: catches fabricated AWS services or unsupported claims.
 * 3. Confidence scoring: returns LOW, MEDIUM, HIGH, or VERIFIED based on objective metrics.
 * 4. Safe fallback if ungrounded.
 */

import type { RAGCandidateChunk } from './aiRagService.js';

export type ConfidenceLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'VERIFIED';

export interface VerificationResult {
  isValid: boolean;
  confidence: ConfidenceLevel;
  confidenceScore: number; // 0.0 - 1.0
  unsupportedClaims: string[];
  hallucinationDetected: boolean;
  verifiedAnswer: string;
  evidenceCoverage: number; // 0.0 - 1.0
}

// Fabricated or fake AWS service patterns that LLMs occasionally hallucinate
const KNOWN_HALLUCINATION_PATTERNS = [
  /aws\s+(?:quantum\s+db|supers3|ultraec2|megacloud|hyperlambda)/i,
  /amazon\s+(?:magic\s+cache|infinity\s+disk|instant\s+scale)/i,
  /s3\s+(?:infinite|ultra|extreme)\s+tier/i,
];

function tokenize(text: string): Set<string> {
  const words = (text || '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2);
  return new Set(words);
}

const AWS_CORE_SERVICES = [
  'alb', 'nlb', 'glb', 'elb', 'ec2', 's3', 'ebs', 'efs', 'vpc',
  'rds', 'aurora', 'dynamodb', 'sqs', 'sns', 'lambda', 'fargate',
  'ecs', 'eks', 'route53', 'cloudfront', 'waf', 'shield', 'iam',
  'kms', 'secrets manager', 'cloudwatch', 'cloudtrail', 'redshift',
  'kinesis', 'glue', 'emr', 'athena', 'eventbridge', 'step functions',
  'transit gateway', 'direct connect', 'global accelerator', 'elasticache',
];

/**
 * Verify generated response against retrieved evidence and calculate confidence
 */
export function verifyGeneratedAnswer(
  answer: string,
  chunks: RAGCandidateChunk[],
  hasVerifiedMemoryHit = false,
  userQuery = ''
): VerificationResult {
  if (!answer || !answer.trim()) {
    return {
      isValid: false,
      confidence: 'LOW',
      confidenceScore: 0,
      unsupportedClaims: ['Câu trả lời rỗng'],
      hallucinationDetected: false,
      verifiedAnswer: 'Tôi không có đủ thông tin xác thực trong cơ sở tri thức hiện tại để trả lời câu hỏi này một cách tự tin.',
      evidenceCoverage: 0,
    };
  }

  // 1. Hallucination Pattern Scan
  for (const pat of KNOWN_HALLUCINATION_PATTERNS) {
    if (pat.test(answer)) {
      return {
        isValid: false,
        confidence: 'LOW',
        confidenceScore: 0.2,
        unsupportedClaims: ['Phát hiện tên dịch vụ không tồn tại trong hệ sinh thái AWS'],
        hallucinationDetected: true,
        verifiedAnswer: 'Câu trả lời bị chặn do chứa thông tin dịch vụ không có thật trong hệ sinh thái AWS. Vui lòng tham khảo các dịch vụ chính thức.',
        evidenceCoverage: 0.1,
      };
    }
  }

  // 2. Evidence Coverage Calculation
  const answerTokens = tokenize(answer);
  const combinedEvidence = chunks.map((c) => `${c.title} ${c.snippet}`).join(' ');
  const evidenceTokens = tokenize(combinedEvidence);

  let groundedCount = 0;
  for (const tok of answerTokens) {
    if (evidenceTokens.has(tok)) {
      groundedCount++;
    }
  }

  const coverage = answerTokens.size > 0 ? groundedCount / answerTokens.size : 0;

  // 3. Confidence Calculation
  let score = coverage * 0.5;

  // Boost for high-authority chunks
  const avgAuthority = chunks.length > 0
    ? chunks.reduce((acc, c) => acc + c.authority, 0) / chunks.length
    : 0.5;
  score += avgAuthority * 0.3;

  // Boost if verified memory / exact source match
  if (hasVerifiedMemoryHit) {
    score += 0.25;
  }

  score = Math.min(Math.max(score, 0.1), 1.0);

  const unsupportedClaims: string[] = [];

  // 4. Query Entity Relevance Check: If user specifically asked about specific AWS services,
  // verify that the answer actually mentions at least one of those services.
  if (userQuery && userQuery.trim()) {
    const qLower = userQuery.toLowerCase();
    const aLower = answer.toLowerCase();

    const queryEntities = AWS_CORE_SERVICES.filter((svc) => {
      if (svc.length <= 3) {
        const regex = new RegExp(`\\b${svc}\\b`, 'i');
        return regex.test(qLower);
      }
      return qLower.includes(svc);
    });

    if (queryEntities.length > 0) {
      const hasAnyEntityInAnswer = queryEntities.some((svc) => {
        if (svc.length <= 3) {
          const regex = new RegExp(`\\b${svc}\\b`, 'i');
          return regex.test(aLower);
        }
        return aLower.includes(svc);
      });

      if (!hasAnyEntityInAnswer) {
        // The answer completely missed the queried entities! Force confidence to LOW
        score = 0.12;
        unsupportedClaims.push(
          `Nội dung câu trả lời chưa đề cập đúng dịch vụ/chủ thể được hỏi (${queryEntities.join(', ').toUpperCase()})`
        );
      }
    }
  }

  let confidence: ConfidenceLevel = 'MEDIUM';
  if (unsupportedClaims.length > 0 || score < 0.35) {
    confidence = 'LOW';
  } else if (hasVerifiedMemoryHit && score >= 0.85) {
    confidence = 'VERIFIED';
  } else if (score >= 0.75) {
    confidence = 'HIGH';
  } else if (score >= 0.45) {
    confidence = 'MEDIUM';
  } else {
    confidence = 'LOW';
  }

  // If evidence coverage is critically low (< 15%) and no question context was present
  if (coverage < 0.12 && chunks.length === 0) {
    return {
      isValid: true,
      confidence: 'LOW',
      confidenceScore: score,
      unsupportedClaims: ['Độ bao phủ chứng cứ thấp'],
      hallucinationDetected: false,
      verifiedAnswer: `${answer}\n\n*Lưu ý: Câu trả lời này dựa trên tri thức tổng quát và chưa được đối chiếu đầy đủ với tài liệu chuyên biệt trong cơ sở tri thức.*`,
      evidenceCoverage: coverage,
    };
  }

  return {
    isValid: true,
    confidence,
    confidenceScore: Math.round(score * 100) / 100,
    unsupportedClaims,
    hallucinationDetected: false,
    verifiedAnswer: answer,
    evidenceCoverage: Math.round(coverage * 100) / 100,
  };
}
