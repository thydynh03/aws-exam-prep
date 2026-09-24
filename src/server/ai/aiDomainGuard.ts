/**
 * Domain Relevance & Scope Guard for AWS Certification AI Assistant
 *
 * Checks if incoming question relates to:
 * - AWS Services (EC2, S3, RDS, DynamoDB, Lambda, VPC, IAM, etc.)
 * - Cloud Architecture & Solutions Architect Exam (SAA-C03, SAP-C02, etc.)
 * - DevOps, Cloud Networking, Cloud Security, FinOps, Cloud Migration
 *
 * If question is clearly unrelated (e.g. cooking, celebrities, unrelated politics),
 * provides an in-scope / out-of-scope classification and safe fallback response.
 */

export type ScopeClassification = 'IN_SCOPE' | 'OUT_OF_SCOPE' | 'AMBIGUOUS' | 'MALICIOUS';

export interface DomainCheckResult {
  classification: ScopeClassification;
  confidence: number;
  matchedKeywords: string[];
  suggestedResponse?: string;
}

const AWS_CLOUD_KEYWORDS = [
  'aws', 'amazon', 'cloud', 's3', 'ec2', 'lambda', 'rds', 'dynamodb', 'vpc', 'iam',
  'cloudfront', 'route 53', 'route53', 'sqs', 'sns', 'kms', 'ecs', 'eks', 'fargate',
  'cloudwatch', 'cloudtrail', 'secrets manager', 'parameter store', 'ssm', 'elb', 'alb', 'nlb',
  'ebs', 'efs', 's3 glacier', 'glacier', 'elasticache', 'redis', 'memcached', 'redshift',
  'athena', 'glue', 'kinesis', 'step functions', 'eventbridge', 'waf', 'shield', 'cognito',
  'direct connect', 'transit gateway', 'vpn', 'nat gateway', 'internet gateway', 'subnet',
  'auto scaling', 'asg', 'cloudformation', 'cdk', 'well-architected', 'high availability',
  'disaster recovery', 'rpo', 'rto', 'multi-az', 'read replica', 'aurora', 'saa-c03', 'dva-c02',
  'soa-c02', 'ans-c01', 'scs-c02', 'solutions architect', 'exam', 'câu hỏi', 'đáp án', 'bài thi',
  'kiến trúc', 'bảo mật', 'phân quyền', 'mạng', 'lưu trữ', 'tính toán', 'chi phí', 'giá cước',
  'băng thông', 'độ trễ', 'throughput', 'iops', 'storage gateway', 'snowball', 'datasync',
  'tcp', 'http', 'https', 'udp', 'osi', 'tls', 'ssl', 'layer 4', 'layer 7', 'socket'
];

const EXPLICIT_OUT_OF_SCOPE_TOPICS = [
  'nấu ăn', 'recipe', 'cook', 'nấu phở', 'món ăn', 'bóng đá', 'thời tiết',
  'chiêm tinh', 'tử vi', 'bói toán', 'xổ số', 'lô đề', 'game crack', 'crypto pump',
  'phim ảnh', 'celebrity', 'chính trị thế giới', 'tình yêu', 'hẹn hò'
];

/**
 * Evaluates whether user query is in scope of AWS Certification & Cloud Architecture
 */
export function evaluateDomainScope(query: string, questionContextAvailable: boolean = false): DomainCheckResult {
  if (!query || !query.trim()) {
    return {
      classification: 'AMBIGUOUS',
      confidence: 0.1,
      matchedKeywords: [],
      suggestedResponse: 'Vui lòng cung cấp câu hỏi hoặc chủ đề AWS bạn muốn được giải đáp.',
    };
  }

  const lower = query.toLowerCase();

  // If user is currently solving an exam question on screen, questions like "Tại sao chọn A?", "Giải thích câu này" are automatically in scope
  if (questionContextAvailable) {
    return {
      classification: 'IN_SCOPE',
      confidence: 1.0,
      matchedKeywords: ['question_context_active'],
    };
  }

  // Check explicit out-of-scope keywords
  for (const oos of EXPLICIT_OUT_OF_SCOPE_TOPICS) {
    if (lower.includes(oos)) {
      return {
        classification: 'OUT_OF_SCOPE',
        confidence: 0.95,
        matchedKeywords: [oos],
        suggestedResponse: 'Câu hỏi này nằm ngoài phạm vi của Trợ lý AI Luyện Thi AWS. Hệ thống chỉ hỗ trợ giải đáp các dịch vụ đám mây AWS, kiến trúc giải pháp và nội dung bài thi chứng chỉ AWS.',
      };
    }
  }

  // Count matching AWS / Cloud keywords
  const matched = AWS_CLOUD_KEYWORDS.filter((kw) => {
    if (kw.length <= 3) {
      const reg = new RegExp(`\\b${kw}\\b`, 'i');
      return reg.test(lower);
    }
    return lower.includes(kw);
  });

  if (matched.length >= 1) {
    return {
      classification: 'IN_SCOPE',
      confidence: Math.min(0.7 + matched.length * 0.1, 1.0),
      matchedKeywords: matched,
    };
  }

  // General questions that might be broad cloud / architecture questions
  const genericTechKeywords = ['server', 'database', 'network', 'security', 'backup', 'cluster', 'failover', 'cache', 'proxy', 'api', 'load balancer', 'mã hóa', 'sao lưu', 'máy chủ', 'hạ tầng'];
  const techMatched = genericTechKeywords.filter((tk) => lower.includes(tk));

  if (techMatched.length >= 1) {
    return {
      classification: 'IN_SCOPE',
      confidence: 0.75,
      matchedKeywords: techMatched,
    };
  }

  // If query is short or unclear, classify as AMBIGUOUS
  if (lower.split(/\s+/).length < 4) {
    return {
      classification: 'AMBIGUOUS',
      confidence: 0.5,
      matchedKeywords: [],
      suggestedResponse: 'Câu hỏi của bạn chưa đủ thông tin ngữ cảnh AWS. Bạn có thể nêu rõ dịch vụ AWS (như S3, EC2, VPC, DynamoDB) hoặc tình huống kiến trúc cụ thể không?',
    };
  }

  // Default fallback: Outside current AWS scope
  return {
    classification: 'OUT_OF_SCOPE',
    confidence: 0.85,
    matchedKeywords: [],
    suggestedResponse: 'Câu hỏi này nằm ngoài phạm vi của Trợ lý AI Luyện Thi AWS. Hệ thống chỉ hỗ trợ giải đáp các dịch vụ đám mây AWS, kiến trúc giải pháp và nội dung bài thi chứng chỉ AWS.',
  };
}
