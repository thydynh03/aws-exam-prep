import React, { useState } from 'react';
import {
  Layers,
  Sparkles,
  Play,
  Sliders,
  Search,
  Lock,
  Unlock,
  Eye,
  EyeOff,
  Trash2,
  ChevronRight,
  ChevronLeft,
  Cpu,
  Palette,
} from 'lucide-react';
import type { Diagram, DiagramNode, DiagramEdge, PresentationStep } from '../../core/diagram/diagramTypes';
import { DIAGRAM_TEMPLATES } from '../../core/diagram/diagramTemplates';

type SidebarTab = 'services' | 'layers' | 'templates' | 'steps' | 'properties';

interface AWSLibraryItem {
  id: string;
  name: string;
  category: string;
  icon: string;
  color: string;
  defaultDescription: string;
}

const AWS_SERVICES_CATALOG: Record<string, AWSLibraryItem[]> = {
  Compute: [
    { id: 'ec2', name: 'Amazon EC2', category: 'Compute', icon: 'Cpu', color: '#f97316', defaultDescription: 'Virtual Servers in the Cloud' },
    { id: 'asg', name: 'Auto Scaling', category: 'Compute', icon: 'Cpu', color: '#f97316', defaultDescription: 'EC2 Auto Scaling Groups' },
    { id: 'lightsail', name: 'Amazon Lightsail', category: 'Compute', icon: 'Cpu', color: '#f97316', defaultDescription: 'Simple VPS' },
  ],
  Containers: [
    { id: 'ecs', name: 'Amazon ECS', category: 'Containers', icon: 'Box', color: '#8b5cf6', defaultDescription: 'Elastic Container Service' },
    { id: 'eks', name: 'Amazon EKS', category: 'Containers', icon: 'Layers', color: '#8b5cf6', defaultDescription: 'Managed Kubernetes Service' },
    { id: 'fargate', name: 'AWS Fargate', category: 'Containers', icon: 'Cpu', color: '#8b5cf6', defaultDescription: 'Serverless Container Engine' },
    { id: 'ecr', name: 'Amazon ECR', category: 'Containers', icon: 'Box', color: '#8b5cf6', defaultDescription: 'Container Registry' },
  ],
  Serverless: [
    { id: 'lambda', name: 'AWS Lambda', category: 'Serverless', icon: 'Zap', color: '#eab308', defaultDescription: 'Serverless Compute' },
    { id: 'apigw', name: 'API Gateway', category: 'Serverless', icon: 'Globe', color: '#f97316', defaultDescription: 'REST & WebSocket APIs' },
    { id: 'sqs', name: 'Amazon SQS', category: 'Serverless', icon: 'Layers', color: '#ec4899', defaultDescription: 'Message Queuing Service' },
    { id: 'sns', name: 'Amazon SNS', category: 'Serverless', icon: 'Zap', color: '#ec4899', defaultDescription: 'Pub/Sub Notifications' },
    { id: 'eventbridge', name: 'EventBridge', category: 'Serverless', icon: 'Layers', color: '#8b5cf6', defaultDescription: 'Serverless Event Bus' },
    { id: 'stepfunctions', name: 'Step Functions', category: 'Serverless', icon: 'Layers', color: '#ec4899', defaultDescription: 'Visual Workflows' },
  ],
  Storage: [
    { id: 's3', name: 'Amazon S3', category: 'Storage', icon: 'HardDrive', color: '#10b981', defaultDescription: 'Object Storage' },
    { id: 'ebs', name: 'Amazon EBS', category: 'Storage', icon: 'HardDrive', color: '#10b981', defaultDescription: 'Block Storage Volume' },
    { id: 'efs', name: 'Amazon EFS', category: 'Storage', icon: 'HardDrive', color: '#10b981', defaultDescription: 'Elastic File System' },
  ],
  Database: [
    { id: 'rds', name: 'Amazon RDS', category: 'Database', icon: 'Database', color: '#3b82f6', defaultDescription: 'Relational Database Service' },
    { id: 'aurora', name: 'Amazon Aurora', category: 'Database', icon: 'Database', color: '#3b82f6', defaultDescription: 'High-Performance Cloud DB' },
    { id: 'dynamodb', name: 'DynamoDB', category: 'Database', icon: 'Database', color: '#3b82f6', defaultDescription: 'NoSQL Key-Value Database' },
    { id: 'elasticache', name: 'ElastiCache', category: 'Database', icon: 'Zap', color: '#ec4899', defaultDescription: 'In-Memory Redis / Memcached' },
    { id: 'documentdb', name: 'DocumentDB', category: 'Database', icon: 'Database', color: '#3b82f6', defaultDescription: 'MongoDB-compatible DB' },
  ],
  Networking: [
    { id: 'vpc', name: 'Amazon VPC', category: 'Networking', icon: 'Shield', color: '#8b5cf6', defaultDescription: 'Isolated Virtual Cloud' },
    { id: 'alb', name: 'Application LB', category: 'Networking', icon: 'Globe', color: '#0284c7', defaultDescription: 'Layer-7 Load Balancer' },
    { id: 'nlb', name: 'Network LB', category: 'Networking', icon: 'Globe', color: '#0284c7', defaultDescription: 'Ultra High-Throughput LB' },
    { id: 'cloudfront', name: 'CloudFront', category: 'Networking', icon: 'Globe', color: '#a855f7', defaultDescription: 'Global Edge CDN' },
    { id: 'route53', name: 'Route 53', category: 'Networking', icon: 'Globe', color: '#a855f7', defaultDescription: 'Scalable DNS & Routing' },
  ],
  'AI & ML': [
    { id: 'bedrock', name: 'Amazon Bedrock', category: 'AI/ML', icon: 'Bot', color: '#a855f7', defaultDescription: 'Foundation Models (Claude, Llama)' },
    { id: 'sagemaker', name: 'SageMaker', category: 'AI/ML', icon: 'Bot', color: '#a855f7', defaultDescription: 'Build, Train, Deploy ML' },
    { id: 'opensearch', name: 'OpenSearch', category: 'AI/ML', icon: 'Search', color: '#06b6d4', defaultDescription: 'Vector Search Engine' },
  ],
  Security: [
    { id: 'iam', name: 'AWS IAM', category: 'Security', icon: 'Shield', color: '#ef4444', defaultDescription: 'Identity & Access Management' },
    { id: 'kms', name: 'AWS KMS', category: 'Security', icon: 'Shield', color: '#ef4444', defaultDescription: 'Key Management Service' },
    { id: 'waf', name: 'AWS WAF', category: 'Security', icon: 'Shield', color: '#ef4444', defaultDescription: 'Web Application Firewall' },
    { id: 'shield', name: 'AWS Shield', category: 'Security', icon: 'Shield', color: '#ef4444', defaultDescription: 'DDoS Protection' },
  ],
};

interface DiagramSidebarProps {
  diagram: Diagram;
  selectedNode: DiagramNode | null;
  selectedEdge: DiagramEdge | null;
  onAddAwsNode: (service: AWSLibraryItem) => void;
  onSelectNode: (nodeId: string | null) => void;
  onUpdateNode: (nodeId: string, changes: Partial<DiagramNode>) => void;
  onDeleteNode: (nodeId: string) => void;
  onToggleLockNode: (nodeId: string) => void;
  onToggleHideNode: (nodeId: string) => void;
  onUpdateEdge: (edgeId: string, changes: Partial<DiagramEdge>) => void;
  onDeleteEdge: (edgeId: string) => void;
  onLoadTemplate: (templateId: string) => void;
  onPlayStepFlow: (step: PresentationStep) => void;
  onAddPresentationStep: () => void;
  onDeletePresentationStep: (stepId: string) => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
}

export const DiagramSidebar: React.FC<DiagramSidebarProps> = ({
  diagram,
  selectedNode,
  selectedEdge,
  onAddAwsNode,
  onSelectNode,
  onUpdateNode,
  onDeleteNode,
  onToggleLockNode,
  onToggleHideNode,
  onUpdateEdge,
  onDeleteEdge,
  onLoadTemplate,
  onPlayStepFlow,
  onAddPresentationStep,
  onDeletePresentationStep,
  isCollapsed,
  onToggleCollapse,
}) => {
  const [activeTab, setActiveTab] = useState<SidebarTab>('services');
  const [searchQuery, setSearchQuery] = useState('');

  if (isCollapsed) {
    return (
      <div className="flex flex-col items-center py-3 px-1 bg-white border-r border-slate-200 dark:bg-slate-900 dark:border-slate-800 text-slate-600 dark:text-slate-400 z-10">
        <button
          onClick={onToggleCollapse}
          title="Mở rộng bảng công cụ"
          className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 transition-colors mb-3"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
        <div className="flex flex-col gap-3">
          <button
            onClick={() => {
              setActiveTab('services');
              onToggleCollapse();
            }}
            className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
            title="AWS Services"
          >
            <Cpu className="w-4 h-4 text-orange-500" />
          </button>
          <button
            onClick={() => {
              setActiveTab('layers');
              onToggleCollapse();
            }}
            className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
            title="Layers"
          >
            <Layers className="w-4 h-4 text-blue-500" />
          </button>
          <button
            onClick={() => {
              setActiveTab('templates');
              onToggleCollapse();
            }}
            className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
            title="Templates"
          >
            <Sparkles className="w-4 h-4 text-purple-500" />
          </button>
          <button
            onClick={() => {
              setActiveTab('steps');
              onToggleCollapse();
            }}
            className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
            title="Step Walkthrough"
          >
            <Play className="w-4 h-4 text-emerald-500" />
          </button>
        </div>
      </div>
    );
  }

  // Switch to properties tab automatically when an object is selected
  const effectiveTab = (selectedNode || selectedEdge) && activeTab === 'services' ? 'properties' : activeTab;

  return (
    <div className="w-72 sm:w-80 flex flex-col bg-white border-r border-slate-200 dark:bg-slate-900 dark:border-slate-800 text-slate-800 dark:text-slate-100 z-10 shrink-0 h-full overflow-hidden select-none">
      {/* Tab Header */}
      <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 p-1">
        <div className="flex items-center gap-0.5 overflow-x-auto custom-scrollbar">
          <button
            onClick={() => setActiveTab('services')}
            className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 transition-all ${
              effectiveTab === 'services'
                ? 'bg-white text-blue-600 shadow-2xs dark:bg-slate-800 dark:text-blue-400'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            <Cpu className="w-3.5 h-3.5 text-orange-500" />
            <span>AWS</span>
          </button>
          <button
            onClick={() => setActiveTab('layers')}
            className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 transition-all ${
              effectiveTab === 'layers'
                ? 'bg-white text-blue-600 shadow-2xs dark:bg-slate-800 dark:text-blue-400'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            <Layers className="w-3.5 h-3.5 text-blue-500" />
            <span>Layers</span>
          </button>
          <button
            onClick={() => setActiveTab('templates')}
            className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 transition-all ${
              effectiveTab === 'templates'
                ? 'bg-white text-blue-600 shadow-2xs dark:bg-slate-800 dark:text-blue-400'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-purple-500" />
            <span>Mẫu</span>
          </button>
          <button
            onClick={() => setActiveTab('steps')}
            className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 transition-all ${
              effectiveTab === 'steps'
                ? 'bg-white text-blue-600 shadow-2xs dark:bg-slate-800 dark:text-blue-400'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            <Play className="w-3.5 h-3.5 text-emerald-500" />
            <span>Flow</span>
          </button>
          {(selectedNode || selectedEdge) && (
            <button
              onClick={() => setActiveTab('properties')}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 transition-all ${
                effectiveTab === 'properties'
                  ? 'bg-white text-blue-600 shadow-2xs dark:bg-slate-800 dark:text-blue-400'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              <Sliders className="w-3.5 h-3.5 text-indigo-500" />
              <span>Sửa</span>
            </button>
          )}
        </div>

        {/* Button ẩn panel bên trái */}
        <button
          type="button"
          onClick={onToggleCollapse}
          title="Ẩn panel bên trái (Thu gọn)"
          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors shrink-0 ml-1 cursor-pointer"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
      </div>

      {/* Tab Body */}
      <div className="flex-1 overflow-y-auto p-3 custom-scrollbar">
        {/* 1. AWS Services Library */}
        {effectiveTab === 'services' && (
          <div className="space-y-4">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-2.5 top-2.5 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Tìm dịch vụ AWS (EC2, S3, RDS...)..."
                className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-xs focus:outline-hidden focus:ring-2 focus:ring-blue-500 text-slate-800 dark:text-slate-100"
              />
            </div>

            {Object.entries(AWS_SERVICES_CATALOG).map(([category, items]) => {
              const filtered = items.filter(
                (item) =>
                  item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                  item.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
                  item.defaultDescription.toLowerCase().includes(searchQuery.toLowerCase())
              );
              if (filtered.length === 0) return null;

              return (
                <div key={category} className="space-y-1.5">
                  <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                    {category}
                  </h4>
                  <div className="grid grid-cols-2 gap-2">
                    {filtered.map((item) => (
                      <button
                        key={item.id}
                        onClick={() => onAddAwsNode(item)}
                        className="flex flex-col items-start p-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-850/60 hover:bg-blue-50 hover:border-blue-300 dark:hover:bg-slate-800 dark:hover:border-blue-500 transition-all text-left group cursor-pointer shadow-2xs"
                      >
                        <div className="flex items-center gap-1.5 w-full mb-1">
                          <span
                            className="w-2.5 h-2.5 rounded-full shrink-0"
                            style={{ backgroundColor: item.color }}
                          />
                          <span className="text-xs font-bold truncate group-hover:text-blue-600 dark:group-hover:text-blue-400">
                            {item.name}
                          </span>
                        </div>
                        <span className="text-[10px] text-slate-500 dark:text-slate-400 line-clamp-1">
                          {item.defaultDescription}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* 2. Layers / Object Tree */}
        {effectiveTab === 'layers' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
              <span>{diagram.nodes.length} nodes · {diagram.edges.length} edges</span>
            </div>

            <div className="space-y-1">
              {diagram.nodes.map((node) => (
                <div
                  key={node.id}
                  onClick={() => onSelectNode(node.id)}
                  className={`flex items-center justify-between p-2 rounded-lg text-xs cursor-pointer transition-colors ${
                    selectedNode?.id === node.id
                      ? 'bg-blue-50 border border-blue-300 text-blue-700 dark:bg-blue-950/60 dark:border-blue-800 dark:text-blue-300'
                      : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300'
                  }`}
                >
                  <div className="flex items-center gap-2 truncate">
                    <span
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ backgroundColor: node.style.stroke }}
                    />
                    <span className="truncate font-medium">{node.label.split('\n')[0] || node.id}</span>
                  </div>
                  <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => onToggleHideNode(node.id)}
                      className="p-1 rounded text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                      title={node.hidden ? 'Hiện' : 'Ẩn'}
                    >
                      {node.hidden ? <EyeOff className="w-3.5 h-3.5 text-rose-400" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                    <button
                      onClick={() => onToggleLockNode(node.id)}
                      className="p-1 rounded text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                      title={node.locked ? 'Mở khóa' : 'Khóa'}
                    >
                      {node.locked ? <Lock className="w-3.5 h-3.5 text-amber-500" /> : <Unlock className="w-3.5 h-3.5" />}
                    </button>
                    <button
                      onClick={() => onDeleteNode(node.id)}
                      className="p-1 rounded text-rose-400 hover:text-rose-600"
                      title="Xóa"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 3. Templates Library */}
        {effectiveTab === 'templates' && (
          <div className="space-y-3">
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Chọn mẫu kiến trúc tiêu chuẩn để nạp nhanh lên canvas
            </p>
            <div className="space-y-2.5">
              {DIAGRAM_TEMPLATES.map((tpl) => (
                <div
                  key={tpl.id}
                  className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-850/60 hover:border-blue-400 dark:hover:border-blue-600 transition-all text-left space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300">
                      {tpl.category}
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono">
                      {tpl.diagram.nodes.length} nodes
                    </span>
                  </div>
                  <h4 className="text-xs font-bold text-slate-800 dark:text-slate-100 leading-snug">
                    {tpl.title}
                  </h4>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-2">
                    {tpl.description}
                  </p>
                  <button
                    onClick={() => onLoadTemplate(tpl.id)}
                    className="w-full py-1.5 px-3 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold transition-colors flex items-center justify-center gap-1.5"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Nạp mẫu này</span>
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 4. Presentation Steps */}
        {effectiveTab === 'steps' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-600 dark:text-slate-300">Các bước trình chiếu</span>
              <button
                onClick={onAddPresentationStep}
                className="px-2 py-1 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white transition-colors"
              >
                + Thêm bước
              </button>
            </div>

            {(!diagram.presentationSteps || diagram.presentationSteps.length === 0) ? (
              <div className="text-center py-6 text-xs text-slate-400">
                Chưa có bước trình chiếu nào. Nhấn "+ Thêm bước" để bắt đầu tạo kịch bản giải thích kiến trúc.
              </div>
            ) : (
              <div className="space-y-2">
                {diagram.presentationSteps.map((step) => (
                  <div
                    key={step.id}
                    className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-850/60 space-y-1.5"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-emerald-600 text-white text-[10px] font-bold flex items-center justify-center">
                          {step.stepNumber}
                        </span>
                        <span className="text-xs font-bold text-slate-800 dark:text-slate-100 truncate">
                          {step.title}
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => onPlayStepFlow(step)}
                          className="p-1 rounded text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40"
                          title="Chạy bước này"
                        >
                          <Play className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => onDeletePresentationStep(step.id)}
                          className="p-1 rounded text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                          title="Xóa bước"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      {step.explanation}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* 5. Properties Inspector */}
        {effectiveTab === 'properties' && (
          <div className="space-y-4">
            {selectedNode ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                    Thuộc tính Node
                  </span>
                  <button
                    onClick={() => onDeleteNode(selectedNode.id)}
                    className="p-1 rounded text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                    title="Xóa node"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                {/* Label */}
                <div className="space-y-1">
                  <label className="text-xs text-slate-600 dark:text-slate-400 font-medium">Nhãn (Label)</label>
                  <textarea
                    rows={2}
                    value={selectedNode.label}
                    onChange={(e) => onUpdateNode(selectedNode.id, { label: e.target.value })}
                    className="w-full p-2 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs focus:outline-hidden focus:ring-2 focus:ring-blue-500 text-slate-800 dark:text-slate-100"
                  />
                </div>

                {/* Colors */}
                <div className="space-y-1.5">
                  <label className="text-xs text-slate-600 dark:text-slate-400 font-medium flex items-center gap-1">
                    <Palette className="w-3.5 h-3.5" />
                    <span>Màu viền (Stroke Color)</span>
                  </label>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {['#38bdf8', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6', '#ef4444', '#f8fafc'].map((c) => (
                      <button
                        key={c}
                        onClick={() => onUpdateNode(selectedNode.id, { style: { ...selectedNode.style, stroke: c } })}
                        className={`w-6 h-6 rounded-full border-2 transition-transform ${
                          selectedNode.style.stroke === c ? 'scale-110 border-blue-500' : 'border-transparent'
                        }`}
                        style={{ backgroundColor: c }}
                      />
                    ))}
                  </div>
                </div>

                {/* Stroke Width */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-xs text-slate-600 dark:text-slate-400">
                    <span>Độ dày viền: {selectedNode.style.strokeWidth || 2}px</span>
                  </div>
                  <input
                    type="range"
                    min="1"
                    max="6"
                    value={selectedNode.style.strokeWidth || 2}
                    onChange={(e) =>
                      onUpdateNode(selectedNode.id, {
                        style: { ...selectedNode.style, strokeWidth: Number(e.target.value) },
                      })
                    }
                    className="w-full"
                  />
                </div>
              </div>
            ) : selectedEdge ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                    Thuộc tính Đường nối
                  </span>
                  <button
                    onClick={() => onDeleteEdge(selectedEdge.id)}
                    className="p-1 rounded text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                    title="Xóa đường nối"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                <div className="space-y-1">
                  <label className="text-xs text-slate-600 dark:text-slate-400 font-medium">Nhãn kết nối</label>
                  <input
                    type="text"
                    value={selectedEdge.label || ''}
                    onChange={(e) => onUpdateEdge(selectedEdge.id, { label: e.target.value })}
                    placeholder="VD: HTTPS, SQL Query, Sync..."
                    className="w-full p-2 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs focus:outline-hidden focus:ring-2 focus:ring-blue-500 text-slate-800 dark:text-slate-100"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs text-slate-600 dark:text-slate-400 font-medium">Kiểu đường nét</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => onUpdateEdge(selectedEdge.id, { lineStyle: 'solid' })}
                      className={`p-1.5 rounded-lg text-xs font-medium border ${
                        selectedEdge.lineStyle === 'solid'
                          ? 'border-blue-500 bg-blue-50 dark:bg-blue-950 text-blue-600'
                          : 'border-slate-200 dark:border-slate-700'
                      }`}
                    >
                      Liền nét (Solid)
                    </button>
                    <button
                      onClick={() => onUpdateEdge(selectedEdge.id, { lineStyle: 'dashed' })}
                      className={`p-1.5 rounded-lg text-xs font-medium border ${
                        selectedEdge.lineStyle === 'dashed'
                          ? 'border-blue-500 bg-blue-50 dark:bg-blue-950 text-blue-600'
                          : 'border-slate-200 dark:border-slate-700'
                      }`}
                    >
                      Nét đứt (Dashed)
                    </button>
                  </div>
                </div>

                {/* Animated Flow Toggle */}
                <div className="flex items-center justify-between p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs">
                  <span className="font-medium">Chạy luồng dữ liệu (Flow)</span>
                  <input
                    type="checkbox"
                    checked={!!selectedEdge.animated}
                    onChange={(e) => onUpdateEdge(selectedEdge.id, { animated: e.target.checked })}
                    className="w-4 h-4 text-blue-600 rounded"
                  />
                </div>
              </div>
            ) : (
              <div className="text-center py-8 text-xs text-slate-400">
                Chọn một đối tượng trên canvas để tinh chỉnh thuộc tính
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
