// Exam Clues & Decision Constraints Knowledge Base for AWS SAA-C03

export interface ExamClueDef {
  id: string;
  pattern: RegExp;
  label: string;
  architecturalGuidance: string;
  explanationVi: string;
  colorLight: string;
  colorDark: string;
}

export const EXAM_CLUES: ExamClueDef[] = [
  {
    id: 'overhead',
    pattern: /\b(least operational overhead|minimal operational overhead|minimize operational overhead|minimum operational effort|least administrative effort|minimize operational complexity|least operational complexity|lowest operational complexity|minimal operational complexity|reduce operational complexity|operational complexity|operational overhead|administrative overhead)\b/gi,
    label: 'Managed / Serverless',
    architecturalGuidance: 'Favor fully managed, serverless AWS services (Lambda, Fargate, DynamoDB, S3, Aurora Serverless, EventBridge). Minimize operational complexity by avoiding self-managed EC2 instances or custom cron scripts.',
    explanationVi: 'Ưu tiên dịch vụ Serverless/Managed hoàn toàn (Lambda, DynamoDB, S3, Aurora Serverless). Giảm tối đa độ phức tạp vận hành bằng cách tránh tự cài phần mềm trên EC2.',
    colorLight: 'bg-emerald-100 text-emerald-900 border-emerald-300',
    colorDark: 'dark:bg-emerald-950/80 dark:text-emerald-300 dark:border-emerald-700',
  },
  {
    id: 'cost',
    pattern: /\b(most cost-effective|cost-effective|lowest cost|minimize cost|least expensive|minimize expenses|cost-efficient|lowest price|most economical)\b/gi,
    label: 'Cost Optimization',
    architecturalGuidance: 'Look for S3 Lifecycle rules (Standard-IA, Glacier Deep Archive), Spot Instances for fault-tolerant jobs, Gateway VPC Endpoints (free vs NAT Gateway), Savings Plans, or DynamoDB On-Demand.',
    explanationVi: 'Tối ưu chi phí: Tìm kiếm S3 Lifecycle (Standard-IA, Glacier), EC2 Spot, Gateway VPC Endpoints (miễn phí), hoặc Savings Plans.',
    colorLight: 'bg-amber-100 text-amber-900 border-amber-300',
    colorDark: 'dark:bg-amber-950/80 dark:text-amber-300 dark:border-amber-700',
  },
  {
    id: 'latency',
    pattern: /\b(as quickly as possible|sub-millisecond|microsecond latency|single-digit millisecond|lowest latency|fastest response time|fastest|quickest|accelerate performance|accelerate uploads|accelerate data transfer|speed up)\b/gi,
    label: 'Performance / Acceleration',
    architecturalGuidance: 'Requires acceleration or caching layer: S3 Transfer Acceleration (global uploads to S3), DynamoDB Accelerator (DAX), Amazon ElastiCache (Redis/Memcached), or CloudFront / Global Accelerator.',
    explanationVi: 'Tốc độ cao / Tăng tốc truyền tải: Dùng S3 Transfer Acceleration (upload nhanh vào S3 từ toàn cầu), ElastiCache/DAX (microsecond), hoặc CloudFront / Global Accelerator.',
    colorLight: 'bg-violet-100 text-violet-900 border-violet-300',
    colorDark: 'dark:bg-violet-950/80 dark:text-violet-300 dark:border-violet-700',
  },
  {
    id: 'global-distribution',
    pattern: /\b(across multiple continents|global sites|globally distributed|users around the world|global users|worldwide|multiple geographic regions)\b/gi,
    label: 'Global Distribution / Edge',
    architecturalGuidance: 'For global workloads across multiple continents: Use Amazon S3 Transfer Acceleration for fast cross-region uploads into a single bucket, Amazon CloudFront for edge caching, Route 53 Geolocation, or AWS Global Accelerator.',
    explanationVi: 'Phân phối / Tổng hợp toàn cầu: Dùng S3 Transfer Acceleration (upload nhanh vào 1 bucket S3 từ nhiều châu lục), CloudFront, hoặc AWS Global Accelerator.',
    colorLight: 'bg-cyan-100 text-cyan-900 border-cyan-300',
    colorDark: 'dark:bg-cyan-950/80 dark:text-cyan-300 dark:border-cyan-700',
  },
  {
    id: 'shared-fs',
    pattern: /\b(shared file system|POSIX-compliant|POSIX|NFS|SMB file share|shared storage across instances)\b/gi,
    label: 'Shared File Storage',
    architecturalGuidance: 'Multi-instance file sharing: Amazon EFS (for Linux POSIX/NFSv4), Amazon FSx for Windows File Server (SMB), or FSx for Lustre (high-performance compute). EBS cannot be shared across AZs.',
    explanationVi: 'Hệ thống tệp chia sẻ: EFS (cho Linux POSIX), FSx for Windows (SMB), FSx for Lustre (tính toán hiệu năng cao). EBS không chia sẻ qua nhiều AZ.',
    colorLight: 'bg-blue-100 text-blue-900 border-blue-300',
    colorDark: 'dark:bg-blue-950/80 dark:text-blue-300 dark:border-blue-700',
  },
  {
    id: 'decouple',
    pattern: /\b(decouple|decoupling|asynchronously|asynchronous processing|buffer requests|queue)\b/gi,
    label: 'Asynchronous Decoupling',
    architecturalGuidance: 'Decouple components using Amazon SQS (message queuing, backpressure buffering), Amazon SNS (pub/sub fan-out), or EventBridge (event routing).',
    explanationVi: 'Phân rã & bất đồng bộ: Amazon SQS (hàng đợi đệm tải), Amazon SNS (phát tán 1-nhiều), Amazon EventBridge (định tuyến sự kiện).',
    colorLight: 'bg-teal-100 text-teal-900 border-teal-300',
    colorDark: 'dark:bg-teal-950/80 dark:text-teal-300 dark:border-teal-700',
  },
  {
    id: 'preserve-ip',
    pattern: /\b(preserve client IP|source IP address|static IP address|whitelisted IP)\b/gi,
    label: 'Layer 4 / Static IP',
    architecturalGuidance: 'Preserve source IP or provide static IPs: Use Network Load Balancer (NLB) with target type instance/IP, or AWS Global Accelerator (provides 2 static Anycast public IPs). ALB modifies source IP.',
    explanationVi: 'Giữ nguyên IP nguồn hoặc cấp IP tĩnh: Network Load Balancer (NLB) hoặc AWS Global Accelerator (2 IP Anycast tĩnh).',
    colorLight: 'bg-indigo-100 text-indigo-900 border-indigo-300',
    colorDark: 'dark:bg-indigo-950/80 dark:text-indigo-300 dark:border-indigo-700',
  },
  {
    id: 'rotation',
    pattern: /\b(rotate credentials|automatic rotation|secrets rotation|store database credentials)\b/gi,
    label: 'Secrets Manager',
    architecturalGuidance: 'AWS Secrets Manager natively supports automatic rotation for RDS, Aurora, and DocumentDB via built-in Lambda functions. AWS Systems Manager Parameter Store does NOT support automatic rotation.',
    explanationVi: 'Tự động xoay mật khẩu: AWS Secrets Manager (tích hợp sẵn Lambda rotation). Parameter Store KHÔNG hỗ trợ tự xoay.',
    colorLight: 'bg-rose-100 text-rose-900 border-rose-300',
    colorDark: 'dark:bg-rose-950/80 dark:text-rose-300 dark:border-rose-700',
  },
  {
    id: 'streaming',
    pattern: /\b(real-time|real time|stream data|streaming data|ingest continuous|clickstream)\b/gi,
    label: 'Real-Time Streaming',
    architecturalGuidance: 'Ingest and process continuous streaming data: Amazon Kinesis Data Streams (custom consumers, sub-second latency), Kinesis Data Firehose (near real-time loading to S3/Redshift/OpenSearch).',
    explanationVi: 'Dữ liệu luồng thời gian thực: Amazon Kinesis Data Streams (độ trễ dưới 1s) hoặc Kinesis Data Firehose (đẩy trực tiếp vào S3/Redshift).',
    colorLight: 'bg-orange-100 text-orange-900 border-orange-300',
    colorDark: 'dark:bg-orange-950/80 dark:text-orange-300 dark:border-orange-700',
  },
  {
    id: 'ha-resilient',
    pattern: /\b(highly available|high availability|fault-tolerant|fault tolerance|resilient to AZ outage|survive an AZ failure)\b/gi,
    label: 'Multi-AZ Resilience',
    architecturalGuidance: 'Span across at least 2 Availability Zones. Use Multi-AZ for RDS/Aurora, Auto Scaling Groups across multiple AZs behind an Application Load Balancer.',
    explanationVi: 'Tính sẵn sàng cao: Trải rộng tối thiểu 2-3 Availability Zones, kết hợp ALB + Auto Scaling Group, RDS Multi-AZ.',
    colorLight: 'bg-cyan-100 text-cyan-900 border-cyan-300',
    colorDark: 'dark:bg-cyan-950/80 dark:text-cyan-300 dark:border-cyan-700',
  },
  {
    id: 'dr',
    pattern: /\b(disaster recovery|RPO|RTO|recovery point objective|recovery time objective)\b/gi,
    label: 'Disaster Recovery Strategy',
    architecturalGuidance: 'RPO/RTO tradeoffs: Backup & Restore (hours, cheapest) -> Pilot Light (core data replicated, scaled down) -> Warm Standby (smaller scaled production) -> Multi-Site Active-Active (seconds/zero RPO, costliest).',
    explanationVi: 'Chiến lược khắc phục thảm họa (DR): Backup & Restore (vài giờ) -> Pilot Light (vài chục phút) -> Warm Standby (vài phút) -> Multi-Site Active-Active (gần như 0).',
    colorLight: 'bg-fuchsia-100 text-fuchsia-900 border-fuchsia-300',
    colorDark: 'dark:bg-fuchsia-950/80 dark:text-fuchsia-300 dark:border-fuchsia-700',
  },
  {
    id: 'private',
    pattern: /\b(without internet|private connectivity|without traversing the public internet|privately connect|VPC endpoint)\b/gi,
    label: 'Private VPC Networking',
    architecturalGuidance: 'Keep traffic inside AWS private backbone: Gateway VPC Endpoints (for S3 and DynamoDB, free), Interface VPC Endpoints / AWS PrivateLink (for other services, ENI with private IP).',
    explanationVi: 'Kết nối riêng tư không qua Internet: Dùng Gateway VPC Endpoint (cho S3 và DynamoDB - miễn phí) hoặc Interface VPC Endpoint / PrivateLink.',
    colorLight: 'bg-sky-100 text-sky-900 border-sky-300',
    colorDark: 'dark:bg-sky-950/80 dark:text-sky-300 dark:border-sky-700',
  },
  {
    id: 'no-code-change',
    pattern: /\b(without modifying application code|without changing the application|no code change|minimal application modifications)\b/gi,
    label: 'Transparent Architectural Layer',
    architecturalGuidance: 'Use infrastructure abstraction layers: AWS Global Accelerator, Amazon CloudFront, Amazon Route 53 DNS aliases, or Amazon RDS Proxy without modifying backend codebase.',
    explanationVi: 'Không cần đổi code: Dùng tầng mạng/DNS trừu tượng như CloudFront, Global Accelerator, Route 53 DNS, hoặc RDS Proxy.',
    colorLight: 'bg-purple-100 text-purple-900 border-purple-300',
    colorDark: 'dark:bg-purple-950/80 dark:text-purple-300 dark:border-purple-700',
  },
  {
    id: 'encryption',
    pattern: /\b(encrypt at rest|encrypted at rest|customer-managed key|customer managed key|CMK|bring your own key|FIPS 140-2 Level 3|CloudHSM)\b/gi,
    label: 'Encryption & Security',
    architecturalGuidance: 'Customer Managed Keys (CMK) in AWS KMS for key management & automatic annual rotation. AWS CloudHSM for dedicated hardware security module (FIPS 140-2 Level 3).',
    explanationVi: 'Mã hóa & Khóa bảo mật: AWS KMS với Customer Managed Keys (CMK) cho quyền kiểm soát và tự xoay key. CloudHSM cho phần cứng chuyên dụng FIPS 140-2 Level 3.',
    colorLight: 'bg-emerald-100 text-emerald-900 border-emerald-300',
    colorDark: 'dark:bg-emerald-950/80 dark:text-emerald-300 dark:border-emerald-700',
  },
  {
    id: 'migration',
    pattern: /\b(large volume of data|petabytes of data|terabytes of data|Snowball|Snowcone|Snowmobile|database migration service|AWS DMS|AWS SCT)\b/gi,
    label: 'Data Migration',
    architecturalGuidance: 'Offline petabyte-scale data transfer: AWS Snowball Edge. Active database migration and schema conversion: AWS DMS and SCT.',
    explanationVi: 'Di chuyển dữ liệu: AWS Snowball Edge cho dữ liệu dung lượng lớn (TB/PB) offline. AWS DMS và SCT cho database.',
    colorLight: 'bg-lime-100 text-lime-900 border-lime-300',
    colorDark: 'dark:bg-lime-950/80 dark:text-lime-300 dark:border-lime-700',
  },
];

export interface DetectedClue {
  clue: ExamClueDef;
  matchText: string;
}

export function detectQuestionClues(text: string): DetectedClue[] {
  const detected: DetectedClue[] = [];
  const seenIds = new Set<string>();

  for (const clue of EXAM_CLUES) {
    clue.pattern.lastIndex = 0;
    const match = clue.pattern.exec(text);
    if (match && !seenIds.has(clue.id)) {
      seenIds.add(clue.id);
      detected.push({
        clue,
        matchText: match[0],
      });
    }
  }

  return detected;
}
