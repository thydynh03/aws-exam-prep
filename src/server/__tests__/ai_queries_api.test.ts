import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { app } from '../app.js';

describe('AI Queries Logging & Learning Behavior Analytics API Tests', () => {
  let adminToken: string;
  let learnerToken: string;
  let learnerId: string;

  beforeAll(async () => {
    // Admin login
    const adminRes = await request(app)
      .post('/api/auth/login')
      .send({ username: 'admin', adminPasscode: 'admin123' });
    expect(adminRes.status).toBe(200);
    adminToken = adminRes.body.token;

    // Learner login
    const learnerRes = await request(app)
      .post('/api/auth/login')
      .send({ username: 'ai_query_learner' });
    expect(learnerRes.status).toBe(200);
    learnerToken = learnerRes.body.token;
    learnerId = learnerRes.body.user.id;
  });

  it('rejects POST /api/ai/query when prompt is empty', async () => {
    const res = await request(app)
      .post('/api/ai/query')
      .send({ prompt: '   ' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();
  });

  it('records AI prompt for anonymous guest with IP extraction', async () => {
    const res = await request(app)
      .post('/api/ai/query')
      .set('x-forwarded-for', '171.244.33.10')
      .send({
        questionId: 42,
        prompt: 'Làm thế nào để cấu hình Amazon S3 Transfer Acceleration và VPC Endpoint?',
        mode: 'explain',
        provider: 'local_rag',
        username: 'Khách HCM',
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.id).toMatch(/^aiq_/);
  });

  it('records AI prompt for authenticated learner', async () => {
    const res = await request(app)
      .post('/api/ai/query')
      .set('Authorization', `Bearer ${learnerToken}`)
      .send({
        questionId: 105,
        prompt: 'Vẽ sơ đồ kiến trúc Multi-AZ RDS và DynamoDB với Auto Scaling',
        mode: 'mermaid',
        provider: 'gemini-2.0-flash',
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.id).toMatch(/^aiq_/);
  });

  it('rejects learner accessing GET /api/admin/ai/queries with 403 Forbidden', async () => {
    const res = await request(app)
      .get('/api/admin/ai/queries')
      .set('Authorization', `Bearer ${learnerToken}`);
    expect(res.status).toBe(403);
  });

  it('allows admin to query AI user prompts list with search and filters', async () => {
    const res = await request(app)
      .get('/api/admin/ai/queries?search=Transfer+Acceleration')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.queries).toBeDefined();
    expect(Array.isArray(res.body.queries)).toBe(true);
    expect(res.body.total).toBeGreaterThanOrEqual(1);

    const found = res.body.queries.find((q: any) => q.prompt.includes('Transfer Acceleration'));
    expect(found).toBeDefined();
    expect(found.ipAddress).toBe('171.244.33.10');
  });

  it('rejects learner accessing GET /api/admin/learning-behavior with 403 Forbidden', async () => {
    const res = await request(app)
      .get('/api/admin/learning-behavior')
      .set('Authorization', `Bearer ${learnerToken}`);
    expect(res.status).toBe(403);
  });

  it('allows admin to fetch aggregated learning behavior analytics', async () => {
    const res = await request(app)
      .get('/api/admin/learning-behavior')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.studyTimeDistribution).toBeDefined();
    expect(Array.isArray(res.body.studyTimeDistribution.hourlyDistribution)).toBe(true);
    expect(res.body.studyTimeDistribution.hourlyDistribution.length).toBe(24);

    expect(res.body.confidenceAnalysis).toBeDefined();
    expect(typeof res.body.confidenceAnalysis.dangerousMisconceptionsCount).toBe('number');

    expect(Array.isArray(res.body.domainBreakdown)).toBe(true);
    expect(res.body.domainBreakdown.length).toBe(4);

    expect(res.body.deviceHabits).toBeDefined();
    expect(res.body.studyEngagementMetrics).toBeDefined();
  });

  it('includes aiQueries in GET /api/admin/users/:id/analytics', async () => {
    const res = await request(app)
      .get(`/api/admin/users/${learnerId}/analytics`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.aiQueries).toBeDefined();
    expect(Array.isArray(res.body.aiQueries)).toBe(true);
    expect(res.body.aiQueries.length).toBeGreaterThanOrEqual(1);
    expect(res.body.aiQueries[0].prompt).toContain('Multi-AZ RDS');
  });

  it('includes queriesAnalytics in GET /api/admin/ai-analytics', async () => {
    const res = await request(app)
      .get('/api/admin/ai-analytics')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.queriesAnalytics).toBeDefined();
    expect(typeof res.body.queriesAnalytics.totalQueries).toBe('number');
    expect(Array.isArray(res.body.queriesAnalytics.topKeywords)).toBe(true);
    expect(Array.isArray(res.body.queriesAnalytics.recentQueries)).toBe(true);
  });

  it('records AI response output and retrieves it in admin query details', async () => {
    const testPrompt = 'So sánh S3 Standard và S3 Glacier Deep Archive';
    const testResponse = 'S3 Standard có độ trễ mili-giây, còn Glacier Deep Archive mất 12-48 giờ khôi phục.';
    const recordRes = await request(app)
      .post('/api/ai/query')
      .send({
        questionId: 88,
        prompt: testPrompt,
        response: testResponse,
        mode: 'socratic',
        provider: 'gemini-2.0-flash',
        username: 'Học viên Kỹ thuật',
      });

    expect(recordRes.status).toBe(200);
    expect(recordRes.body.success).toBe(true);
    expect(recordRes.body.record.response).toBe(testResponse);

    const adminRes = await request(app)
      .get('/api/admin/ai/queries?search=Glacier+Deep+Archive')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(adminRes.status).toBe(200);
    const found = adminRes.body.queries.find((q: any) => q.prompt.includes('Glacier Deep Archive'));
    expect(found).toBeDefined();
    expect(found.response).toBe(testResponse);
    expect(found.username).toBe('Học viên Kỹ thuật');
  });

  it('batch syncs local AI queries via POST /api/ai/queries/sync', async () => {
    const syncRes = await request(app)
      .post('/api/ai/queries/sync')
      .send({
        queries: [
          {
            prompt: 'Sync Test Question 1',
            response: 'Sync Test Answer 1',
            mode: 'explain',
            provider: 'local_rag',
            timestamp: Date.now() - 10000,
          },
          {
            prompt: 'Sync Test Question 2',
            response: 'Sync Test Answer 2',
            mode: 'mermaid',
            provider: 'gemini-2.0-flash',
            timestamp: Date.now() - 5000,
          },
        ],
      });

    expect(syncRes.status).toBe(200);
    expect(syncRes.body.success).toBe(true);
    expect(syncRes.body.syncedCount).toBe(2);
  });

  it('responds with text/event-stream on GET /api/realtime/events', async () => {
    const response = await request(app)
      .get('/api/realtime/events')
      .buffer(false)
      .parse((res, callback) => {
        let data = '';
        res.on('data', (chunk) => {
          data += chunk.toString();
          // Destroy stream after initial handshake
          (res as any).destroy?.();
          callback(null, data);
        });
      });

    expect(response.status).toBe(200);
    expect(response.header['content-type']).toContain('text/event-stream');
    expect(response.header['cache-control']).toContain('no-cache');
  });
});

