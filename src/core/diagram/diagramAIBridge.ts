import type { Diagram, DiagramPatch } from './diagramTypes';
import { parseMermaidToDiagram } from './mermaidToDiagram';
import { generateId } from './diagramStorage';

/**
 * Serializes the diagram into a clear, structured markdown/text format for AI prompts
 */
export function diagramToContextText(diagram: Diagram, selectedNodeId?: string | null): string {
  if (!diagram || diagram.nodes.length === 0) {
    return 'The diagram is currently empty.';
  }

  const lines: string[] = [];
  lines.push(`### Diagram Name: "${diagram.name}"`);
  if (diagram.description) lines.push(`Description: ${diagram.description}`);
  lines.push(`Total Components: ${diagram.nodes.length}, Total Connections: ${diagram.edges.length}\n`);

  if (diagram.frames.length > 0) {
    lines.push('#### Boundaries / Groups / VPCs:');
    diagram.frames.forEach((f) => {
      lines.push(`- Frame "${f.title}" (ID: ${f.id})`);
    });
    lines.push('');
  }

  lines.push('#### Nodes / Services:');
  diagram.nodes.forEach((n) => {
    const isSelected = n.id === selectedNodeId ? ' [SELECTED FOCUS]' : '';
    const category = n.data?.serviceCategory ? ` (${n.data.serviceCategory})` : '';
    const label = n.label.replace(/\n/g, ' - ');
    lines.push(`- [${n.id}] ${label}${category}${isSelected}`);
  });
  lines.push('');

  lines.push('#### Data Flow & Connections:');
  diagram.edges.forEach((e) => {
    const sNode = diagram.nodes.find((n) => n.id === e.sourceNodeId);
    const tNode = diagram.nodes.find((n) => n.id === e.targetNodeId);
    const sName = sNode ? sNode.label.split('\n')[0] : e.sourceNodeId;
    const tName = tNode ? tNode.label.split('\n')[0] : e.targetNodeId;
    const lbl = e.label ? ` via "${e.label}"` : '';
    const style = e.lineStyle === 'dashed' ? ' (async/dashed)' : '';
    lines.push(`- ${sName} (${e.sourceNodeId}) ──> ${tName} (${e.targetNodeId})${lbl}${style}`);
  });

  if (selectedNodeId) {
    const sel = diagram.nodes.find((n) => n.id === selectedNodeId);
    if (sel) {
      lines.push('\n#### Selected Component in Focus:');
      lines.push(`- Component: "${sel.label.replace(/\n/g, ' ')}" [ID: ${sel.id}]`);
      const incoming = diagram.edges
        .filter((e) => e.targetNodeId === sel.id)
        .map((e) => diagram.nodes.find((n) => n.id === e.sourceNodeId)?.label.split('\n')[0] || e.sourceNodeId);
      const outgoing = diagram.edges
        .filter((e) => e.sourceNodeId === sel.id)
        .map((e) => diagram.nodes.find((n) => n.id === e.targetNodeId)?.label.split('\n')[0] || e.targetNodeId);
      lines.push(`  * Inbound Traffic from: ${incoming.length > 0 ? incoming.join(', ') : 'None'}`);
      lines.push(`  * Outbound Calls to: ${outgoing.length > 0 ? outgoing.join(', ') : 'None'}`);
    }
  }

  return lines.join('\n');
}

/**
 * Built-in static heuristic audit for AWS architecture common anti-patterns
 */
export function auditArchitectureHeuristics(diagram: Diagram): string[] {
  const issues: string[] = [];
  const nodes = diagram.nodes;
  const edges = diagram.edges;

  if (nodes.length === 0) return ['The canvas is empty. Add services or load a template.'];

  // Check EC2 single instance without ALB or ASG
  const ec2Nodes = nodes.filter((n) => /ec2|instance|server/i.test(n.label));
  const albNodes = nodes.filter((n) => /alb|nlb|load balancer|balancer/i.test(n.label));
  if (ec2Nodes.length === 1 && albNodes.length === 0) {
    issues.push('⚠️ Single EC2 Instance detected without Load Balancer or Auto Scaling Group (Potential Single Point of Failure).');
  }

  // Check Database without cache or replicas
  const dbNodes = nodes.filter((n) => /rds|database|mysql|postgres|aurora|dynamo/i.test(n.label));
  const cacheNodes = nodes.filter((n) => /cache|redis|memcached|elasticache/i.test(n.label));
  if (dbNodes.length > 0 && cacheNodes.length === 0) {
    issues.push('💡 High read traffic to Database could benefit from adding an in-memory caching tier (e.g. Amazon ElastiCache Redis).');
  }

  // Check Edge CDN
  const cfNodes = nodes.filter((n) => /cloudfront|cdn|edge/i.test(n.label));
  if (cfNodes.length === 0 && albNodes.length > 0) {
    issues.push('💡 Consider placing Amazon CloudFront in front of the Load Balancer to protect origin and cache static assets globally.');
  }

  // Check Async Queuing for Lambda / Services
  const lambdaNodes = nodes.filter((n) => /lambda|function/i.test(n.label));
  const sqsNodes = nodes.filter((n) => /sqs|queue|eventbridge|sns/i.test(n.label));
  if (lambdaNodes.length >= 2 && sqsNodes.length === 0) {
    issues.push('💡 Multiple Microservices/Lambdas communicate directly. Consider decoupling with Amazon SQS or EventBridge for fault tolerance.');
  }

  // Check orphan nodes
  nodes.forEach((n) => {
    const isConnected = edges.some((e) => e.sourceNodeId === n.id || e.targetNodeId === n.id);
    if (!isConnected && nodes.length > 1) {
      issues.push(`⚠️ Component "${n.label.split('\n')[0]}" is disconnected from the architecture.`);
    }
  });

  return issues;
}

/**
 * Prompts generator for Explain Mode
 */
export function buildExplainArchitecturePrompt(diagram: Diagram, selectedNodeId?: string | null): string {
  const context = diagramToContextText(diagram, selectedNodeId);
  return `You are an AWS Certified Solutions Architect Professional and System Design Tutor.
Analyze and explain the following cloud architecture diagram to a software engineer / learner.

${context}

Please structure your explanation in clear Vietnamese with:
1. 🌐 **Tổng quan kiến trúc** (Mục đích & Pattern kiến trúc này đang áp dụng: ví dụ 3-tier, Event-driven, RAG, Microservices...).
2. 🔄 **Luồng dữ liệu (Data Flow)**: Giải thích đường đi từng bước từ người dùng/client qua các tầng.
3. 🛡️ **Bảo mật & Tính sẵn sàng cao (High Availability)**: Phân tích cách hệ thống chống chịu sự cố (Multi-AZ, Decoupling, WAF).
4. 💰 **Tối ưu chi phí (Cost Optimization)**: Đánh giá các thành phần tốn kém và gợi ý cách tối ưu.
5. 🎓 **Bài học AWS Exam**: Các câu hỏi thi AWS SAA/SAP thường hỏi về mô hình này.`;
}

/**
 * Prompts generator for Validate Mode
 */
export function buildValidateArchitecturePrompt(diagram: Diagram): string {
  const context = diagramToContextText(diagram);
  const heuristics = auditArchitectureHeuristics(diagram);

  return `You are an AWS Principal Well-Architected Reviewer.
Review the following architecture according to the AWS Well-Architected Framework (Reliability, Security, Performance, Cost, Operational Excellence).

${context}

Heuristic Pre-Checks:
${heuristics.map((h) => `- ${h}`).join('\n')}

Vui lòng phân tích và trả về báo cáo đánh giá kiến trúc:
1. 🚨 **Điểm nghẽn & Single Points of Failure (SPOF)**
2. 🔒 **Rủi ro bảo mật (Security Risks & Network Isolation)**
3. 📈 **Khả năng mở rộng (Scalability & Bottlenecks)**
4. 💡 **Đề xuất cải tiến cụ thể (Actionable Recommendations)**: Liệt kê các dịch vụ AWS cần bổ sung (VD: SQS, CloudFront, Multi-AZ, Read Replica...).`;
}

/**
 * Prompts generator for Diagram Generation from user text
 */
export function buildGenerateDiagramPrompt(userPrompt: string): string {
  return `You are an AWS Solutions Architect & Visual Diagram Generator.
The user wants to generate an AWS or System Design Architecture diagram based on this request:
"${userPrompt}"

Output your answer in TWO sections:
1. A brief 2-3 paragraph explanation of the architectural choices.
2. An exact Mermaid flowchart block (enclosed in \`\`\`mermaid ... \`\`\`) representing the architecture.

Rules for Mermaid:
- Use \`flowchart LR\` or \`flowchart TD\`
- Use descriptive node IDs and labels: \`User["Client Web/App"] --> ALB["Application Load Balancer"]\`
- Use subgraphs for VPC or Subnets if appropriate
- Edge labels: \`-->|HTTPS| \` or \`-->|SQL Query|\`
- Use known AWS services: S3, CloudFront, ALB, EC2, Lambda, DynamoDB, RDS, ElastiCache, SQS, SNS, EventBridge, Bedrock, OpenSearch, EKS.`;
}

/**
 * Prompts generator for Suggesting Next Component
 */
export function buildSuggestNextComponentPrompt(diagram: Diagram, userIdea?: string): string {
  const context = diagramToContextText(diagram);
  return `You are an interactive System Design pair-programmer.
Current Diagram:
${context}

User Idea / Context: ${userIdea || 'What should I add next to improve scalability, reliability, or security?'}

Please recommend the top 2-3 services or components to add next, why they fit, and where to connect them.`;
}

/**
 * Parse AI response to extract Mermaid diagram code or JSON
 */
export function parseAIDiagramResponse(aiContent: string): {
  success: boolean;
  explanation: string;
  parsedDiagram?: ReturnType<typeof parseMermaidToDiagram>;
  mermaidCode?: string;
} {
  const mermaidMatch = aiContent.match(/```(?:mermaid)\s*([\s\S]*?)```/i);
  if (mermaidMatch) {
    const mermaidCode = mermaidMatch[1].trim();
    try {
      const parsed = parseMermaidToDiagram(mermaidCode);
      const explanation = aiContent.replace(/```(?:mermaid)[\s\S]*?```/i, '').trim();
      return {
        success: true,
        explanation,
        parsedDiagram: parsed,
        mermaidCode,
      };
    } catch {
      // Fallback
    }
  }

  return {
    success: false,
    explanation: aiContent,
  };
}

/**
 * Parse AI response for visual diff patch
 */
export function parseAIPatchResponse(aiContent: string): DiagramPatch | null {
  const jsonMatch = aiContent.match(/```(?:json)\s*([\s\S]*?)```/i);
  if (!jsonMatch) return null;

  try {
    const parsed = JSON.parse(jsonMatch[1]);
    if (parsed && (parsed.addNodes || parsed.removeNodeIds || parsed.updateNodes || parsed.addEdges)) {
      return {
        id: generateId('patch'),
        title: parsed.title || 'AI Architecture Update',
        reason: parsed.reason || 'AI proposed architectural enhancements',
        addNodes: parsed.addNodes,
        removeNodeIds: parsed.removeNodeIds,
        updateNodes: parsed.updateNodes,
        addEdges: parsed.addEdges,
        removeEdgeIds: parsed.removeEdgeIds,
      };
    }
  } catch {
    return null;
  }
  return null;
}

/**
 * Applies a patch to a diagram immutably
 */
export function applyPatchToDiagram(diagram: Diagram, patch: DiagramPatch): Diagram {
  let nodes = [...diagram.nodes];
  let edges = [...diagram.edges];

  // Remove nodes
  if (patch.removeNodeIds && patch.removeNodeIds.length > 0) {
    const removeSet = new Set(patch.removeNodeIds);
    nodes = nodes.filter((n) => !removeSet.has(n.id));
    edges = edges.filter((e) => !removeSet.has(e.sourceNodeId) && !removeSet.has(e.targetNodeId));
  }

  // Update nodes
  if (patch.updateNodes) {
    patch.updateNodes.forEach(({ id, changes }) => {
      const idx = nodes.findIndex((n) => n.id === id);
      if (idx !== -1) {
        nodes[idx] = { ...nodes[idx], ...changes };
      }
    });
  }

  // Add nodes
  if (patch.addNodes && patch.addNodes.length > 0) {
    patch.addNodes.forEach((n) => {
      if (!nodes.some((existing) => existing.id === n.id)) {
        nodes.push(n);
      }
    });
  }

  // Remove edges
  if (patch.removeEdgeIds && patch.removeEdgeIds.length > 0) {
    const removeEdgeSet = new Set(patch.removeEdgeIds);
    edges = edges.filter((e) => !removeEdgeSet.has(e.id));
  }

  // Add edges
  if (patch.addEdges && patch.addEdges.length > 0) {
    patch.addEdges.forEach((e) => {
      if (!edges.some((existing) => existing.id === e.id)) {
        edges.push(e);
      }
    });
  }

  return {
    ...diagram,
    nodes,
    edges,
    updatedAt: Date.now(),
  };
}
