import crypto from 'node:crypto';
import { dbExecute } from '../db.js';

export interface SecurityCheckResult {
  isSafe: boolean;
  securityFlags: string[];
  sanitizedInput: string;
  blockedReason?: string;
  severity?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  attackType?: string;
}

export interface SecurityEventRecord {
  id: string;
  tenantId: string;
  userId?: string | null;
  ipAddress?: string | null;
  eventType: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  attackType: string;
  payloadSnippet: string;
  blocked: boolean;
  actionTaken: string;
  createdAt: number;
}

// 1. Direct & Indirect Prompt Injection & Jailbreak Patterns (OWASP Top 10 for LLM - LLM01)
const PROMPT_INJECTION_PATTERNS: Array<{ regex: RegExp; name: string; severity: 'HIGH' | 'CRITICAL' }> = [
  // Direct Instruction Override (English)
  { regex: /ignore\s+(?:all\s+)?(?:previous|above|prior)\s+(?:instructions|prompts|rules|commands|guidelines)/i, name: 'INSTRUCTION_OVERRIDE', severity: 'CRITICAL' },
  { regex: /disregard\s+(?:all\s+)?(?:previous|above|prior)\s+(?:instructions|prompts|rules)/i, name: 'INSTRUCTION_OVERRIDE', severity: 'CRITICAL' },
  { regex: /forget\s+(?:all\s+)?(?:previous|above|prior)\s+(?:instructions|prompts|rules)/i, name: 'INSTRUCTION_OVERRIDE', severity: 'CRITICAL' },
  { regex: /(?:stop|cease|quit)\s+(?:being|acting\s+as)\s+(?:an?\s+)?(?:aws|tutor|assistant)/i, name: 'INSTRUCTION_OVERRIDE', severity: 'CRITICAL' },
  { regex: /(?:overwrite|override)\s+(?:all\s+)?(?:system|base|core)\s+(?:rules|instructions|prompts)/i, name: 'INSTRUCTION_OVERRIDE', severity: 'CRITICAL' },

  // Direct Instruction Override (Vietnamese)
  { regex: /(?:bỏ\s+qua|quên|hủy\s+bỏ|phớt\s+lờ|vứt\s+bỏ|không\s+cần\s+tuân\s+theo)\s+(?:tất\s+cả\s+)?(?:các\s+|mọi\s+)?(?:chỉ\s+dẫn|hướng\s+dẫn|quy\s+tắc|câu\s+lệnh|lệnh|ràng\s+buộc|yêu\s+cầu)(?:\s+(?:trước|ở\s+trên|cũ|ban\s+đầu|đã\s+cho))?/i, name: 'INSTRUCTION_OVERRIDE_VI', severity: 'CRITICAL' },
  { regex: /(?:từ\s+bây\s+giờ|từ\s+giờ)\s+(?:hãy\s+)?(?:làm\s+theo|nghe\s+theo|tuân\s+theo|thực\s+hiện)\s+(?:lệnh|chỉ\s+dẫn|hướng\s+dẫn)\s+mới/i, name: 'INSTRUCTION_OVERRIDE_VI', severity: 'CRITICAL' },
  { regex: /(?:dừng|ngừng)\s+(?:làm|đóng\s+vai)\s+(?:gia\s+sư|trợ\s+lý|tutor|ai)/i, name: 'INSTRUCTION_OVERRIDE_VI', severity: 'CRITICAL' },
  { regex: /(?:ghi\s+đè|thay\s+thế)\s+(?:toàn\s+bộ\s+)?(?:quy\s+tắc|chỉ\s+dẫn|lệnh)\s+(?:hệ\s+thống|cũ|gốc)/i, name: 'INSTRUCTION_OVERRIDE_VI', severity: 'CRITICAL' },
  { regex: /(?:chỉ\s+được|bắt\s+buộc\s+phải)\s+(?:trả\s+lời|nói|thực\s+hiện)\s+(?:theo\s+lệnh\s+sau|duy\s+nhất)/i, name: 'INSTRUCTION_OVERRIDE_VI', severity: 'CRITICAL' },

  // Jailbreak & Roleplay (English)
  { regex: /you\s+are\s+now\s+(?:a|an|in|acting\s+as)\s+(?:DAN|developer\s+mode|unrestricted|jailbroken|evil|god\s+mode|sudo\s+mode)/i, name: 'JAILBREAK_ROLEPLAY', severity: 'CRITICAL' },
  { regex: /(?:act\s+as|pretend\s+to\s+be)\s+an\s+(?:unfiltered|uncensored|unrestricted)\s+assistant/i, name: 'SAFETY_BYPASS_ROLEPLAY', severity: 'HIGH' },
  { regex: /do\s+anything\s+now|DAN\s+mode|jailbreak|bypass\s+(?:safety|filters|guardrails|policies)/i, name: 'JAILBREAK_ATTEMPT', severity: 'CRITICAL' },
  { regex: /enter\s+(?:developer\s+mode|jailbreak\s+mode|god\s+mode|unrestricted\s+mode)/i, name: 'JAILBREAK_ATTEMPT', severity: 'CRITICAL' },

  // Jailbreak & Roleplay (Vietnamese)
  { regex: /(?:bạn\s+là|hãy\s+đóng\s+vai|hóa\s+thân\s+thành|chuyển\s+sang\s+chế\s+độ)\s+(?:DAN|developer\s+mode|nhà\s+phát\s+triển|không\s+giới\s+hạn|bẻ\s+khóa|ác\s+quỷ|god\s+mode|tự\s+do|không\s+kiểm\s+duyệt)/i, name: 'JAILBREAK_ROLEPLAY_VI', severity: 'CRITICAL' },
  { regex: /(?:vượt\s+qua|bỏ\s+qua|vô\s+hiệu\s+hóa)\s+(?:hàng\s+rào\s+bảo\s+vệ|bảo\s+mật|kiểm\s+duyệt|bộ\s+lọc\s+an\s+toàn)/i, name: 'JAILBREAK_ATTEMPT_VI', severity: 'CRITICAL' },
  { regex: /(?:tưởng\s+tượng|giả\s+sử|hãy\s+coi\s+như)\s+bạn\s+(?:không\s+có\s+quy\s+tắc|được\s+tự\s+do\s+hoàn\s+toàn|không\s+bị\s+ràng\s+buộc)/i, name: 'SAFETY_BYPASS_ROLEPLAY_VI', severity: 'HIGH' },

  // System Prompt Extraction (English)
  { regex: /(?:reveal|show|print|output|display|repeat|leak|give\s+me)\s+(?:your\s+)?(?:system\s+prompt|developer\s+instructions|secret\s+key|api\s+key|master\s+prompt)/i, name: 'SYSTEM_PROMPT_EXTRACTION', severity: 'HIGH' },
  { regex: /what\s+(?:are|were)\s+your\s+(?:initial|original|system)\s+(?:instructions|prompts)/i, name: 'SYSTEM_PROMPT_EXTRACTION', severity: 'HIGH' },
  { regex: /repeat\s+(?:all\s+)?(?:the\s+)?(?:words|text|instructions)\s+above/i, name: 'SYSTEM_PROMPT_EXTRACTION', severity: 'HIGH' },

  // System Prompt Extraction (Vietnamese)
  { regex: /(?:tiết\s+lộ|cho\s+tôi\s+biết|in\s+ra|hiển\s+thị|đọc\s+lại|trích\s+xuất|chia\s+sẻ|chép\s+lại)\s+(?:toàn\s+bộ\s+)?(?:system\s+prompt|prompt\s+hệ\s+thống|chỉ\s+dẫn\s+hệ\s+thống|câu\s+lệnh\s+gốc|chỉ\s+dẫn\s+ban\s+đầu|mã\s+bí\s+mật)/i, name: 'SYSTEM_PROMPT_EXTRACTION_VI', severity: 'HIGH' },
  { regex: /(?:system\s+prompt|prompt\s+gốc|chỉ\s+dẫn\s+gốc)\s+của\s+bạn\s+là\s+gì/i, name: 'SYSTEM_PROMPT_EXTRACTION_VI', severity: 'HIGH' },
  { regex: /(?:lặp\s+lại|chép\s+lại|đọc\s+lại)\s+(?:tất\s+cả\s+)?(?:nội\s+dung|văn\s+bản|câu\s+chữ)\s+ở\s+trên/i, name: 'SYSTEM_PROMPT_EXTRACTION_VI', severity: 'HIGH' },

  // Delimiter Injection & Role Spoofing (OWASP LLM01)
  { regex: /<\|(?:im_start|im_end|endoftext|system|assistant|user)\|>/i, name: 'DELIMITER_INJECTION', severity: 'CRITICAL' },
  { regex: /\[(?:SYSTEM|INSTRUCTION|ADMIN|ROOT|HỆ\s+THỐNG|QUẢN\s+TRỊ)\]/i, name: 'ROLE_SPOOFING', severity: 'HIGH' },
  { regex: /<<\s*SYS\s*>>|\[\/?INST\]/i, name: 'DELIMITER_INJECTION', severity: 'CRITICAL' },
  { regex: /(?:---|===)\s*(?:BEGIN|START|END)\s+(?:SYSTEM|PROMPT|INSTRUCTION|CONTEXT|LỆNH)/i, name: 'DELIMITER_INJECTION', severity: 'HIGH' },
  { regex: /<<<END_(?:UNTRUSTED|STUDENT|CONTEXT)/i, name: 'DELIMITER_INJECTION', severity: 'CRITICAL' },

  // Authority Impersonation (Social Engineering)
  { regex: /(?:i\s+am|this\s+is)\s+(?:your\s+)?(?:creator|developer|administrator|admin|lead\s+engineer)/i, name: 'AUTHORITY_IMPERSONATION', severity: 'CRITICAL' },
  { regex: /(?:tôi\s+là|đây\s+là)\s+(?:admin|quản\s+trị\s+viên|nhà\s+phát\s+triển|kỹ\s+sư\s+hệ\s+thống)\s+của\s+bạn/i, name: 'AUTHORITY_IMPERSONATION_VI', severity: 'CRITICAL' },

  // Context Escape & Session Reset
  { regex: /(?:end\s+of\s+exam|reset\s+session|new\s+session\s+starts\s+now)\s*[:.]/i, name: 'CONTEXT_ESCAPE', severity: 'HIGH' },
  { regex: /(?:kết\s+thúc\s+bài\s+thi|phiên\s+mới\s+bắt\s+đầu|bắt\s+đầu\s+lại\s+từ\s+đầu)\s*[:.]/i, name: 'CONTEXT_ESCAPE_VI', severity: 'HIGH' },

  // Obfuscated / Ciphers
  { regex: /(?:base64|hex|rot13)\s+decode\s+and\s+execute/i, name: 'OBFUSCATED_PAYLOAD', severity: 'HIGH' },
  { regex: /bypass\s+(?:tenant|user)\s+(?:isolation|security|boundary)/i, name: 'TENANT_ESCAPE_ATTEMPT', severity: 'CRITICAL' },
];

const CYRILLIC_LOOKALIKES: Record<string, string> = {
  '\u0430': 'a', '\u0435': 'e', '\u043E': 'o', '\u0440': 'p', '\u0441': 'c',
  '\u0443': 'y', '\u0445': 'x', '\u0456': 'i', '\u0410': 'A', '\u0412': 'B',
  '\u0415': 'E', '\u041A': 'K', '\u041C': 'M', '\u041D': 'H', '\u041E': 'O',
  '\u0420': 'P', '\u0421': 'C', '\u0422': 'T', '\u0425': 'X',
};

/**
 * Enterprise Unicode Homoglyph & Obfuscation Canonicalizer
 */
export function canonicalizeSecurityInput(text: string): string {
  if (!text) return '';
  // 1. Unicode normalization (NFKC)
  let norm = text.normalize('NFKC');
  // 2. Strip zero-width, invisible formatting, joiners, soft-hyphen
  norm = norm.replace(/[\u200B-\u200D\uFEFF\u00AD\u200E\u200F\u202A-\u202E]/gu, '');
  // 3. Remove non-printable control chars except \t \n \r
  let filtered = '';
  for (let i = 0; i < norm.length; i++) {
    const code = norm.charCodeAt(i);
    if (code === 127 || (code < 32 && code !== 9 && code !== 10 && code !== 13)) {
      continue;
    }
    filtered += norm[i];
  }
  // 4. Translate homoglyphs / Cyrillic lookalikes to Latin
  let out = '';
  for (const ch of filtered) {
    out += CYRILLIC_LOOKALIKES[ch] || ch;
  }
  return out;
}

/**
 * Detect and decode potential base64 embedded payloads
 */
function extractBase64Payloads(text: string): string[] {
  const matches = text.match(/\b[A-Za-z0-9+/]{16,}={0,2}\b/g);
  if (!matches) return [];
  const results: string[] = [];
  for (const m of matches) {
    try {
      const decoded = Buffer.from(m, 'base64').toString('utf8');
      if (/[\x20-\x7E\s]{8,}/.test(decoded)) {
        results.push(decoded);
      }
    } catch {
      // not base64
    }
  }
  return results;
}

// 2. Secret & Credential Regex Patterns
const SECRET_PATTERNS: Array<{ regex: RegExp; name: string }> = [
  { regex: /(?:AKIA|ABIA|ACCA|ASIA)[0-9A-Z]{16}/, name: 'AWS_ACCESS_KEY_ID' },
  { regex: /(?:cohere_[a-zA-Z0-9_-]{40,})/, name: 'COHERE_API_KEY' },
  { regex: /sk-[a-zA-Z0-9]{32,}/, name: 'OPENAI_API_KEY' },
  { regex: /AIza[0-9A-Za-z-_]{35}/, name: 'GOOGLE_API_KEY' },
  { regex: /ghp_[0-9a-zA-Z]{36}/, name: 'GITHUB_PERSONAL_ACCESS_TOKEN' },
  { regex: /ey[A-Za-z0-9-_=]+\.[A-Za-z0-9-_=]+\.?[A-Za-z0-9-_.+/=]*/, name: 'JWT_BEARER_TOKEN' },
  { regex: /-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/, name: 'PRIVATE_KEY' },
  { regex: /(?:postgres|mysql|mongodb|redis):\/\/[^:\s]+:[^@\s]+@[^\s]+/, name: 'DATABASE_CONNECTION_URI' },
];

// 3. PII Detection Patterns
const PII_PATTERNS: Array<{ regex: RegExp; name: string; maskFn: (val: string) => string }> = [
  {
    regex: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
    name: 'EMAIL_ADDRESS',
    maskFn: (email: string) => {
      const [local, domain] = email.split('@');
      if (!local || !domain) return '[REDACTED_EMAIL]';
      const visible = local.length > 2 ? local[0] + '***' + local[local.length - 1] : local[0] + '***';
      return `${visible}@${domain}`;
    },
  },
  {
    regex: /(?:\+?84|0)(?:3[2-9]|5[689]|7[06-9]|8[1-689]|9[0-46-9])[0-9]{7}\b/g,
    name: 'VIETNAMESE_PHONE',
    maskFn: (phone: string) => phone.slice(0, 3) + '****' + phone.slice(-3),
  },
  {
    regex: /\b\d{3}[-.]?\d{2}[-.]?\d{4}\b/g,
    name: 'US_SSN',
    maskFn: () => '***-**-****',
  },
  {
    regex: /\b(?:4[0-9]{12}(?:[0-9]{3})?|5[1-5][0-9]{14}|3[47][0-9]{13})\b/g,
    name: 'CREDIT_CARD_NUMBER',
    maskFn: (cc: string) => '****-****-****-' + cc.slice(-4),
  },
];

/**
 * Scan text for secrets and credentials.
 * If found, returns matched secret names and optionally redacts or blocks.
 */
export function scanSecrets(text: string): { hasSecrets: boolean; secretTypes: string[]; redactedText: string } {
  if (!text) return { hasSecrets: false, secretTypes: [], redactedText: text };

  let redacted = text;
  const typesFound: string[] = [];

  for (const pat of SECRET_PATTERNS) {
    if (pat.regex.test(redacted)) {
      typesFound.push(pat.name);
      redacted = redacted.replace(new RegExp(pat.regex, 'g'), `[REDACTED_${pat.name}]`);
    }
  }

  return {
    hasSecrets: typesFound.length > 0,
    secretTypes: typesFound,
    redactedText: redacted,
  };
}

/**
 * Scan text for Personally Identifiable Information (PII) and redact it safely.
 */
export function scanAndMaskPII(text: string): { hasPii: boolean; piiTypes: string[]; maskedText: string } {
  if (!text) return { hasPii: false, piiTypes: [], maskedText: text };

  let masked = text;
  const typesFound: string[] = [];

  for (const pat of PII_PATTERNS) {
    const matches = masked.match(pat.regex);
    if (matches && matches.length > 0) {
      typesFound.push(pat.name);
      masked = masked.replace(pat.regex, pat.maskFn);
    }
  }

  return {
    hasPii: typesFound.length > 0,
    piiTypes: typesFound,
    maskedText: masked,
  };
}

/**
 * Sanitize XSS vectors, dangerous HTML tags, and malicious URLs
 */
export function sanitizeXSS(text: string): string {
  if (!text) return '';

  let sanitized = text;

  // Strip dangerous HTML script, iframe, object, embed tags
  sanitized = sanitized.replace(/<\s*script[^>]*>[\s\S]*?<\s*\/\s*script\s*>/gi, '');
  sanitized = sanitized.replace(/<\s*iframe[^>]*>[\s\S]*?<\s*\/\s*iframe\s*>/gi, '');
  sanitized = sanitized.replace(/<\s*object[^>]*>[\s\S]*?<\s*\/\s*object\s*>/gi, '');
  sanitized = sanitized.replace(/<\s*embed[^>]*>/gi, '');

  // Strip dangerous inline event handlers like onerror, onload, onclick
  sanitized = sanitized.replace(/\s+on\w+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '');

  // Strip dangerous protocol prefixes
  sanitized = sanitized.replace(/javascript:[^\s"'>]*/gi, 'about:blank');
  sanitized = sanitized.replace(/vbscript:[^\s"'>]*/gi, 'about:blank');
  sanitized = sanitized.replace(/data:text\/html[^\s"'>]*/gi, 'about:blank');

  return sanitized;
}

/**
 * Central Input Security Inspector
 * Validates payload, catches prompt injections, jailbreaks, and records security events
 */
export async function inspectInputSecurity(
  rawInput: string,
  context: { tenantId?: string; userId?: string | null; ipAddress?: string | null }
): Promise<SecurityCheckResult> {
  const flags: string[] = [];
  const tenantId = context.tenantId || 'default';

  // 1. Basic length & empty check
  if (!rawInput || typeof rawInput !== 'string') {
    return {
      isSafe: false,
      securityFlags: ['EMPTY_OR_INVALID_INPUT'],
      sanitizedInput: '',
      blockedReason: 'Nội dung câu hỏi không hợp lệ hoặc để trống.',
      severity: 'LOW',
      attackType: 'INVALID_INPUT',
    };
  }

  const trimmed = rawInput.trim();
  if (trimmed.length > 6000) {
    return {
      isSafe: false,
      securityFlags: ['OVERSIZED_INPUT'],
      sanitizedInput: trimmed.slice(0, 6000),
      blockedReason: 'Câu hỏi vượt quá giới hạn tối đa cho phép (6,000 ký tự).',
      severity: 'MEDIUM',
      attackType: 'OVERSIZED_PAYLOAD',
    };
  }

  // 2. Enterprise Canonicalization: NFKC, strip zero-width chars, map homoglyphs
  const cleaned = canonicalizeSecurityInput(trimmed);

  // Check both direct input and any extracted base64 payloads
  const base64Payloads = extractBase64Payloads(cleaned);
  const targetsToScan: Array<{ text: string; isBase64: boolean }> = [
    { text: cleaned, isBase64: false },
    ...base64Payloads.map((b) => ({ text: canonicalizeSecurityInput(b), isBase64: true })),
  ];

  // 3. Multi-layer Prompt Injection & Jailbreak Detection (OWASP LLM01)
  for (const target of targetsToScan) {
    for (const pat of PROMPT_INJECTION_PATTERNS) {
      if (pat.regex.test(target.text)) {
        const flagName = target.isBase64 ? `OBFUSCATED_${pat.name}` : pat.name;
        flags.push(flagName);
        const severity = pat.severity;

        // Log Security Event to Database
        await logSecurityEvent({
          tenantId,
          userId: context.userId,
          ipAddress: context.ipAddress,
          eventType: 'PROMPT_INJECTION_BLOCKED',
          severity,
          attackType: flagName,
          payloadSnippet: target.text.slice(0, 200),
          blocked: true,
          actionTaken: 'REQUEST_BLOCKED_BY_SECURITY_GATEWAY',
        });

        return {
          isSafe: false,
          securityFlags: flags,
          sanitizedInput: cleaned,
          blockedReason: 'Yêu cầu của bạn bị từ chối do vi phạm chính sách an toàn AI (phát hiện cấu trúc ghi đè chỉ dẫn hệ thống hoặc can thiệp bảo mật).',
          severity,
          attackType: flagName,
        };
      }
    }
  }

  // 4. Secret scan on input (Prevent users from accidentally submitting live secrets)
  const secretScan = scanSecrets(cleaned);
  let safeInput = cleaned;
  if (secretScan.hasSecrets) {
    flags.push('SECRET_DETECTED_IN_INPUT');
    safeInput = secretScan.redactedText;
  }

  // 5. PII scan on input (Redact sensitive PII before pipeline)
  const piiScan = scanAndMaskPII(safeInput);
  if (piiScan.hasPii) {
    flags.push('PII_DETECTED_IN_INPUT');
    safeInput = piiScan.maskedText;
  }

  // 6. XSS sanitization
  safeInput = sanitizeXSS(safeInput);

  return {
    isSafe: true,
    securityFlags: flags,
    sanitizedInput: safeInput,
  };
}

/**
 * Log Security Event to database
 */
export async function logSecurityEvent(event: Omit<SecurityEventRecord, 'id' | 'createdAt'>): Promise<string> {
  const id = `sec_${crypto.randomUUID().slice(0, 12)}`;
  const now = Date.now();

  try {
    await dbExecute(`
      INSERT INTO ai_security_events (
        id, tenant_id, user_id, ip_address, event_type, severity, attack_type, payload_snippet, blocked, action_taken, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      id,
      event.tenantId || 'default',
      event.userId || null,
      event.ipAddress || null,
      event.eventType,
      event.severity,
      event.attackType,
      event.payloadSnippet.slice(0, 250),
      event.blocked ? 1 : 0,
      event.actionTaken,
      now,
    ]);
  } catch (err) {
    console.warn('Failed to persist AI security event:', err);
  }

  return id;
}
