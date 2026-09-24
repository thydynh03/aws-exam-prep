import type { DiagramNode, DiagramEdge, AnchorPoint, AnchorDirection } from './diagramTypes';

export type AutoLayoutMode = 'hierarchical-horizontal' | 'hierarchical-vertical' | 'grid' | 'circular';

/**
 * Calculates anchor point coordinates for a node
 */
export function getAnchorPoint(node: DiagramNode, direction: AnchorDirection): AnchorPoint {
  const { x, y, width, height } = node;
  switch (direction) {
    case 'top':
      return { id: `${node.id}-top`, x: x + width / 2, y, direction: 'top' };
    case 'right':
      return { id: `${node.id}-right`, x: x + width, y: y + height / 2, direction: 'right' };
    case 'bottom':
      return { id: `${node.id}-bottom`, x: x + width / 2, y: y + height, direction: 'bottom' };
    case 'left':
      return { id: `${node.id}-left`, x, y: y + height / 2, direction: 'left' };
  }
}

/**
 * Calculate the best matching anchor pair between two nodes based on their relative positions
 */
export function getBestAnchorPair(
  source: DiagramNode,
  target: DiagramNode
): { sourceAnchor: AnchorDirection; targetAnchor: AnchorDirection } {
  const sCenter = { x: source.x + source.width / 2, y: source.y + source.height / 2 };
  const tCenter = { x: target.x + target.width / 2, y: target.y + target.height / 2 };

  const dx = tCenter.x - sCenter.x;
  const dy = tCenter.y - sCenter.y;

  if (Math.abs(dx) >= Math.abs(dy)) {
    // Horizontal dominant
    return dx > 0
      ? { sourceAnchor: 'right', targetAnchor: 'left' }
      : { sourceAnchor: 'left', targetAnchor: 'right' };
  } else {
    // Vertical dominant
    return dy > 0
      ? { sourceAnchor: 'bottom', targetAnchor: 'top' }
      : { sourceAnchor: 'top', targetAnchor: 'bottom' };
  }
}

/**
 * Generates clean orthogonal path waypoints between two points with direction
 */
export function computeOrthogonalWaypoints(
  source: { x: number; y: number; direction?: AnchorDirection },
  target: { x: number; y: number; direction?: AnchorDirection }
): Array<{ x: number; y: number }> {
  const points: Array<{ x: number; y: number }> = [{ x: source.x, y: source.y }];

  const sDir = source.direction || 'right';
  const tDir = target.direction || 'left';

  // Distance offset from anchor to start bending
  const stub = 24;

  let sStub = { x: source.x, y: source.y };
  if (sDir === 'right') sStub = { x: source.x + stub, y: source.y };
  else if (sDir === 'left') sStub = { x: source.x - stub, y: source.y };
  else if (sDir === 'top') sStub = { x: source.x, y: source.y - stub };
  else if (sDir === 'bottom') sStub = { x: source.x, y: source.y + stub };

  let tStub = { x: target.x, y: target.y };
  if (tDir === 'right') tStub = { x: target.x + stub, y: target.y };
  else if (tDir === 'left') tStub = { x: target.x - stub, y: target.y };
  else if (tDir === 'top') tStub = { x: target.x, y: target.y - stub };
  else if (tDir === 'bottom') tStub = { x: target.x, y: target.y + stub };

  points.push(sStub);

  // Connect sStub to tStub with orthogonal mid-segment
  if (sDir === 'right' || sDir === 'left') {
    if (tDir === 'right' || tDir === 'left') {
      const midX = (sStub.x + tStub.x) / 2;
      points.push({ x: midX, y: sStub.y });
      points.push({ x: midX, y: tStub.y });
    } else {
      points.push({ x: tStub.x, y: sStub.y });
    }
  } else {
    // sDir is top or bottom
    if (tDir === 'top' || tDir === 'bottom') {
      const midY = (sStub.y + tStub.y) / 2;
      points.push({ x: sStub.x, y: midY });
      points.push({ x: tStub.x, y: midY });
    } else {
      points.push({ x: sStub.x, y: tStub.y });
    }
  }

  points.push(tStub);
  points.push({ x: target.x, y: target.y });

  // Clean redundant straight points
  return simplifyPoints(points);
}

function simplifyPoints(pts: Array<{ x: number; y: number }>): Array<{ x: number; y: number }> {
  if (pts.length <= 2) return pts;
  const result: Array<{ x: number; y: number }> = [pts[0]];
  for (let i = 1; i < pts.length - 1; i++) {
    const prev = result[result.length - 1];
    const curr = pts[i];
    const next = pts[i + 1];

    // Check if colinear horizontally or vertically
    const isColinearH = Math.abs(prev.y - curr.y) < 1 && Math.abs(curr.y - next.y) < 1;
    const isColinearV = Math.abs(prev.x - curr.x) < 1 && Math.abs(curr.x - next.x) < 1;

    if (!isColinearH && !isColinearV) {
      result.push(curr);
    }
  }
  result.push(pts[pts.length - 1]);
  return result;
}

/**
 * Executes automatic layout on nodes and edges
 */
export function applyAutoLayout(
  nodes: DiagramNode[],
  edges: DiagramEdge[],
  mode: AutoLayoutMode = 'hierarchical-horizontal',
  options?: { spacingX?: number; spacingY?: number; startX?: number; startY?: number }
): { nodes: DiagramNode[]; edges: DiagramEdge[] } {
  if (nodes.length === 0) return { nodes, edges };

  const spacingX = options?.spacingX ?? (mode === 'hierarchical-horizontal' ? 240 : 200);
  const spacingY = options?.spacingY ?? (mode === 'hierarchical-horizontal' ? 140 : 180);
  const startX = options?.startX ?? 80;
  const startY = options?.startY ?? 80;

  const nodeMap = new Map(nodes.map((n) => [n.id, { ...n }]));

  if (mode === 'grid') {
    const cols = Math.ceil(Math.sqrt(nodes.length));
    nodes.forEach((n, idx) => {
      const col = idx % cols;
      const row = Math.floor(idx / cols);
      const updated = nodeMap.get(n.id)!;
      updated.x = startX + col * spacingX;
      updated.y = startY + row * spacingY;
    });
  } else if (mode === 'circular') {
    const radius = Math.max(180, nodes.length * 35);
    const centerX = startX + radius;
    const centerY = startY + radius;
    const step = (2 * Math.PI) / nodes.length;
    nodes.forEach((n, idx) => {
      const angle = idx * step;
      const updated = nodeMap.get(n.id)!;
      updated.x = Math.round(centerX + radius * Math.cos(angle) - n.width / 2);
      updated.y = Math.round(centerY + radius * Math.sin(angle) - n.height / 2);
    });
  } else {
    // Hierarchical layout (Horizontal or Vertical)
    const inDegree = new Map<string, number>();
    nodes.forEach((n) => inDegree.set(n.id, 0));
    edges.forEach((e) => {
      if (inDegree.has(e.targetNodeId)) {
        inDegree.set(e.targetNodeId, (inDegree.get(e.targetNodeId) || 0) + 1);
      }
    });

    const levels = new Map<string, number>();
    const roots = nodes.filter((n) => (inDegree.get(n.id) || 0) === 0);
    const queue = roots.length > 0 ? roots.map((n) => n.id) : [nodes[0].id];
    queue.forEach((id) => levels.set(id, 0));

    const visited = new Set<string>();
    while (queue.length > 0) {
      const curr = queue.shift()!;
      visited.add(curr);
      const currLevel = levels.get(curr) || 0;

      const outgoing = edges.filter((e) => e.sourceNodeId === curr);
      for (const e of outgoing) {
        const nextLvl = levels.get(e.targetNodeId) ?? -1;
        if (nextLvl < currLevel + 1) {
          levels.set(e.targetNodeId, currLevel + 1);
        }
        if (!visited.has(e.targetNodeId) && !queue.includes(e.targetNodeId)) {
          queue.push(e.targetNodeId);
        }
      }
    }

    nodes.forEach((n) => {
      if (!levels.has(n.id)) levels.set(n.id, 0);
    });

    const levelGroups = new Map<number, string[]>();
    nodes.forEach((n) => {
      const lvl = levels.get(n.id) || 0;
      const list = levelGroups.get(lvl) || [];
      list.push(n.id);
      levelGroups.set(lvl, list);
    });

    const isHorizontal = mode === 'hierarchical-horizontal';
    Array.from(levelGroups.entries()).forEach(([lvl, ids]) => {
      ids.forEach((id, index) => {
        const node = nodeMap.get(id)!;
        if (isHorizontal) {
          node.x = startX + lvl * spacingX;
          node.y = startY + index * spacingY;
        } else {
          node.x = startX + index * spacingX;
          node.y = startY + lvl * spacingY;
        }
      });
    });
  }

  // Update edges with best anchor pairs
  const updatedEdges = edges.map((edge) => {
    const sNode = nodeMap.get(edge.sourceNodeId);
    const tNode = nodeMap.get(edge.targetNodeId);
    if (!sNode || !tNode) return edge;
    const { sourceAnchor, targetAnchor } = getBestAnchorPair(sNode, tNode);
    return {
      ...edge,
      sourceAnchor,
      targetAnchor,
    };
  });

  return {
    nodes: Array.from(nodeMap.values()),
    edges: updatedEdges,
  };
}
