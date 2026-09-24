import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { app } from '../app.js';

describe('Diagram Workbook Cloud Persistence API Tests', () => {
  let learnerToken: string;
  let learnerId: string;

  beforeAll(async () => {
    const learnerRes = await request(app)
      .post('/api/auth/login')
      .send({ username: 'diagram_cloud_tester' });
    expect(learnerRes.status).toBe(200);
    learnerToken = learnerRes.body.token;
    learnerId = learnerRes.body.user.id;
  });

  it('returns null workbook when user has no cloud diagram saved yet', async () => {
    const res = await request(app)
      .get('/api/diagrams/workbook')
      .set('Authorization', `Bearer ${learnerToken}`);

    expect(res.status).toBe(200);
    expect(res.body.workbook).toBeNull();
  });

  it('rejects malformed workbook payload with 400', async () => {
    const res = await request(app)
      .post('/api/diagrams/workbook')
      .set('Authorization', `Bearer ${learnerToken}`)
      .send({ workbook: { id: 'missing_sheets' } });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('không hợp lệ');
  });

  it('saves and retrieves multi-sheet diagram workbook with nodes and edges', async () => {
    const mockWorkbook = {
      id: 'wb_test_arch_001',
      name: 'Test Cloud Architecture',
      activeSheetId: 'sheet_vpc_1',
      sheets: [
        {
          id: 'sheet_vpc_1',
          name: 'VPC Core',
          nodes: [
            {
              id: 'node_alb',
              type: 'aws-service',
              serviceType: 'ALB',
              label: 'Application Load Balancer',
              x: 100,
              y: 100,
              width: 140,
              height: 60,
              style: { fill: '#ffffff', stroke: '#3b82f6', strokeWidth: 2, textColor: '#1e293b', fontSize: 13, shape: 'rectangle' },
            },
          ],
          edges: [],
          groups: [],
          background: 'dots',
          zoom: 1,
          pan: { x: 0, y: 0 },
          updatedAt: Date.now(),
        },
      ],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    // Save
    const postRes = await request(app)
      .post('/api/diagrams/workbook')
      .set('Authorization', `Bearer ${learnerToken}`)
      .send({ workbook: mockWorkbook });

    expect(postRes.status).toBe(200);
    expect(postRes.body.success).toBe(true);
    expect(postRes.body.id).toBe('wb_test_arch_001');

    // Retrieve
    const getRes = await request(app)
      .get('/api/diagrams/workbook')
      .set('Authorization', `Bearer ${learnerToken}`);

    expect(getRes.status).toBe(200);
    expect(getRes.body.workbook).toBeDefined();
    expect(getRes.body.workbook.id).toBe('wb_test_arch_001');
    expect(getRes.body.workbook.name).toBe('Test Cloud Architecture');
    expect(getRes.body.workbook.userId).toBe(learnerId);
    expect(getRes.body.workbook.sheets.length).toBe(1);
    expect(getRes.body.workbook.sheets[0].nodes[0].id).toBe('node_alb');
  });

  it('updates diagram workbook on subsequent saves without duplicate rows', async () => {
    const updatedWorkbook = {
      id: 'wb_test_arch_001',
      name: 'Updated Architecture v2',
      activeSheetId: 'sheet_vpc_1',
      sheets: [
        {
          id: 'sheet_vpc_1',
          name: 'VPC Core v2',
          nodes: [
            {
              id: 'node_alb',
              type: 'aws-service',
              serviceType: 'ALB',
              label: 'ALB Active-Active',
              x: 120,
              y: 120,
              width: 140,
              height: 60,
              style: { fill: '#ffffff', stroke: '#3b82f6', strokeWidth: 2, textColor: '#1e293b', fontSize: 13, shape: 'rectangle' },
            },
          ],
          edges: [],
          groups: [],
          background: 'grid',
          zoom: 1.2,
          pan: { x: 50, y: 50 },
          updatedAt: Date.now() + 1000,
        },
      ],
      createdAt: Date.now(),
      updatedAt: Date.now() + 1000,
    };

    const updateRes = await request(app)
      .post('/api/diagrams/workbook')
      .set('Authorization', `Bearer ${learnerToken}`)
      .send({ workbook: updatedWorkbook });

    expect(updateRes.status).toBe(200);
    expect(updateRes.body.success).toBe(true);

    // Verify fetched workbook has the updated name
    const fetchRes = await request(app)
      .get('/api/diagrams/workbook')
      .set('Authorization', `Bearer ${learnerToken}`);

    expect(fetchRes.status).toBe(200);
    expect(fetchRes.body.workbook.name).toBe('Updated Architecture v2');
    expect(fetchRes.body.workbook.sheets[0].name).toBe('VPC Core v2');
  });
});
