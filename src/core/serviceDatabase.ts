import type { AWSServiceGuide, ServiceComparison } from './types';

export const AWS_SERVICES: AWSServiceGuide[] = [
  // --- COMPUTE ---
  {
    id: 'ec2',
    name: 'Amazon EC2',
    category: 'Compute',
    abbreviation: 'EC2',
    summary: 'Elastic Compute Cloud provides resizable compute capacity with full OS-level control.',
    coreConcepts: [
      'Instance types: General Purpose (M/T), Compute (C), Memory (R/X), Storage (I/D), Accelerated (P/G)',
      'Pricing models: On-Demand, Spot (up to 90% discount, interruptible), Reserved Instances / Savings Plans (1-3 yr commit)',
      'Placement groups: Cluster (low latency, 10Gbps single AZ), Spread (distinct hardware, max 7 per AZ), Partition (Hadoop/Kafka distributed)',
      'User Data scripts run once at launch as root; Instance Metadata Service (IMDSv2 uses session tokens)',
    ],
    useCases: [
      'Traditional monolithic applications requiring custom OS kernels or software packages',
      'Batch processing workloads leveraging Spot instances for cost reduction',
      'High Performance Computing (HPC) using Cluster Placement Groups and EFA',
    ],
    examRelevance: 'Heavily tested across all domains: cost optimization (Spot vs RI), resilience (Auto Scaling across multi-AZ), and security (IAM roles, IMDSv2, Security Groups).',
    commonTraps: [
      'Spot instances give only a 2-minute termination notice — never use for stateful or non-fault-tolerant workloads',
      'Cluster placement groups cannot span multiple Availability Zones',
      'Stopping an EC2 instance loses ephemeral Instance Store data; root EBS volumes persist',
    ],
    relatedServices: ['ebs', 'auto-scaling', 'alb', 'iam'],
    docsUrl: 'https://docs.aws.amazon.com/ec2/',
  },
  {
    id: 'lambda',
    name: 'AWS Lambda',
    category: 'Compute',
    abbreviation: 'Lambda',
    summary: 'Serverless compute service that executes code in response to events without provisioning servers.',
    coreConcepts: [
      'Event-driven: triggered by S3, DynamoDB Streams, SQS, API Gateway, EventBridge, etc.',
      'Execution limits: 15-minute maximum timeout, 10 GB memory max, 10 GB ephemeral /tmp storage',
      'Cold starts & Provisioned Concurrency for consistent low-latency execution',
      'VPC access: attaches Hyperplane ENIs for fast VPC resource communication (RDS, ElastiCache)',
    ],
    useCases: [
      'Serverless web backends paired with Amazon API Gateway',
      'Real-time file processing upon S3 object upload (thumbnails, virus scanning)',
      'Event-driven ETL and data stream transformation with Kinesis and DynamoDB Streams',
    ],
    examRelevance: 'Preferred serverless compute answer in SAA-C03 when requirements mention lowest operational overhead and scale-to-zero cost.',
    commonTraps: [
      'Lambda functions cannot run longer than 15 minutes; longer jobs must use AWS Step Functions, ECS, or AWS Batch',
      'Lambda inside a VPC requires a NAT Gateway or VPC Endpoint to access public internet or AWS APIs',
    ],
    relatedServices: ['api-gateway', 'step-functions', 'sqs', 'dynamodb'],
    docsUrl: 'https://docs.aws.amazon.com/lambda/',
  },
  {
    id: 'ecs-fargate',
    name: 'Amazon ECS & AWS Fargate',
    category: 'Compute',
    abbreviation: 'ECS / Fargate',
    summary: 'Fully managed container orchestration supporting both EC2 launch type and serverless Fargate.',
    coreConcepts: [
      'ECS Launch Types: EC2 (you manage instances and OS patching) vs Fargate (serverless, per-vCPU/GB pricing)',
      'Task Definitions define containers, CPU/memory, environment variables, IAM task roles',
      'Service auto-scaling based on target tracking (CPU, memory, ALB request count)',
      'Task Execution Role (pull image, write CloudWatch logs) vs Task Role (app permissions to S3, DynamoDB)',
    ],
    useCases: [
      'Microservices architectures packaged as Docker containers',
      'Long-running containerized backend tasks that exceed Lambda 15-minute runtime',
      'Batch jobs or scheduled recurring tasks without dedicating idle EC2 instances',
    ],
    examRelevance: 'When containers are specified and "minimal operational management" is desired, AWS Fargate is almost always the correct answer over ECS EC2.',
    commonTraps: [
      'Confusing ECS Task Role (permissions used by your application code inside the container) with Task Execution Role (permissions for the ECS agent to pull images and send logs)',
    ],
    relatedServices: ['ecr', 'alb', 'fargate', 'eks'],
    docsUrl: 'https://docs.aws.amazon.com/ecs/',
  },

  // --- STORAGE ---
  {
    id: 's3',
    name: 'Amazon S3',
    category: 'Storage',
    abbreviation: 'S3',
    summary: 'Highly scalable, 11 9s durable object storage service accessible via HTTP REST APIs.',
    coreConcepts: [
      'Durability: 99.999999999% (11 9s) across 3+ AZs (except One Zone-IA)',
      'Storage tiers: Standard, Intelligent-Tiering, Standard-IA, One Zone-IA, Glacier Instant, Glacier Flexible, Glacier Deep Archive',
      'Security: Block Public Access (default), SSE-S3 (AES-256), SSE-KMS, SSE-C, client-side encryption, Bucket Policies, ACLs',
      'Lifecycle Rules for automated transitioning and expiration',
      'Performance: S3 Transfer Acceleration, Multipart Upload (mandatory for files > 5GB), byte-range fetches',
    ],
    useCases: [
      'Static asset hosting and website hosting paired with CloudFront',
      'Data lakes for analytics tools (Athena, EMR, Redshift Spectrum)',
      'Long-term compliance archives with S3 Object Lock and Glacier Deep Archive',
    ],
    examRelevance: 'Highest frequency storage service on SAA-C03. Tested on security policies, cross-region replication (CRR), lifecycle rules, and storage classes.',
    commonTraps: [
      'Multipart upload is recommended for objects > 100MB, but strictly mandatory for objects > 5GB',
      'S3 One Zone-IA is not resilient to an AZ destruction event',
      'Enabling Cross-Region Replication (CRR) requires Versioning enabled on BOTH source and destination buckets',
    ],
    relatedServices: ['cloudfront', 'kms', 'athena', 'glacier'],
    docsUrl: 'https://docs.aws.amazon.com/s3/',
  },
  {
    id: 'ebs',
    name: 'Amazon Elastic Block Store',
    category: 'Storage',
    abbreviation: 'EBS',
    summary: 'High-performance block storage volumes attached to EC2 instances within a single Availability Zone.',
    coreConcepts: [
      'Volume types: General Purpose SSD (gp3/gp2), Provisioned IOPS SSD (io2/io1 - high throughput, Multi-Attach), Throughput Optimized HDD (st1 - sequential big data), Cold HDD (sc1 - log archives)',
      'Availability: Bound to a single AZ; to move across AZs, take an EBS Snapshot (stored in S3) and restore in target AZ',
      'Snapshots: Incremental, crash-consistent or application-consistent via VSS, Fast Snapshot Restore (FSR)',
      'Encryption: KMS keys, snapshots of encrypted volumes are automatically encrypted',
    ],
    useCases: [
      'Primary boot drives and system drives for EC2 instances',
      'Relational and NoSQL transactional databases running directly on EC2',
      'Sequential read-heavy workloads (st1) for data warehousing or big data clusters',
    ],
    examRelevance: 'Frequently compared with EFS and S3. Questions test volume types (gp3 vs io2 vs st1), multi-attach constraints, and snapshot lifecycle.',
    commonTraps: [
      'EBS volumes are AZ-locked! They cannot be attached directly to an EC2 instance in another AZ without snapshotting',
      'EBS Multi-Attach is only supported on io1/io2 volumes and requires a cluster-aware file system (e.g. GFS2); it does NOT allow concurrent writes safely without one',
      'st1 and sc1 HDD volumes CANNOT be used as EC2 boot volumes',
    ],
    relatedServices: ['ec2', 'kms', 'efs', 's3'],
    docsUrl: 'https://docs.aws.amazon.com/ebs/',
  },
  {
    id: 'efs',
    name: 'Amazon Elastic File System',
    category: 'Storage',
    abbreviation: 'EFS',
    summary: 'Serverless, fully elastic POSIX-compliant Network File System (NFSv4) shared across multiple AZs.',
    coreConcepts: [
      'Multi-AZ availability and durability by default (One Zone storage class also available)',
      'Concurrent access: thousands of Linux EC2 instances, ECS/EKS tasks, and on-premises servers can mount simultaneously',
      'Performance modes: General Purpose (low latency) vs Max I/O (high aggregate throughput)',
      'Throughput modes: Bursting vs Provisioned vs Elastic (automatic scaling based on workload)',
      'Lifecycle Management: auto-transition files to Infrequent Access (EFS-IA) after inactivity',
    ],
    useCases: [
      'Shared content management systems (WordPress, Drupal) across auto-scaled EC2 instances',
      'Shared home directories for developer teams and CI/CD build artifacts',
      'Container persistent storage for Amazon ECS and EKS workloads',
    ],
    examRelevance: 'Tested whenever a problem requires a POSIX-compliant, multi-instance read/write shared file system across Linux instances.',
    commonTraps: [
      'EFS supports Linux instances only via NFSv4; for Windows file sharing using SMB, the answer is Amazon FSx for Windows File Server',
      'Do not pick EBS Multi-Attach when standard multi-AZ shared file access is required — pick EFS',
    ],
    relatedServices: ['ec2', 'ecs', 'fsx', 'ebs'],
    docsUrl: 'https://docs.aws.amazon.com/efs/',
  },

  // --- DATABASE ---
  {
    id: 'rds',
    name: 'Amazon RDS',
    category: 'Database',
    abbreviation: 'RDS',
    summary: 'Managed relational database service supporting Postgres, MySQL, MariaDB, Oracle, and SQL Server.',
    coreConcepts: [
      'Multi-AZ Deployment: Synchronous replication to standby in another AZ for High Availability and automatic failover (no data loss, same DNS endpoint)',
      'Read Replicas: Asynchronous replication (up to 5 for RDS, 15 for Aurora) for Read Scaling and offloading reporting; can be promoted to standalone; can span regions',
      'Backups: Automated daily snapshots (1-35 days retention) + transaction logs for point-in-time recovery (PITR); manual DB snapshots never expire',
      'Storage Auto Scaling: Automatically scales storage volume up to 64 TB without downtime',
    ],
    useCases: [
      'Traditional relational applications requiring ACID compliance and complex SQL JOINs',
      'Enterprise database migrations (Oracle, SQL Server) with automated patching and backups',
      'Read-heavy web apps using Read Replicas behind Route 53 or an application proxy',
    ],
    examRelevance: 'Core SAA-C03 staple. High distinction tested between Multi-AZ (High Availability / Disaster Recovery) vs Read Replicas (Read Performance Scaling).',
    commonTraps: [
      'Multi-AZ standby CANNOT be used to serve read traffic; it is strictly an active-passive failover partner',
      'Read replicas use asynchronous replication, so there is replication lag — not suitable for strict zero-lag read consistency',
    ],
    relatedServices: ['aurora', 'ec2', 'kms', 'route53'],
    docsUrl: 'https://docs.aws.amazon.com/rds/',
  },
  {
    id: 'aurora',
    name: 'Amazon Aurora',
    category: 'Database',
    abbreviation: 'Aurora',
    summary: 'Cloud-native, MySQL/Postgres-compatible relational database with 5x MySQL and 3x Postgres throughput.',
    coreConcepts: [
      'Storage architecture: 6 copies across 3 AZs; survives loss of 2 copies without affecting write availability, 3 copies without read availability',
      'Auto-healing storage: continuous disk block repair; automatically expands up to 128 TiB in 10 GB increments',
      'Read Replicas: up to 15 replicas with sub-10ms replication lag; automatic failover to read replica in under 30 seconds',
      'Aurora Serverless v2: instant scaling in fine-grained ACUs (Aurora Capacity Units)',
      'Aurora Global Database: sub-second cross-region replication for disaster recovery with RPO < 1s and RTO < 1 min',
    ],
    useCases: [
      'High-throughput enterprise relational workloads with strict RTO/RPO SLAs',
      'Global multi-region read scaling with Aurora Global Database',
      'Unpredictable, intermittent database traffic using Aurora Serverless v2',
    ],
    examRelevance: 'Always the superior answer over standard RDS when high availability, lower failover times (<30s), sub-second cross-region replication, or auto-scaling storage is required.',
    commonTraps: [
      'Aurora uses a shared cluster storage volume; all replicas read from the exact same underlying storage layer, which is why replication lag is so low',
    ],
    relatedServices: ['rds', 'secrets-manager', 'route53'],
    docsUrl: 'https://docs.aws.amazon.com/AmazonRDS/latest/AuroraUserGuide/',
  },
  {
    id: 'dynamodb',
    name: 'Amazon DynamoDB',
    category: 'Database',
    abbreviation: 'DynamoDB',
    summary: 'Fully managed, serverless, single-digit millisecond NoSQL key-value and document database.',
    coreConcepts: [
      'Data modeling: Partition Key (HASH) for data distribution; Sort Key (RANGE) for ordering within a partition',
      'Capacity modes: On-Demand (pay per request, unpredictable workloads) vs Provisioned (auto-scaling WCU/RCU, predictable workloads)',
      'DynamoDB Streams: ordered stream of item-level modifications (24h retention) used to trigger Lambda or feed OpenSearch',
      'DynamoDB Accelerator (DAX): in-memory cache providing microsecond read response times for read-heavy workloads',
      'Global Tables: fully managed, multi-region active-active replication with two-way sync',
    ],
    useCases: [
      'Gaming leaderboards, user session stores, and shopping carts needing single-digit ms latency',
      'Mobile backends and IoT sensor data ingestion at massive scale',
      'Global active-active multi-region databases with DynamoDB Global Tables',
    ],
    examRelevance: 'Primary NoSQL database on the exam. Questions test On-Demand vs Provisioned, DAX for microsecond latency, DynamoDB Streams + Lambda pattern, and Global Tables.',
    commonTraps: [
      'ElastiCache Redis requires application code changes to handle cache misses; DAX is API-compatible and transparent to the application',
      'Strongly Consistent Reads consume 2x the Read Capacity Units (RCUs) compared to Eventually Consistent Reads',
    ],
    relatedServices: ['lambda', 'elasticache', 'apigateway', 'kms'],
    docsUrl: 'https://docs.aws.amazon.com/dynamodb/',
  },

  // --- NETWORKING ---
  {
    id: 'vpc',
    name: 'Amazon Virtual Private Cloud',
    category: 'Networking',
    abbreviation: 'VPC',
    summary: 'Logically isolated virtual network with fine-grained control over IP ranges, subnets, route tables, and gateways.',
    coreConcepts: [
      'Subnets: Public (route to Internet Gateway) vs Private (route to NAT Gateway for outbound internet access)',
      'NAT Gateway: Managed, redundant within an AZ; must be placed in a PUBLIC subnet with an Elastic IP; private subnets point their default route (0.0.0.0/0) to it',
      'VPC Peering: Non-transitive connection between two VPCs (A-B and B-C does NOT equal A-C)',
      'VPC Endpoints: Gateway Endpoints (FREE, for S3 and DynamoDB via route table entry) vs Interface Endpoints (PrivateLink, ENI with private IP, hourly + data fee, for other services)',
    ],
    useCases: [
      'Multi-tier architectures (Public Web Tier, Private App Tier, Isolated DB Tier)',
      'Secure hybrid cloud interconnect with AWS Site-to-Site VPN or AWS Direct Connect',
      'Accessing S3 privately without internet egress using Gateway VPC Endpoints',
    ],
    examRelevance: 'Fundamental bedrock of SAA-C03. Tested across routing, NAT Gateways, VPC Peering non-transitivity, and VPC Endpoints (Gateway vs Interface).',
    commonTraps: [
      'VPC Peering does NOT support transitive routing — for hub-and-spoke topologies with 10+ VPCs, use AWS Transit Gateway',
      'Gateway Endpoints are ONLY for S3 and DynamoDB; all other services use Interface Endpoints (PrivateLink)',
      'NAT Gateway is AZ-bound: for high availability, deploy a NAT Gateway in EACH public subnet across multiple AZs',
    ],
    relatedServices: ['transit-gateway', 'direct-connect', 'route53', 'ec2'],
    docsUrl: 'https://docs.aws.amazon.com/vpc/',
  },
  {
    id: 'alb-nlb',
    name: 'Elastic Load Balancing (ALB & NLB)',
    category: 'Networking',
    abbreviation: 'ELB (ALB / NLB)',
    summary: 'Distributes incoming application or network traffic across multiple targets in multiple AZs.',
    coreConcepts: [
      'Application Load Balancer (ALB): Layer 7 (HTTP/HTTPS/gRPC), path/host/query routing, redirects/fixed responses, SSL termination, target types: EC2, ECS, Lambda, IP',
      'Network Load Balancer (NLB): Layer 4 (TCP/UDP/TLS), ultra-high performance, millions of requests/sec, static IP address per AZ, elastic IP support, sub-millisecond latency',
      'Cross-Zone Load Balancing: Enabled by default on ALB (free); disabled by default on NLB (inter-AZ data charges apply when enabled)',
      'Health checks: targets marked unhealthy stop receiving new traffic; connections drained gracefully (deregistration delay)',
    ],
    useCases: [
      'Microservices routing based on URL path (/api/users, /api/orders) using ALB',
      'Real-time gaming, financial protocols, or non-HTTP TCP sockets requiring static IP using NLB',
      'SSL/TLS offloading to reduce compute load on backend EC2 web servers',
    ],
    examRelevance: 'Core SAA-C03 staple. Distinguishing between ALB (Layer 7 HTTP features) and NLB (Layer 4 static IP / extreme throughput) is tested repeatedly.',
    commonTraps: [
      'ALB does NOT have a static IP address — it has a DNS name; if a static IP or elastic IP is required, pick NLB or AWS Global Accelerator',
      'ALB passes client IP in the `X-Forwarded-For` header; NLB preserves client IP directly in the TCP packet without translation',
    ],
    relatedServices: ['ec2', 'route53', 'waf', 'global-accelerator'],
    docsUrl: 'https://docs.aws.amazon.com/elasticloadbalancing/',
  },
  {
    id: 'cloudfront',
    name: 'Amazon CloudFront',
    category: 'Networking',
    abbreviation: 'CloudFront',
    summary: 'Global Content Delivery Network (CDN) that speeds up delivery of static and dynamic web content.',
    coreConcepts: [
      'Edge Locations & Regional Edge Caches: 450+ Points of Presence caching content close to users globally',
      'Origins: S3 bucket, ALB, EC2, or custom HTTP origin servers',
      'Origin Access Control (OAC): restricts S3 bucket access so users cannot bypass CloudFront and access S3 directly',
      'Security: integration with AWS WAF, AWS Shield Standard (free DDoS mitigation), and custom SSL certificates via ACM (must be in us-east-1)',
      'Edge Compute: CloudFront Functions (sub-millisecond URL rewrites/header manipulation) vs Lambda@Edge (full Node/Python logic, network calls)',
    ],
    useCases: [
      'Global distribution of static websites (S3 + CloudFront + ACM)',
      'DDoS defense and geo-restriction for public web applications',
      'Accelerating dynamic API payloads via optimized AWS backbone connections',
    ],
    examRelevance: 'Primary answer for reducing latency for globally dispersed users and securing S3 origins with Origin Access Control (OAC).',
    commonTraps: [
      'Origin Access Identity (OAI) is legacy; modern exam questions test Origin Access Control (OAC)',
      'SSL certificates for CloudFront distributions MUST be created in the `us-east-1` (N. Virginia) region',
    ],
    relatedServices: ['s3', 'waf', 'route53', 'acm'],
    docsUrl: 'https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/',
  },
  {
    id: 'global-accelerator',
    name: 'AWS Global Accelerator',
    category: 'Networking',
    abbreviation: 'AGA',
    summary: 'Networking service that improves the availability and performance of applications with global users by providing 2 static Anycast IP addresses routed over the AWS global private network.',
    coreConcepts: [
      'Static Anycast IP addresses: Provides 2 static public Anycast IPv4 addresses as fixed global entry points',
      'AWS Global Backbone: Routes traffic from edge locations to backend endpoints over the private AWS fiber network, bypassing public Internet congestion and jitter',
      'Protocol support: Accelerates both TCP and UDP traffic (unlike CloudFront which is primarily HTTP/HTTPS/WebSocket)',
      'Endpoint targets: Application Load Balancers (ALB), Network Load Balancers (NLB), EC2 instances, and Elastic IPs across single or multiple Regions',
      'Instant failover: Fast health check failover between AWS Regions in under 30 seconds without waiting for DNS TTL expiration',
      'Client IP preservation: Preserves original client IP address for ALB and EC2 endpoints',
    ],
    useCases: [
      'Non-HTTP/HTTPS applications (TCP/UDP real-time gaming, VoIP, IoT, financial trading) needing global low latency',
      'HTTP applications requiring fixed static IP addresses (for customer firewall whitelisting) while still utilizing ALB Layer 7 routing',
      'Multi-Region disaster recovery and seamless instant failover without DNS propagation delays',
    ],
    examRelevance: 'Key answer in SAA-C03 whenever requirements specify 2 static IP addresses, TCP/UDP non-HTTP traffic, or instant cross-region failover. Contrast with CloudFront which caches HTTP/HTTPS content at edge locations.',
    commonTraps: [
      'CloudFront caches content at edge locations; Global Accelerator does NOT cache content — it accelerates network transport over AWS private backbone',
      'CloudFront is designed for web HTTP/HTTPS/WebSocket; Global Accelerator supports generic TCP and UDP protocols',
      'ALB has no static IP address (only DNS name); pairing Global Accelerator in front of ALB provides static Anycast IPs with Layer 7 routing',
    ],
    relatedServices: ['alb-nlb', 'cloudfront', 'route53', 'ec2'],
    docsUrl: 'https://docs.aws.amazon.com/global-accelerator/',
  },
  {
    id: 'tcp-networking',
    name: 'TCP-based Applications on AWS',
    category: 'Networking',
    abbreviation: 'TCP Apps',
    summary: 'Applications utilizing Transmission Control Protocol (TCP) for reliable, connection-oriented, error-checked delivery of data streams between networked hosts (Layer 4 transport).',
    coreConcepts: [
      'TCP Protocol: 3-way handshake (SYN, SYN-ACK, ACK), reliable delivery with automatic packet retransmission, ordered byte streams, and congestion control',
      'Common TCP applications: Web traffic (HTTP/HTTPS over TCP port 80/443), Remote access (SSH port 22, RDP port 3389), Database connections (PostgreSQL 5432, MySQL 3306), FTP, custom socket servers, multiplayer game state servers',
      'Load balancing on AWS: NLB (Network Load Balancer) operates natively at Layer 4 (TCP/TLS) delivering ultra-high throughput and sub-millisecond latency with static IPs; ALB operates at Layer 7 (HTTP/HTTPS over TCP)',
      'Global acceleration: AWS Global Accelerator provides 2 static Anycast IP addresses to route TCP and UDP traffic over the AWS global private fiber backbone, dramatically cutting latency and packet loss',
      'Security: Controlled via stateful Security Groups and stateless Network ACLs filtering inbound/outbound TCP port ranges',
    ],
    useCases: [
      'High-throughput gaming servers, financial transaction processing, and IoT MQTT endpoints using NLB',
      'Accelerating global TCP connections with AWS Global Accelerator to minimize latency and packet loss',
      'Connecting corporate networks requiring static IP firewall whitelisting to AWS backends',
    ],
    examRelevance: 'Crucial distinction for SAA-C03: For TCP-based non-HTTP apps or apps requiring static IP, use NLB or Global Accelerator. For HTTP/HTTPS apps requiring path/host routing, use ALB. CloudFront cannot accelerate generic non-HTTP TCP traffic.',
    commonTraps: [
      'CloudFront does NOT support generic non-HTTP TCP/UDP applications (only HTTP/HTTPS/WebSocket) — use AWS Global Accelerator or NLB instead',
      'ALB cannot terminate raw TCP streams without HTTP parsing — use NLB for raw TCP socket applications',
    ],
    relatedServices: ['alb-nlb', 'global-accelerator', 'ec2'],
    docsUrl: 'https://docs.aws.amazon.com/whitepapers/latest/aws-fault-isolation-boundaries/',
  },

  // --- INTEGRATION & MESSAGING ---
  {
    id: 'sqs',
    name: 'Amazon Simple Queue Service',
    category: 'Integration',
    abbreviation: 'SQS',
    summary: 'Fully managed message queuing service for decoupling and scaling microservices and distributed systems.',
    coreConcepts: [
      'Standard Queue: unlimited throughput, at-least-once delivery, best-effort ordering',
      'FIFO Queue: exactly-once delivery, first-in-first-out strict order, message deduplication ID, message group ID (limited to 3,000 msg/s with high throughput mode)',
      'Visibility Timeout: period where a message is invisible to other consumers while being processed (default 30s, max 12h); ChangeMessageVisibility API',
      'Dead-Letter Queue (DLQ): isolates messages that fail processing after maxReceiveCount threshold',
      'Long Polling: WaitTimeSeconds up to 20s reduces empty responses and lowers cost',
    ],
    useCases: [
      'Decoupling write-heavy web applications from background worker processing',
      'Smoothing traffic spikes between microservices (buffering and throttling)',
      'Financial transactions requiring strict ordering via SQS FIFO',
    ],
    examRelevance: 'Tested in almost every exam for asynchronous decoupling, buffering spikes, and FIFO vs Standard trade-offs.',
    commonTraps: [
      'SQS Standard queues do NOT guarantee FIFO ordering and messages can occasionally be delivered more than once',
      'If consumers cannot finish processing within the Visibility Timeout, another consumer will process the same message duplicate unless extended',
    ],
    relatedServices: ['sns', 'lambda', 'ec2', 'eventbridge'],
    docsUrl: 'https://docs.aws.amazon.com/sqs/',
  },
  {
    id: 'sns',
    name: 'Amazon Simple Notification Service',
    category: 'Integration',
    abbreviation: 'SNS',
    summary: 'Managed publish/subscribe messaging service for high-throughput, push-based, one-to-many fanout.',
    coreConcepts: [
      'Pub/Sub model: publishers send messages to a Topic; multiple subscribers receive pushed copies',
      'Subscribers: SQS queues, Lambda functions, HTTP/HTTPS endpoints, Email, SMS, Mobile Push',
      'SNS Fanout Pattern: publish once to SNS, fan out to multiple independent SQS queues for parallel asynchronous processing',
      'Message Filtering: subscriber filter policies prevent unnecessary processing by filtering on message attributes',
      'SNS FIFO Topics: strict ordering and deduplication paired with SQS FIFO queues',
    ],
    useCases: [
      'Fanout pattern: single order event processed simultaneously by Fraud, Inventory, and Shipping services',
      'System alerts and CloudWatch alarms sent via email and SMS',
      'Real-time push notifications to iOS and Android devices',
    ],
    examRelevance: 'Key architectural pattern on SAA-C03: SNS Topic + multiple SQS Queues = Fanout architecture.',
    commonTraps: [
      'SNS pushes messages directly; it does NOT store messages for delayed polling (unless SQS is the subscriber)',
    ],
    relatedServices: ['sqs', 'lambda', 'cloudwatch', 'eventbridge'],
    docsUrl: 'https://docs.aws.amazon.com/sns/',
  },
  {
    id: 'eventbridge',
    name: 'Amazon EventBridge',
    category: 'Integration',
    abbreviation: 'EventBridge',
    summary: 'Serverless event bus service that routes events from AWS services, SaaS apps, and custom apps with JSON rules.',
    coreConcepts: [
      'Default Event Bus: receives events from AWS services (EC2 state changes, S3 API calls, etc.)',
      'Custom & Partner Event Buses: ingest events from Datadog, Zendesk, Salesforce, and custom applications',
      'Rules & Content Filtering: inspect event JSON payloads and route to targets (Lambda, SQS, SNS, Step Functions, Kinesis)',
      'Schema Registry: discover, generate, and manage OpenAPI/JSON schemas for code generation',
      'Archiving & Replay: record all events and replay them for debugging or disaster recovery',
    ],
    useCases: [
      'Event-driven architectures triggering downstream microservices based on specific payload attributes',
      'Automated remediation of security events (e.g. AWS Config rule failure -> EventBridge -> Lambda fix)',
      'Cron-style scheduled tasks (formerly CloudWatch Events)',
    ],
    examRelevance: 'Modern replacement for CloudWatch Events. Tested for event-driven decoupled systems and payload content-based routing.',
    commonTraps: [
      'EventBridge is the evolved version of CloudWatch Events; if both appear in legacy contexts, EventBridge has advanced features like partner buses and schema registry',
    ],
    relatedServices: ['lambda', 'sqs', 'sns', 'step-functions'],
    docsUrl: 'https://docs.aws.amazon.com/eventbridge/',
  },

  // --- SECURITY & IDENTITY ---
  {
    id: 'iam',
    name: 'AWS Identity and Access Management',
    category: 'Security',
    abbreviation: 'IAM',
    summary: 'Fine-grained access control service to securely manage identities, roles, and permissions across AWS.',
    coreConcepts: [
      'Principles of Least Privilege: grant only permissions required to perform the task',
      'IAM Roles: assumed temporarily by users, EC2 instances, Lambda functions, or external accounts via STS; uses temporary credentials',
      'Policy Evaluation Logic: Explicit Deny always overrides any Explicit Allow; default is Implicit Deny',
      'Service Control Policies (SCPs): guardrails in AWS Organizations that limit maximum permissions for accounts (never grant permissions directly)',
      'Permission Boundaries: define the maximum permissions that an identity-based policy can grant to an IAM entity',
    ],
    useCases: [
      'Granting EC2 instances access to S3 buckets using Instance Profiles and IAM Roles without hardcoding credentials',
      'Cross-account role assumption for multi-account deployment pipelines',
      'Enforcing company-wide compliance guardrails using AWS Organizations SCPs',
    ],
    examRelevance: 'Appears in every domain: security best practices, credential management, least privilege, and cross-account access.',
    commonTraps: [
      'Never store AWS access keys on an EC2 instance or in code repositories; always use IAM Roles',
      'SCPs do not grant permissions; an identity still needs an IAM policy Allow even if the SCP allows it',
    ],
    relatedServices: ['kms', 'secrets-manager', 'organizations', 'sts'],
    docsUrl: 'https://docs.aws.amazon.com/iam/',
  },
  {
    id: 'kms',
    name: 'AWS Key Management Service',
    category: 'Security',
    abbreviation: 'KMS',
    summary: 'Managed service to create and control cryptographic keys used to encrypt data across AWS services.',
    coreConcepts: [
      'Key types: AWS Owned (free, internal), AWS Managed (default aws/s3, free), Customer Managed (full control, rotation, $1/mo)',
      'Key policies: primary way to control access to KMS keys; IAM policies alone are insufficient without KMS key policy authorization',
      'Envelope Encryption: KMS encrypts a Data Key (DEK) with the KMS Key (KEK); data is encrypted locally using the plaintext DEK, which is then wiped from memory',
      'Multi-Region Keys: primary and replica keys sharing same key ID and key material for cross-region disaster recovery',
    ],
    useCases: [
      'Server-side encryption for S3 buckets, EBS volumes, RDS databases, and DynamoDB tables',
      'Fulfilling compliance requirements for annual automated key rotation using Customer Managed Keys',
      'Cross-region encrypted data replication without decrypting and re-encrypting',
    ],
    examRelevance: 'Tested on key policies, envelope encryption for payloads > 4KB, and customer managed vs AWS managed key capabilities.',
    commonTraps: [
      'KMS APIs cannot directly encrypt plaintext data larger than 4 KB — for larger files, Envelope Encryption (GenerateDataKey API) must be used',
      'AWS Managed Keys rotate automatically every 1 year; Customer Managed Keys support optional 1-year automatic rotation',
    ],
    relatedServices: ['secrets-manager', 's3', 'ebs', 'iam'],
    docsUrl: 'https://docs.aws.amazon.com/kms/',
  },
  {
    id: 'secrets-manager',
    name: 'AWS Secrets Manager',
    category: 'Security',
    abbreviation: 'Secrets Manager',
    summary: 'Securely encrypts, stores, and automatically rotates database credentials, API keys, and secrets.',
    coreConcepts: [
      'Automatic rotation: built-in integration with RDS, Aurora, DocumentDB, and Redshift via automated Lambda rotation functions',
      'KMS integration: all secrets encrypted at rest using KMS customer-managed or AWS-managed keys',
      'Compared to SSM Parameter Store: Secrets Manager costs $0.40/secret/month and includes built-in automated rotation; SSM Parameter Store Standard is FREE but lacks native auto-rotation',
    ],
    useCases: [
      'Storing RDS database passwords with 30-day automated rotation without application downtime',
      'Centralized third-party API token storage with cross-account access',
    ],
    examRelevance: 'Whenever "automatic rotation of database credentials" is mentioned in a question, AWS Secrets Manager is almost certainly the answer.',
    commonTraps: [
      'Do not choose SSM Parameter Store if automatic credential rotation without custom code is required',
    ],
    relatedServices: ['kms', 'rds', 'lambda', 'ssm'],
    docsUrl: 'https://docs.aws.amazon.com/secretsmanager/',
  },
  {
    id: 'cognito',
    name: 'Amazon Cognito',
    category: 'Security',
    abbreviation: 'Cognito',
    summary: 'Customer identity and access management (CIAM) providing user sign-up, sign-in, and access control for web and mobile applications.',
    coreConcepts: [
      'Cognito User Pools (CUP): User Directory & Authentication ("Who you are?"). Handles user sign-up, login, MFA, and social sign-in (Google, Facebook, Apple, SAML, OIDC). Returns standard JWT tokens (ID Token, Access Token, Refresh Token).',
      'Cognito Identity Pools (CIP / Federated Identities): Authorization ("What AWS resources can you access?"). Exchanges User Pool or social tokens for temporary, scoped AWS IAM credentials via AWS STS.',
      'Fine-grained Access Control: Uses IAM policy variables such as ${cognito-identity.amazonaws.com:sub} so users can only access their personal private folders (e.g. s3://bucket/private/${cognito-identity.amazonaws.com:sub}/*).',
      'Guest / Unauthenticated Access: Supports granting temporary read-only or limited AWS credentials to guest users without creating an account.',
    ],
    useCases: [
      'Mobile and web application authentication with social login (Google, Facebook) and Multi-Factor Authentication (MFA)',
      'Allowing mobile users to directly upload and download private photos/files from Amazon S3 using temporary AWS credentials without burdening backend servers',
      'Enterprise federation with Active Directory / Okta via SAML 2.0 or OIDC',
    ],
    examRelevance: 'SAA-C03 golden rule: User Pools = Authentication & user directory (JWT tokens). Identity Pools = Authorization & temporary AWS credentials for accessing AWS services directly.',
    commonTraps: [
      'Cognito User Pool JWT tokens CANNOT be used directly as AWS credentials to sign AWS API requests — they must be exchanged via Identity Pools for temporary IAM credentials',
      'Never create individual IAM users for external application customers; always use Amazon Cognito User Pools and Identity Pools',
    ],
    relatedServices: ['iam', 'sts', 's3', 'api-gateway', 'lambda'],
    docsUrl: 'https://docs.aws.amazon.com/cognito/',
  },
  // --- ARTIFICIAL INTELLIGENCE & MACHINE LEARNING ---
  {
    id: 'textract',
    name: 'Amazon Textract',
    category: 'AI & Machine Learning',
    abbreviation: 'Textract',
    summary: 'Dịch vụ máy học chuyên trích xuất tự động văn bản, chữ viết tay, bảng biểu (tables) và dữ liệu cặp khóa-giá trị (key-value) từ tài liệu scan, PDF và ảnh.',
    coreConcepts: [
      'Document OCR thông minh: Vượt xa OCR thông thường nhờ khả năng hiểu cấu trúc tài liệu (quan hệ hàng - cột trong bảng, form biểu mẫu)',
      'Hỗ trợ Forms Detection trả về quan hệ Key-Value (ví dụ: "Họ và tên: Nguyễn Văn A")',
      'Hỗ trợ Tables Analysis bảo toàn cấu trúc phân cấp ô và tiêu đề',
      'API đồng bộ (Sync) cho file 1 trang; API bất đồng bộ (Async) cho file PDF nhiều trang qua S3 và SNS/SQS',
      'Tích hợp Amazon Augmented AI (A2I) để con người duyệt lại (human review) khi độ tin cậy thấp',
    ],
    useCases: [
      'Số hóa hóa đơn, chứng từ tài chính và bảng kê ngân hàng từ file PDF trên S3',
      'Đọc hồ sơ bệnh án, phiếu xét nghiệm scan dạng văn bản giấy để đưa vào hệ thống quản lý bệnh viện',
      'Trích xuất dữ liệu CCCD/Hộ chiếu trong quy trình định danh điện tử (eKYC)',
    ],
    examRelevance: 'Trong đề thi SAA-C03: Khi đề bài yêu cầu "trích xuất text hoặc bảng biểu từ tài liệu PDF/scan với chi phí và công sức lập trình thấp nhất", Textract luôn là câu trả lời chính xác.',
    commonTraps: [
      'Textract KHÔNG hiểu ngữ nghĩa y khoa hay phân tích cảm xúc của văn bản (đó là việc của Comprehend / Comprehend Medical)',
      'Textract KHÔNG nhận diện khuôn mặt hay phân tích video (đó là Rekognition)',
      'Với tài liệu PDF nhiều trang, phải dùng Async API thông qua S3 và SNS/SQS notification, không dùng Sync API',
    ],
    relatedServices: ['comprehend', 'comprehend-medical', 'a2i', 's3', 'lambda'],
    docsUrl: 'https://docs.aws.amazon.com/textract/',
  },
  {
    id: 'comprehend-medical',
    name: 'Amazon Comprehend Medical',
    category: 'AI & Machine Learning',
    abbreviation: 'Comprehend Medical',
    summary: 'Dịch vụ xử lý ngôn ngữ tự nhiên (NLP) chuyên sâu cho ngành y tế, trích xuất thực thể y khoa (chẩn đoán, thuốc, liều lượng) và thông tin sức khỏe cá nhân (PHI) tuân thủ HIPAA.',
    coreConcepts: [
      'Trích xuất thực thể y tế chuyên ngành (Medical NER): Tự động phát hiện triệu chứng, bệnh án, tên thuốc, liều lượng, tần suất và đường dùng thuốc',
      'Phát hiện và ẩn danh thông tin sức khỏe được bảo vệ (Protected Health Information - PHI) để tuân thủ đạo luật HIPAA',
      'Liên kết thực thể y khoa với các bộ từ điển mã hóa quốc tế: ICD-10-CM (chẩn đoán bệnh), RxNorm (thuốc), SNOMED CT (thuật ngữ lâm sàng)',
      'Đầu vào là văn bản thô (Text input): Không cần huấn luyện mô hình ML thủ công (Pre-trained ML API)',
    ],
    useCases: [
      'Phân tích tự động hồ sơ bệnh án điện tử (EHR) để gán mã bảo hiểm y tế ICD-10 tự động',
      'Ẩn danh thông tin bệnh nhân (de-identification PHI) trước khi chia sẻ dữ liệu phục vụ nghiên cứu lâm sàng',
      'Rà soát tương tác thuốc và liều lượng trong đơn thuốc của bệnh nhân',
    ],
    examRelevance: 'Đề thi SAA-C03: Khi đề bài nhắc tới "hồ sơ bệnh án", "y tế/dược phẩm", "trích xuất thông tin lâm sàng/thuốc" hoặc "tuân thủ HIPAA phát hiện PHI", luôn chọn Amazon Comprehend Medical.',
    commonTraps: [
      'Comprehend Medical KHÔNG đọc được trực tiếp file ảnh scan hay PDF scan — nó chỉ nhận text! Phải dùng Textract đọc file PDF/ảnh ra text trước, rồi mới đưa text vào Comprehend Medical!',
      'Amazon Comprehend tiêu chuẩn không có các bộ từ điển y khoa chuyên sâu (ICD-10, RxNorm) — với bài toán y tế bắt buộc dùng Comprehend Medical',
    ],
    relatedServices: ['textract', 'comprehend', 's3', 'lambda', 'healthlake'],
    docsUrl: 'https://docs.aws.amazon.com/comprehend-medical/',
  },
  {
    id: 'comprehend',
    name: 'Amazon Comprehend',
    category: 'AI & Machine Learning',
    abbreviation: 'Comprehend',
    summary: 'Dịch vụ xử lý ngôn ngữ tự nhiên (NLP) sử dụng Machine Learning để tìm kiếm thông tin chi tiết, phân tích sắc thái cảm xúc, trích xuất thực thể và chủ đề từ văn bản phi cấu trúc.',
    coreConcepts: [
      'Phân tích tình cảm (Sentiment Analysis): Phân loại tích cực (Positive), tiêu cực (Negative), trung lập (Neutral), hỗn hợp (Mixed)',
      'Nhận dạng thực thể (Entity Recognition): Tự động nhận diện Người, Địa điểm, Tổ chức, Ngày tháng, Số tiền',
      'Nhận diện thông tin nhận dạng cá nhân (PII Redaction / Detection): Phát hiện số thẻ tín dụng, email, số điện thoại, SSN',
      'Phân cụm chủ đề (Topic Modeling) và phân loại văn bản tùy chỉnh (Custom Classification)',
    ],
    useCases: [
      'Phân tích phản hồi khách hàng và đánh giá sản phẩm trên mạng xã hội theo thang đo cảm xúc',
      'Tự động phân loại ticket hỗ trợ người dùng và điều hướng đến bộ phận giải quyết phù hợp',
      'Tự động che giấu (redact) thông tin nhạy cảm PII trong hợp đồng và tài liệu hỗ trợ',
    ],
    examRelevance: 'Đề thi SAA-C03: Lựa chọn hàng đầu cho "phân tích cảm xúc", "nhận diện thực thể PII" trong văn bản phi cấu trúc thông thường (không phải y tế).',
    commonTraps: [
      'Không dùng Comprehend cho hồ sơ y tế chuyên sâu (phải dùng Comprehend Medical)',
      'Không dùng Comprehend để dịch ngôn ngữ (đó là Amazon Translate) hay chuyển giọng nói thành văn bản (đó là Amazon Transcribe)',
    ],
    relatedServices: ['textract', 'comprehend-medical', 'translate', 'transcribe', 's3'],
    docsUrl: 'https://docs.aws.amazon.com/comprehend/',
  },
  {
    id: 'rekognition',
    name: 'Amazon Rekognition',
    category: 'AI & Machine Learning',
    abbreviation: 'Rekognition',
    summary: 'Dịch vụ thị giác máy tính (Computer Vision) tự động phân tích hình ảnh và video để nhận diện khuôn mặt, vật thể, cảnh quan, người nổi tiếng và kiểm duyệt nội dung độc hại.',
    coreConcepts: [
      'Gán nhãn đối tượng và cảnh (Labels Detection): Nhận diện đồ vật kèm điểm tin cậy (confidence score)',
      'Phân tích và so khớp khuôn mặt (Facial Analysis & Search): Đo lường cảm xúc, ước lượng độ tuổi, so khớp khuôn mặt với cơ sở dữ liệu (Face Collection)',
      'Kiểm duyệt nội dung (Content Moderation): Phát hiện hình ảnh khiêu dâm, bạo lực để lọc tự động',
      'Nhận diện văn bản trong ảnh (Text in Image): Nhận diện chữ ngắn xuất hiện tự nhiên trên ảnh (biển số xe, biển hiệu)',
      'Hỗ trợ phân tích luồng video thời gian thực thông qua tích hợp Amazon Kinesis Video Streams',
    ],
    useCases: [
      'Xác thực danh tính người dùng bằng chụp ảnh selfie so khớp với ảnh CMND/Hộ chiếu trong eKYC',
      'Tự động kiểm duyệt hình ảnh và video do người dùng tải lên mạng xã hội trước khi xuất bản',
      'Đếm lưu lượng người và phương tiện giao thông từ camera an ninh thông qua Kinesis Video Streams',
    ],
    examRelevance: 'Đề thi SAA-C03: Lựa chọn chuẩn xác khi bài toán đề cập "nhận diện khuôn mặt", "kiểm duyệt hình ảnh/video nhạy cảm", "phát hiện đối tượng trong ảnh".',
    commonTraps: [
      'Không dùng Rekognition để đọc tài liệu biểu mẫu phức tạp, hợp đồng PDF hay bảng tính y tế — đó là nhiệm vụ của Amazon Textract!',
      'Tính năng Text in Image của Rekognition chỉ đọc text ngắn ngoài đời thực (biển số xe), không hiểu cấu trúc bảng biểu hay cặp key-value của tài liệu',
    ],
    relatedServices: ['textract', 'kinesis-video-streams', 's3', 'lambda'],
    docsUrl: 'https://docs.aws.amazon.com/rekognition/',
  },
  {
    id: 'transcribe',
    name: 'Amazon Transcribe',
    category: 'AI & Machine Learning',
    abbreviation: 'Transcribe',
    summary: 'Dịch vụ nhận dạng giọng nói tự động (Automatic Speech Recognition - ASR) chuyển đổi âm thanh, hội thoại thành văn bản.',
    coreConcepts: [
      'Speech-to-Text: Chuyển đổi file âm thanh (MP3, WAV, FLAC) hoặc audio stream thời gian thực thành text',
      'Nhận diện phân tách người nói (Speaker Diarization): Nhận diện ai đang nói gì trong cuộc gọi nhiều người',
      'Amazon Transcribe Medical: Phiên bản chuyên ngành y tế chuyển đổi giọng nói bác sĩ đọc bệnh án thành văn bản',
      'Tự động tạo phụ đề (Subtitles) định dạng VTT/SRT và che giấu PII trong file ghi âm',
    ],
    useCases: [
      'Chuyển đổi các cuộc gọi ghi âm của tổng đài chăm sóc khách hàng (Call Center) thành text để phân tích chất lượng',
      'Tự động tạo phụ đề cho video bài giảng, hội thảo trực tuyến',
    ],
    examRelevance: 'Gặp trong câu hỏi tổng đài contact center (kết hợp Amazon Connect + Transcribe + Comprehend để đánh giá cảm xúc cuộc gọi).',
    commonTraps: [
      'Không dùng Transcribe để chuyển text thành giọng nói — đó là Amazon Polly!',
    ],
    relatedServices: ['polly', 'comprehend', 'connect', 's3'],
    docsUrl: 'https://docs.aws.amazon.com/transcribe/',
  },
  {
    id: 'polly',
    name: 'Amazon Polly',
    category: 'AI & Machine Learning',
    abbreviation: 'Polly',
    summary: 'Dịch vụ chuyển đổi văn bản thành giọng nói chân thực (Text-to-Speech - TTS) với công nghệ Neural TTS và hỗ trợ SSML.',
    coreConcepts: [
      'Text-to-Speech: Biến chữ viết thành âm thanh giọng đọc tự nhiên (hàng chục ngôn ngữ)',
      'Neural TTS (NTTS): Chất lượng giọng đọc sống động như người thật, phong cách đọc tin tức',
      'Speech Synthesis Markup Language (SSML): Điều chỉnh tốc độ, cao độ, khoảng dừng và phát âm ngữ âm',
    ],
    useCases: [
      'Đọc báo, phát thanh tin tức tự động cho ứng dụng di động',
      'Hệ thống trả lời tự động IVR trong trung tâm cuộc gọi',
    ],
    examRelevance: 'Từ khóa then chốt: "Text to speech", "Generate lifelike speech", "Spoken audio".',
    commonTraps: [
      'Polly là Text -> Speech. Transcribe là Speech -> Text. Đừng nhầm lẫn giữa hai chiều chuyển đổi!',
    ],
    relatedServices: ['transcribe', 'lex', 's3'],
    docsUrl: 'https://docs.aws.amazon.com/polly/',
  },
  {
    id: 'kendra',
    name: 'Amazon Kendra',
    category: 'AI & Machine Learning',
    abbreviation: 'Kendra',
    summary: 'Công cụ tìm kiếm doanh nghiệp thông minh dựa trên Machine Learning, hiểu ngôn ngữ tự nhiên và kết nối nhiều nguồn dữ liệu (S3, SharePoint, Salesforce, RDS).',
    coreConcepts: [
      'Natural Language Search: Trả về câu trả lời trực tiếp chính xác (Direct Answer) thay vì chỉ danh sách từ khóa link',
      'Connectors có sẵn cho hơn 40 nguồn dữ liệu (S3, Google Drive, Microsoft 365, ServiceNow, Confluence)',
      'Kiểm soát quyền truy cập tài liệu bằng Access Control Lists (ACLs)',
    ],
    useCases: [
      'Xây dựng cổng tra cứu tài liệu nội bộ, quy trình nhân sự và cẩm nang kỹ thuật cho toàn công ty',
      'Hệ thống tìm kiếm thông minh trên trang web hỗ trợ khách hàng',
    ],
    examRelevance: 'Từ khóa SAA-C03: "Intelligent enterprise search", "Natural language queries across multiple document repositories with document-level security".',
    commonTraps: [
      'Không dùng OpenSearch khi đề thi nhấn mạnh "Natural language questions and answers with built-in connectors" — đó là Kendra!',
    ],
    relatedServices: ['opensearch', 's3', 'iam'],
    docsUrl: 'https://docs.aws.amazon.com/kendra/',
  },
  {
    id: 'sagemaker',
    name: 'Amazon SageMaker',
    category: 'AI & Machine Learning',
    abbreviation: 'SageMaker',
    summary: 'Nền tảng toàn diện hỗ trợ xây dựng, huấn luyện và triển khai các mô hình Machine Learning tùy chỉnh ở mọi quy mô.',
    coreConcepts: [
      'Môi trường phát triển: SageMaker Studio, Jupyter Notebooks',
      'Huấn luyện phân tán: SageMaker Training Jobs, Spot instances giúp tiết kiệm đến 90% chi phí huấn luyện',
      'Triển khai suy luận: Real-time Endpoints, Serverless Inference, Asynchronous Inference, Batch Transform',
    ],
    useCases: [
      'Xây dựng mô hình dự báo tài chính tùy chỉnh độc quyền của doanh nghiệp',
      'Huấn luyện và tinh chỉnh (fine-tuning) các mô hình học sâu (Deep Learning)',
    ],
    examRelevance: 'Chọn SageMaker khi các dịch vụ AI tiền huấn luyện (Rekognition, Textract, Comprehend) không đáp ứng được yêu cầu và khách hàng muốn "tự huấn luyện mô hình ML riêng".',
    commonTraps: [
      'Nếu đề bài yêu cầu "Least operational overhead" cho OCR hoặc nhận diện ảnh, CHỌN Textract/Rekognition, KHÔNG tự build SageMaker từ đầu!',
    ],
    relatedServices: ['s3', 'ec2', 'lambda', 'bedrock'],
    docsUrl: 'https://docs.aws.amazon.com/sagemaker/',
  },
];

export const SERVICE_COMPARISONS: ServiceComparison[] = [
  {
    id: 'textract-vs-comprehend-medical-vs-rekognition',
    title: 'Amazon Textract vs Amazon Comprehend Medical vs Amazon Rekognition',
    category: 'AI & Machine Learning',
    services: ['Amazon Textract', 'Amazon Comprehend Medical', 'Amazon Rekognition'],
    dimensions: [
      {
        name: 'Bản chất & Mục đích cốt lõi',
        description: {
          'Amazon Textract': 'OCR thông minh cấp độ tài liệu. Chuyên trích xuất văn bản, bảng biểu (Tables) và biểu mẫu (Key-Value Forms) từ file PDF, scan hoặc giấy tờ.',
          'Amazon Comprehend Medical': 'NLP chuyên ngành Y tế & Dược phẩm. Chuyên hiểu ngữ nghĩa bệnh án, trích xuất thực thể y tế (thuốc, liều lượng, chẩn đoán) và bảo mật thông tin sức khỏe (PHI) chuẩn HIPAA.',
          'Amazon Rekognition': 'Thị giác máy tính (Computer Vision) cho hình ảnh & video. Chuyên nhận diện khuôn mặt, phát hiện đối tượng/cảnh quan, kiểm duyệt nội dung độc hại và chữ ngắn xuất hiện tự nhiên trong ảnh.',
        },
      },
      {
        name: 'Định dạng dữ liệu đầu vào (Input Format)',
        description: {
          'Amazon Textract': 'Tài liệu số hoặc scan: PDF, TIFF, PNG, JPEG. Nhận file nhiều trang thông qua S3 bucket.',
          'Amazon Comprehend Medical': 'Chuỗi văn bản thô (Plain UTF-8 Text). KHÔNG nhận trực tiếp file ảnh scan hay file PDF!',
          'Amazon Rekognition': 'Hình ảnh số (JPEG, PNG) hoặc Video (MP4, MOV, luồng Kinesis Video Streams).',
        },
      },
      {
        name: 'Khả năng OCR & Trích xuất cấu trúc',
        description: {
          'Amazon Textract': 'RẤT MẠNH. Hiểu rõ mối quan hệ hàng - cột trong bảng tính phức tạp và cặp khóa-giá trị trong hóa đơn/chứng từ.',
          'Amazon Comprehend Medical': 'KHÔNG CÓ OCR. Cần Textract đọc văn bản từ hồ sơ PDF trước, rồi mới đưa text kết quả vào Comprehend Medical phân tích ngữ nghĩa.',
          'Amazon Rekognition': 'OCR cơ bản ngoài đời thực (Text in Image): Chỉ nhận diện chữ ngắn xuất hiện tự nhiên (biển số xe, biển hiệu), không hiểu cấu trúc bảng hay biểu mẫu.',
        },
      },
      {
        name: 'Khả năng phân tích ngữ nghĩa & Thực thể chuyên ngành',
        description: {
          'Amazon Textract': 'Không phân tích ngữ nghĩa hay sắc thái. Chỉ trích xuất chính xác các ký tự và cấu trúc hiển thị trên trang giấy.',
          'Amazon Comprehend Medical': 'RẤT SÂU. Tự động ánh xạ vào từ điển y tế quốc tế (ICD-10-CM cho bệnh lý, RxNorm cho dược phẩm, SNOMED CT cho thuật ngữ lâm sàng).',
          'Amazon Rekognition': 'Không phân tích văn bản y tế. Phân tích đối tượng trực quan, cảm xúc biểu cảm khuôn mặt, độ tuổi, người nổi tiếng.',
        },
      },
      {
        name: 'Trọng tâm bài thi AWS SAA-C03 & Kịch bản thực tế',
        description: {
          'Amazon Textract': 'Đề bài có từ khóa: "Extract text/tables from scanned PDFs/invoices", "Minimize operational overhead".',
          'Amazon Comprehend Medical': 'Đề bài có từ khóa: "Analyze medical records", "Extract dosages/conditions", "Identify and redact Protected Health Information (PHI) HIPAA compliant".',
          'Amazon Rekognition': 'Đề bài có từ khóa: "Facial analysis/comparison", "Detect unsafe/inappropriate content", "Identify objects and people in video/images".',
        },
      },
      {
        name: 'Kiến trúc phối hợp kinh điển (Architecture Pipeline)',
        description: {
          'Amazon Textract': 'Bước 1: Bệnh nhân upload bệnh án PDF scan lên Amazon S3 -> S3 trigger AWS Lambda -> Gọi Amazon Textract để bóc tách toàn bộ text từ PDF.',
          'Amazon Comprehend Medical': 'Bước 2: Lambda nhận text thô từ Textract -> Gọi Amazon Comprehend Medical để trích xuất chẩn đoán y khoa và mã hóa dữ liệu nhạy cảm PHI.',
          'Amazon Rekognition': 'Bước bổ trợ: Dùng Rekognition để nhận diện ảnh thẻ bệnh nhân hoặc khuôn mặt đối chiếu với CCCD trong quy trình check-in bệnh viện.',
        },
      },
    ],
    examTip: 'Nhớ quy tắc 3 bước trong đề thi y tế AWS: (1) S3 lưu PDF -> (2) Amazon Textract trích xuất text từ PDF -> (3) Amazon Comprehend Medical phân tích thuật ngữ y khoa & phát hiện PHI.',
    commonTrap: 'Không bao giờ chọn Comprehend Medical để đọc trực tiếp file scan PDF (nó không có OCR). Cũng không chọn Rekognition để đọc tài liệu y tế (nó là thị giác máy tính cho ảnh/video).',
    docsUrls: [
      { label: 'Amazon Textract Official Guide', url: 'https://docs.aws.amazon.com/textract/' },
      { label: 'Amazon Comprehend Medical Official Guide', url: 'https://docs.aws.amazon.com/comprehend-medical/' },
      { label: 'Amazon Rekognition Official Guide', url: 'https://docs.aws.amazon.com/rekognition/' },
    ],
  },
  {
    id: 's3-vs-ebs-vs-efs',
    title: 'Amazon S3 vs Amazon EBS vs Amazon EFS',
    category: 'Storage',
    services: ['Amazon S3', 'Amazon EBS', 'Amazon EFS'],
    dimensions: [
      {
        name: 'Storage Type',
        description: {
          'Amazon S3': 'Object storage accessed via HTTP/REST APIs (Get/Put). Unlimited capacity.',
          'Amazon EBS': 'Block storage attached to a single EC2 instance as a virtual disk drive.',
          'Amazon EFS': 'POSIX-compliant Network File System (NFSv4) file share.',
        },
      },
      {
        name: 'Scope / Availability',
        description: {
          'Amazon S3': 'Regional service; automatically redundant across 3+ AZs (11 9s durability).',
          'Amazon EBS': 'Locked to a SINGLE Availability Zone. Requires snapshots to move across AZs.',
          'Amazon EFS': 'Regional service; accessible concurrently across multiple AZs and VPCs.',
        },
      },
      {
        name: 'Multi-Instance Attachment',
        description: {
          'Amazon S3': 'Millions of concurrent clients via HTTP REST APIs.',
          'Amazon EBS': 'Single instance (except io1/io2 Multi-Attach on clustered file systems within same AZ).',
          'Amazon EFS': 'Thousands of concurrent Linux instances read/write simultaneously.',
        },
      },
      {
        name: 'Best For',
        description: {
          'Amazon S3': 'Static websites, images/videos, backups, data lakes, big data analytics.',
          'Amazon EBS': 'OS boot volumes, transactional relational databases (Postgres, Oracle).',
          'Amazon EFS': 'Content management systems (WordPress), shared home directories, big data jobs.',
        },
      },
    ],
    examTip: 'If multiple Linux EC2 instances across different AZs need concurrent read/write access to a shared POSIX file system, choose EFS. If it is an OS boot disk, choose EBS. For media and static files, choose S3.',
    commonTrap: 'Never select EBS Multi-Attach as a general shared filesystem answer: it does not support cross-AZ, is limited to io1/io2, and requires a cluster-aware filesystem like GFS2 to prevent corruption.',
  },
  {
    id: 'tcp-vs-http',
    title: 'Giao thức TCP (Layer 4) vs HTTP (Layer 7) trên nền tảng AWS',
    category: 'Networking',
    services: ['TCP (Layer 4 - Transport)', 'HTTP (Layer 7 - Application)'],
    dimensions: [
      {
        name: 'Tầng mô hình OSI',
        description: {
          'TCP (Layer 4 - Transport)': 'Layer 4 (Transport Layer - Tầng giao vận). Quản lý kết nối đầu cuối host-to-host qua cổng (Port).',
          'HTTP (Layer 7 - Application)': 'Layer 7 (Application Layer - Tầng ứng dụng). Giao thức truyền siêu văn bản chạy trên nền kết nối TCP.',
        },
      },
      {
        name: 'Cơ chế hoạt động',
        description: {
          'TCP (Layer 4 - Transport)': 'Hướng kết nối (Connection-oriented) với 3-way handshake (SYN, SYN-ACK, ACK), đảm bảo tin cậy và thứ tự gói tin.',
          'HTTP (Layer 7 - Application)': 'Mô hình Request - Response phi trạng thái (Stateless), truyền tải tài nguyên HTML, JSON, media.',
        },
      },
      {
        name: 'Độ trễ & Hiệu năng',
        description: {
          'TCP (Layer 4 - Transport)': 'Cực thấp (Sub-millisecond), xử lý hàng triệu gói tin/giây mà không cần phân tích nội dung ứng dụng.',
          'HTTP (Layer 7 - Application)': 'Độ trễ cao hơn do overhead từ Header, Cookies, SSL/TLS handshake và phân tích cú pháp ứng dụng.',
        },
      },
      {
        name: 'Khả năng định tuyến & Kiểm tra',
        description: {
          'TCP (Layer 4 - Transport)': 'Chỉ định tuyến theo địa chỉ IP và Cổng (Port). Không đọc hay can thiệp nội dung payload.',
          'HTTP (Layer 7 - Application)': 'Định tuyến thông minh theo URL Path (/api vs /static), Host header, Query string, Cookies, HTTP Methods.',
        },
      },
      {
        name: 'Dịch vụ AWS tương ứng',
        description: {
          'TCP (Layer 4 - Transport)': 'Network Load Balancer (NLB), AWS Global Accelerator, VPC Endpoints (AWS PrivateLink).',
          'HTTP (Layer 7 - Application)': 'Application Load Balancer (ALB), Amazon CloudFront, Amazon API Gateway.',
        },
      },
      {
        name: 'Tính năng bảo mật AWS',
        description: {
          'TCP (Layer 4 - Transport)': 'Hỗ trợ gán Static IP / Elastic IP cho từng AZ để Whitelist tường lửa phía đối tác; TLS Passthrough.',
          'HTTP (Layer 7 - Application)': 'Tích hợp AWS WAF (chống SQL Injection, XSS), SSL/TLS Offloading, xác thực Cognito/OIDC người dùng.',
        },
      },
      {
        name: 'Ứng dụng trong đề thi SAA-C03',
        description: {
          'TCP (Layer 4 - Transport)': 'Hệ thống Gaming thời gian thực, IoT, VoIP, streaming trực tiếp hoặc yêu cầu IP tĩnh cố định whitelist firewall.',
          'HTTP (Layer 7 - Application)': 'Website thương mại điện tử, RESTful API, Microservices định tuyến theo URL, ứng dụng Container (ECS/EKS).',
        },
      },
    ],
    examTip: 'Đề thi SAA-C03: Khi đề bài yêu cầu "hàng triệu request/giây", "độ trễ sub-millisecond" hoặc "IP tĩnh cố định cho từng AZ để whitelist firewall" -> Chọn NLB (TCP Layer 4). Khi đề bài yêu cầu "định tuyến theo URL path / Host header", "tích hợp WAF" hoặc "chứng chỉ SSL/TLS offloading" -> Chọn ALB (HTTP Layer 7).',
    commonTrap: 'ALB chỉ hoạt động ở HTTP/HTTPS/gRPC (Layer 7), KHÔNG hỗ trợ giao thức TCP thô và KHÔNG thể gán Elastic IP cố định. Đừng bao giờ chọn ALB khi khách hàng yêu cầu Whitelist IP tĩnh.',
    docsUrls: [
      { label: 'AWS ALB - How Application Load Balancers Work', url: 'https://docs.aws.amazon.com/elasticloadbalancing/latest/application/introduction.html' },
      { label: 'AWS NLB - How Network Load Balancers Work', url: 'https://docs.aws.amazon.com/elasticloadbalancing/latest/network/introduction.html' },
      { label: 'AWS Whitepaper - Load Balancing Options on AWS', url: 'https://docs.aws.amazon.com/whitepapers/latest/real-time-communication-on-aws/load-balancing.html' },
    ],
  },
  {
    id: 'alb-vs-nlb-vs-glb',
    title: 'Application Load Balancer (ALB) vs Network Load Balancer (NLB) vs Gateway Load Balancer (GLB)',
    category: 'Networking',
    services: ['ALB (Layer 7)', 'NLB (Layer 4)', 'GLB (Layer 3)'],
    dimensions: [
      {
        name: 'OSI Model Layer',
        description: {
          'ALB (Layer 7)': 'Layer 7 (Application): HTTP, HTTPS, gRPC, WebSockets.',
          'NLB (Layer 4)': 'Layer 4 (Transport): TCP, UDP, TLS.',
          'GLB (Layer 3)': 'Layer 3 (Network Gateway): IP packets transparent routing using GENEVE protocol.',
        },
      },
      {
        name: 'IP Address Type',
        description: {
          'ALB (Layer 7)': 'Dynamic IP addresses; clients MUST connect via DNS name.',
          'NLB (Layer 4)': 'Static IP addresses per AZ; can assign Elastic IPs directly.',
          'GLB (Layer 3)': 'Transparent gateway; retains original packet headers without proxying.',
        },
      },
      {
        name: 'Advanced Routing',
        description: {
          'ALB (Layer 7)': 'URL path-based, host-based, HTTP header, query string, and HTTP method routing.',
          'NLB (Layer 4)': 'Port and protocol routing only. No inspection of HTTP headers.',
          'GLB (Layer 3)': 'Routes all IP traffic to third-party virtual security appliances (firewalls/IDS).',
        },
      },
      {
        name: 'Performance & Scale',
        description: {
          'ALB (Layer 7)': 'High throughput with automatic scaling, milliseconds latency.',
          'NLB (Layer 4)': 'Ultra-high throughput, millions of requests per second, sub-millisecond latency.',
          'GLB (Layer 3)': 'High throughput scale-out for third-party security appliances.',
        },
      },
    ],
    examTip: 'Choose ALB for microservices and URL path routing (/api vs /app). Choose NLB when extreme performance, static IP/Elastic IP, or non-HTTP protocols (TCP/UDP) are needed. Choose GLB for third-party firewalls.',
    commonTrap: 'ALB cannot be assigned an Elastic IP address. If a question requires a load balancer with a fixed static IP address whitelisted on a customer firewall, pick NLB.',
    docsUrls: [
      { label: 'AWS ALB Documentation', url: 'https://docs.aws.amazon.com/elasticloadbalancing/latest/application/introduction.html' },
      { label: 'AWS NLB Documentation', url: 'https://docs.aws.amazon.com/elasticloadbalancing/latest/network/introduction.html' },
      { label: 'AWS Gateway Load Balancer Documentation', url: 'https://docs.aws.amazon.com/elasticloadbalancing/latest/gateway/introduction.html' },
    ],
  },
  {
    id: 'rds-multi-az-vs-read-replica',
    title: 'RDS Multi-AZ vs RDS Read Replicas',
    category: 'Database',
    services: ['RDS Multi-AZ', 'RDS Read Replicas'],
    dimensions: [
      {
        name: 'Primary Purpose',
        description: {
          'RDS Multi-AZ': 'High Availability and Disaster Recovery (automatic failover).',
          'RDS Read Replicas': 'Read Performance Scalability and reporting offload.',
        },
      },
      {
        name: 'Replication Type',
        description: {
          'RDS Multi-AZ': 'SYNCHRONOUS replication (zero data loss between primary and standby).',
          'RDS Read Replicas': 'ASYNCHRONOUS replication (subject to replication lag).',
        },
      },
      {
        name: 'Can Serve Traffic?',
        description: {
          'RDS Multi-AZ': 'NO. Standby is completely passive and cannot be queried for reads.',
          'RDS Read Replicas': 'YES. Each replica has its own DNS endpoint for SELECT queries.',
        },
      },
      {
        name: 'Multi-Region Support',
        description: {
          'RDS Multi-AZ': 'Same region only (spans 2 Availability Zones).',
          'RDS Read Replicas': 'Can be created in the same region OR in a different AWS region.',
        },
      },
    ],
    examTip: 'Multi-AZ is for HA / Disaster Recovery. Read Replicas are for Scaling Read Throughput. They can be combined (e.g., a Multi-AZ primary with cross-region read replicas).',
    commonTrap: 'Standby instances in a standard Multi-AZ deployment CANNOT serve read queries. If the question asks to offload BI or analytics queries, the answer is Read Replicas, not Multi-AZ.',
  },
  {
    id: 'security-groups-vs-nacls',
    title: 'Security Groups vs Network ACLs (NACLs)',
    category: 'Security',
    services: ['Security Groups', 'Network ACLs (NACLs)'],
    dimensions: [
      {
        name: 'Operating Level',
        description: {
          'Security Groups': 'Instance / ENI level (applies to individual EC2/RDS network interfaces).',
          'Network ACLs (NACLs)': 'Subnet level (first line of defense for all traffic entering or leaving subnet).',
        },
      },
      {
        name: 'Statefulness',
        description: {
          'Security Groups': 'STATEFUL: Return traffic is automatically allowed regardless of inbound/outbound rules.',
          'Network ACLs (NACLs)': 'STATELESS: Return traffic must be explicitly permitted by outbound and ephemeral port rules.',
        },
      },
      {
        name: 'Rule Types',
        description: {
          'Security Groups': 'ALLOW rules only. Implicit deny for everything else. Cannot write explicit DENY.',
          'Network ACLs (NACLs)': 'Supports both ALLOW and DENY rules evaluated in numbered order (e.g. 100, 200).',
        },
      },
      {
        name: 'Block Specific IP',
        description: {
          'Security Groups': 'CANNOT block a single offending IP address (no deny rules).',
          'Network ACLs (NACLs)': 'CAN block a specific IP address using a low-numbered DENY rule.',
        },
      },
    ],
    examTip: 'When an exam question asks to block a single malicious IP address or subnet at the network layer, Network ACL is the correct answer (Rule #: DENY 198.51.100.23/32).',
    commonTrap: 'Remember that NACLs are stateless: when allowing inbound HTTP traffic on port 80, you must also allow outbound traffic on ephemeral ports (1024-65535) for client responses.',
  },
  {
    id: 'sqs-vs-sns-vs-eventbridge',
    title: 'Amazon SQS vs Amazon SNS vs Amazon EventBridge',
    category: 'Integration',
    services: ['Amazon SQS', 'Amazon SNS', 'Amazon EventBridge'],
    dimensions: [
      {
        name: 'Pattern',
        description: {
          'Amazon SQS': 'Queue (Pull / Polling). One-to-one consumption with message deletion.',
          'Amazon SNS': 'Pub/Sub (Push). One-to-many fanout to multiple subscribers.',
          'Amazon EventBridge': 'Event Bus (Push). Content-based JSON routing to 20+ AWS targets.',
        },
      },
      {
        name: 'Data Retention',
        description: {
          'Amazon SQS': 'Persists messages up to 14 days (default 4 days) until worker deletes.',
          'Amazon SNS': 'Ephemeral; immediately pushed to subscribers or discarded if none.',
          'Amazon EventBridge': 'Ephemeral by default; optional Event Archiving & Replay for past events.',
        },
      },
      {
        name: 'Message Filtering',
        description: {
          'Amazon SQS': 'None (all consumers read from the same queue).',
          'Amazon SNS': 'Subscription Filter Policies on message attributes.',
          'Amazon EventBridge': 'Advanced JSON pattern matching on the full event payload body.',
        },
      },
      {
        name: 'Third-Party SaaS',
        description: {
          'Amazon SQS': 'No native SaaS integrations.',
          'Amazon SNS': 'No native SaaS integrations.',
          'Amazon EventBridge': 'Native Partner Event Sources (Shopify, Datadog, Zendesk, Salesforce).',
        },
      },
    ],
    examTip: 'Use SQS for worker decoupling and rate-limiting. Use SNS for fanout to multiple subscribers. Use EventBridge for complex event schemas, SaaS integrations, or JSON payload inspection.',
    commonTrap: 'SNS does not hold or buffer messages for offline workers. If workers go down, unhandled SNS messages will be lost unless subscribed to SQS DLQs.',
  },
  {
    id: 'nat-gateway-vs-nat-instance',
    title: 'AWS NAT Gateway vs NAT Instance',
    category: 'Networking',
    services: ['NAT Gateway (Managed)', 'NAT Instance (Self-Managed EC2)'],
    dimensions: [
      {
        name: 'Management & Maintenance',
        description: {
          'NAT Gateway (Managed)': 'AWS Managed Service: software patching, OS management, and scaling handled automatically by AWS.',
          'NAT Instance (Self-Managed EC2)': 'Self-Managed EC2 instance: you must patch Linux OS, manage security updates, and configure iptables forwarding.',
        },
      },
      {
        name: 'High Availability',
        description: {
          'NAT Gateway (Managed)': 'Highly available within a single AZ (auto-replaces faulty hardware). Deploy in multiple AZs for multi-AZ resilience.',
          'NAT Instance (Self-Managed EC2)': 'Single point of failure within AZ. Requires complex custom failover scripts (heartbeats and route-table flipping).',
        },
      },
      {
        name: 'Bandwidth & Scalability',
        description: {
          'NAT Gateway (Managed)': 'Automatically scales up to 100 Gbps of bandwidth on-demand without manual instance resizing.',
          'NAT Instance (Self-Managed EC2)': 'Strictly limited by EC2 instance type network bandwidth (e.g. t3.nano vs c5.large).',
        },
      },
      {
        name: 'Security Groups Support',
        description: {
          'NAT Gateway (Managed)': 'CANNOT associate a Security Group directly with a NAT Gateway (NACLs at subnet level apply).',
          'NAT Instance (Self-Managed EC2)': 'CAN attach a Security Group for fine-grained port and IP control.',
        },
      },
      {
        name: 'Source/Destination Check',
        description: {
          'NAT Gateway (Managed)': 'Handled automatically by AWS.',
          'NAT Instance (Self-Managed EC2)': 'MANDATORY: You must explicitly disable "Source/Dest. Check" on the EC2 instance or routing will fail.',
        },
      },
      {
        name: 'Cost Model',
        description: {
          'NAT Gateway (Managed)': 'Hourly fee (~$0.045/hr) + Data processing fee (~$0.045/GB).',
          'NAT Instance (Self-Managed EC2)': 'Standard EC2 instance pricing (can use Spot or T-family for low baseline traffic).',
        },
      },
    ],
    examTip: 'For production architectures requiring high availability, up to 100 Gbps auto-scaling, and zero administrative overhead, always choose AWS NAT Gateway.',
    commonTrap: 'On the exam, if a legacy question asks why a NAT Instance is not forwarding traffic from private subnets, the answer is almost always: you forgot to disable the "Source/Destination Check" on the EC2 instance.',
  },
  {
    id: 'direct-connect-vs-vpn',
    title: 'AWS Direct Connect (DX) vs AWS Site-to-Site VPN',
    category: 'Networking',
    services: ['AWS Direct Connect', 'AWS Site-to-Site VPN'],
    dimensions: [
      {
        name: 'Physical Connection',
        description: {
          'AWS Direct Connect': 'Dedicated physical fiber optic cable connection (1 Gbps, 10 Gbps, 100 Gbps) directly linking on-premises data center to AWS.',
          'AWS Site-to-Site VPN': 'IPsec VPN tunnel running over the public Internet between customer gateway and AWS Virtual Private Gateway / Transit Gateway.',
        },
      },
      {
        name: 'Setup Time',
        description: {
          'AWS Direct Connect': 'Takes weeks to months to coordinate cross-connect fiber with AWS Direct Connect partners and telecommunications providers.',
          'AWS Site-to-Site VPN': 'Can be provisioned in minutes directly through the AWS Management Console.',
        },
      },
      {
        name: 'Latency & Reliability',
        description: {
          'AWS Direct Connect': 'Ultra-low, consistent, deterministic network latency without traversing the public internet.',
          'AWS Site-to-Site VPN': 'Variable internet latency, jitter, and throughput dependent on public ISP conditions.',
        },
      },
      {
        name: 'Data Encryption in Transit',
        description: {
          'AWS Direct Connect': 'UNENCRYPTED by default! To secure data in transit, configure IPsec VPN over Direct Connect (DX + VPN).',
          'AWS Site-to-Site VPN': 'ENCRYPTED by default with IPsec AES-256 standard.',
        },
      },
      {
        name: 'Cost Structure',
        description: {
          'AWS Direct Connect': 'High fixed port monthly charge + significantly discounted data egress rate ($0.02/GB vs $0.09/GB internet).',
          'AWS Site-to-Site VPN': 'Inexpensive hourly fee per VPN connection ($0.05/hr) + standard public Internet egress data charges.',
        },
      },
    ],
    examTip: 'Choose Direct Connect when high throughput (10Gbps+), consistent latency, or lower per-GB data egress cost is required. If immediate setup or low initial investment is required, choose Site-to-Site VPN. For encrypted Direct Connect, combine DX with VPN.',
    commonTrap: 'Direct Connect is NOT encrypted out of the box. If an exam question asks for a dedicated high-speed connection with encryption in transit for compliance, the answer is AWS Direct Connect + IPsec VPN.',
  },
  {
    id: 'sqs-vs-sns',
    title: 'Amazon SQS vs Amazon SNS',
    category: 'Integration',
    services: ['Amazon SQS', 'Amazon SNS'],
    dimensions: [
      {
        name: 'Communication Model',
        description: {
          'Amazon SQS': 'Pull / Polling model: Downstream consumers actively poll messages from the queue, process them, and delete them.',
          'Amazon SNS': 'Push / PubSub model: SNS immediately pushes events to all subscribed endpoints (HTTP, Lambda, SQS, Email, SMS).',
        },
      },
      {
        name: 'Number of Consumers',
        description: {
          'Amazon SQS': '1:1 per message: Each message is delivered to and processed by exactly one worker (competing consumers pattern).',
          'Amazon SNS': '1:Many (Fanout): Each published message is fanned out and delivered to all subscribed endpoints simultaneously.',
        },
      },
      {
        name: 'Message Persistence',
        description: {
          'Amazon SQS': 'Durable queue: Messages are persisted up to 14 days (default 4 days) until a consumer processes and deletes them.',
          'Amazon SNS': 'Ephemeral pub/sub: Messages are not stored permanently; if no subscriber is active or listening, the message is discarded.',
        },
      },
      {
        name: 'Ordering & Deduplication',
        description: {
          'Amazon SQS': 'Supports SQS FIFO queues (strict order, message deduplication, message group ID).',
          'Amazon SNS': 'Supports SNS FIFO topics (strict ordering and deduplication when paired with SQS FIFO queues).',
        },
      },
    ],
    examTip: 'Remember the golden rule: Use SQS for task decoupling, rate-limiting, and batch worker processing. Use SNS for broadcasting notifications or fanout architecture to multiple downstream queues/functions.',
    commonTrap: 'SNS alone does not hold or queue messages for offline consumers. Always combine SNS with SQS (Fanout pattern) to guarantee zero message loss during consumer outages.',
  },
  {
    id: 'kinesis-vs-sqs',
    title: 'Amazon Kinesis Data Streams vs Amazon SQS',
    category: 'Integration',
    services: ['Kinesis Data Streams', 'Amazon SQS'],
    dimensions: [
      {
        name: 'Consumer Model',
        description: {
          'Kinesis Data Streams': 'Pub/Sub Streaming: Multiple independent consumer applications can read the exact same data stream concurrently at their own speed.',
          'Amazon SQS': 'Message Queuing: Individual messages are pulled by one worker, processed, and deleted from the queue.',
        },
      },
      {
        name: 'Data Replay & Retention',
        description: {
          'Kinesis Data Streams': 'REPLAYABLE: Records remain in stream up to 365 days (default 24h) and can be re-read from any point in time by consumers.',
          'Amazon SQS': 'NOT REPLAYABLE: Once a message is acknowledged and deleted by a worker, it cannot be recovered or re-processed.',
        },
      },
      {
        name: 'Ordering Guarantees',
        description: {
          'Kinesis Data Streams': 'Strict ordering guaranteed within each Shard by partition key.',
          'Amazon SQS': 'Standard queue: Best-effort ordering; FIFO queue: Strict FIFO ordering per Message Group ID.',
        },
      },
      {
        name: 'Scaling Mechanism',
        description: {
          'Kinesis Data Streams': 'Provisioned Shards (1MB/s in, 2MB/s out per shard) or On-Demand mode scaling.',
          'Amazon SQS': 'Fully serverless: automatically scales to unlimited throughput (Standard queue) without provisioning capacity.',
        },
      },
    ],
    examTip: 'Choose Kinesis when multiple applications (e.g. Analytics, Fraud, Dashboard) must read and re-read the exact same clickstream or real-time sensor stream. Choose SQS for asynchronous task decoupling and horizontal worker scaling.',
    commonTrap: 'SQS messages are consumed and deleted. If you need replayable historical telemetry or multiple downstream consumers reading the same event at different times, SQS is the wrong choice — use Kinesis.',
  },
  {
    id: 'aurora-global-vs-dynamodb-global',
    title: 'Aurora Global Database vs DynamoDB Global Tables',
    category: 'Database',
    services: ['Aurora Global Database', 'DynamoDB Global Tables'],
    dimensions: [
      {
        name: 'Database Model',
        description: {
          'Aurora Global Database': 'Relational SQL (MySQL/PostgreSQL compatible) with full ACID transactions and complex joins.',
          'DynamoDB Global Tables': 'NoSQL Key-Value and Document database with single-digit millisecond response times at scale.',
        },
      },
      {
        name: 'Replication Architecture',
        description: {
          'Aurora Global Database': 'Single-Primary / Multi-Secondary: ONE primary region handles writes; up to 5 secondary regions provide read replicas.',
          'DynamoDB Global Tables': 'Active-Active Multi-Master: Applications can write AND read simultaneously in any replica region with bi-directional sync.',
        },
      },
      {
        name: 'Replication Latency',
        description: {
          'Aurora Global Database': 'Dedicated storage layer replication with sub-second replication latency (typically < 1 second).',
          'DynamoDB Global Tables': 'Streams-based cross-region replication with typical propagation latency around 1 second.',
        },
      },
      {
        name: 'Disaster Recovery Failover',
        description: {
          'Aurora Global Database': 'Cross-region failover can promote a secondary region to primary with RPO < 1s and RTO < 1 min.',
          'DynamoDB Global Tables': 'Zero downtime failover: since all regions are active-active, write traffic simply reroutes to surviving region.',
        },
      },
    ],
    examTip: 'If your application requires relational SQL, ACID, and multi-region disaster recovery, pick Aurora Global Database. If you need global active-active writes with serverless NoSQL scale, pick DynamoDB Global Tables.',
    commonTrap: 'Aurora Global Database does NOT support active-active writes across multiple regions (only one region accepts writes; others are read-only). DynamoDB Global Tables DOES support active-active multi-region writes.',
  },
  {
    id: 'secrets-manager-vs-parameter-store',
    title: 'AWS Secrets Manager vs Systems Manager Parameter Store',
    category: 'Security',
    services: ['AWS Secrets Manager', 'SSM Parameter Store'],
    dimensions: [
      {
        name: 'Automatic Rotation',
        description: {
          'AWS Secrets Manager': 'NATIVE AUTOMATIC ROTATION built-in for RDS, Aurora, DocumentDB, and Redshift using pre-built Lambda rotation functions.',
          'SSM Parameter Store': 'NO native automatic rotation. Rotating credentials requires manual updates or complex custom Lambda/EventBridge workflows.',
        },
      },
      {
        name: 'Cost',
        description: {
          'AWS Secrets Manager': 'Paid service: $0.40 per secret per month + $0.05 per 10,000 API calls.',
          'SSM Parameter Store': 'Standard tier is completely FREE (up to 10,000 parameters, 4KB size). Advanced parameters cost $0.05/month.',
        },
      },
      {
        name: 'KMS Encryption Support',
        description: {
          'AWS Secrets Manager': 'Encrypted at rest by default using KMS AWS managed keys or customer managed keys.',
          'SSM Parameter Store': 'Supports String, StringList, and SecureString (encrypted with KMS).',
        },
      },
      {
        name: 'Cross-Account Access',
        description: {
          'AWS Secrets Manager': 'Supports native resource-based policies on secrets for simple cross-account access.',
          'SSM Parameter Store': 'Cross-account sharing supported via AWS RAM (Resource Access Manager).',
        },
      },
    ],
    examTip: 'When an exam question mentions automatic rotation of database passwords (RDS, Aurora, Redshift), the answer is always AWS Secrets Manager. If it is non-rotating configuration parameters or lowest-cost storage, choose SSM Parameter Store.',
    commonTrap: 'SSM Parameter Store is free, but it does NOT offer native automated credential rotation out of the box.',
  },
  {
    id: 'cognito-user-pools-vs-identity-pools',
    title: 'Cognito User Pools vs Cognito Identity Pools',
    category: 'Security',
    services: ['Cognito User Pools (CUP)', 'Cognito Identity Pools (CIP)'],
    dimensions: [
      {
        name: 'Primary Purpose',
        description: {
          'Cognito User Pools (CUP)': 'Authentication & User Directory ("Who are you?"). Handles registration, login, password recovery, MFA, and social federation.',
          'Cognito Identity Pools (CIP)': 'Authorization & AWS Access ("What are you allowed to do in AWS?"). Provides temporary AWS STS IAM credentials to access AWS resources.',
        },
      },
      {
        name: 'Output Token / Credential',
        description: {
          'Cognito User Pools (CUP)': 'JSON Web Tokens (JWT): ID Token, Access Token, Refresh Token. Used to authenticate with APIs (API Gateway / ALB).',
          'Cognito Identity Pools (CIP)': 'Temporary AWS Credentials (Access Key ID, Secret Access Key, Session Token) issued by AWS STS.',
        },
      },
      {
        name: 'Access Target',
        description: {
          'Cognito User Pools (CUP)': 'Application backend APIs, API Gateway HTTP endpoints, Application Load Balancers.',
          'Cognito Identity Pools (CIP)': 'Direct access to native AWS services: Amazon S3 (e.g. upload photo directly), DynamoDB, Kinesis, etc.',
        },
      },
      {
        name: 'Identity Providers Supported',
        description: {
          'Cognito User Pools (CUP)': 'Built-in user directory, Google, Facebook, Apple, Amazon, SAML 2.0, OpenID Connect.',
          'Cognito Identity Pools (CIP)': 'Cognito User Pools, Google, Facebook, Apple, SAML, OIDC, and Unauthenticated (Guest) identities.',
        },
      },
    ],
    examTip: 'Remember the 5-second trick: User Pools = Authentication (JWT). Identity Pools = Authorization (Temporary AWS Credentials for AWS Services like S3).',
    commonTrap: 'A User Pool JWT cannot be used to call AWS APIs directly. You must exchange it through an Identity Pool to obtain AWS IAM credentials.',
  },
];

export function getAllServices(): AWSServiceGuide[] {
  return AWS_SERVICES;
}

export function getServiceById(id: string): AWSServiceGuide | undefined {
  return AWS_SERVICES.find((s) => s.id.toLowerCase() === id.toLowerCase() || s.abbreviation?.toLowerCase() === id.toLowerCase());
}

export function getServicesByCategory(category: string): AWSServiceGuide[] {
  return AWS_SERVICES.filter((s) => s.category.toLowerCase() === category.toLowerCase());
}

export function searchServices(query: string): AWSServiceGuide[] {
  const q = query.trim().toLowerCase();
  if (!q) return AWS_SERVICES;
  return AWS_SERVICES.filter((s) => 
    s.name.toLowerCase().includes(q) ||
    (s.abbreviation && s.abbreviation.toLowerCase().includes(q)) ||
    s.summary.toLowerCase().includes(q) ||
    s.coreConcepts.some((c) => c.toLowerCase().includes(q)) ||
    s.examRelevance.toLowerCase().includes(q)
  );
}

export function getAllComparisons(): ServiceComparison[] {
  return SERVICE_COMPARISONS;
}

export function getComparisonById(id: string): ServiceComparison | undefined {
  return SERVICE_COMPARISONS.find((c) => c.id === id);
}
