/**
 * Prompt Rewrite & Question Understanding Service
 *
 * Responsibilities:
 * 1. Normalize query (remove filler words, punctuation, fix common typos).
 * 2. Strip prompt injection artifacts from the search query so vector/keyword retrieval
 *    is not tainted by injection instructions, while preserving security flags.
 * 3. Query expansion with AWS terminology (e.g. "s3" -> "Amazon S3 object storage").
 * 4. Intent detection & topic classification.
 */

export interface RewriteResult {
  originalQuery: string;
  normalizedQuery: string;
  rewrittenQuery: string;
  intent: 'QUESTION_SOLVING' | 'CONCEPT_EXPLANATION' | 'ARCHITECTURE_COMPARISON' | 'EXAM_TRAP_ANALYSIS' | 'TROUBLESHOOTING' | 'UNCLEAR';
  topic: 'Compute' | 'Storage' | 'Database' | 'Networking' | 'Security' | 'Management' | 'Application Integration' | 'Analytics' | 'General';
  rewriteReason: string;
}

const ACRONYM_EXPANSIONS: Record<string, string> = {
  s3: 'Amazon S3 (Simple Storage Service)',
  ec2: 'Amazon EC2 (Elastic Compute Cloud)',
  rds: 'Amazon RDS (Relational Database Service)',
  dynamodb: 'Amazon DynamoDB NoSQL',
  lambda: 'AWS Lambda Serverless Compute',
  vpc: 'Amazon VPC (Virtual Private Cloud)',
  iam: 'AWS IAM (Identity and Access Management)',
  alb: 'Application Load Balancer (ALB)',
  nlb: 'Network Load Balancer (NLB)',
  elb: 'Elastic Load Balancing (ELB)',
  kms: 'AWS KMS (Key Management Service)',
  sqs: 'Amazon SQS (Simple Queue Service)',
  sns: 'Amazon SNS (Simple Notification Service)',
  ebs: 'Amazon EBS (Elastic Block Store)',
  efs: 'Amazon EFS (Elastic File System)',
  asg: 'Auto Scaling Group (ASG)',
  r53: 'Amazon Route 53 DNS',
  route53: 'Amazon Route 53 DNS',
  tgw: 'AWS Transit Gateway',
  dx: 'AWS Direct Connect',
  cloudwatch: 'Amazon CloudWatch Monitoring & Logs',
  cloudtrail: 'AWS CloudTrail Audit & Governance',
  aga: 'AWS Global Accelerator',
  tcp: 'TCP (Transmission Control Protocol)',
  udp: 'UDP (User Datagram Protocol)',
};

// Patterns to strip from search queries so injections don't distort RAG retrieval
const INJECTION_STRIP_REGEX = /(?:ignore\s+(?:all\s+)?(?:previous|prior)\s+instructions|disregard\s+rules|system\s+prompt|reveal\s+secret|jailbreak|DAN\s+mode|as\s+an\s+unfiltered\s+assistant|do\s+anything\s+now)/gi;

/**
 * Rewrite, normalize and classify query for retrieval and memory
 */
export function rewritePrompt(rawQuery: string): RewriteResult {
  const originalQuery = (rawQuery || '').trim();
  let cleaned = originalQuery.replace(INJECTION_STRIP_REGEX, ' ').trim();

  // Normalize spaces & unicode
  cleaned = cleaned.replace(/\s+/g, ' ');

  // 1. Detect Intent
  let intent: RewriteResult['intent'] = 'CONCEPT_EXPLANATION';
  const lower = originalQuery.toLowerCase();

  if (
    lower.includes('câu này') ||
    lower.includes('đáp án') ||
    lower.includes('tại sao chọn') ||
    lower.includes('vì sao chọn') ||
    lower.includes('tại sao phải chọn') ||
    lower.includes('vì sao phải chọn') ||
    lower.includes('sao lại chọn') ||
    lower.includes('sao phải chọn') ||
    lower.includes('phải chọn') ||
    lower.includes('đề có cái gì') ||
    lower.includes('đề có gì') ||
    lower.includes('đề hỏi') ||
    lower.includes('đề yêu cầu') ||
    lower.includes('trong đề') ||
    lower.includes('yêu cầu của đề') ||
    lower.includes('dựa vào đề') ||
    lower.includes('phương án') ||
    lower.includes('lựa chọn') ||
    lower.includes('giải thích đề') ||
    lower.includes('giải thích câu') ||
    lower.includes('tại sao sai') ||
    lower.includes('tại sao đúng') ||
    lower.includes('chọn a') ||
    lower.includes('chọn b') ||
    lower.includes('chọn c') ||
    lower.includes('chọn d') ||
    lower.includes('chọn e')
  ) {
    intent = 'QUESTION_SOLVING';
  } else if (
    lower.includes('so sánh') ||
    lower.includes('khác gì') ||
    lower.includes('vs') ||
    lower.includes('phân biệt') ||
    lower.includes('compare') ||
    lower.includes('difference between')
  ) {
    intent = 'ARCHITECTURE_COMPARISON';
  } else if (
    lower.includes('bẫy') ||
    lower.includes('trap') ||
    lower.includes('lừa') ||
    lower.includes('lưu ý khi thi') ||
    lower.includes('mẹo phòng thi')
  ) {
    intent = 'EXAM_TRAP_ANALYSIS';
  } else if (
    lower.includes('sửa lỗi') ||
    lower.includes('troubleshoot') ||
    lower.includes('không kết nối được') ||
    lower.includes('lỗi') ||
    lower.includes('timeout')
  ) {
    intent = 'TROUBLESHOOTING';
  } else if (cleaned.length < 5) {
    intent = 'UNCLEAR';
  }

  // 2. Detect Topic
  let topic: RewriteResult['topic'] = 'General';
  if (/\b(ec2|lambda|fargate|ecs|eks|batch|elastic beanstalk)\b/i.test(lower)) {
    topic = 'Compute';
  } else if (/\b(s3|ebs|efs|glacier|storage gateway|snowball|fsx)\b/i.test(lower)) {
    topic = 'Storage';
  } else if (/\b(rds|aurora|dynamodb|elasticache|redshift|neptune|documentdb)\b/i.test(lower)) {
    topic = 'Database';
  } else if (/\b(vpc|subnet|route 53|route53|cloudfront|alb|nlb|transit gateway|direct connect|nat gateway|vpn|global accelerator|anycast|tcp|udp)\b/i.test(lower)) {
    topic = 'Networking';
  } else if (/\b(iam|kms|secrets manager|cognito|waf|shield|guardduty|security hub|macie)\b/i.test(lower)) {
    topic = 'Security';
  } else if (/\b(cloudwatch|cloudtrail|systems manager|ssm|config|cloudformation|organizations|cost explorer)\b/i.test(lower)) {
    topic = 'Management';
  } else if (/\b(sqs|sns|eventbridge|step functions|appsync|api gateway|mq)\b/i.test(lower)) {
    topic = 'Application Integration';
  } else if (/\b(athena|glue|kinesis|emr|quicksight|opensearch)\b/i.test(lower)) {
    topic = 'Analytics';
  }

  // 3. Normalization (strip punctuation, lowercased for exact memory search)
  const normalizedQuery = cleaned
    .toLowerCase()
    .replace(/[?!.,;:"'()[\]{}]/g, '')
    .trim();

  // 4. Query expansion: expand acronyms if present
  let rewrittenQuery = cleaned;
  const words = cleaned.split(/\s+/);
  const expansions: string[] = [];

  for (const w of words) {
    const cleanWord = w.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (ACRONYM_EXPANSIONS[cleanWord]) {
      expansions.push(ACRONYM_EXPANSIONS[cleanWord]);
    }
  }

  if (expansions.length > 0 && !lower.includes('amazon') && !lower.includes('aws')) {
    rewrittenQuery = `${cleaned} (AWS Kiến thức liên quan: ${expansions.slice(0, 3).join(', ')})`;
  }

  let rewriteReason = 'Normalized whitespace and punctuation';
  if (originalQuery !== cleaned) {
    rewriteReason = 'Stripped instruction override attempts from search query';
  } else if (expansions.length > 0) {
    rewriteReason = 'Expanded AWS acronyms for higher retrieval precision';
  }

  return {
    originalQuery,
    normalizedQuery,
    rewrittenQuery,
    intent,
    topic,
    rewriteReason,
  };
}
