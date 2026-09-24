import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { app } from '../app.js';

describe('Realtime Session Tracker & IP/Device Telemetry API Tests', () => {
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
      .send({ username: 'tracker_tester_user' });
    expect(learnerRes.status).toBe(200);
    learnerToken = learnerRes.body.token;
    learnerId = learnerRes.body.user.id;
  });

  it('records heartbeat for anonymous guest with IP and device parsing', async () => {
    const res = await request(app)
      .post('/api/tracker/heartbeat')
      .set('x-forwarded-for', '103.145.2.15')
      .set('user-agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0.0.0')
      .send({
        sessionId: 'test_guest_session_123',
        currentScreen: 'Chế độ Luyện tập',
        currentAction: 'Đang làm câu #18 (Amazon Aurora Serverless)',
        questionId: 18,
        questionsAttempted: 5,
        accuracyPercent: 80,
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.session).toBeDefined();
    expect(res.body.session.sessionId).toBe('test_guest_session_123');
    expect(res.body.session.ipAddress).toBe('103.145.2.15');
    expect(res.body.session.deviceType).toBe('Desktop');
    expect(res.body.session.os).toContain('Windows');
    expect(res.body.session.browser).toContain('Chrome');
    expect(res.body.session.currentAction).toBe('Đang làm câu #18 (Amazon Aurora Serverless)');
    expect(res.body.session.isOnline).toBe(true);
  });

  it('records heartbeat for logged in learner', async () => {
    const res = await request(app)
      .post('/api/tracker/heartbeat')
      .set('x-forwarded-for', '14.241.120.5')
      .set('user-agent', 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1')
      .send({
        sessionId: 'test_learner_session_456',
        userId: learnerId,
        username: 'tracker_tester_user',
        device: {
          deviceType: 'Mobile',
          os: 'iOS',
          browser: 'Apple Safari',
          screenResolution: '390x844',
        },
        currentScreen: 'Thi mô phỏng Pearson VUE',
        currentAction: 'Đang làm bài thi: Còn 52 phút (28/65 câu)',
        questionId: 28,
        questionsAttempted: 28,
        accuracyPercent: 75,
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.session.username).toBe('tracker_tester_user');
    expect(res.body.session.ipAddress).toBe('14.241.120.5');
    expect(res.body.session.deviceType).toBe('Mobile');
    expect(res.body.session.os).toBe('iOS');
    expect(res.body.session.browser).toBe('Apple Safari');
  });

  it('protects /api/admin/live-sessions with ADMIN role check', async () => {
    // Unauthenticated
    const unauth = await request(app).get('/api/admin/live-sessions');
    expect(unauth.status).toBe(401);

    // Regular learner
    const forbidden = await request(app)
      .get('/api/admin/live-sessions')
      .set('Authorization', `Bearer ${learnerToken}`);
    expect(forbidden.status).toBe(403);

    // Admin allowed
    const adminRes = await request(app)
      .get('/api/admin/live-sessions')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(adminRes.status).toBe(200);
    expect(Array.isArray(adminRes.body.sessions)).toBe(true);
    expect(adminRes.body.sessions.length).toBeGreaterThanOrEqual(2);

    const guestSess = adminRes.body.sessions.find((s: any) => s.sessionId === 'test_guest_session_123');
    expect(guestSess).toBeDefined();
    expect(guestSess.ipAddress).toBe('103.145.2.15');
    expect(guestSess.currentAction).toBe('Đang làm câu #18 (Amazon Aurora Serverless)');
  });

  it('returns realtime IP, device, and online status in getAdminUsersList', async () => {
    const res = await request(app)
      .get('/api/admin/users?search=tracker_tester_user')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.users).toBeDefined();
    const user = res.body.users.find((u: any) => u.username === 'tracker_tester_user');
    expect(user).toBeDefined();
    expect(user.ipAddress).toBe('14.241.120.5');
    expect(user.deviceType).toBe('Mobile');
    expect(user.os).toBe('iOS');
    expect(user.currentAction).toBe('Đang làm bài thi: Còn 52 phút (28/65 câu)');
    expect(user.isOnline).toBe(true);
  });

  it('returns aggregated learning behavior analytics for global system', async () => {
    const res = await request(app)
      .get('/api/admin/learning-behavior')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.studyTimeDistribution).toBeDefined();
    expect(res.body.confidenceAnalysis).toBeDefined();
    expect(Array.isArray(res.body.domainBreakdown)).toBe(true);
    expect(res.body.domainBreakdown.length).toBe(4);
    expect(res.body.deviceHabits).toBeDefined();
    expect(res.body.studyEngagementMetrics).toBeDefined();
    expect(res.body.learner).toBeNull();
  });

  it('returns individual learner metrics when userId query param is provided', async () => {
    const res = await request(app)
      .get(`/api/admin/learning-behavior?userId=${encodeURIComponent(learnerId)}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.learner).toBeDefined();
    expect(res.body.learner.id).toBe(learnerId);
    expect(res.body.learner.username).toBe('tracker_tester_user');
    expect(res.body.studyTimeDistribution).toBeDefined();
    expect(res.body.confidenceAnalysis).toBeDefined();
    expect(Array.isArray(res.body.domainBreakdown)).toBe(true);
    expect(res.body.deviceHabits).toBeDefined();
    expect(res.body.studyEngagementMetrics).toBeDefined();
  });

  it('purges obsolete guest session when admin logs in from the same IP and device', async () => {
    const testIp = '42.114.19.163';
    const testUa = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

    // 1. Initial guest heartbeat
    const guestRes = await request(app)
      .post('/api/tracker/heartbeat')
      .set('x-forwarded-for', testIp)
      .set('user-agent', testUa)
      .send({
        sessionId: 'test_guest_session_purge_check',
        currentScreen: 'Trang chủ',
        currentAction: 'Đang xem trang chủ',
      });
    expect(guestRes.status).toBe(200);

    // 2. Admin heartbeat from the exact same device and IP
    const adminHeartbeatRes = await request(app)
      .post('/api/tracker/heartbeat')
      .set('x-forwarded-for', testIp)
      .set('user-agent', testUa)
      .send({
        sessionId: 'test_admin_session_active',
        username: 'admin',
        role: 'ADMIN',
        currentScreen: 'Bảng Quản Trị',
        currentAction: 'Đang quản lý hệ thống & giám sát người học',
      });
    expect(adminHeartbeatRes.status).toBe(200);

    // 3. Live sessions query must have admin and MUST NOT have the superseded guest
    const liveRes = await request(app)
      .get('/api/admin/live-sessions')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(liveRes.status).toBe(200);

    const guestStillThere = liveRes.body.sessions.find((s: any) => s.sessionId === 'test_guest_session_purge_check');
    expect(guestStillThere).toBeUndefined();

    const adminSession = liveRes.body.sessions.find((s: any) => s.sessionId === 'test_admin_session_active');
    expect(adminSession).toBeDefined();
    expect(adminSession.role).toBe('ADMIN');
  });

  it('automatically registers and displays online learner thi in GET /api/admin/users', async () => {
    // Heartbeat from learner 'thi' with 9 attempted questions and IP
    const thiHeartbeat = await request(app)
      .post('/api/tracker/heartbeat')
      .set('x-forwarded-for', '42.114.19.163')
      .set('user-agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36')
      .send({
        sessionId: 'test_thi_session_realtime',
        username: 'thi',
        currentScreen: 'Trang chủ & Tổng quan',
        currentAction: 'Đang học ở Trang chủ & Tổng quan',
        questionsAttempted: 9,
        accuracyPercent: 0,
      });

    expect(thiHeartbeat.status).toBe(200);
    expect(thiHeartbeat.body.success).toBe(true);
    expect(thiHeartbeat.body.session.username).toBe('thi');
    expect(thiHeartbeat.body.session.userId).toBeTruthy();
    expect(thiHeartbeat.body.session.questionsAttempted).toBe(9);

    // 1. Must appear in live-sessions
    const liveRes = await request(app)
      .get('/api/admin/live-sessions')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(liveRes.status).toBe(200);
    const thiLive = liveRes.body.sessions.find((s: any) => s.username === 'thi');
    expect(thiLive).toBeDefined();
    expect(thiLive.ipAddress).toBe('42.114.19.163');
    expect(thiLive.questionsAttempted).toBe(9);

    // 2. Must appear in GET /api/admin/users list and be saved in database
    const usersRes = await request(app)
      .get('/api/admin/users?search=thi')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(usersRes.status).toBe(200);
    expect(usersRes.body.users).toBeDefined();
    const thiUser = usersRes.body.users.find((u: any) => u.username === 'thi');
    expect(thiUser).toBeDefined();
    expect(thiUser.role).toBe('LEARNER');
    expect(thiUser.ipAddress).toBe('42.114.19.163');
    expect(thiUser.questionsAttempted).toBe(9);
    expect(thiUser.currentScreen).toBe('Trang chủ & Tổng quan');
  });

  it('records and streams live screen telemetry for UltraView Web', async () => {
    const streamPayload = {
      sessionId: 'test_ultraview_session_101',
      userId: learnerId,
      username: 'tracker_tester_user',
      screen: 'Chế độ Luyện tập',
      action: 'Đang làm câu #14 (Amazon DynamoDB Accelerator)',
      viewport: { width: 1440, height: 900 },
      cursor: { xPercent: 42.5, yPercent: 68.2, lastActiveAt: Date.now() },
      click: {
        xPercent: 42.5,
        yPercent: 68.2,
        targetDescription: 'Bấm vào "Đáp án B: DAX Cluster"',
        timestamp: Date.now(),
      },
      scroll: { scrollPercent: 35, scrollY: 420 },
      activeQuestion: {
        id: 14,
        questionText: 'Which service provides in-memory caching for DynamoDB?',
        topic: 'Database',
        service: 'DynamoDB',
        options: {
          A: 'ElastiCache',
          B: 'DynamoDB Accelerator (DAX)',
          C: 'CloudFront',
          D: 'MemoryDB',
        },
        selectedAnswer: 'B',
        isSubmitted: true,
        isCorrect: true,
      },
      recentLogs: [
        { id: 'log1', timestamp: Date.now(), text: 'Bấm chọn đáp án B', badge: 'Click' },
      ],
    };

    // 1. Post screen frame from learner
    const postRes = await request(app)
      .post('/api/tracker/screen-stream')
      .set('x-forwarded-for', '103.20.15.88')
      .send(streamPayload);

    expect(postRes.status).toBe(200);
    expect(postRes.body.success).toBe(true);
    expect(postRes.body.frame).toBeDefined();
    expect(postRes.body.frame.cursor.xPercent).toBe(42.5);
    expect(postRes.body.frame.activeQuestion.id).toBe(14);
    expect(postRes.body.frame.ipAddress).toBe('103.20.15.88');

    // 2. Admin retrieves latest screen frame via GET
    const getRes = await request(app)
      .get('/api/tracker/screen-stream/test_ultraview_session_101')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(getRes.status).toBe(200);
    expect(getRes.body.success).toBe(true);
    expect(getRes.body.frame).toBeDefined();
    expect(getRes.body.frame.username).toBe('tracker_tester_user');
    expect(getRes.body.frame.activeQuestion.selectedAnswer).toBe('B');
    expect(getRes.body.frame.activeQuestion.isCorrect).toBe(true);
    expect(getRes.body.frame.click.targetDescription).toContain('DAX Cluster');
  });
});

