/**
 * Quét ngân hàng 1.019 câu hỏi để tìm những AWS service thực sự xuất hiện.
 *
 * Kết quả dùng cho 2 việc:
 *   1. Xác định phạm vi service cần viết nội dung deep-dive
 *   2. Sinh chỉ mục service -> danh sách câu hỏi liên quan
 *
 * Chạy: node scripts/extractServices.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const QUESTIONS = path.join(ROOT, 'public/data/questions.json');
const OUT_DIR = path.join(ROOT, 'scripts/out');

/**
 * Mỗi service có: id chuẩn, tên hiển thị, nhóm, và các biến thể tên xuất hiện
 * trong đề. Biến thể được ghép thành regex nên phải escape ký tự đặc biệt.
 */
const CATALOG = [
  // --- Compute ---
  ['ec2', 'Amazon EC2', 'Compute', ['EC2', 'Elastic Compute Cloud']],
  ['lambda', 'AWS Lambda', 'Compute', ['Lambda']],
  ['ecs', 'Amazon ECS', 'Compute', ['ECS', 'Elastic Container Service']],
  ['eks', 'Amazon EKS', 'Compute', ['EKS', 'Elastic Kubernetes Service']],
  ['fargate', 'AWS Fargate', 'Compute', ['Fargate']],
  ['batch', 'AWS Batch', 'Compute', ['AWS Batch']],
  ['lightsail', 'Amazon Lightsail', 'Compute', ['Lightsail']],
  ['elastic-beanstalk', 'AWS Elastic Beanstalk', 'Compute', ['Elastic Beanstalk']],
  ['outposts', 'AWS Outposts', 'Compute', ['Outposts']],
  ['app-runner', 'AWS App Runner', 'Compute', ['App Runner']],
  ['auto-scaling', 'Amazon EC2 Auto Scaling', 'Compute', ['Auto Scaling group', 'Auto Scaling', 'ASG']],

  // --- Storage ---
  ['s3', 'Amazon S3', 'Storage', ['S3', 'Simple Storage Service']],
  ['s3-glacier', 'Amazon S3 Glacier', 'Storage', ['Glacier']],
  ['ebs', 'Amazon EBS', 'Storage', ['EBS', 'Elastic Block Store']],
  ['efs', 'Amazon EFS', 'Storage', ['EFS', 'Elastic File System']],
  ['fsx', 'Amazon FSx', 'Storage', ['FSx']],
  ['storage-gateway', 'AWS Storage Gateway', 'Storage', ['Storage Gateway']],
  ['backup', 'AWS Backup', 'Storage', ['AWS Backup']],
  ['snowball', 'AWS Snow Family', 'Storage', ['Snowball', 'Snowmobile', 'Snowcone']],
  ['datasync', 'AWS DataSync', 'Storage', ['DataSync']],
  ['transfer-family', 'AWS Transfer Family', 'Storage', ['Transfer Family', 'AWS Transfer for SFTP']],

  // --- Database ---
  ['rds', 'Amazon RDS', 'Database', ['RDS', 'Relational Database Service']],
  ['aurora', 'Amazon Aurora', 'Database', ['Aurora']],
  ['dynamodb', 'Amazon DynamoDB', 'Database', ['DynamoDB']],
  ['elasticache', 'Amazon ElastiCache', 'Database', ['ElastiCache']],
  ['redshift', 'Amazon Redshift', 'Database', ['Redshift']],
  ['documentdb', 'Amazon DocumentDB', 'Database', ['DocumentDB']],
  ['neptune', 'Amazon Neptune', 'Database', ['Neptune']],
  ['timestream', 'Amazon Timestream', 'Database', ['Timestream']],
  ['keyspaces', 'Amazon Keyspaces', 'Database', ['Keyspaces']],
  ['memorydb', 'Amazon MemoryDB', 'Database', ['MemoryDB']],
  ['dms', 'AWS DMS', 'Database', ['DMS', 'Database Migration Service']],

  // --- Networking ---
  ['vpc', 'Amazon VPC', 'Networking', ['VPC', 'Virtual Private Cloud']],
  ['route53', 'Amazon Route 53', 'Networking', ['Route 53', 'Route53']],
  ['cloudfront', 'Amazon CloudFront', 'Networking', ['CloudFront']],
  ['elb', 'Elastic Load Balancing', 'Networking', ['Application Load Balancer', 'Network Load Balancer', 'Gateway Load Balancer', 'Elastic Load Balanc', 'ALB', 'NLB', 'load balancer']],
  ['api-gateway', 'Amazon API Gateway', 'Networking', ['API Gateway']],
  ['direct-connect', 'AWS Direct Connect', 'Networking', ['Direct Connect']],
  ['transit-gateway', 'AWS Transit Gateway', 'Networking', ['Transit Gateway']],
  ['privatelink', 'AWS PrivateLink', 'Networking', ['PrivateLink', 'VPC endpoint', 'interface endpoint', 'gateway endpoint']],
  ['nat-gateway', 'NAT Gateway', 'Networking', ['NAT gateway', 'NAT instance']],
  ['global-accelerator', 'AWS Global Accelerator', 'Networking', ['Global Accelerator']],
  ['vpn', 'AWS Site-to-Site VPN', 'Networking', ['Site-to-Site VPN', 'AWS VPN', 'Client VPN']],
  ['vpc-peering', 'VPC Peering', 'Networking', ['VPC peering']],

  // --- Integration & App ---
  ['sqs', 'Amazon SQS', 'Integration', ['SQS', 'Simple Queue Service']],
  ['sns', 'Amazon SNS', 'Integration', ['SNS', 'Simple Notification Service']],
  ['eventbridge', 'Amazon EventBridge', 'Integration', ['EventBridge', 'CloudWatch Events']],
  ['step-functions', 'AWS Step Functions', 'Integration', ['Step Functions']],
  ['mq', 'Amazon MQ', 'Integration', ['Amazon MQ']],
  ['appsync', 'AWS AppSync', 'Integration', ['AppSync']],
  ['ses', 'Amazon SES', 'Integration', ['SES', 'Simple Email Service']],

  // --- Analytics ---
  ['kinesis', 'Amazon Kinesis', 'Analytics', ['Kinesis']],
  ['athena', 'Amazon Athena', 'Analytics', ['Athena']],
  ['glue', 'AWS Glue', 'Analytics', ['Glue']],
  ['emr', 'Amazon EMR', 'Analytics', ['EMR', 'Elastic MapReduce']],
  ['quicksight', 'Amazon QuickSight', 'Analytics', ['QuickSight']],
  ['opensearch', 'Amazon OpenSearch', 'Analytics', ['OpenSearch', 'Elasticsearch Service']],
  ['msk', 'Amazon MSK', 'Analytics', ['MSK', 'Managed Streaming for Apache Kafka']],
  ['lake-formation', 'AWS Lake Formation', 'Analytics', ['Lake Formation']],
  ['data-firehose', 'Amazon Data Firehose', 'Analytics', ['Firehose']],

  // --- Security & Identity ---
  ['iam', 'AWS IAM', 'Security', ['IAM', 'Identity and Access Management']],
  ['kms', 'AWS KMS', 'Security', ['KMS', 'Key Management Service']],
  ['secrets-manager', 'AWS Secrets Manager', 'Security', ['Secrets Manager']],
  ['parameter-store', 'SSM Parameter Store', 'Security', ['Parameter Store']],
  ['cognito', 'Amazon Cognito', 'Security', ['Cognito']],
  ['waf', 'AWS WAF', 'Security', ['WAF']],
  ['shield', 'AWS Shield', 'Security', ['Shield']],
  ['guardduty', 'Amazon GuardDuty', 'Security', ['GuardDuty']],
  ['inspector', 'Amazon Inspector', 'Security', ['Inspector']],
  ['macie', 'Amazon Macie', 'Security', ['Macie']],
  ['acm', 'AWS Certificate Manager', 'Security', ['Certificate Manager', 'ACM']],
  ['security-hub', 'AWS Security Hub', 'Security', ['Security Hub']],
  ['directory-service', 'AWS Directory Service', 'Security', ['Directory Service', 'AWS Managed Microsoft AD']],
  ['sts', 'AWS STS', 'Security', ['STS', 'Security Token Service', 'AssumeRole']],
  ['security-groups', 'Security Groups & NACLs', 'Security', ['security group', 'network ACL', 'NACL']],
  ['cloudhsm', 'AWS CloudHSM', 'Security', ['CloudHSM']],

  // --- Management & Governance ---
  ['cloudwatch', 'Amazon CloudWatch', 'Management', ['CloudWatch']],
  ['cloudtrail', 'AWS CloudTrail', 'Management', ['CloudTrail']],
  ['config', 'AWS Config', 'Management', ['AWS Config']],
  ['organizations', 'AWS Organizations', 'Management', ['Organizations', 'service control polic', 'SCP']],
  ['systems-manager', 'AWS Systems Manager', 'Management', ['Systems Manager', 'SSM']],
  ['cloudformation', 'AWS CloudFormation', 'Management', ['CloudFormation']],
  ['trusted-advisor', 'AWS Trusted Advisor', 'Management', ['Trusted Advisor']],
  ['control-tower', 'AWS Control Tower', 'Management', ['Control Tower']],
  ['cost-explorer', 'AWS Cost Explorer', 'Management', ['Cost Explorer', 'Cost and Usage Report', 'Budgets']],
  ['resource-access-manager', 'AWS RAM', 'Management', ['Resource Access Manager', 'AWS RAM']],

  // --- AI/ML & Misc ---
  ['sagemaker', 'Amazon SageMaker', 'AI & ML', ['SageMaker']],
  ['rekognition', 'Amazon Rekognition', 'AI & ML', ['Rekognition']],
  ['comprehend', 'Amazon Comprehend', 'AI & ML', ['Comprehend']],
  ['textract', 'Amazon Textract', 'AI & ML', ['Textract']],
  ['transcribe', 'Amazon Transcribe', 'AI & ML', ['Transcribe']],
  ['polly', 'Amazon Polly', 'AI & ML', ['Polly']],
  ['translate', 'Amazon Translate', 'AI & ML', ['Translate']],
  ['kendra', 'Amazon Kendra', 'AI & ML', ['Kendra']],
  // "forecast" là từ thông thường (predictive scaling) nên bắt buộc có tiền tố
  ['forecast', 'Amazon Forecast', 'AI & ML', ['Amazon Forecast']],
  ['workspaces', 'Amazon WorkSpaces', 'End User', ['WorkSpaces']],
  ['appstream', 'Amazon AppStream 2.0', 'End User', ['AppStream']],
];

const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Ghép biến thể thành 1 regex, ưu tiên khớp nguyên từ để tránh dương tính giả. */
function buildMatcher(aliases) {
  const parts = aliases
    .slice()
    .sort((a, b) => b.length - a.length)
    .map(escape);
  return new RegExp(`(?<![A-Za-z0-9])(?:${parts.join('|')})(?![A-Za-z0-9])`, 'gi');
}

const MATCHERS = CATALOG.map(([id, name, category, aliases]) => ({
  id,
  name,
  category,
  aliases,
  re: buildMatcher(aliases),
}));

const questions = JSON.parse(fs.readFileSync(QUESTIONS, 'utf8'));

/** Gom toàn bộ chữ của một câu hỏi: đề bài + các lựa chọn. */
function textOf(q) {
  const choices = q.choices && typeof q.choices === 'object' ? Object.values(q.choices) : [];
  return [q.question, ...choices].join('\n');
}

const serviceToQuestions = new Map(MATCHERS.map((m) => [m.id, []]));
const questionToServices = {};

for (const q of questions) {
  const text = textOf(q);
  const hits = [];
  for (const m of MATCHERS) {
    m.re.lastIndex = 0;
    if (m.re.test(text)) {
      hits.push(m.id);
      serviceToQuestions.get(m.id).push(q.question_id);
    }
  }
  questionToServices[q.question_id] = hits;
}

const rows = MATCHERS.map((m) => ({
  id: m.id,
  name: m.name,
  category: m.category,
  count: serviceToQuestions.get(m.id).length,
})).sort((a, b) => b.count - a.count);

const present = rows.filter((r) => r.count > 0);
const absent = rows.filter((r) => r.count === 0);

fs.mkdirSync(OUT_DIR, { recursive: true });
fs.writeFileSync(
  path.join(OUT_DIR, 'service-question-index.json'),
  JSON.stringify(
    {
      generatedAt: new Date().toISOString(),
      totalQuestions: questions.length,
      services: present.map((r) => ({ ...r, questionIds: serviceToQuestions.get(r.id) })),
    },
    null,
    2
  )
);
fs.writeFileSync(
  path.join(OUT_DIR, 'question-to-services.json'),
  JSON.stringify(questionToServices, null, 0)
);

// Xuất file dữ liệu mà app import trực tiếp
const tierOf = (n) => (n >= 40 ? 'core' : n >= 10 ? 'standard' : 'brief');
const shipped = present.map((r) => ({
  id: r.id,
  name: r.name,
  category: r.category,
  tier: tierOf(r.count),
  count: r.count,
  questionIds: serviceToQuestions.get(r.id),
}));
fs.writeFileSync(
  path.join(ROOT, 'src/data/serviceQuestionIndex.json'),
  JSON.stringify(shipped, null, 0)
);

const noHit = Object.values(questionToServices).filter((v) => v.length === 0).length;

console.log(`Tổng câu hỏi        : ${questions.length}`);
console.log(`Service có xuất hiện: ${present.length} / ${MATCHERS.length}`);
console.log(`Service không thấy  : ${absent.map((r) => r.id).join(', ') || '(không có)'}`);
console.log(`Câu không khớp gì   : ${noHit}`);
console.log('');
console.log('STT  SỐ CÂU  NHÓM          SERVICE');
present.forEach((r, i) => {
  console.log(
    String(i + 1).padStart(3) +
      String(r.count).padStart(8) +
      '  ' +
      r.category.padEnd(13) +
      ' ' +
      r.name
  );
});
