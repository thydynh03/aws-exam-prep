/**
 * AI Configuration Center Service
 *
 * Provides enterprise configuration management:
 * - Active vs Draft configuration
 * - Versioning & Audit History
 * - Instant Rollback
 * - Safe Secret Masking (never expose raw API keys)
 */

import crypto from 'node:crypto';
import { dbQuery, dbQueryOne, dbExecute } from '../db.js';

export interface EnterpriseAIConfig {
  version?: number;
  status?: string;
  aiProvider: {
    provider: string; // 'gemini' | 'openai' | 'anthropic' | 'deepseek' | 'pipeline'
    model: string;
    temperature: number;
    maxTokens: number;
    topP: number;
    timeoutMs: number;
    fallbackModel?: string;
  };
  systemPrompt: {
    basePrompt: string;
    strictMode: boolean;
  };
  promptRewrite: {
    enabled: boolean;
    expandAcronyms: boolean;
    detectIntent: boolean;
    stripInjections: boolean;
  };
  rag: {
    enabled: boolean;
    topK: number;
    minScoreThreshold: number;
    includeCustomQuestions: boolean;
  };
  cohereRerank: {
    enabled: boolean;
    model: string;
    topN: number;
    scoreThreshold: number;
    mode: 'ALWAYS' | 'WHEN_RELEVANCE_LOW' | 'COMPLEX_QUERY_ONLY' | 'DISABLED';
    timeoutMs: number;
    apiKeyConfigured: boolean; // boolean flag only, NEVER raw key
  };
  memory: {
    semanticCacheEnabled: boolean;
    semanticCacheTtlDays: number;
    similarityThreshold: number;
    questionMemoryEnabled: boolean;
    verifiedMemoryEnabled: boolean;
    correctionMemoryEnabled: boolean;
  };
  security: {
    inputValidation: boolean;
    promptInjectionDefense: boolean;
    piiScanAndMask: boolean;
    secretLeakageBlock: boolean;
    xssSanitization: boolean;
    domainScopeGuard: boolean;
    rateLimiting: boolean;
    tenantIsolation: boolean;
  };
  domainPolicy: {
    primaryDomain: string;
    relevanceThreshold: number;
    outOfScopeFallbackResponse: string;
  };
}

export const DEFAULT_ENTERPRISE_CONFIG: EnterpriseAIConfig = {
  aiProvider: {
    provider: 'gemini',
    model: 'gemini-2.0-flash',
    temperature: 0.3,
    maxTokens: 4096,
    topP: 0.95,
    timeoutMs: 45000,
    fallbackModel: 'gemini-1.5-flash',
  },
  systemPrompt: {
    basePrompt: 'Bạn là Trợ lý AI Luyện Thi Chứng Chỉ AWS (AWS Exam AI Tutor & Architecture Advisor) cấp Enterprise.',
    strictMode: true,
  },
  promptRewrite: {
    enabled: true,
    expandAcronyms: true,
    detectIntent: true,
    stripInjections: true,
  },
  rag: {
    enabled: true,
    topK: 15,
    minScoreThreshold: 0.25,
    includeCustomQuestions: true,
  },
  cohereRerank: {
    enabled: true,
    model: 'rerank-v3.5',
    topN: 5,
    scoreThreshold: 0.2,
    mode: 'ALWAYS',
    timeoutMs: 5000,
    apiKeyConfigured: true,
  },
  memory: {
    semanticCacheEnabled: true,
    semanticCacheTtlDays: 7,
    similarityThreshold: 0.85,
    questionMemoryEnabled: true,
    verifiedMemoryEnabled: true,
    correctionMemoryEnabled: true,
  },
  security: {
    inputValidation: true,
    promptInjectionDefense: true,
    piiScanAndMask: true,
    secretLeakageBlock: true,
    xssSanitization: true,
    domainScopeGuard: true,
    rateLimiting: true,
    tenantIsolation: true,
  },
  domainPolicy: {
    primaryDomain: 'AWS Certified Solutions Architect & Cloud Architecture',
    relevanceThreshold: 0.7,
    outOfScopeFallbackResponse: 'Câu hỏi này nằm ngoài phạm vi của Trợ lý AI Luyện Thi AWS. Hệ thống chỉ hỗ trợ giải đáp các dịch vụ đám mây AWS, kiến trúc giải pháp và nội dung bài thi chứng chỉ AWS.',
  },
};

/**
 * Get active configuration for tenant (with secrets strictly masked)
 */
export async function getActiveAIConfig(tenantId = 'default'): Promise<EnterpriseAIConfig> {
  const row = await dbQueryOne<{
    config_json: string;
    active_version: number;
    status: string;
  }>('SELECT config_json, active_version, status FROM ai_configurations WHERE tenant_id = ? LIMIT 1', [tenantId]);

  const hasCohereKey = Boolean(process.env.COHERE_API_KEY && process.env.COHERE_API_KEY.trim());

  if (!row) {
    // Return default config
    return {
      ...DEFAULT_ENTERPRISE_CONFIG,
      version: 1,
      status: 'PUBLISHED',
      cohereRerank: {
        ...DEFAULT_ENTERPRISE_CONFIG.cohereRerank,
        apiKeyConfigured: hasCohereKey,
      },
    };
  }

  try {
    const parsed = JSON.parse(row.config_json);
    return {
      ...DEFAULT_ENTERPRISE_CONFIG,
      ...parsed,
      version: Number(row.active_version || 1),
      status: row.status || 'PUBLISHED',
      cohereRerank: {
        ...DEFAULT_ENTERPRISE_CONFIG.cohereRerank,
        ...(parsed.cohereRerank || {}),
        apiKeyConfigured: hasCohereKey,
      },
    };
  } catch {
    return {
      ...DEFAULT_ENTERPRISE_CONFIG,
      version: Number(row.active_version || 1),
      status: row.status || 'PUBLISHED',
      cohereRerank: {
        ...DEFAULT_ENTERPRISE_CONFIG.cohereRerank,
        apiKeyConfigured: hasCohereKey,
      },
    };
  }
}

/**
 * Publish updated AI Configuration (creates new version & audits)
 */
export async function publishAIConfig(
  tenantId: string,
  newConfig: Partial<EnterpriseAIConfig> | Record<string, any> | undefined | null,
  publishedBy: string,
  changeSummary = 'Cập nhật cấu hình AI'
): Promise<{ version: number; success: boolean; config: EnterpriseAIConfig }> {
  const current = await getActiveAIConfig(tenantId);
  const rawInput = (newConfig && typeof newConfig === 'object') ? (newConfig as Record<string, any>) : {};

  const updated: EnterpriseAIConfig = {
    ...current,
    ...rawInput,
    aiProvider: {
      ...current.aiProvider,
      ...(rawInput.aiProvider && typeof rawInput.aiProvider === 'object' ? rawInput.aiProvider : {}),
      provider: rawInput.provider ?? rawInput.aiProvider?.provider ?? current.aiProvider.provider,
      model: rawInput.model ?? rawInput.aiProvider?.model ?? current.aiProvider.model,
      temperature: typeof rawInput.temperature === 'number'
        ? rawInput.temperature
        : (typeof rawInput.aiProvider?.temperature === 'number' ? rawInput.aiProvider.temperature : current.aiProvider.temperature),
      maxTokens: rawInput.maxTokens ?? rawInput.aiProvider?.maxTokens ?? current.aiProvider.maxTokens,
      topP: rawInput.topP ?? rawInput.aiProvider?.topP ?? current.aiProvider.topP,
      timeoutMs: rawInput.timeoutMs ?? rawInput.aiProvider?.timeoutMs ?? current.aiProvider.timeoutMs,
      fallbackModel: rawInput.fallbackModel ?? rawInput.aiProvider?.fallbackModel ?? current.aiProvider.fallbackModel,
    },
    systemPrompt: {
      ...current.systemPrompt,
      ...(rawInput.systemPrompt && typeof rawInput.systemPrompt === 'object' ? rawInput.systemPrompt : {}),
      basePrompt: typeof rawInput.systemPrompt === 'string'
        ? rawInput.systemPrompt
        : (rawInput.systemPrompt?.basePrompt ?? current.systemPrompt.basePrompt),
      strictMode: rawInput.strictMode ?? rawInput.systemPrompt?.strictMode ?? current.systemPrompt.strictMode,
    },
    promptRewrite: {
      ...current.promptRewrite,
      ...(rawInput.promptRewrite && typeof rawInput.promptRewrite === 'object' ? rawInput.promptRewrite : {}),
    },
    rag: {
      ...current.rag,
      ...(rawInput.rag && typeof rawInput.rag === 'object' ? rawInput.rag : {}),
      topK: typeof rawInput.ragTopK === 'number'
        ? rawInput.ragTopK
        : (typeof rawInput.rag?.topK === 'number' ? rawInput.rag.topK : current.rag.topK),
      minScoreThreshold: rawInput.ragMinScoreThreshold ?? rawInput.rag?.minScoreThreshold ?? current.rag.minScoreThreshold,
      includeCustomQuestions: rawInput.includeCustomQuestions ?? rawInput.rag?.includeCustomQuestions ?? current.rag.includeCustomQuestions,
    },
    cohereRerank: {
      ...current.cohereRerank,
      ...(rawInput.cohereRerank && typeof rawInput.cohereRerank === 'object' ? rawInput.cohereRerank : {}),
      mode: rawInput.cohereRerankMode ?? rawInput.cohereRerank?.mode ?? current.cohereRerank.mode,
      topN: typeof rawInput.rerankTopN === 'number'
        ? rawInput.rerankTopN
        : (typeof rawInput.cohereRerank?.topN === 'number' ? rawInput.cohereRerank.topN : current.cohereRerank.topN),
      apiKeyConfigured: Boolean(process.env.COHERE_API_KEY && process.env.COHERE_API_KEY.trim()),
    },
    memory: {
      ...current.memory,
      ...(rawInput.memory && typeof rawInput.memory === 'object' ? rawInput.memory : {}),
      semanticCacheEnabled: typeof rawInput.semanticCacheEnabled === 'boolean'
        ? rawInput.semanticCacheEnabled
        : (typeof rawInput.memory?.semanticCacheEnabled === 'boolean' ? rawInput.memory.semanticCacheEnabled : current.memory.semanticCacheEnabled),
    },
    security: {
      ...current.security,
      ...(rawInput.security && typeof rawInput.security === 'object' ? rawInput.security : {}),
      domainScopeGuard: typeof rawInput.strictDomainEnabled === 'boolean'
        ? rawInput.strictDomainEnabled
        : (typeof rawInput.security?.domainScopeGuard === 'boolean' ? rawInput.security.domainScopeGuard : current.security.domainScopeGuard),
    },
    domainPolicy: {
      ...current.domainPolicy,
      ...(rawInput.domainPolicy && typeof rawInput.domainPolicy === 'object' ? rawInput.domainPolicy : {}),
    },
  };

  const now = Date.now();
  const configJson = JSON.stringify(updated);

  // Get max version
  const vRow = await dbQueryOne<{ max_v: number }>(
    'SELECT MAX(version) as max_v FROM ai_configuration_versions WHERE tenant_id = ?',
    [tenantId]
  );
  const nextVersion = (vRow?.max_v ? Number(vRow.max_v) : 0) + 1;

  // Insert version history
  const versionId = `ver_${crypto.randomUUID().slice(0, 10)}`;
  await dbExecute(`
    INSERT INTO ai_configuration_versions (
      id, tenant_id, version, config_json, change_summary, published_by, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
  `, [versionId, tenantId, nextVersion, configJson, changeSummary, publishedBy, now]);

  // Upsert active configuration
  await dbExecute(`
    INSERT INTO ai_configurations (id, tenant_id, active_version, status, config_json, updated_at)
    VALUES (?, ?, ?, 'PUBLISHED', ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      active_version = excluded.active_version,
      status = excluded.status,
      config_json = excluded.config_json,
      updated_at = excluded.updated_at
  `, [`cfg_${tenantId}`, tenantId, nextVersion, configJson, now]);

  return {
    version: nextVersion,
    success: true,
    config: {
      ...updated,
      version: nextVersion,
      status: 'PUBLISHED',
    },
  };
}

/**
 * Rollback to a specific configuration version
 */
export async function rollbackAIConfig(
  tenantId: string,
  targetVersion: number,
  adminUser: string
): Promise<{ success: boolean; activeVersion: number; rolledBackVersion: number }> {
  const versionRow = await dbQueryOne<{ config_json: string }>(
    'SELECT config_json FROM ai_configuration_versions WHERE tenant_id = ? AND version = ?',
    [tenantId, targetVersion]
  );

  if (!versionRow) {
    throw new Error(`Phiên bản cấu hình v${targetVersion} không tồn tại.`);
  }

  const result = await publishAIConfig(
    tenantId,
    JSON.parse(versionRow.config_json),
    adminUser,
    `Rollback về phiên bản v${targetVersion}`
  );

  return { success: true, activeVersion: result.version, rolledBackVersion: targetVersion };
}

/**
 * Get Configuration Versions History
 */
export async function getAIConfigVersionHistory(tenantId = 'default'): Promise<Array<{
  version: number;
  changeSummary: string;
  publishedBy: string;
  createdAt: number;
}>> {
  const rows = await dbQuery<{
    version: number;
    change_summary: string;
    published_by: string;
    created_at: number;
  }>(`
    SELECT version, change_summary, published_by, created_at
    FROM ai_configuration_versions
    WHERE tenant_id = ?
    ORDER BY version DESC
    LIMIT 20
  `, [tenantId]);

  return rows.map((r) => ({
    version: Number(r.version),
    changeSummary: r.change_summary || 'Cập nhật cấu hình',
    publishedBy: r.published_by,
    createdAt: Number(r.created_at),
  }));
}
