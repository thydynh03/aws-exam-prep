/**
 * Output Security Gate & Final Sanitizer
 *
 * Ensures that AI output never leaks:
 * 1. System prompts, internal file paths, or developer instructions.
 * 2. Secrets, API keys, AWS credentials, JWT tokens, passwords.
 * 3. PII (emails, phone numbers, identity numbers).
 * 4. Dangerous XSS vectors, scripts, iframes, and malicious URLs.
 */

import { scanSecrets, scanAndMaskPII, sanitizeXSS } from './aiSecurityGateway.js';

export interface GuardedOutputResult {
  safeContent: string;
  isBlocked: boolean;
  blockReason?: string;
  piiMasked: boolean;
  secretsMasked: boolean;
  securityFlags: string[];
}

// Internal system markers that should never appear in user output
const LEAKAGE_MARKERS = [
  /<untrusted_knowledge_documents>/i,
  /<\/untrusted_knowledge_documents>/i,
  /QUY TẮC BẢO MẬT & GROUNDING TUYỆT ĐỐI/i,
  /NON-NEGOTIABLE/i,
  /C:\\Users\\/i,
  /\/etc\/passwd/i,
  /process\.env/i,
];

/**
 * Filter and guard output before delivering to user
 */
export function guardOutput(rawOutput: string): GuardedOutputResult {
  if (!rawOutput || !rawOutput.trim()) {
    return {
      safeContent: 'Không có phản hồi từ dịch vụ AI.',
      isBlocked: false,
      piiMasked: false,
      secretsMasked: false,
      securityFlags: [],
    };
  }

  const flags: string[] = [];
  let content = rawOutput;

  // 1. Check for system prompt / internal instruction leakage
  for (const marker of LEAKAGE_MARKERS) {
    if (marker.test(content)) {
      flags.push('INTERNAL_INSTRUCTION_LEAKAGE_PREVENTED');
      // Strip out the leaked marker
      content = content.replace(new RegExp(marker, 'gi'), '[Nội dung kỹ thuật nội bộ đã lược bỏ]');
    }
  }

  // 2. Secret Scan & Masking
  const secretResult = scanSecrets(content);
  let secretsMasked = false;
  if (secretResult.hasSecrets) {
    flags.push(...secretResult.secretTypes.map((t) => `SECRET_LEAKAGE_PREVENTED_${t}`));
    content = secretResult.redactedText;
    secretsMasked = true;
  }

  // 3. PII Scan & Redaction
  const piiResult = scanAndMaskPII(content);
  let piiMasked = false;
  if (piiResult.hasPii) {
    flags.push(...piiResult.piiTypes.map((t) => `PII_MASKED_${t}`));
    content = piiResult.maskedText;
    piiMasked = true;
  }

  // 4. XSS & HTML Sanitization
  content = sanitizeXSS(content);

  return {
    safeContent: content,
    isBlocked: false,
    piiMasked,
    secretsMasked,
    securityFlags: flags,
  };
}
