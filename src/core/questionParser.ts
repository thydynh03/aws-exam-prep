import type { RawQuestion, Question, CommunityVote, AWSDomain, Difficulty } from './types';

const AWS_SERVICES = [
  { name: 'Amazon S3', regex: /\b(S3|Amazon S3|Glacier)\b/i },
  { name: 'Amazon EC2', regex: /\b(EC2|Amazon EC2|Auto Scaling)\b/i },
  { name: 'AWS Lambda', regex: /\b(Lambda|AWS Lambda|serverless)\b/i },
  { name: 'Amazon RDS', regex: /\b(RDS|Amazon RDS|Aurora|Multi-AZ)\b/i },
  { name: 'Amazon DynamoDB', regex: /\b(DynamoDB|Amazon DynamoDB|DAX)\b/i },
  { name: 'Amazon VPC', regex: /\b(VPC|Subnet|NAT Gateway|Internet Gateway|Transit Gateway|VPC Peering)\b/i },
  { name: 'AWS IAM', regex: /\b(IAM|Role|Policy|Principal|Instance profile)\b/i },
  { name: 'AWS KMS', regex: /\b(KMS|Key Management Service|customer managed key)\b/i },
  { name: 'AWS Secrets Manager', regex: /\b(Secrets Manager|Systems Manager Parameter Store)\b/i },
  { name: 'Amazon SQS', regex: /\b(SQS|Simple Queue Service|FIFO queue|dead-letter queue)\b/i },
  { name: 'Amazon SNS', regex: /\b(SNS|Simple Notification Service)\b/i },
  { name: 'Amazon CloudFront', regex: /\b(CloudFront|CDN|Origin Access)\b/i },
  { name: 'Amazon Route 53', regex: /\b(Route 53|DNS|latency routing|failover routing)\b/i },
  { name: 'Amazon CloudWatch', regex: /\b(CloudWatch|alarm|metric|logs)\b/i },
  { name: 'AWS CloudTrail', regex: /\b(CloudTrail|audit log)\b/i },
  { name: 'Amazon EBS', regex: /\b(EBS|Elastic Block Store|snapshot)\b/i },
  { name: 'Amazon EFS', regex: /\b(EFS|Elastic File System)\b/i },
  { name: 'Amazon ECS / EKS', regex: /\b(ECS|EKS|Fargate|container)\b/i },
  { name: 'AWS Storage Gateway', regex: /\b(Storage Gateway|Volume Gateway|File Gateway|Tape Gateway)\b/i },
  { name: 'AWS Step Functions', regex: /\b(Step Functions|state machine)\b/i },
  { name: 'Amazon Kinesis', regex: /\b(Kinesis|data stream|firehose)\b/i },
  { name: 'Amazon API Gateway', regex: /\b(API Gateway|REST API|HTTP API)\b/i },
  { name: 'AWS Direct Connect', regex: /\b(Direct Connect|DX)\b/i },
  { name: 'Amazon ElastiCache', regex: /\b(ElastiCache|Redis|Memcached)\b/i },
  { name: 'Amazon FSx', regex: /\b(FSx|Lustre|Windows File Server)\b/i },
  { name: 'AWS Global Accelerator', regex: /\b(Global Accelerator)\b/i },
  { name: 'AWS WAF & Shield', regex: /\b(WAF|Shield|DDoS)\b/i },
  { name: 'AWS Organizations', regex: /\b(Organizations|SCP|Service Control Policy)\b/i },
];

export function extractServiceTags(questionText: string, choices: Record<string, string>): string[] {
  const fullText = `${questionText} ${Object.values(choices).join(' ')}`;
  const tags: string[] = [];

  for (const service of AWS_SERVICES) {
    if (service.regex.test(fullText)) {
      tags.push(service.name);
    }
  }

  return tags.length > 0 ? tags : ['AWS General'];
}

export function inferAWSDomain(
  questionText: string,
  choices: Record<string, string>,
  serviceTags: string[]
): AWSDomain {
  const content = `${questionText} ${Object.values(choices).join(' ')}`.toLowerCase();

  // 1. High confidence Cost-Optimization indicators
  const costKeywords = [
    'cost-effective',
    'least cost',
    'lowest cost',
    'cost-optimized',
    'lifecycle policy',
    's3 glacier',
    'glacier deep archive',
    'intelligent-tiering',
    'spot instance',
    'savings plan',
    'reserved instance',
    'reduce cost',
    'minimize cost',
    'most economical',
  ];
  let costScore = 0;
  for (const kw of costKeywords) {
    if (content.includes(kw)) costScore += 2;
  }

  // 2. High confidence Security indicators
  let secScore = 0;
  if (
    serviceTags.includes('AWS IAM') ||
    serviceTags.includes('AWS KMS') ||
    serviceTags.includes('AWS Secrets Manager') ||
    serviceTags.includes('AWS CloudTrail') ||
    serviceTags.includes('AWS WAF & Shield') ||
    serviceTags.includes('AWS Organizations')
  ) {
    secScore += 3;
  }
  const secKeywords = [
    'security',
    'encrypt',
    'compliance',
    'least privilege',
    'waf',
    'shield',
    'guardduty',
    'macie',
    'inspector',
    'cloudhsm',
    'private subnet',
    'nacl',
    'security group',
    'bucket policy',
    'privatelink',
    'vpc endpoint',
    'sso',
  ];
  for (const kw of secKeywords) {
    if (content.includes(kw)) secScore += 1.5;
  }

  // 3. High-Performance indicators (Task statements 3.1 - 3.5)
  let perfScore = 0;
  if (
    serviceTags.includes('Amazon CloudFront') ||
    serviceTags.includes('Amazon ElastiCache') ||
    serviceTags.includes('AWS Global Accelerator') ||
    serviceTags.includes('Amazon FSx') ||
    serviceTags.includes('Amazon Kinesis') ||
    serviceTags.includes('AWS Direct Connect')
  ) {
    perfScore += 3;
  }
  const perfKeywords = [
    'performance',
    'high performance',
    'latency',
    'lowest latency',
    'throughput',
    'high throughput',
    'caching',
    'cache',
    'elasticache',
    'accelerat',
    'sub-millisecond',
    'iops',
    'provisioned iops',
    'io2',
    'gp3',
    'lustre',
    'fastest',
    'real-time',
    'streaming',
    'transfer acceleration',
    'memory-optimized',
    'compute-optimized',
  ];
  for (const kw of perfKeywords) {
    if (content.includes(kw)) perfScore += 1.5;
  }

  // 4. Resilience & Decoupling indicators (Task statements 2.1 - 2.2)
  let resScore = 0;
  if (
    serviceTags.includes('Amazon SQS') ||
    serviceTags.includes('Amazon SNS') ||
    serviceTags.includes('Amazon Route 53') ||
    serviceTags.includes('AWS Step Functions')
  ) {
    resScore += 2.5;
  }
  const resKeywords = [
    'resilient',
    'high availability',
    'highly available',
    'multi-az',
    'disaster recovery',
    'failover',
    'rto',
    'rpo',
    'decouple',
    'fault tolerant',
    'fault-tolerant',
    'auto scaling',
    'cross-region',
    'pilot light',
    'warm standby',
    'active-active',
  ];
  for (const kw of resKeywords) {
    if (content.includes(kw)) resScore += 1.5;
  }

  // Determine winning domain based on weighted score
  const maxScore = Math.max(costScore, secScore, perfScore, resScore);

  if (maxScore > 0) {
    if (costScore === maxScore) return 'Domain 4: Design Cost-Optimized Architectures';
    if (secScore === maxScore) return 'Domain 1: Design Secure Architectures';
    if (perfScore === maxScore) return 'Domain 3: Design High-Performing Architectures';
    return 'Domain 2: Design Resilient Architectures';
  }

  // Default fallback
  return 'Domain 2: Design Resilient Architectures';
}

export function inferDifficulty(
  raw: RawQuestion,
  communityVotes: CommunityVote[],
  expectedChoicesCount: number
): Difficulty {
  const textLength = (raw.question || '').length;

  // Multi-response with 3 answers or long scenario with divided community vote -> Hard
  if (expectedChoicesCount >= 3) return 'Hard';
  
  if (communityVotes.length > 1) {
    const topPct = communityVotes[0]?.percentage || 100;
    if (topPct < 75) return 'Hard';
  }

  if (textLength > 600 || expectedChoicesCount === 2) {
    return 'Medium';
  }

  if (communityVotes.length > 0 && communityVotes[0]?.percentage >= 90 && textLength < 350) {
    return 'Easy';
  }

  return 'Medium';
}

export function parseCommunityVotes(rawVotes: string[]): CommunityVote[] {
  if (!rawVotes || !Array.isArray(rawVotes)) return [];

  const votes: CommunityVote[] = [];
  const voteRegex = /([A-F]+)\s*\(([0-9]+)%\)/i;

  for (const item of rawVotes) {
    if (typeof item !== 'string') continue;
    const match = item.match(voteRegex);
    if (match) {
      votes.push({
        choice: match[1].toUpperCase(),
        percentage: parseInt(match[2], 10),
        raw: item.trim(),
      });
    } else {
      votes.push({
        choice: 'Other',
        percentage: parseInt(item.replace(/[^0-9]/g, ''), 10) || 0,
        raw: item.trim(),
      });
    }
  }

  return votes;
}

export function normalizeAnswer(ans: string): string {
  if (!ans || typeof ans !== 'string') return '';
  return ans
    .toUpperCase()
    .replace(/[^A-Z]/g, '')
    .split('')
    .sort()
    .join('');
}

export function parseQuestion(raw: RawQuestion, index: number): Question {
  const id = typeof raw.question_id === 'number' 
    ? raw.question_id 
    : parseInt(String(raw.question_id), 10) || (index + 1);

  const cleanAnswer = normalizeAnswer(raw.answer);
  const choices = raw.choices || {};
  const choiceKeys = Object.keys(choices).sort();
  const expectedCount = cleanAnswer.length > 0 ? cleanAnswer.length : 1;
  const isMultiSelect = expectedCount > 1;

  const text = (raw.question || '').trim();
  const serviceTags = extractServiceTags(text, choices);
  const communityVotes = parseCommunityVotes(raw.answers_community);
  const domain = inferAWSDomain(text, choices, serviceTags);
  const difficulty = inferDifficulty(raw, communityVotes, expectedCount);

  return {
    id,
    originalId: String(raw.question_id ?? id),
    text,
    choices,
    choiceKeys,
    answer: cleanAnswer,
    answerDescription: (raw.answer_description || '').trim(),
    communityVotes,
    topic: String(raw.topic || '1'),
    serviceTags,
    domain,
    difficulty,
    isMultiSelect,
    expectedChoicesCount: expectedCount,
  };
}

export function parseAllQuestions(rawList: RawQuestion[]): Question[] {
  if (!Array.isArray(rawList)) return [];
  return rawList.map((raw, idx) => parseQuestion(raw, idx));
}
