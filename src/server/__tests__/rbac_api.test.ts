import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { app } from '../app.js';

describe('RBAC & User Analytics API Integration Tests', () => {
  let learner1Token: string;
  let learner1Id: string;
  let learner2Token: string;
  let adminToken: string;

  beforeAll(async () => {
    // 1. Login Learner 1
    const res1 = await request(app)
      .post('/api/auth/login')
      .send({
        username: 'alice_learner',
        deviceInfo: {
          userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
          platform: 'Win32',
          screenResolution: '1920x1080',
          ipAddress: '127.0.0.1',
        },
      });
    expect(res1.status).toBe(200);
    expect(res1.body.user.role).toBe('LEARNER');
    expect(res1.body.token).toBeDefined();
    learner1Token = res1.body.token;
    learner1Id = res1.body.user.id;

    // 2. Login Learner 2
    const res2 = await request(app)
      .post('/api/auth/login')
      .send({
        username: 'bob_learner',
        deviceInfo: {
          userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X)',
          platform: 'iOS',
          screenResolution: '390x844',
          ipAddress: '192.168.1.5',
        },
      });
    expect(res2.status).toBe(200);
    expect(res2.body.user.role).toBe('LEARNER');
    learner2Token = res2.body.token;

    // 3. Login Admin
    const resAdmin = await request(app)
      .post('/api/auth/login')
      .send({
        username: 'admin',
        adminPasscode: 'admin123',
      });
    expect(resAdmin.status).toBe(200);
    expect(resAdmin.body.user.role).toBe('ADMIN');
    adminToken = resAdmin.body.token;
  });

  describe('Authentication & Role Validation', () => {
    it('rejects admin login without passcode or with wrong passcode', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ username: 'admin' });
      expect(res.status).toBe(401);

      const resWrong = await request(app)
        .post('/api/auth/login')
        .send({ username: 'admin', adminPasscode: 'wrongpass' });
      expect(resWrong.status).toBe(401);
    });

    it('returns current user profile with valid token', async () => {
      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${learner1Token}`);
      expect(res.status).toBe(200);
      expect(res.body.user.username).toBe('alice_learner');
      expect(res.body.user.role).toBe('LEARNER');
    });

    it('returns 401 when accessing protected route without token', async () => {
      const res = await request(app).get('/api/auth/me');
      expect(res.status).toBe(401);
    });
  });

  describe('RBAC Authorization Guard (Admin Isolation)', () => {
    it('forbids LEARNER from accessing admin overview (403)', async () => {
      const res = await request(app)
        .get('/api/admin/overview')
        .set('Authorization', `Bearer ${learner1Token}`);
      expect(res.status).toBe(403);
    });

    it('forbids LEARNER from accessing user analytics (403)', async () => {
      const res = await request(app)
        .get(`/api/admin/users/${learner1Id}/analytics`)
        .set('Authorization', `Bearer ${learner1Token}`);
      expect(res.status).toBe(403);
    });

    it('forbids LEARNER from accessing question review queue (403)', async () => {
      const res = await request(app)
        .get('/api/admin/questions/review')
        .set('Authorization', `Bearer ${learner1Token}`);
      expect(res.status).toBe(403);
    });

    it('allows ADMIN to access admin overview', async () => {
      const res = await request(app)
        .get('/api/admin/overview')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.body.totalUsers).toBeGreaterThanOrEqual(2);
    });
  });

  describe('Learner Study Data & Isolation (IDOR Prevention)', () => {
    it('saves and retrieves study progress for a learner', async () => {
      // Save progress for question 1 as correct
      const saveRes = await request(app)
        .post('/api/users/me/progress')
        .set('Authorization', `Bearer ${learner1Token}`)
        .send({
          questionId: 1,
          selectedChoices: ['A'],
          isCorrect: true,
          timeSpentSeconds: 45,
        });
      expect(saveRes.status).toBe(200);
      expect(saveRes.body.success).toBe(true);

      // Fetch progress for Learner 1
      const getRes1 = await request(app)
        .get('/api/users/me/progress')
        .set('Authorization', `Bearer ${learner1Token}`);
      expect(getRes1.status).toBe(200);
      expect(getRes1.body.progress['1']).toBeDefined();
      expect(getRes1.body.progress['1'].isCorrect).toBe(true);

      // Fetch progress for Learner 2 (must be empty for question 1)
      const getRes2 = await request(app)
        .get('/api/users/me/progress')
        .set('Authorization', `Bearer ${learner2Token}`);
      expect(getRes2.status).toBe(200);
      expect(getRes2.body.progress['1']).toBeUndefined();
    });

    it('resets a single question progress and all study progress for a learner', async () => {
      // Save progress for question 2 and 3 for Learner 1
      await request(app)
        .post('/api/users/me/progress')
        .set('Authorization', `Bearer ${learner1Token}`)
        .send({
          questionId: 2,
          selectedChoices: ['B'],
          isCorrect: true,
          timeSpentSeconds: 30,
        });

      await request(app)
        .post('/api/users/me/progress')
        .set('Authorization', `Bearer ${learner1Token}`)
        .send({
          questionId: 3,
          selectedChoices: ['C'],
          isCorrect: false,
          timeSpentSeconds: 25,
        });

      // Verify questions 2 and 3 exist
      let res = await request(app)
        .get('/api/users/me/progress')
        .set('Authorization', `Bearer ${learner1Token}`);
      expect(res.body.progress['2']).toBeDefined();
      expect(res.body.progress['3']).toBeDefined();

      // Reset single question 2
      const delSingleRes = await request(app)
        .delete('/api/users/me/progress/2')
        .set('Authorization', `Bearer ${learner1Token}`);
      expect(delSingleRes.status).toBe(200);
      expect(delSingleRes.body.success).toBe(true);

      res = await request(app)
        .get('/api/users/me/progress')
        .set('Authorization', `Bearer ${learner1Token}`);
      expect(res.body.progress['2']).toBeUndefined();
      expect(res.body.progress['3']).toBeDefined();

      // Reset all progress
      const delAllRes = await request(app)
        .delete('/api/users/me/progress')
        .set('Authorization', `Bearer ${learner1Token}`);
      expect(delAllRes.status).toBe(200);
      expect(delAllRes.body.success).toBe(true);

      res = await request(app)
        .get('/api/users/me/progress')
        .set('Authorization', `Bearer ${learner1Token}`);
      expect(Object.keys(res.body.progress || {}).length).toBe(0);
    });

    it('saves, fetches, and deletes user notes', async () => {
      // Save note for question 5
      const noteRes = await request(app)
        .post('/api/users/me/notes')
        .set('Authorization', `Bearer ${learner1Token}`)
        .send({
          questionId: 5,
          noteText: 'Nhớ kỹ: S3 Standard-IA có phí truy xuất.',
        });
      expect(noteRes.status).toBe(200);

      // Learner 1 gets note
      const getNotes1 = await request(app)
        .get('/api/users/me/notes')
        .set('Authorization', `Bearer ${learner1Token}`);
      expect(getNotes1.body.notes['5'].noteText).toBe('Nhớ kỹ: S3 Standard-IA có phí truy xuất.');

      // Learner 2 does NOT see Learner 1 notes
      const getNotes2 = await request(app)
        .get('/api/users/me/notes')
        .set('Authorization', `Bearer ${learner2Token}`);
      expect(getNotes2.body.notes['5']).toBeUndefined();

      // Delete note
      const delRes = await request(app)
        .delete('/api/users/me/notes/5')
        .set('Authorization', `Bearer ${learner1Token}`);
      expect(delRes.status).toBe(200);

      const afterDel = await request(app)
        .get('/api/users/me/notes')
        .set('Authorization', `Bearer ${learner1Token}`);
      expect(afterDel.body.notes['5']).toBeUndefined();
    });
  });

  describe('Feedback Workflow', () => {
    let createdFeedbackId: string;

    it('allows learner to submit feedback', async () => {
      const res = await request(app)
        .post('/api/feedback')
        .set('Authorization', `Bearer ${learner1Token}`)
        .send({
          type: 'QUESTION_ERROR',
          title: 'Lỗi câu 42',
          content: 'Giải thích tiếng Việt câu 42 thiếu phần VPC peering.',
          priority: 'HIGH',
        });
      expect([200, 201]).toContain(res.status);
      expect(res.body.feedback.id).toBeDefined();
      expect(res.body.feedback.status).toBe('NEW');
      createdFeedbackId = res.body.feedback.id;
    });

    it('allows learner to see only their submitted feedback', async () => {
      const res1 = await request(app)
        .get('/api/feedback/my')
        .set('Authorization', `Bearer ${learner1Token}`);
      expect(res1.status).toBe(200);
      expect(res1.body.feedbacks.some((f: any) => f.id === createdFeedbackId)).toBe(true);

      const res2 = await request(app)
        .get('/api/feedback/my')
        .set('Authorization', `Bearer ${learner2Token}`);
      expect(res2.status).toBe(200);
      expect(res2.body.feedbacks.some((f: any) => f.id === createdFeedbackId)).toBe(false);
    });

    it('allows admin to view and respond to feedback', async () => {
      const adminList = await request(app)
        .get('/api/admin/feedback?status=NEW')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(adminList.status).toBe(200);
      expect(adminList.body.items.some((f: any) => f.id === createdFeedbackId)).toBe(true);

      // Admin responds & resolves
      const patchRes = await request(app)
        .patch(`/api/admin/feedback/${createdFeedbackId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          status: 'RESOLVED',
          adminResponse: 'Cảm ơn bạn, chúng tôi đã cập nhật giải thích câu 42.',
        });
      expect(patchRes.status).toBe(200);

      // Learner sees updated status & response
      const learnerCheck = await request(app)
        .get('/api/feedback/my')
        .set('Authorization', `Bearer ${learner1Token}`);
      const updated = learnerCheck.body.feedbacks.find((f: any) => f.id === createdFeedbackId);
      expect(updated.status).toBe('RESOLVED');
      expect(updated.adminResponse).toContain('đã cập nhật');
    });
  });

  describe('Question Submission & Moderation Workflow', () => {
    let submittedQuestionId: number;

    it('learner submits question in PENDING_REVIEW; remains private', async () => {
      const res = await request(app)
        .post('/api/questions/submit')
        .set('Authorization', `Bearer ${learner1Token}`)
        .send({
          text: 'Một công ty cần thiết kế giải pháp lưu trữ có độ trễ thấp và khả năng mở rộng không giới hạn trên AWS?',
          choices: {
            A: 'Amazon S3 Standard',
            B: 'Amazon EBS Cold HDD',
            C: 'AWS Storage Gateway',
            D: 'AWS Snowball',
          },
          answer: 'A',
          explanation: 'Amazon S3 Standard cung cấp độ bền 99.999999999% và khả năng mở rộng vô hạn.',
          domain: 'Domain 1: Design Secure Architectures',
          difficulty: 'Medium',
          topic: 'Storage',
          serviceTags: ['S3'],
        });

      expect([200, 201]).toContain(res.status);
      expect(res.body.question.status).toBe('PENDING_REVIEW');
      expect(res.body.question.is_private).toBe(1);
      submittedQuestionId = res.body.question.id;
    });

    it('pending question is visible ONLY to author and admin, NOT to other learners', async () => {
      // Author (Learner 1) fetches custom questions
      const res1 = await request(app)
        .get('/api/questions/custom')
        .set('Authorization', `Bearer ${learner1Token}`);
      expect(res1.body.questions.some((q: any) => q.originalId === `custom_${submittedQuestionId}`)).toBe(true);

      // Learner 2 fetches custom questions (should NOT see it)
      const res2 = await request(app)
        .get('/api/questions/custom')
        .set('Authorization', `Bearer ${learner2Token}`);
      expect(res2.body.questions.some((q: any) => q.originalId === `custom_${submittedQuestionId}`)).toBe(false);
    });

    it('admin reviews and approves question, making it public to all', async () => {
      // Admin sees it in review queue
      const queueRes = await request(app)
        .get('/api/admin/questions/review')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(queueRes.status).toBe(200);
      expect(queueRes.body.pendingQuestions.some((q: any) => q.id === submittedQuestionId)).toBe(true);

      // Admin approves
      const approveRes = await request(app)
        .post(`/api/admin/questions/${submittedQuestionId}/approve`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(approveRes.status).toBe(200);
      expect(approveRes.body.status).toBe('APPROVED');

      // Now Learner 2 CAN see it
      const res2 = await request(app)
        .get('/api/questions/custom')
        .set('Authorization', `Bearer ${learner2Token}`);
      expect(res2.body.questions.some((q: any) => q.originalId === `custom_${submittedQuestionId}`)).toBe(true);
    });
  });

  describe('Admin Deep Analytics & Insights', () => {
    it('generates rich learner analytics including study habits, weak topics and recommendations', async () => {
      const res = await request(app)
        .get(`/api/admin/users/${learner1Id}/analytics`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.user.username).toBe('alice_learner');
      expect(res.body.studyHabits).toBeDefined();
      expect(res.body.studyHabits.activeDaysCount).toBeGreaterThanOrEqual(1);
      expect(res.body.devices).toBeDefined();
      expect(res.body.devices.length).toBeGreaterThanOrEqual(1);
      expect(res.body.topicBreakdown).toBeDefined();
      expect(res.body.recommendations).toBeInstanceOf(Array);
    });

    it('verifies default seeded learner quang_aws has complete progress, notes, and exam history', async () => {
      // Login quang_aws and submit real progress & note
      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({ username: 'quang_aws' });
      const qToken = loginRes.body.token;

      await request(app)
        .post('/api/users/me/progress')
        .set('Authorization', `Bearer ${qToken}`)
        .send({
          questionId: 11,
          selectedAnswer: 'A',
          isSubmitted: true,
          isCorrect: true,
          confidence: 'high',
        });

      await request(app)
        .post('/api/users/me/notes')
        .set('Authorization', `Bearer ${qToken}`)
        .send({ questionId: 11, noteText: 'Test note for quang_aws' });

      // Find quang_aws in users list
      const usersRes = await request(app)
        .get('/api/admin/users?search=quang_aws')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(usersRes.status).toBe(200);
      const quang = usersRes.body.users.find((u: any) => u.username === 'quang_aws');
      expect(quang).toBeDefined();
      expect(quang.questionsAttempted).toBeGreaterThan(0);
      expect(quang.notesCount).toBeGreaterThan(0);

      // Deep dive analytics for quang_aws
      const analyticsRes = await request(app)
        .get(`/api/admin/users/${quang.id}/analytics`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(analyticsRes.status).toBe(200);
      expect(analyticsRes.body.user.username).toBe('quang_aws');
      expect(analyticsRes.body.learningProgress.totalAttempted).toBeGreaterThan(0);
      expect(analyticsRes.body.notes.length).toBeGreaterThan(0);
    });

    it('syncs client-side learners and study data via /api/admin/sync-learners', async () => {
      const syncRes = await request(app)
        .post('/api/admin/sync-learners')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          learners: [
            {
              id: 'usr_test_client_sync',
              username: 'client_synced_learner',
              role: 'LEARNER',
              createdAt: Date.now() - 10000,
              lastActiveAt: Date.now(),
              device: {
                deviceType: 'Desktop',
                os: 'Windows',
                browser: 'Chrome',
              },
            },
          ],
          studyData: {
            progress: {
              items: {
                '99': {
                  selectedAnswer: 'B',
                  isSubmitted: true,
                  isCorrect: true,
                  confidence: 'high',
                  attemptsCount: 1,
                },
              },
            },
            notes: {
              '99': {
                noteText: 'Sync test note content',
              },
            },
          },
        });

      expect(syncRes.status).toBe(200);
      expect(syncRes.body.success).toBe(true);

      // Verify synced user exists in database
      const checkRes = await request(app)
        .get('/api/admin/users?search=client_synced_learner')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(checkRes.status).toBe(200);
      expect(checkRes.body.users.some((u: any) => u.username === 'client_synced_learner')).toBe(true);
    });

    it('supports admin manual re-seed via /api/admin/seed-learners', async () => {
      const seedRes = await request(app)
        .post('/api/admin/seed-learners')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(seedRes.status).toBe(200);
      expect(seedRes.body.success).toBe(true);
    });

    it('records anonymous AI Tutor feedback without storing private chats or API keys', async () => {
      const feedbackRes = await request(app)
        .post('/api/ai/feedback')
        .set('Authorization', `Bearer ${learner1Token}`)
        .send({
          questionId: 101,
          rating: 'up',
          mode: 'explain',
          provider: 'gemini',
        });

      expect(feedbackRes.status).toBe(200);
      expect(feedbackRes.body.success).toBe(true);

      const downRes = await request(app)
        .post('/api/ai/feedback')
        .send({
          questionId: 102,
          rating: 'down',
          reasonTags: ['Giải thích quá dài', 'Cần thêm sơ đồ'],
          comment: 'Muốn có sơ đồ so sánh DynamoDB vs Aurora',
          mode: 'deepdive',
          provider: 'openai',
        });

      expect(downRes.status).toBe(200);
      expect(downRes.body.success).toBe(true);
    });

    it('provides aggregated AI analytics metrics for Admin only', async () => {
      // Learner denied
      const learnerRes = await request(app)
        .get('/api/admin/ai-analytics')
        .set('Authorization', `Bearer ${learner1Token}`);
      expect(learnerRes.status).toBe(403);

      // Admin allowed
      const adminRes = await request(app)
        .get('/api/admin/ai-analytics')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(adminRes.status).toBe(200);
      expect(adminRes.body.totalFeedback).toBeGreaterThanOrEqual(2);
      expect(adminRes.body.knowledgeCoverage.canonicalQuestions).toBe(1019);
      expect(adminRes.body.knowledgeCoverage.indexedServices).toBe(42);
      expect(adminRes.body.topReasons.length).toBeGreaterThan(0);
    });
  });

  describe('Automatic Learner Persistence & Cold-Start Recovery', () => {
    it('automatically persists new learner to registry on login without manual seed', async () => {
      const newUsername = 'hoang_long_tester';
      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({
          username: newUsername,
          device: {
            deviceType: 'Desktop',
            os: 'Windows',
            browser: 'Chrome',
          },
        });

      expect(loginRes.status).toBe(200);
      expect(loginRes.body.user.username).toBe(newUsername);

      // Verify user appears in admin user list immediately
      const adminUsersRes = await request(app)
        .get(`/api/admin/users?search=${newUsername}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(adminUsersRes.status).toBe(200);
      const found = adminUsersRes.body.users.find((u: any) => u.username === newUsername);
      expect(found).toBeDefined();
      expect(found.username).toBe(newUsername);
    });

    it('retains registered learner in persistent registry and admin list', async () => {
      const adminUsersRes = await request(app)
        .get('/api/admin/users?search=alice_learner')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(adminUsersRes.status).toBe(200);
      const found = adminUsersRes.body.users.find((u: any) => u.username.toLowerCase() === 'alice_learner');
      expect(found).toBeDefined();
      expect(found.username).toBe('alice_learner');
    });

    it('accurately tracks and displays questions attempted and accuracy for admin account when completing exams', async () => {
      const examAttempt = {
        id: 'exam_admin_test_1',
        date: new Date().toISOString(),
        scorePercent: 85,
        scaledScore: 850,
        passed: true,
        totalQuestions: 32,
        correctCount: 28,
        incorrectCount: 4,
        unansweredCount: 0,
        timeUsedSeconds: 1800,
        examType: 'SAA-C03 Simulation',
        questionResults: [
          { questionId: 101, userAnswer: 'A', isCorrect: true },
          { questionId: 102, userAnswer: 'B', isCorrect: false },
        ],
      };

      const migrateRes = await request(app)
        .post('/api/users/me/progress/migrate')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          progressItems: {
            '101': { selectedAnswer: 'A', isSubmitted: true, isCorrect: true },
            '102': { selectedAnswer: 'B', isSubmitted: true, isCorrect: false },
          },
          notes: {
            '101': { noteText: 'Admin important note' },
          },
          bookmarks: [101],
          exams: [examAttempt],
        });

      expect(migrateRes.status).toBe(200);

      // Query /api/admin/users for admin
      const usersRes = await request(app)
        .get('/api/admin/users?search=admin')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(usersRes.status).toBe(200);
      const adminUser = usersRes.body.users.find((u: any) => u.username.toLowerCase() === 'admin');
      expect(adminUser).toBeDefined();
      expect(adminUser.questionsAttempted).toBeGreaterThanOrEqual(32);
      expect(adminUser.correctCount).toBeGreaterThanOrEqual(28);
      expect(adminUser.accuracyPercent).toBeGreaterThan(0);
      expect(adminUser.notesCount).toBeGreaterThanOrEqual(1);

      // Query /api/admin/overview
      const overviewRes = await request(app)
        .get('/api/admin/overview')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(overviewRes.status).toBe(200);
      expect(overviewRes.body.totalAttempts).toBeGreaterThanOrEqual(32);
      expect(overviewRes.body.correctAnswers).toBeGreaterThanOrEqual(28);

      // Query /api/admin/learning-behavior for admin
      const behaviorRes = await request(app)
        .get(`/api/admin/learning-behavior?userId=${adminUser.id}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(behaviorRes.status).toBe(200);
      expect(behaviorRes.body.learner).toBeDefined();
      expect(behaviorRes.body.learner.questionsAttempted).toBeGreaterThanOrEqual(32);
    });
  });
});

