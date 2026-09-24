import type { DiagramNode, DiagramEdge, DiagramFrame, ShapeType } from './diagramTypes';
import { generateId } from './diagramStorage';

const AWS_KEYWORD_MAP: Record<string, { category: string; stroke: string; icon: string }> = {
  s3: { category: 'Storage', stroke: '#10b981', icon: 'HardDrive' },
  bucket: { category: 'Storage', stroke: '#10b981', icon: 'HardDrive' },
  lambda: { category: 'Serverless', stroke: '#eab308', icon: 'Zap' },
  function: { category: 'Serverless', stroke: '#eab308', icon: 'Zap' },
  dynamo: { category: 'Database', stroke: '#3b82f6', icon: 'Database' },
  dynamodb: { category: 'Database', stroke: '#3b82f6', icon: 'Database' },
  rds: { category: 'Database', stroke: '#3b82f6', icon: 'Database' },
  aurora: { category: 'Database', stroke: '#3b82f6', icon: 'Database' },
  redis: { category: 'Database', stroke: '#ec4899', icon: 'Zap' },
  elasticache: { category: 'Database', stroke: '#ec4899', icon: 'Zap' },
  ec2: { category: 'Compute', stroke: '#f97316', icon: 'Cpu' },
  asg: { category: 'Compute', stroke: '#f97316', icon: 'Cpu' },
  alb: { category: 'Networking', stroke: '#0284c7', icon: 'Network' },
  nlb: { category: 'Networking', stroke: '#0284c7', icon: 'Network' },
  apigateway: { category: 'Serverless', stroke: '#f97316', icon: 'Network' },
  api_gateway: { category: 'Serverless', stroke: '#f97316', icon: 'Network' },
  sqs: { category: 'Serverless', stroke: '#ec4899', icon: 'Layers' },
  queue: { category: 'Serverless', stroke: '#ec4899', icon: 'Layers' },
  sns: { category: 'Serverless', stroke: '#ec4899', icon: 'Bell' },
  topic: { category: 'Serverless', stroke: '#ec4899', icon: 'Bell' },
  eventbridge: { category: 'Serverless', stroke: '#8b5cf6', icon: 'Workflow' },
  cloudfront: { category: 'Networking', stroke: '#a855f7', icon: 'Globe' },
  cdn: { category: 'Networking', stroke: '#a855f7', icon: 'Globe' },
  route53: { category: 'Networking', stroke: '#a855f7', icon: 'Globe' },
  dns: { category: 'Networking', stroke: '#a855f7', icon: 'Globe' },
  bedrock: { category: 'AI/ML', stroke: '#a855f7', icon: 'Bot' },
  opensearch: { category: 'Database', stroke: '#06b6d4', icon: 'Search' },
  eks: { category: 'Containers', stroke: '#8b5cf6', icon: 'Layers' },
  ecs: { category: 'Containers', stroke: '#8b5cf6', icon: 'Box' },
  fargate: { category: 'Containers', stroke: '#8b5cf6', icon: 'Cpu' },
  vpc: { category: 'Networking', stroke: '#8b5cf6', icon: 'Shield' },
  iam: { category: 'Security', stroke: '#ef4444', icon: 'Lock' },
  kms: { category: 'Security', stroke: '#ef4444', icon: 'Key' },
  waf: { category: 'Security', stroke: '#ef4444', icon: 'Shield' },
};

function matchAwsMeta(text: string): { isAws: boolean; category: string; stroke: string; icon: string } {
  const lower = text.toLowerCase();
  for (const [kw, meta] of Object.entries(AWS_KEYWORD_MAP)) {
    if (lower.includes(kw)) {
      return { isAws: true, ...meta };
    }
  }
  return { isAws: false, category: 'General', stroke: '#38bdf8', icon: 'Box' };
}

export interface ParsedMermaidResult {
  nodes: DiagramNode[];
  edges: DiagramEdge[];
  frames: DiagramFrame[];
  direction: 'TB' | 'LR' | 'RL' | 'BT';
}

/**
 * Parses Mermaid flowchart code into Diagram nodes, edges, and frames
 */
export function parseMermaidToDiagram(mermaidCode: string): ParsedMermaidResult {
  const lines = mermaidCode.split('\n').map((l) => l.trim()).filter((l) => l && !l.startsWith('%%'));
  let direction: 'TB' | 'LR' | 'RL' | 'BT' = 'TB';

  const nodeMap = new Map<string, { label: string; shape: ShapeType }>();
  const rawEdges: Array<{
    source: string;
    target: string;
    label?: string;
    dashed?: boolean;
  }> = [];
  const frames: DiagramFrame[] = [];
  let currentSubgraph: { id: string; title: string } | null = null;
  const nodeToFrame = new Map<string, string>();

  // Determine direction
  const headerLine = lines.find((l) => /^(graph|flowchart)\s+/i.test(l));
  if (headerLine) {
    if (/LR/i.test(headerLine)) direction = 'LR';
    else if (/RL/i.test(headerLine)) direction = 'RL';
    else if (/BT/i.test(headerLine)) direction = 'BT';
    else direction = 'TB';
  }

  for (const line of lines) {
    // Skip graph header
    if (/^(graph|flowchart)\s+/i.test(line)) continue;

    // Subgraph start: subgraph SubId ["Sub Title"] or subgraph SubId
    const subMatch = line.match(/^subgraph\s+([A-Za-z0-9_-]+)(?:\s*\["?([^"\]]+)"?\])?/i);
    if (subMatch) {
      const subId = subMatch[1];
      const subTitle = subMatch[2] || subId;
      currentSubgraph = { id: subId, title: subTitle };
      frames.push({
        id: `frame_${subId}`,
        title: subTitle,
        x: 0,
        y: 0,
        width: 400,
        height: 300,
        style: { fill: '#0f172a15', stroke: '#8b5cf6', strokeDash: 'dashed' },
      });
      continue;
    }

    if (/^end$/i.test(line)) {
      currentSubgraph = null;
      continue;
    }

    // Edge matching: A --> B or A -->|label| B or A -- label --> B or A -.-> B
    // Regex for edge with labels
    const edgeMatch = line.match(
      /^([A-Za-z0-9_-]+(?:\[\([^)]+\)\]|\(\[[^\]]+\]\)|\(\([^)]+\)\)|\[[^\]]+\]|\([^)]+\)|\{[^}]+\})?)\s*(-->\|[^|]+\|?|-->|--\s*"?([^"-]+)"?\s*-->?|-\.->\|[^|]+\|?|-\.->|==>)\s*([A-Za-z0-9_-]+(?:\[\([^)]+\)\]|\(\[[^\]]+\]\)|\(\([^)]+\)\)|\[[^\]]+\]|\([^)]+\)|\{[^}]+\})?)/
    );

    if (edgeMatch) {
      const rawSource = edgeMatch[1];
      const connector = edgeMatch[2];
      const rawTarget = edgeMatch[4];

      const sParsed = extractNodeDef(rawSource);
      const tParsed = extractNodeDef(rawTarget);

      if (sParsed.id) {
        const existingS = nodeMap.get(sParsed.id);
        const hasCustomLabel = sParsed.label && sParsed.label !== sParsed.id;
        nodeMap.set(sParsed.id, {
          label: hasCustomLabel ? sParsed.label! : existingS?.label || sParsed.id,
          shape: sParsed.shape !== 'rectangle' ? sParsed.shape : existingS?.shape || 'rectangle',
        });
        if (currentSubgraph) nodeToFrame.set(sParsed.id, `frame_${currentSubgraph.id}`);
      }
      if (tParsed.id) {
        const existingT = nodeMap.get(tParsed.id);
        const hasCustomLabel = tParsed.label && tParsed.label !== tParsed.id;
        nodeMap.set(tParsed.id, {
          label: hasCustomLabel ? tParsed.label! : existingT?.label || tParsed.id,
          shape: tParsed.shape !== 'rectangle' ? tParsed.shape : existingT?.shape || 'rectangle',
        });
        if (currentSubgraph) nodeToFrame.set(tParsed.id, `frame_${currentSubgraph.id}`);
      }

      let edgeLabel = '';
      const pipeMatch = connector.match(/\|([^|]+)\|/);
      if (pipeMatch) {
        edgeLabel = pipeMatch[1].trim();
      } else if (edgeMatch[3]) {
        edgeLabel = edgeMatch[3].trim();
      }

      const dashed = connector.includes('-.');

      if (sParsed.id && tParsed.id) {
        rawEdges.push({
          source: sParsed.id,
          target: tParsed.id,
          label: edgeLabel || undefined,
          dashed,
        });
      }
      continue;
    }

    // Standalone node definition: A["Label"] or A("Label") or A{"Decision"}
    const singleNode = extractNodeDef(line);
    if (singleNode.id) {
      const existing = nodeMap.get(singleNode.id);
      const hasCustomLabel = singleNode.label && singleNode.label !== singleNode.id;
      nodeMap.set(singleNode.id, {
        label: hasCustomLabel ? singleNode.label! : existing?.label || singleNode.id,
        shape: singleNode.shape !== 'rectangle' ? singleNode.shape : existing?.shape || 'rectangle',
      });
      if (currentSubgraph) {
        nodeToFrame.set(singleNode.id, `frame_${currentSubgraph.id}`);
      }
    }
  }

  // Position nodes in a simple layered hierarchy
  const nodes: DiagramNode[] = [];
  const nodeIds = Array.from(nodeMap.keys());
  const inDegree = new Map<string, number>();
  nodeIds.forEach((id) => inDegree.set(id, 0));
  rawEdges.forEach((e) => {
    inDegree.set(e.target, (inDegree.get(e.target) || 0) + 1);
  });

  // Layer assignment
  const levels = new Map<string, number>();
  const queue = nodeIds.filter((id) => (inDegree.get(id) || 0) === 0);
  queue.forEach((id) => levels.set(id, 0));

  let maxLevel = 0;
  // Breadth-first level assignment
  const visited = new Set<string>();
  while (queue.length > 0) {
    const curr = queue.shift()!;
    visited.add(curr);
    const currLvl = levels.get(curr) || 0;
    maxLevel = Math.max(maxLevel, currLvl);

    const outgoing = rawEdges.filter((e) => e.source === curr);
    for (const out of outgoing) {
      const targetLvl = levels.get(out.target) ?? -1;
      if (targetLvl < currLvl + 1) {
        levels.set(out.target, currLvl + 1);
      }
      if (!visited.has(out.target) && !queue.includes(out.target)) {
        queue.push(out.target);
      }
    }
  }

  // Any remaining unvisited get level 0 or maxLevel
  nodeIds.forEach((id) => {
    if (!levels.has(id)) levels.set(id, 0);
  });

  // Group nodes by level
  const levelGroups = new Map<number, string[]>();
  nodeIds.forEach((id) => {
    const lvl = levels.get(id) || 0;
    const list = levelGroups.get(lvl) || [];
    list.push(id);
    levelGroups.set(lvl, list);
  });

  const isLR = direction === 'LR' || direction === 'RL';
  const nodeW = 160;
  const nodeH = 75;
  const spacingX = isLR ? 240 : 200;
  const spacingY = isLR ? 130 : 160;
  const startX = 60;
  const startY = 80;

  // Calculate coordinates
  Array.from(levelGroups.entries()).forEach(([lvl, ids]) => {
    ids.forEach((id, idx) => {
      const def = nodeMap.get(id)!;
      const meta = matchAwsMeta(def.label);

      let x: number;
      let y: number;

      if (isLR) {
        x = startX + lvl * spacingX;
        y = startY + idx * spacingY;
      } else {
        x = startX + idx * spacingX;
        y = startY + lvl * spacingY;
      }

      nodes.push({
        id,
        type: meta.isAws ? 'aws-service' : def.shape,
        label: def.label,
        x,
        y,
        width: nodeW,
        height: nodeH,
        style: {
          fill: '#1e293b',
          stroke: meta.stroke,
          strokeWidth: 2,
          textColor: '#f8fafc',
          borderRadius: def.shape === 'rounded-rect' ? 12 : 8,
        },
        data: {
          serviceCategory: meta.category,
          icon: meta.icon,
        },
        frameId: nodeToFrame.get(id),
      });
    });
  });

  // Build diagram edges
  const edges: DiagramEdge[] = rawEdges.map((e, index) => {
    const sNode = nodes.find((n) => n.id === e.source);
    const tNode = nodes.find((n) => n.id === e.target);
    const isHorizontal = isLR || (sNode && tNode && Math.abs(tNode.x - sNode.x) > Math.abs(tNode.y - sNode.y));

    return {
      id: generateId('edge'),
      sourceNodeId: e.source,
      targetNodeId: e.target,
      sourceAnchor: isHorizontal ? 'right' : 'bottom',
      targetAnchor: isHorizontal ? 'left' : 'top',
      type: 'orthogonal',
      lineStyle: e.dashed ? 'dashed' : 'solid',
      strokeColor: '#38bdf8',
      strokeWidth: 2,
      endArrow: 'arrow',
      label: e.label,
      animated: index === 0, // Animate first flow edge
    };
  });

  // Compute frame bounds from contained nodes
  frames.forEach((f) => {
    const memberNodes = nodes.filter((n) => n.frameId === f.id);
    if (memberNodes.length > 0) {
      const minX = Math.min(...memberNodes.map((n) => n.x)) - 30;
      const minY = Math.min(...memberNodes.map((n) => n.y)) - 50;
      const maxX = Math.max(...memberNodes.map((n) => n.x + n.width)) + 30;
      const maxY = Math.max(...memberNodes.map((n) => n.y + n.height)) + 30;
      f.x = minX;
      f.y = minY;
      f.width = Math.max(300, maxX - minX);
      f.height = Math.max(180, maxY - minY);
    }
  });

  return {
    nodes,
    edges,
    frames,
    direction,
  };
}

function extractNodeDef(raw: string): { id: string; label?: string; shape: ShapeType } {
  if (!raw) return { id: '', shape: 'rectangle' };
  const str = raw.trim();

  // Cylinder: id[(Label)]
  const cylMatch = str.match(/^([A-Za-z0-9_-]+)\[\(([^)]+)\)\]$/);
  if (cylMatch) {
    return { id: cylMatch[1], label: cleanLabel(cylMatch[2]), shape: 'cylinder' };
  }

  // Diamond: id{Label}
  const diaMatch = str.match(/^([A-Za-z0-9_-]+)\{([^}]+)\}$/);
  if (diaMatch) {
    return { id: diaMatch[1], label: cleanLabel(diaMatch[2]), shape: 'diamond' };
  }

  // Rounded / pill: id(Label) or id([Label])
  const pillMatch = str.match(/^([A-Za-z0-9_-]+)\(\[?([^\])]+)\]?\)$/);
  if (pillMatch) {
    return { id: pillMatch[1], label: cleanLabel(pillMatch[2]), shape: 'rounded-rect' };
  }

  // Circle: id((Label))
  const circMatch = str.match(/^([A-Za-z0-9_-]+)\(\(([^)]+)\)\)$/);
  if (circMatch) {
    return { id: circMatch[1], label: cleanLabel(circMatch[2]), shape: 'circle' };
  }

  // Square / Rectangle: id[Label]
  const rectMatch = str.match(/^([A-Za-z0-9_-]+)\[([^\]]+)\]$/);
  if (rectMatch) {
    return { id: rectMatch[1], label: cleanLabel(rectMatch[2]), shape: 'rectangle' };
  }

  // Plain identifier: id
  const plainMatch = str.match(/^([A-Za-z0-9_-]+)$/);
  if (plainMatch) {
    return { id: plainMatch[1], label: plainMatch[1], shape: 'rectangle' };
  }

  return { id: str.replace(/[^A-Za-z0-9_-]/g, '_'), label: str, shape: 'rectangle' };
}

function cleanLabel(raw: string): string {
  return raw.replace(/^["']|["']$/g, '').replace(/\\n/g, '\n').trim();
}
