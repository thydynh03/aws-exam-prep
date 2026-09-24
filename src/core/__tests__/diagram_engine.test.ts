import { describe, it, expect, beforeEach } from 'vitest';
import {
  generateId,
  createEmptyDiagram,
  saveDiagram,
  loadDiagram,
  listDiagrams,
  deleteDiagram,
  duplicateDiagram,
  createEmptyWorkbook,
  loadWorkbook,
  saveWorkbook,
  addSheetToWorkbook,
  renameSheetInWorkbook,
  duplicateSheetInWorkbook,
  deleteSheetFromWorkbook,
} from '../diagram/diagramStorage';
import { parseMermaidToDiagram } from '../diagram/mermaidToDiagram';
import {
  applyAutoLayout,
  getAnchorPoint,
  getBestAnchorPair,
  computeOrthogonalWaypoints,
} from '../diagram/diagramAutoLayout';
import {
  diagramToContextText,
  auditArchitectureHeuristics,
  parseAIDiagramResponse,
  parseAIPatchResponse,
  applyPatchToDiagram,
} from '../diagram/diagramAIBridge';
import { DIAGRAM_TEMPLATES } from '../diagram/diagramTemplates';
import type { Diagram, DiagramNode, DiagramEdge, DiagramPatch } from '../diagram/diagramTypes';

describe('AI Diagram & Brainstorming Engine', () => {
  const store = new Map<string, string>();

  beforeEach(() => {
    store.clear();
    // Polyfill localStorage in node environment if missing
    if (typeof globalThis.localStorage === 'undefined') {
      (globalThis as any).localStorage = {
        getItem: (k: string) => store.get(k) ?? null,
        setItem: (k: string, v: string) => store.set(k, v),
        removeItem: (k: string) => store.delete(k),
        clear: () => store.clear(),
      };
    } else {
      localStorage.clear();
    }
  });

  describe('Diagram Storage & Management', () => {
    it('generates unique element IDs', () => {
      const id1 = generateId('node');
      const id2 = generateId('node');
      expect(id1).toMatch(/^node_/);
      expect(id2).toMatch(/^node_/);
      expect(id1).not.toBe(id2);
    });

    it('creates an empty diagram with defaults', () => {
      const diag = createEmptyDiagram('Test Architecture');
      expect(diag.name).toBe('Test Architecture');
      expect(diag.nodes).toEqual([]);
      expect(diag.edges).toEqual([]);
      expect(diag.viewport.zoom).toBe(1);
      expect(diag.background).toBe('grid');
    });

    it('saves and loads diagrams to localStorage', () => {
      const diag = createEmptyDiagram('AWS Microservices');
      saveDiagram(diag);

      const loaded = loadDiagram(diag.id);
      expect(loaded).not.toBeNull();
      expect(loaded?.name).toBe('AWS Microservices');

      const list = listDiagrams();
      expect(list.length).toBe(1);
      expect(list[0].id).toBe(diag.id);
    });

    it('duplicates a diagram', () => {
      const diag = createEmptyDiagram('Production VPC');
      diag.nodes.push({
        id: 'n1',
        type: 'rectangle',
        label: 'Node 1',
        x: 10,
        y: 20,
        width: 100,
        height: 50,
        style: { fill: '#000', stroke: '#fff', strokeWidth: 1 },
      });
      saveDiagram(diag);

      const copy = duplicateDiagram(diag.id);
      expect(copy).not.toBeNull();
      expect(copy?.id).not.toBe(diag.id);
      expect(copy?.name).toBe('Production VPC (Copy)');
      expect(copy?.nodes.length).toBe(1);
    });

    it('deletes a diagram', () => {
      const diag = createEmptyDiagram('To Delete');
      saveDiagram(diag);
      expect(loadDiagram(diag.id)).not.toBeNull();

      deleteDiagram(diag.id);
      expect(loadDiagram(diag.id)).toBeNull();
    });
  });

  describe('Mermaid Syntax to Diagram Parser', () => {
    it('parses standard flowchart LR with labeled nodes and edges', () => {
      const code = `
        flowchart LR
          User["Web Browser"] -->|HTTPS| CF["Amazon CloudFront"]
          CF --> ALB["Application Load Balancer"]
          ALB --> EC2["Auto Scaling EC2"]
      `;
      const result = parseMermaidToDiagram(code);
      expect(result.direction).toBe('LR');
      expect(result.nodes.length).toBe(4);
      expect(result.edges.length).toBe(3);

      // Check AWS service classification
      const cfNode = result.nodes.find((n) => n.id === 'CF');
      expect(cfNode?.type).toBe('aws-service');
      expect(cfNode?.data?.serviceCategory).toBe('Networking');

      const ec2Node = result.nodes.find((n) => n.id === 'EC2');
      expect(ec2Node?.type).toBe('aws-service');
      expect(ec2Node?.data?.serviceCategory).toBe('Compute');

      // Check edge label
      expect(result.edges[0].label).toBe('HTTPS');
    });

    it('parses various shape delimiters (cylinder, diamond, rounded)', () => {
      const code = `
        flowchart TD
          DB[("Aurora Database")]
          Decision{"Should Cache?"}
          Cache(["Redis Cache"])
          DB --> Decision
          Decision -.-> Cache
      `;
      const result = parseMermaidToDiagram(code);
      expect(result.direction).toBe('TB');

      const dbNode = result.nodes.find((n) => n.id === 'DB');
      expect(dbNode?.label).toBe('Aurora Database');

      const decNode = result.nodes.find((n) => n.id === 'Decision');
      expect(decNode?.label).toBe('Should Cache?');

      const edge = result.edges.find((e) => e.sourceNodeId === 'Decision');
      expect(edge?.lineStyle).toBe('dashed');
    });

    it('parses subgraphs into diagram frames', () => {
      const code = `
        flowchart LR
          subgraph VPC ["AWS VPC 10.0.0.0/16"]
            S3["Amazon S3 Bucket"]
            Lambda["AWS Lambda"]
          end
          User --> Lambda
          Lambda --> S3
      `;
      const result = parseMermaidToDiagram(code);
      expect(result.frames.length).toBe(1);
      expect(result.frames[0].title).toBe('AWS VPC 10.0.0.0/16');
      expect(result.nodes.some((n) => n.frameId === 'frame_VPC')).toBe(true);
    });
  });

  describe('Auto Layout & Routing Algorithms', () => {
    const createMockGraph = (): { nodes: DiagramNode[]; edges: DiagramEdge[] } => {
      const nodes: DiagramNode[] = [
        { id: 'a', type: 'rectangle', label: 'A', x: 0, y: 0, width: 100, height: 50, style: { fill: '', stroke: '', strokeWidth: 1 } },
        { id: 'b', type: 'rectangle', label: 'B', x: 0, y: 0, width: 100, height: 50, style: { fill: '', stroke: '', strokeWidth: 1 } },
        { id: 'c', type: 'rectangle', label: 'C', x: 0, y: 0, width: 100, height: 50, style: { fill: '', stroke: '', strokeWidth: 1 } },
      ];
      const edges: DiagramEdge[] = [
        { id: 'e1', sourceNodeId: 'a', targetNodeId: 'b', type: 'orthogonal', lineStyle: 'solid', strokeColor: '#fff', strokeWidth: 2 },
        { id: 'e2', sourceNodeId: 'b', targetNodeId: 'c', type: 'orthogonal', lineStyle: 'solid', strokeColor: '#fff', strokeWidth: 2 },
      ];
      return { nodes, edges };
    };

    it('arranges nodes in hierarchical horizontal (LR) layout', () => {
      const { nodes, edges } = createMockGraph();
      const layout = applyAutoLayout(nodes, edges, 'hierarchical-horizontal');
      const nodeA = layout.nodes.find((n) => n.id === 'a')!;
      const nodeB = layout.nodes.find((n) => n.id === 'b')!;
      const nodeC = layout.nodes.find((n) => n.id === 'c')!;

      expect(nodeA.x).toBeLessThan(nodeB.x);
      expect(nodeB.x).toBeLessThan(nodeC.x);
    });

    it('arranges nodes in hierarchical vertical (TB) layout', () => {
      const { nodes, edges } = createMockGraph();
      const layout = applyAutoLayout(nodes, edges, 'hierarchical-vertical');
      const nodeA = layout.nodes.find((n) => n.id === 'a')!;
      const nodeB = layout.nodes.find((n) => n.id === 'b')!;
      const nodeC = layout.nodes.find((n) => n.id === 'c')!;

      expect(nodeA.y).toBeLessThan(nodeB.y);
      expect(nodeB.y).toBeLessThan(nodeC.y);
    });

    it('computes anchor points accurately', () => {
      const node: DiagramNode = {
        id: 'test',
        type: 'rectangle',
        label: 'Test',
        x: 100,
        y: 100,
        width: 80,
        height: 60,
        style: { fill: '', stroke: '', strokeWidth: 1 },
      };

      const topAnchor = getAnchorPoint(node, 'top');
      expect(topAnchor).toEqual({ id: 'test-top', x: 140, y: 100, direction: 'top' });

      const rightAnchor = getAnchorPoint(node, 'right');
      expect(rightAnchor).toEqual({ id: 'test-right', x: 180, y: 130, direction: 'right' });

      const bottomAnchor = getAnchorPoint(node, 'bottom');
      expect(bottomAnchor).toEqual({ id: 'test-bottom', x: 140, y: 160, direction: 'bottom' });

      const leftAnchor = getAnchorPoint(node, 'left');
      expect(leftAnchor).toEqual({ id: 'test-left', x: 100, y: 130, direction: 'left' });
    });

    it('calculates best anchor pair based on geometric orientation', () => {
      const node1: DiagramNode = {
        id: 'n1',
        type: 'rectangle',
        label: '1',
        x: 50,
        y: 100,
        width: 100,
        height: 50,
        style: { fill: '', stroke: '', strokeWidth: 1 },
      };
      const node2: DiagramNode = {
        id: 'n2',
        type: 'rectangle',
        label: '2',
        x: 350,
        y: 100,
        width: 100,
        height: 50,
        style: { fill: '', stroke: '', strokeWidth: 1 },
      };

      const pair = getBestAnchorPair(node1, node2);
      expect(pair.sourceAnchor).toBe('right');
      expect(pair.targetAnchor).toBe('left');
    });

    it('computes orthogonal path waypoints with right-angle corners', () => {
      const source = { x: 100, y: 100, direction: 'right' as const };
      const target = { x: 300, y: 200, direction: 'left' as const };
      const waypoints = computeOrthogonalWaypoints(source, target);

      expect(waypoints.length).toBeGreaterThanOrEqual(4);
      expect(waypoints[0]).toEqual({ x: 100, y: 100 });
      expect(waypoints[waypoints.length - 1]).toEqual({ x: 300, y: 200 });

      // Verify all segments are orthogonal (either horizontal or vertical)
      for (let i = 0; i < waypoints.length - 1; i++) {
        const p1 = waypoints[i];
        const p2 = waypoints[i + 1];
        const isHorizontal = Math.abs(p1.y - p2.y) < 0.001;
        const isVertical = Math.abs(p1.x - p2.x) < 0.001;
        expect(isHorizontal || isVertical).toBe(true);
      }
    });
  });

  describe('Diagram AI Bridge', () => {
    it('extracts diagram context markdown accurately', () => {
      const diag: Diagram = {
        ...createEmptyDiagram('Order Processing Architecture'),
        nodes: [
          {
            id: 'n-apigw',
            type: 'aws-service',
            label: 'API Gateway',
            x: 100,
            y: 100,
            width: 100,
            height: 50,
            style: { fill: '', stroke: '', strokeWidth: 1 },
            data: { serviceCategory: 'Serverless' },
          },
          {
            id: 'n-lambda',
            type: 'aws-service',
            label: 'Order Function',
            x: 300,
            y: 100,
            width: 100,
            height: 50,
            style: { fill: '', stroke: '', strokeWidth: 1 },
            data: { serviceCategory: 'Serverless' },
          },
        ],
        edges: [
          {
            id: 'e1',
            sourceNodeId: 'n-apigw',
            targetNodeId: 'n-lambda',
            type: 'orthogonal',
            lineStyle: 'solid',
            strokeColor: '#38bdf8',
            strokeWidth: 2,
            label: 'POST /orders',
          },
        ],
      };

      const context = diagramToContextText(diag, 'n-lambda');
      expect(context).toContain('Order Processing Architecture');
      expect(context).toContain('API Gateway');
      expect(context).toContain('Order Function');
      expect(context).toContain('POST /orders');
      expect(context).toContain('[SELECTED FOCUS]');
    });

    it('identifies architectural anti-patterns with static heuristics', () => {
      const singleEc2Diagram: Diagram = {
        ...createEmptyDiagram('Unsafe Setup'),
        nodes: [
          {
            id: 'ec2-1',
            type: 'aws-service',
            label: 'EC2 Web Server',
            x: 100,
            y: 100,
            width: 100,
            height: 50,
            style: { fill: '', stroke: '', strokeWidth: 1 },
          },
        ],
        edges: [],
      };

      const audit = auditArchitectureHeuristics(singleEc2Diagram);
      expect(audit.some((msg) => msg.includes('Single Point of Failure'))).toBe(true);
    });

    it('parses AI-generated Mermaid response', () => {
      const aiResponse = `Here is a highly available serverless architecture:
\`\`\`mermaid
flowchart LR
  Client --> APIGW["API Gateway"]
  APIGW --> Lambda["Process Order"]
  Lambda --> DynamoDB[("DynamoDB")]
\`\`\`
This architecture uses API Gateway to throttle traffic.`;

      const result = parseAIDiagramResponse(aiResponse);
      expect(result.success).toBe(true);
      expect(result.parsedDiagram?.nodes.length).toBe(4);
      expect(result.explanation).toContain('API Gateway to throttle');
    });

    it('parses AI patch suggestions and applies them immutably', () => {
      const aiPatchResponse = `I suggest adding an SQS queue between Lambda and DynamoDB:
\`\`\`json
{
  "title": "Decouple with SQS",
  "reason": "Prevents DynamoDB throttling during traffic spikes",
  "addNodes": [
    {
      "id": "sqs-buffer",
      "type": "aws-service",
      "label": "Order Queue (SQS)",
      "x": 250,
      "y": 150,
      "width": 160,
      "height": 70,
      "style": { "fill": "#1e293b", "stroke": "#ec4899", "strokeWidth": 2, "textColor": "#fff" }
    }
  ],
  "addEdges": [
    {
      "id": "edge-sqs",
      "sourceNodeId": "sqs-buffer",
      "targetNodeId": "dynamo-1",
      "type": "orthogonal",
      "lineStyle": "solid",
      "strokeColor": "#ec4899",
      "strokeWidth": 2
    }
  ]
}
\`\`\``;

      const patch = parseAIPatchResponse(aiPatchResponse);
      expect(patch).not.toBeNull();
      expect(patch?.title).toBe('Decouple with SQS');
      expect(patch?.addNodes?.length).toBe(1);

      const baseDiagram = createEmptyDiagram('Base');
      const patched = applyPatchToDiagram(baseDiagram, patch as DiagramPatch);
      expect(patched.nodes.some((n) => n.id === 'sqs-buffer')).toBe(true);
      expect(patched.edges.some((e) => e.id === 'edge-sqs')).toBe(true);
    });
  });

  describe('Curated Architectural Templates', () => {
    it('contains comprehensive pre-built templates for AWS, System Design, and DevOps', () => {
      expect(DIAGRAM_TEMPLATES.length).toBeGreaterThanOrEqual(4);

      const template3Tier = DIAGRAM_TEMPLATES.find((t) => t.id === 'tpl-aws-3tier');
      expect(template3Tier).toBeDefined();
      expect(template3Tier?.diagram.nodes.length).toBeGreaterThan(4);
      expect(template3Tier?.diagram.presentationSteps?.length).toBeGreaterThan(0);

      const templateServerless = DIAGRAM_TEMPLATES.find((t) => t.id === 'tpl-aws-serverless');
      expect(templateServerless).toBeDefined();

      const templateRAG = DIAGRAM_TEMPLATES.find((t) => t.id === 'tpl-genai-rag');
      expect(templateRAG).toBeDefined();
    });
  });

  describe('Diagram Workbook & Multi-sheet Management', () => {
    it('creates an empty workbook with initial sheet', () => {
      const wb = createEmptyWorkbook('Cloud Project');
      expect(wb.name).toBe('Cloud Project');
      expect(wb.sheets.length).toBe(1);
      expect(wb.activeSheetId).toBe(wb.sheets[0].id);
    });

    it('adds, renames, duplicates, and deletes sheets in a workbook', () => {
      let wb = createEmptyWorkbook('Enterprise Arch');
      saveWorkbook(wb);

      // Add sheet
      const { workbook: wbWith2, newSheet } = addSheetToWorkbook(wb, 'VPC Peering');
      wb = wbWith2;
      expect(wb.sheets.length).toBe(2);
      expect(wb.activeSheetId).toBe(newSheet.id);
      expect(newSheet.name).toBe('VPC Peering');

      // Rename sheet
      wb = renameSheetInWorkbook(wb, newSheet.id, 'Cross-Region Transit Gateway');
      expect(wb.sheets.find((s) => s.id === newSheet.id)?.name).toBe('Cross-Region Transit Gateway');

      // Duplicate sheet
      const { workbook: wbWith3, copySheet } = duplicateSheetInWorkbook(wb, newSheet.id);
      wb = wbWith3;
      expect(wb.sheets.length).toBe(3);
      expect(copySheet.name).toBe('Cross-Region Transit Gateway (Copy)');
      expect(wb.activeSheetId).toBe(copySheet.id);

      // Delete sheet
      wb = deleteSheetFromWorkbook(wb, copySheet.id);
      expect(wb.sheets.length).toBe(2);
      expect(wb.sheets.some((s) => s.id === copySheet.id)).toBe(false);
    });

    it('loads workbook and migrates legacy diagram data if present', () => {
      // Setup legacy diagram in storage
      const legacyDiag = createEmptyDiagram('Legacy Migration Test');
      legacyDiag.nodes.push({
        id: 'legacy-node-1',
        type: 'rectangle',
        label: 'Legacy Gateway',
        x: 50,
        y: 50,
        width: 120,
        height: 60,
        style: { fill: '#333', stroke: '#fff', strokeWidth: 1 },
      });
      saveDiagram(legacyDiag);

      // Load workbook should detect and migrate legacy diagram
      const wb = loadWorkbook();
      expect(wb.sheets.length).toBeGreaterThanOrEqual(1);
      const migrated = wb.sheets.find((s) => s.id === legacyDiag.id);
      expect(migrated).toBeDefined();
      expect(migrated?.nodes[0]?.label).toBe('Legacy Gateway');
    });
  });
});
