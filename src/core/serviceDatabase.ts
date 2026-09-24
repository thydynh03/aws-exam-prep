import type { AWSServiceGuide, ServiceComparison } from './types';

export const AWS_SERVICES: AWSServiceGuide[] = [
  // --- COMPUTE ---
  {
    id: 'ec2',
    name: 'Amazon EC2',
    category: 'Compute',
    abbreviation: 'EC2',
    summary: 'Elastic Compute Cloud cung cấp năng lực tính toán co giãn được, cho bạn toàn quyền kiểm soát ở mức hệ điều hành.',
    coreConcepts: [
      'Instance type: General Purpose (M/T), Compute (C), Memory (R/X), Storage (I/D), Accelerated (P/G)',
      'Mô hình giá: On-Demand, Spot (giảm tới 90%, có thể bị thu hồi), Reserved Instance / Savings Plans (cam kết 1-3 năm)',
      'Placement group: Cluster (độ trễ thấp, 10Gbps, trong 1 AZ), Spread (mỗi instance trên phần cứng riêng, tối đa 7 mỗi AZ), Partition (cho hệ phân tán kiểu Hadoop/Kafka)',
      'Script User Data chạy đúng một lần lúc launch với quyền root; Instance Metadata Service (IMDSv2 dùng session token)',
    ],
    useCases: [
      'Ứng dụng monolith truyền thống cần tùy biến kernel hoặc cài gói phần mềm riêng',
      'Workload xử lý theo batch, tận dụng Spot Instance để giảm chi phí',
      'High Performance Computing (HPC) với Cluster Placement Group và EFA',
    ],
    examRelevance: 'Xuất hiện dày đặc ở mọi domain: tối ưu chi phí (Spot vs RI), khả năng chịu lỗi (Auto Scaling qua nhiều AZ) và bảo mật (IAM role, IMDSv2, security group).',
    commonTraps: [
      'Spot Instance chỉ báo trước 2 phút trước khi bị thu hồi — đừng dùng cho workload có trạng thái hoặc không chịu được lỗi',
      'Cluster placement group không trải ra được nhiều Availability Zone',
      'Stop một EC2 instance sẽ mất dữ liệu trên Instance Store; volume EBS gốc thì vẫn còn',
    ],
    relatedServices: ['ebs', 'auto-scaling', 'alb', 'iam'],
    docsUrl: 'https://docs.aws.amazon.com/ec2/',
  },
  {
    id: 'lambda',
    name: 'AWS Lambda',
    category: 'Compute',
    abbreviation: 'Lambda',
    summary: 'Dịch vụ compute serverless, chạy code theo sự kiện mà không cần provision server.',
    coreConcepts: [
      'Hướng sự kiện: kích hoạt từ S3, DynamoDB Streams, SQS, API Gateway, EventBridge, v.v.',
      'Giới hạn thực thi: timeout tối đa 15 phút, bộ nhớ tối đa 10 GB, /tmp tạm tối đa 10 GB',
      'Cold start và Provisioned Concurrency để giữ độ trễ thấp và ổn định',
      'Truy cập VPC: gắn Hyperplane ENI để nói chuyện nhanh với tài nguyên trong VPC (RDS, ElastiCache)',
    ],
    useCases: [
      'Backend web serverless đi kèm Amazon API Gateway',
      'Xử lý file theo thời gian thực ngay khi object được upload lên S3 (tạo thumbnail, quét virus)',
      'ETL hướng sự kiện và biến đổi luồng dữ liệu với Kinesis và DynamoDB Streams',
    ],
    examRelevance: 'Là đáp án compute serverless được ưu tiên trong SAA-C03 khi đề nhấn mạnh chi phí vận hành thấp nhất và khả năng scale về 0.',
    commonTraps: [
      'Lambda không chạy quá 15 phút; job dài hơn phải dùng AWS Step Functions, ECS hoặc AWS Batch',
      'Lambda đặt trong VPC cần NAT Gateway hoặc VPC Endpoint mới ra được internet công cộng hay gọi được AWS API',
    ],
    relatedServices: ['api-gateway', 'step-functions', 'sqs', 'dynamodb'],
    docsUrl: 'https://docs.aws.amazon.com/lambda/',
  },
  {
    id: 'ecs-fargate',
    name: 'Amazon ECS & AWS Fargate',
    category: 'Compute',
    abbreviation: 'ECS / Fargate',
    summary: 'Dịch vụ điều phối container được quản lý hoàn toàn, hỗ trợ cả launch type EC2 lẫn Fargate serverless.',
    coreConcepts: [
      'ECS Launch Type: EC2 (bạn tự quản lý instance và vá OS) và Fargate (serverless, tính tiền theo vCPU/GB)',
      'Task Definition mô tả container, CPU/memory, biến môi trường, IAM task role',
      'Service auto-scaling theo target tracking (CPU, memory, số request của ALB)',
      'Task Execution Role (kéo image, ghi log CloudWatch) khác với Task Role (quyền của ứng dụng lên S3, DynamoDB)',
    ],
    useCases: [
      'Kiến trúc microservice đóng gói bằng Docker container',
      'Tác vụ backend chạy lâu trong container, vượt giới hạn 15 phút của Lambda',
      'Job batch hoặc tác vụ chạy định kỳ mà không phải nuôi EC2 instance rảnh rỗi',
    ],
    examRelevance: 'Khi đề nhắc tới container kèm yêu cầu "quản lý vận hành tối thiểu", AWS Fargate gần như luôn là đáp án đúng thay vì ECS trên EC2.',
    commonTraps: [
      'Nhầm ECS Task Role (quyền cho code ứng dụng bên trong container) với Task Execution Role (quyền để ECS agent kéo image và gửi log)',
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
    summary: 'Dịch vụ lưu trữ object khả năng mở rộng rất cao, độ bền 11 9s, truy cập qua HTTP REST API.',
    coreConcepts: [
      'Độ bền: 99.999999999% (11 9s) trên từ 3 AZ trở lên (trừ One Zone-IA)',
      'Storage class: Standard, Intelligent-Tiering, Standard-IA, One Zone-IA, Glacier Instant, Glacier Flexible, Glacier Deep Archive',
      'Bảo mật: Block Public Access (mặc định bật), SSE-S3 (AES-256), SSE-KMS, SSE-C, mã hóa phía client, bucket policy, ACL',
      'Lifecycle rule để tự động chuyển tầng lưu trữ và hết hạn object',
      'Hiệu năng: S3 Transfer Acceleration, Multipart Upload (bắt buộc với file > 5 GB), byte-range fetch',
    ],
    useCases: [
      'Lưu trữ tài nguyên tĩnh và hosting website, kết hợp với CloudFront',
      'Data lake phục vụ các công cụ phân tích (Athena, EMR, Redshift Spectrum)',
      'Lưu trữ dài hạn phục vụ tuân thủ với S3 Object Lock và Glacier Deep Archive',
    ],
    examRelevance: 'Dịch vụ lưu trữ xuất hiện nhiều nhất trong SAA-C03. Thường hỏi về chính sách bảo mật, cross-region replication (CRR), lifecycle rule và storage class.',
    commonTraps: [
      'Multipart upload được khuyến nghị với object > 100 MB, nhưng bắt buộc với object > 5 GB',
      'S3 One Zone-IA không chịu được sự cố mất trắng một AZ',
      'Bật Cross-Region Replication (CRR) đòi hỏi Versioning phải bật ở CẢ bucket nguồn lẫn bucket đích',
    ],
    relatedServices: ['cloudfront', 'kms', 'athena', 'glacier'],
    docsUrl: 'https://docs.aws.amazon.com/s3/',
  },
  {
    id: 'ebs',
    name: 'Amazon Elastic Block Store',
    category: 'Storage',
    abbreviation: 'EBS',
    summary: 'Block storage hiệu năng cao, gắn vào EC2 instance trong phạm vi một Availability Zone.',
    coreConcepts: [
      'Volume type: General Purpose SSD (gp3/gp2), Provisioned IOPS SSD (io2/io1 - throughput cao, hỗ trợ Multi-Attach), Throughput Optimized HDD (st1 - đọc tuần tự cho big data), Cold HDD (sc1 - lưu trữ log)',
      'Tính sẵn sàng: gắn chặt với một AZ; muốn chuyển sang AZ khác phải tạo EBS Snapshot (lưu trên S3) rồi khôi phục ở AZ đích',
      'Snapshot: tăng dần (incremental), crash-consistent hoặc application-consistent qua VSS, có Fast Snapshot Restore (FSR)',
      'Mã hóa: dùng KMS key; snapshot của volume đã mã hóa cũng tự động được mã hóa',
    ],
    useCases: [
      'Ổ boot và ổ hệ thống cho EC2 instance',
      'Database quan hệ và NoSQL chạy trực tiếp trên EC2',
      'Workload đọc tuần tự nặng (st1) cho data warehouse hoặc cụm big data',
    ],
    examRelevance: 'Hay được đem so với EFS và S3. Câu hỏi xoáy vào volume type (gp3 vs io2 vs st1), giới hạn của Multi-Attach và vòng đời snapshot.',
    commonTraps: [
      'EBS volume bị khóa theo AZ! Không gắn trực tiếp vào EC2 instance ở AZ khác được nếu không snapshot',
      'EBS Multi-Attach chỉ hỗ trợ volume io1/io2 và cần file system hiểu cluster (ví dụ GFS2); không có nó thì ghi đồng thời KHÔNG an toàn',
      'Volume HDD st1 và sc1 KHÔNG dùng làm boot volume cho EC2 được',
    ],
    relatedServices: ['ec2', 'kms', 'efs', 's3'],
    docsUrl: 'https://docs.aws.amazon.com/ebs/',
  },
  {
    id: 'efs',
    name: 'Amazon Elastic File System',
    category: 'Storage',
    abbreviation: 'EFS',
    summary: 'File system chia sẻ chuẩn POSIX (NFSv4), serverless, co giãn hoàn toàn, dùng chung qua nhiều AZ.',
    coreConcepts: [
      'Mặc định có sẵn tính sẵn sàng và độ bền Multi-AZ (ngoài ra còn storage class One Zone)',
      'Truy cập đồng thời: hàng nghìn EC2 instance Linux, task ECS/EKS và server on-premises có thể mount cùng lúc',
      'Performance mode: General Purpose (độ trễ thấp) và Max I/O (throughput tổng cao)',
      'Throughput mode: Bursting, Provisioned và Elastic (tự co giãn theo workload)',
      'Lifecycle Management: tự chuyển file sang Infrequent Access (EFS-IA) khi lâu không dùng',
    ],
    useCases: [
      'Hệ quản trị nội dung dùng chung (WordPress, Drupal) trên nhóm EC2 tự co giãn',
      'Thư mục home dùng chung cho nhóm dev và artifact build CI/CD',
      'Lưu trữ bền cho container ở Amazon ECS và EKS',
    ],
    examRelevance: 'Ra thi mỗi khi bài toán cần một file system dùng chung chuẩn POSIX, nhiều instance Linux cùng đọc ghi.',
    commonTraps: [
      'EFS chỉ phục vụ Linux qua NFSv4; nếu cần chia sẻ file Windows bằng SMB thì đáp án là Amazon FSx for Windows File Server',
      'Đừng chọn EBS Multi-Attach khi yêu cầu là chia sẻ file chuẩn qua nhiều AZ — chọn EFS',
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
    summary: 'Dịch vụ database quan hệ được quản lý, hỗ trợ Postgres, MySQL, MariaDB, Oracle và SQL Server.',
    coreConcepts: [
      'Multi-AZ Deployment: replication đồng bộ sang standby ở AZ khác để có High Availability và failover tự động (không mất dữ liệu, giữ nguyên DNS endpoint)',
      'Read Replica: replication bất đồng bộ (tối đa 5 với RDS, 15 với Aurora) để scale đọc và tách tải báo cáo; có thể promote thành database độc lập; có thể đặt ở region khác',
      'Backup: snapshot tự động hằng ngày (giữ 1-35 ngày) kèm transaction log cho point-in-time recovery (PITR); snapshot thủ công không bao giờ hết hạn',
      'Storage Auto Scaling: tự tăng dung lượng lưu trữ tới 64 TB mà không downtime',
    ],
    useCases: [
      'Ứng dụng quan hệ truyền thống cần ACID và câu SQL JOIN phức tạp',
      'Di chuyển database doanh nghiệp (Oracle, SQL Server) với vá lỗi và backup tự động',
      'Web app đọc nhiều, dùng Read Replica đứng sau Route 53 hoặc một proxy ứng dụng',
    ],
    examRelevance: 'Món ruột của SAA-C03. Đề phân biệt rất kỹ Multi-AZ (High Availability / Disaster Recovery) với Read Replica (scale hiệu năng đọc).',
    commonTraps: [
      'Standby của Multi-AZ KHÔNG phục vụ được traffic đọc; nó chỉ là bản dự phòng active-passive để failover',
      'Read Replica dùng replication bất đồng bộ nên luôn có độ trễ — không hợp với yêu cầu đọc nhất quán tuyệt đối',
    ],
    relatedServices: ['aurora', 'ec2', 'kms', 'route53'],
    docsUrl: 'https://docs.aws.amazon.com/rds/',
  },
  {
    id: 'aurora',
    name: 'Amazon Aurora',
    category: 'Database',
    abbreviation: 'Aurora',
    summary: 'Database quan hệ thiết kế riêng cho cloud, tương thích MySQL/Postgres, throughput gấp 5 lần MySQL và 3 lần Postgres.',
    coreConcepts: [
      'Kiến trúc lưu trữ: 6 bản sao trên 3 AZ; mất 2 bản vẫn ghi được, mất 3 bản vẫn đọc được',
      'Storage tự phục hồi: liên tục sửa lỗi disk block; tự mở rộng tới 128 TiB theo từng bước 10 GB',
      'Read Replica: tối đa 15 replica với độ trễ replication dưới 10ms; tự động failover sang read replica trong chưa tới 30 giây',
      'Aurora Serverless v2: co giãn tức thì theo đơn vị ACU (Aurora Capacity Unit) rất mịn',
      'Aurora Global Database: replication cross-region dưới một giây cho disaster recovery, RPO < 1s và RTO < 1 phút',
    ],
    useCases: [
      'Workload quan hệ doanh nghiệp throughput cao, SLA về RTO/RPO khắt khe',
      'Scale đọc toàn cầu qua nhiều region bằng Aurora Global Database',
      'Lưu lượng database thất thường, lúc có lúc không, dùng Aurora Serverless v2',
    ],
    examRelevance: 'Luôn là đáp án nhỉnh hơn RDS thường khi đề yêu cầu tính sẵn sàng cao, thời gian failover ngắn (<30s), replication cross-region dưới một giây, hoặc storage tự co giãn.',
    commonTraps: [
      'Aurora dùng chung một cluster storage volume; mọi replica đọc từ đúng cùng một lớp lưu trữ, nhờ vậy độ trễ replication mới thấp đến thế',
    ],
    relatedServices: ['rds', 'secrets-manager', 'route53'],
    docsUrl: 'https://docs.aws.amazon.com/AmazonRDS/latest/AuroraUserGuide/',
  },
  {
    id: 'dynamodb',
    name: 'Amazon DynamoDB',
    category: 'Database',
    abbreviation: 'DynamoDB',
    summary: 'Database NoSQL dạng key-value và document, serverless, được quản lý hoàn toàn, độ trễ một chữ số mili giây.',
    coreConcepts: [
      'Thiết kế dữ liệu: Partition Key (HASH) để phân tán dữ liệu; Sort Key (RANGE) để sắp thứ tự trong một partition',
      'Capacity mode: On-Demand (trả theo request, hợp workload khó đoán) và Provisioned (auto-scaling WCU/RCU, hợp workload đoán được)',
      'DynamoDB Streams: luồng thay đổi ở mức item theo thứ tự (giữ 24h), dùng để trigger Lambda hoặc đẩy sang OpenSearch',
      'DynamoDB Accelerator (DAX): cache in-memory cho độ trễ đọc cỡ micro giây với workload đọc nhiều',
      'Global Table: replication active-active đa region, đồng bộ hai chiều, được quản lý hoàn toàn',
    ],
    useCases: [
      'Bảng xếp hạng game, lưu session người dùng, giỏ hàng — những chỗ cần độ trễ vài mili giây',
      'Backend mobile và thu thập dữ liệu cảm biến IoT ở quy mô rất lớn',
      'Database active-active toàn cầu bằng DynamoDB Global Tables',
    ],
    examRelevance: 'Là database NoSQL chính trong đề. Thường hỏi On-Demand vs Provisioned, DAX cho độ trễ micro giây, mẫu DynamoDB Streams + Lambda và Global Tables.',
    commonTraps: [
      'ElastiCache Redis buộc phải sửa code ứng dụng để xử lý cache miss; DAX tương thích API sẵn nên ứng dụng không cần biết',
      'Strongly Consistent Read tốn gấp đôi Read Capacity Unit (RCU) so với Eventually Consistent Read',
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
    summary: 'Mạng ảo cô lập về mặt logic, cho bạn kiểm soát chi tiết dải IP, subnet, route table và gateway.',
    coreConcepts: [
      'Subnet: public (route ra Internet Gateway) và private (route qua NAT Gateway để đi internet chiều ra)',
      'NAT Gateway: được quản lý, dự phòng trong phạm vi một AZ; phải đặt ở subnet PUBLIC kèm Elastic IP; subnet private trỏ default route (0.0.0.0/0) vào nó',
      'VPC Peering: kết nối không bắc cầu giữa hai VPC (A-B và B-C KHÔNG suy ra A-C)',
      'VPC Endpoint: Gateway Endpoint (MIỄN PHÍ, cho S3 và DynamoDB qua route table) và Interface Endpoint (PrivateLink, ENI có IP private, tính phí theo giờ và theo dữ liệu, dùng cho các service còn lại)',
    ],
    useCases: [
      'Kiến trúc nhiều tầng (web tier public, app tier private, DB tier cô lập)',
      'Kết nối hybrid an toàn với AWS Site-to-Site VPN hoặc AWS Direct Connect',
      'Truy cập S3 riêng tư không cần đi ra internet, dùng Gateway VPC Endpoint',
    ],
    examRelevance: 'Nền tảng cốt lõi của SAA-C03. Đề hỏi về routing, NAT Gateway, tính không bắc cầu của VPC Peering và VPC Endpoint (Gateway vs Interface).',
    commonTraps: [
      'VPC Peering KHÔNG hỗ trợ định tuyến bắc cầu — với mô hình hub-and-spoke từ 10 VPC trở lên, dùng AWS Transit Gateway',
      'Gateway Endpoint CHỈ dành cho S3 và DynamoDB; mọi service khác phải dùng Interface Endpoint (PrivateLink)',
      'NAT Gateway gắn với một AZ: muốn có tính sẵn sàng cao thì đặt một NAT Gateway ở MỖI public subnet trên nhiều AZ',
    ],
    relatedServices: ['transit-gateway', 'direct-connect', 'route53', 'ec2'],
    docsUrl: 'https://docs.aws.amazon.com/vpc/',
  },
  {
    id: 'alb-nlb',
    name: 'Elastic Load Balancing (ALB & NLB)',
    category: 'Networking',
    abbreviation: 'ELB (ALB / NLB)',
    summary: 'Phân phối lưu lượng ứng dụng hoặc mạng đến nhiều target trải trên nhiều AZ.',
    coreConcepts: [
      'Application Load Balancer (ALB): Layer 7 (HTTP/HTTPS/gRPC), định tuyến theo path/host/query, redirect và fixed response, SSL termination, target là EC2, ECS, Lambda hoặc IP',
      'Network Load Balancer (NLB): Layer 4 (TCP/UDP/TLS), hiệu năng cực cao, hàng triệu request/giây, IP tĩnh cho mỗi AZ, hỗ trợ Elastic IP, độ trễ dưới một mili giây',
      'Cross-Zone Load Balancing: ALB bật sẵn (miễn phí); NLB tắt sẵn (bật lên sẽ phát sinh phí dữ liệu giữa các AZ)',
      'Health check: target bị đánh dấu unhealthy sẽ ngừng nhận traffic mới; kết nối đang mở được đóng êm (deregistration delay)',
    ],
    useCases: [
      'Định tuyến microservice theo URL path (/api/users, /api/orders) bằng ALB',
      'Game thời gian thực, giao thức tài chính hoặc socket TCP không phải HTTP cần IP tĩnh, dùng NLB',
      'Offload SSL/TLS để giảm tải tính toán cho web server EC2 phía sau',
    ],
    examRelevance: 'Món ruột của SAA-C03. Phân biệt ALB (tính năng HTTP Layer 7) với NLB (IP tĩnh Layer 4, throughput cực lớn) được hỏi đi hỏi lại.',
    commonTraps: [
      'ALB KHÔNG có IP tĩnh — chỉ có DNS name; nếu đề đòi IP tĩnh hoặc Elastic IP thì chọn NLB hoặc AWS Global Accelerator',
      'ALB truyền IP client qua header `X-Forwarded-For`; NLB giữ nguyên IP client ngay trong gói TCP mà không dịch địa chỉ',
    ],
    relatedServices: ['ec2', 'route53', 'waf', 'global-accelerator'],
    docsUrl: 'https://docs.aws.amazon.com/elasticloadbalancing/',
  },
  {
    id: 'cloudfront',
    name: 'Amazon CloudFront',
    category: 'Networking',
    abbreviation: 'CloudFront',
    summary: 'Mạng phân phối nội dung (CDN) toàn cầu, tăng tốc phân phối nội dung web tĩnh lẫn động.',
    coreConcepts: [
      'Edge Location và Regional Edge Cache: hơn 450 điểm hiện diện (PoP) cache nội dung gần người dùng trên toàn thế giới',
      'Origin: bucket S3, ALB, EC2 hoặc server HTTP tùy ý',
      'Origin Access Control (OAC): siết quyền truy cập bucket S3 để người dùng không đi vòng qua CloudFront mà gọi thẳng S3',
      'Bảo mật: tích hợp AWS WAF, AWS Shield Standard (chống DDoS miễn phí) và chứng chỉ SSL riêng qua ACM (bắt buộc ở us-east-1)',
      'Edge compute: CloudFront Functions (rewrite URL, chỉnh header, dưới một mili giây) và Lambda@Edge (chạy logic Node/Python đầy đủ, gọi được ra mạng)',
    ],
    useCases: [
      'Phân phối website tĩnh toàn cầu (S3 + CloudFront + ACM)',
      'Chống DDoS và chặn theo vùng địa lý cho ứng dụng web công khai',
      'Tăng tốc payload API động nhờ đi qua đường backbone tối ưu của AWS',
    ],
    examRelevance: 'Đáp án chính khi cần giảm độ trễ cho người dùng phân tán toàn cầu và bảo vệ origin S3 bằng Origin Access Control (OAC).',
    commonTraps: [
      'Origin Access Identity (OAI) đã lỗi thời; đề thi hiện nay hỏi Origin Access Control (OAC)',
      'Chứng chỉ SSL cho CloudFront distribution BẮT BUỘC phải tạo ở region `us-east-1` (N. Virginia)',
    ],
    relatedServices: ['s3', 'waf', 'route53', 'acm'],
    docsUrl: 'https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/',
  },
  {
    id: 'global-accelerator',
    name: 'AWS Global Accelerator',
    category: 'Networking',
    abbreviation: 'AGA',
    summary: 'Dịch vụ mạng giúp ứng dụng có người dùng toàn cầu chạy nhanh và ổn định hơn, bằng cách cấp 2 địa chỉ IP Anycast tĩnh và định tuyến qua mạng riêng toàn cầu của AWS.',
    coreConcepts: [
      'Địa chỉ Anycast tĩnh: cấp 2 địa chỉ IPv4 Anycast public cố định làm điểm vào toàn cầu',
      'Backbone toàn cầu của AWS: đưa traffic từ edge location về endpoint backend qua mạng cáp quang riêng của AWS, tránh tắc nghẽn và jitter của Internet công cộng',
      'Hỗ trợ giao thức: tăng tốc cả TCP lẫn UDP (khác CloudFront vốn chủ yếu phục vụ HTTP/HTTPS/WebSocket)',
      'Endpoint đích: Application Load Balancer (ALB), Network Load Balancer (NLB), EC2 instance và Elastic IP, ở một hay nhiều Region',
      'Failover tức thì: chuyển vùng giữa các AWS Region theo health check trong dưới 30 giây, không phải chờ DNS TTL hết hạn',
      'Giữ IP client: bảo toàn IP gốc của client với endpoint là ALB và EC2',
    ],
    useCases: [
      'Ứng dụng không phải HTTP/HTTPS (game thời gian thực TCP/UDP, VoIP, IoT, giao dịch tài chính) cần độ trễ thấp trên phạm vi toàn cầu',
      'Ứng dụng HTTP cần IP tĩnh cố định (để khách hàng whitelist trên firewall) nhưng vẫn muốn dùng định tuyến Layer 7 của ALB',
      'Disaster recovery đa Region và failover tức thì, không phải chờ DNS lan truyền',
    ],
    examRelevance: 'Là đáp án then chốt trong SAA-C03 khi đề nêu 2 địa chỉ IP tĩnh, traffic TCP/UDP không phải HTTP, hoặc failover cross-region tức thì. Nhớ đối chiếu với CloudFront vốn cache nội dung HTTP/HTTPS tại edge location.',
    commonTraps: [
      'CloudFront cache nội dung tại edge location; Global Accelerator KHÔNG cache gì cả — nó chỉ tăng tốc truyền tải qua backbone riêng của AWS',
      'CloudFront sinh ra cho web HTTP/HTTPS/WebSocket; Global Accelerator hỗ trợ TCP và UDP nói chung',
      'ALB không có IP tĩnh (chỉ có DNS name); đặt Global Accelerator trước ALB thì vừa có IP Anycast tĩnh vừa giữ được định tuyến Layer 7',
    ],
    relatedServices: ['alb-nlb', 'cloudfront', 'route53', 'ec2'],
    docsUrl: 'https://docs.aws.amazon.com/global-accelerator/',
  },
  {
    id: 'tcp-networking',
    name: 'TCP-based Applications on AWS',
    category: 'Networking',
    abbreviation: 'TCP Apps',
    summary: 'Các ứng dụng dùng Transmission Control Protocol (TCP) để truyền luồng dữ liệu tin cậy, hướng kết nối và có kiểm lỗi giữa các host trong mạng (Layer 4 - transport).',
    coreConcepts: [
      'Giao thức TCP: bắt tay 3 bước (SYN, SYN-ACK, ACK), truyền tin cậy với tự động gửi lại gói mất, luồng byte đúng thứ tự, có kiểm soát tắc nghẽn',
      'Ứng dụng TCP phổ biến: web (HTTP/HTTPS qua TCP port 80/443), truy cập từ xa (SSH port 22, RDP port 3389), kết nối database (PostgreSQL 5432, MySQL 3306), FTP, socket server tự viết, server giữ trạng thái game nhiều người chơi',
      'Cân bằng tải trên AWS: NLB (Network Load Balancer) chạy thuần Layer 4 (TCP/TLS), throughput cực cao, độ trễ dưới một mili giây, có IP tĩnh; ALB chạy Layer 7 (HTTP/HTTPS trên nền TCP)',
      'Tăng tốc toàn cầu: AWS Global Accelerator cấp 2 địa chỉ IP Anycast tĩnh, đưa traffic TCP và UDP qua backbone cáp quang riêng của AWS, giảm mạnh độ trễ và mất gói',
      'Bảo mật: kiểm soát bằng security group (stateful) và network ACL (stateless), lọc dải port TCP vào/ra',
    ],
    useCases: [
      'Game server throughput cao, xử lý giao dịch tài chính và endpoint MQTT cho IoT, dùng NLB',
      'Tăng tốc kết nối TCP toàn cầu bằng AWS Global Accelerator để giảm độ trễ và mất gói',
      'Kết nối mạng doanh nghiệp cần whitelist IP tĩnh trên firewall về backend AWS',
    ],
    examRelevance: 'Điểm phân biệt quan trọng trong SAA-C03: app TCP không phải HTTP hoặc cần IP tĩnh thì dùng NLB hoặc Global Accelerator. App HTTP/HTTPS cần định tuyến theo path/host thì dùng ALB. CloudFront không tăng tốc được traffic TCP thuần.',
    commonTraps: [
      'CloudFront KHÔNG hỗ trợ ứng dụng TCP/UDP thuần ngoài HTTP (chỉ HTTP/HTTPS/WebSocket) — hãy dùng AWS Global Accelerator hoặc NLB',
      'ALB không thể xử lý luồng TCP thô mà không parse HTTP — ứng dụng socket TCP thô phải dùng NLB',
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
    summary: 'Dịch vụ hàng đợi tin nhắn được quản lý hoàn toàn, dùng để tách rời và mở rộng microservice cùng hệ phân tán.',
    coreConcepts: [
      'Standard Queue: throughput không giới hạn, giao ít nhất một lần, thứ tự chỉ ở mức best-effort',
      'FIFO Queue: giao đúng một lần, giữ thứ tự vào trước ra trước, có message deduplication ID và message group ID (giới hạn 3,000 msg/s ở chế độ high throughput)',
      'Visibility Timeout: khoảng thời gian message bị ẩn với consumer khác trong lúc đang được xử lý (mặc định 30s, tối đa 12h); có API ChangeMessageVisibility',
      'Dead-Letter Queue (DLQ): tách riêng message xử lý thất bại quá ngưỡng maxReceiveCount',
      'Long Polling: WaitTimeSeconds tối đa 20s giúp giảm phản hồi rỗng và giảm chi phí',
    ],
    useCases: [
      'Tách ứng dụng web ghi nhiều ra khỏi phần worker xử lý nền',
      'Làm phẳng các đợt tăng traffic đột biến giữa các microservice (đệm và điều tiết)',
      'Giao dịch tài chính cần giữ thứ tự nghiêm ngặt, dùng SQS FIFO',
    ],
    examRelevance: 'Gần như đề nào cũng có, xoay quanh tách rời bất đồng bộ, đệm traffic đột biến và đánh đổi giữa FIFO với Standard.',
    commonTraps: [
      'SQS Standard KHÔNG đảm bảo thứ tự FIFO và message có thể thỉnh thoảng được giao hơn một lần',
      'Nếu consumer xử lý không xong trong Visibility Timeout, consumer khác sẽ nhận lại chính message đó, trừ khi bạn gia hạn timeout',
    ],
    relatedServices: ['sns', 'lambda', 'ec2', 'eventbridge'],
    docsUrl: 'https://docs.aws.amazon.com/sqs/',
  },
  {
    id: 'sns',
    name: 'Amazon Simple Notification Service',
    category: 'Integration',
    abbreviation: 'SNS',
    summary: 'Dịch vụ nhắn tin publish/subscribe được quản lý, đẩy tin một-tới-nhiều với throughput cao.',
    coreConcepts: [
      'Mô hình Pub/Sub: publisher gửi message vào một Topic; nhiều subscriber nhận được bản đẩy về',
      'Subscriber: SQS queue, Lambda function, endpoint HTTP/HTTPS, email, SMS, mobile push',
      'Mẫu SNS Fanout: publish một lần vào SNS rồi tỏa ra nhiều SQS queue độc lập để xử lý song song, bất đồng bộ',
      'Message Filtering: filter policy ở phía subscriber lọc theo message attribute, tránh xử lý thừa',
      'SNS FIFO Topic: giữ thứ tự nghiêm ngặt và khử trùng lặp khi ghép với SQS FIFO queue',
    ],
    useCases: [
      'Mẫu fanout: một sự kiện đặt hàng được các service Fraud, Inventory và Shipping xử lý cùng lúc',
      'Cảnh báo hệ thống và CloudWatch alarm gửi qua email và SMS',
      'Push notification thời gian thực xuống thiết bị iOS và Android',
    ],
    examRelevance: 'Mẫu kiến trúc then chốt của SAA-C03: SNS Topic + nhiều SQS Queue = kiến trúc Fanout.',
    commonTraps: [
      'SNS đẩy message đi ngay; nó KHÔNG lưu message để consumer poll sau (trừ khi subscriber là SQS)',
    ],
    relatedServices: ['sqs', 'lambda', 'cloudwatch', 'eventbridge'],
    docsUrl: 'https://docs.aws.amazon.com/sns/',
  },
  {
    id: 'eventbridge',
    name: 'Amazon EventBridge',
    category: 'Integration',
    abbreviation: 'EventBridge',
    summary: 'Event bus serverless, định tuyến sự kiện từ dịch vụ AWS, ứng dụng SaaS và ứng dụng tự viết bằng rule dạng JSON.',
    coreConcepts: [
      'Default Event Bus: nhận sự kiện từ các dịch vụ AWS (EC2 đổi trạng thái, lời gọi API của S3, v.v.)',
      'Custom và Partner Event Bus: nạp sự kiện từ Datadog, Zendesk, Salesforce và ứng dụng tự viết',
      'Rule và lọc theo nội dung: soi payload JSON của sự kiện rồi định tuyến tới target (Lambda, SQS, SNS, Step Functions, Kinesis)',
      'Schema Registry: khám phá, sinh và quản lý schema OpenAPI/JSON để generate code',
      'Archive và Replay: lưu lại toàn bộ sự kiện và phát lại để debug hoặc phục hồi sau sự cố',
    ],
    useCases: [
      'Kiến trúc hướng sự kiện, kích hoạt microservice phía sau dựa trên thuộc tính cụ thể trong payload',
      'Tự động khắc phục sự cố bảo mật (ví dụ: AWS Config rule fail -> EventBridge -> Lambda sửa)',
      'Tác vụ chạy theo lịch kiểu cron (trước đây là CloudWatch Events)',
    ],
    examRelevance: 'Bản thay thế hiện đại của CloudWatch Events. Ra thi ở phần hệ thống tách rời hướng sự kiện và định tuyến theo nội dung payload.',
    commonTraps: [
      'EventBridge là phiên bản tiến hóa của CloudWatch Events; nếu cả hai cùng xuất hiện, EventBridge là bên có tính năng nâng cao như partner bus và schema registry',
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
    summary: 'Dịch vụ kiểm soát truy cập chi tiết, quản lý an toàn danh tính, role và quyền trên toàn bộ AWS.',
    coreConcepts: [
      'Nguyên tắc đặc quyền tối thiểu: chỉ cấp đúng quyền cần thiết để làm được việc',
      'IAM Role: được user, EC2 instance, Lambda function hay tài khoản bên ngoài assume tạm thời qua STS; dùng credential tạm thời',
      'Logic đánh giá policy: Explicit Deny luôn thắng mọi Explicit Allow; mặc định là Implicit Deny',
      'Service Control Policy (SCP): hàng rào trong AWS Organizations, giới hạn trần quyền của các account (bản thân nó không cấp quyền)',
      'Permission Boundary: xác định mức quyền tối đa mà một identity-based policy có thể cấp cho một IAM entity',
    ],
    useCases: [
      'Cho EC2 instance truy cập bucket S3 bằng Instance Profile và IAM Role, không hardcode credential',
      'Assume role cross-account cho pipeline triển khai nhiều tài khoản',
      'Áp hàng rào tuân thủ cho toàn công ty bằng SCP của AWS Organizations',
    ],
    examRelevance: 'Có mặt ở mọi domain: best practice bảo mật, quản lý credential, đặc quyền tối thiểu và truy cập cross-account.',
    commonTraps: [
      'Đừng bao giờ để access key AWS trên EC2 instance hay trong repo code; luôn dùng IAM Role',
      'SCP không cấp quyền; identity vẫn cần một IAM policy Allow ngay cả khi SCP đã cho phép',
    ],
    relatedServices: ['kms', 'secrets-manager', 'organizations', 'sts'],
    docsUrl: 'https://docs.aws.amazon.com/iam/',
  },
  {
    id: 'kms',
    name: 'AWS Key Management Service',
    category: 'Security',
    abbreviation: 'KMS',
    summary: 'Dịch vụ được quản lý để tạo và kiểm soát khóa mã hóa dùng cho dữ liệu trên các dịch vụ AWS.',
    coreConcepts: [
      'Loại key: AWS Owned (miễn phí, nội bộ), AWS Managed (mặc định kiểu aws/s3, miễn phí), Customer Managed (toàn quyền kiểm soát, xoay vòng, 1 USD/tháng)',
      'Key policy: cách chính để kiểm soát truy cập vào KMS key; chỉ IAM policy thôi là chưa đủ nếu key policy không cho phép',
      'Envelope Encryption: KMS mã hóa Data Key (DEK) bằng KMS Key (KEK); dữ liệu được mã hóa cục bộ bằng DEK dạng plaintext, sau đó DEK này bị xóa khỏi bộ nhớ',
      'Multi-Region Key: key primary và replica dùng chung key ID và key material, phục vụ disaster recovery cross-region',
    ],
    useCases: [
      'Mã hóa phía server cho bucket S3, volume EBS, database RDS và bảng DynamoDB',
      'Đáp ứng yêu cầu tuân thủ về xoay vòng khóa tự động hằng năm bằng Customer Managed Key',
      'Nhân bản dữ liệu đã mã hóa qua region mà không cần giải mã rồi mã hóa lại',
    ],
    examRelevance: 'Ra thi ở key policy, envelope encryption cho payload > 4KB, và khác biệt giữa customer managed key với AWS managed key.',
    commonTraps: [
      'API của KMS không mã hóa trực tiếp được dữ liệu plaintext lớn hơn 4 KB — file lớn hơn phải dùng Envelope Encryption (API GenerateDataKey)',
      'AWS Managed Key tự xoay vòng mỗi 1 năm; Customer Managed Key có tùy chọn bật xoay vòng tự động 1 năm',
    ],
    relatedServices: ['secrets-manager', 's3', 'ebs', 'iam'],
    docsUrl: 'https://docs.aws.amazon.com/kms/',
  },
  {
    id: 'secrets-manager',
    name: 'AWS Secrets Manager',
    category: 'Security',
    abbreviation: 'Secrets Manager',
    summary: 'Mã hóa, lưu trữ an toàn và tự động xoay vòng thông tin đăng nhập database, API key và các secret khác.',
    coreConcepts: [
      'Xoay vòng tự động: tích hợp sẵn với RDS, Aurora, DocumentDB và Redshift qua các Lambda rotation function dựng sẵn',
      'Tích hợp KMS: mọi secret đều được mã hóa at rest bằng KMS customer-managed key hoặc AWS-managed key',
      'So với SSM Parameter Store: Secrets Manager tốn 0.40 USD/secret/tháng và có sẵn xoay vòng tự động; SSM Parameter Store bậc Standard MIỄN PHÍ nhưng không có auto-rotation gốc',
    ],
    useCases: [
      'Lưu mật khẩu database RDS kèm xoay vòng tự động 30 ngày mà ứng dụng không phải downtime',
      'Lưu tập trung token API bên thứ ba, chia sẻ được cross-account',
    ],
    examRelevance: 'Hễ đề nhắc "tự động xoay vòng thông tin đăng nhập database" thì gần như chắc chắn đáp án là AWS Secrets Manager.',
    commonTraps: [
      'Đừng chọn SSM Parameter Store nếu yêu cầu là xoay vòng credential tự động mà không phải tự viết code',
    ],
    relatedServices: ['kms', 'rds', 'lambda', 'ssm'],
    docsUrl: 'https://docs.aws.amazon.com/secretsmanager/',
  },
  {
    id: 'cognito',
    name: 'Amazon Cognito',
    category: 'Security',
    abbreviation: 'Cognito',
    summary: 'Quản lý danh tính và truy cập cho khách hàng (CIAM): đăng ký, đăng nhập và phân quyền cho ứng dụng web và mobile.',
    coreConcepts: [
      'Cognito User Pool (CUP): thư mục người dùng và xác thực ("Bạn là ai?"). Lo phần đăng ký, đăng nhập, MFA và social sign-in (Google, Facebook, Apple, SAML, OIDC). Trả về JWT chuẩn (ID Token, Access Token, Refresh Token).',
      'Cognito Identity Pool (CIP / Federated Identities): phân quyền ("Bạn được dùng tài nguyên AWS nào?"). Đổi token của User Pool hoặc mạng xã hội lấy credential IAM tạm thời, giới hạn phạm vi, thông qua AWS STS.',
      'Fine-grained Access Control: dùng biến trong IAM policy như ${cognito-identity.amazonaws.com:sub} để mỗi người dùng chỉ truy cập được thư mục riêng của mình (ví dụ s3://bucket/private/${cognito-identity.amazonaws.com:sub}/*).',
      'Truy cập khách (Guest / Unauthenticated): cấp được credential AWS tạm thời, chỉ đọc hoặc giới hạn, cho người dùng chưa tạo tài khoản.',
    ],
    useCases: [
      'Xác thực cho ứng dụng web và mobile với social login (Google, Facebook) và xác thực đa yếu tố (MFA)',
      'Cho người dùng mobile upload và tải ảnh/file riêng tư trực tiếp từ Amazon S3 bằng credential AWS tạm thời, không dồn tải lên backend',
      'Liên kết danh tính doanh nghiệp với Active Directory / Okta qua SAML 2.0 hoặc OIDC',
    ],
    examRelevance: 'Quy tắc vàng của SAA-C03: User Pool = xác thực và thư mục người dùng (JWT). Identity Pool = phân quyền và cấp credential AWS tạm thời để gọi thẳng dịch vụ AWS.',
    commonTraps: [
      'JWT của Cognito User Pool KHÔNG dùng trực tiếp làm credential AWS để ký request lên AWS API — phải đổi qua Identity Pool lấy credential IAM tạm thời',
      'Đừng tạo IAM user riêng cho từng khách hàng bên ngoài; luôn dùng Amazon Cognito User Pool và Identity Pool',
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
        name: 'Kiểu lưu trữ',
        description: {
          'Amazon S3': 'Object storage, truy cập qua HTTP/REST API (Get/Put). Dung lượng không giới hạn.',
          'Amazon EBS': 'Block storage gắn vào một EC2 instance như một ổ đĩa ảo.',
          'Amazon EFS': 'File system chia sẻ chuẩn POSIX qua Network File System (NFSv4).',
        },
      },
      {
        name: 'Phạm vi / Tính sẵn sàng',
        description: {
          'Amazon S3': 'Dịch vụ cấp Region; tự nhân bản trên từ 3 AZ trở lên (độ bền 11 9s).',
          'Amazon EBS': 'Khóa trong MỘT Availability Zone. Muốn sang AZ khác phải qua snapshot.',
          'Amazon EFS': 'Dịch vụ cấp Region; truy cập đồng thời được từ nhiều AZ và nhiều VPC.',
        },
      },
      {
        name: 'Gắn được nhiều instance?',
        description: {
          'Amazon S3': 'Hàng triệu client đồng thời qua HTTP REST API.',
          'Amazon EBS': 'Một instance (trừ Multi-Attach trên io1/io2 với cluster file system, trong cùng AZ).',
          'Amazon EFS': 'Hàng nghìn instance Linux đọc ghi đồng thời.',
        },
      },
      {
        name: 'Hợp nhất với',
        description: {
          'Amazon S3': 'Website tĩnh, ảnh/video, backup, data lake, phân tích big data.',
          'Amazon EBS': 'Ổ boot hệ điều hành, database quan hệ giao dịch (Postgres, Oracle).',
          'Amazon EFS': 'Hệ quản trị nội dung (WordPress), thư mục home dùng chung, job big data.',
        },
      },
    ],
    examTip: 'Nếu nhiều EC2 instance Linux ở các AZ khác nhau cần cùng đọc ghi một file system POSIX dùng chung, chọn EFS. Nếu là ổ boot hệ điều hành, chọn EBS. Với media và file tĩnh, chọn S3.',
    commonTrap: 'Đừng lấy EBS Multi-Attach làm đáp án cho nhu cầu file system dùng chung nói chung: nó không chạy cross-AZ, chỉ hỗ trợ io1/io2, và cần một cluster file system như GFS2 mới tránh được hỏng dữ liệu.',
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
        name: 'Tầng mô hình OSI',
        description: {
          'ALB (Layer 7)': 'Layer 7 (Application): HTTP, HTTPS, gRPC, WebSockets.',
          'NLB (Layer 4)': 'Layer 4 (Transport): TCP, UDP, TLS.',
          'GLB (Layer 3)': 'Layer 3 (Network Gateway): định tuyến gói IP trong suốt bằng giao thức GENEVE.',
        },
      },
      {
        name: 'Kiểu địa chỉ IP',
        description: {
          'ALB (Layer 7)': 'IP động; client BẮT BUỘC kết nối qua DNS name.',
          'NLB (Layer 4)': 'IP tĩnh cho mỗi AZ; gán được Elastic IP trực tiếp.',
          'GLB (Layer 3)': 'Gateway trong suốt; giữ nguyên header gói tin gốc, không proxy.',
        },
      },
      {
        name: 'Định tuyến nâng cao',
        description: {
          'ALB (Layer 7)': 'Định tuyến theo URL path, host, HTTP header, query string và HTTP method.',
          'NLB (Layer 4)': 'Chỉ định tuyến theo port và protocol. Không đọc HTTP header.',
          'GLB (Layer 3)': 'Đẩy toàn bộ traffic IP tới thiết bị bảo mật ảo của bên thứ ba (firewall/IDS).',
        },
      },
      {
        name: 'Hiệu năng & Quy mô',
        description: {
          'ALB (Layer 7)': 'Throughput cao, tự co giãn, độ trễ cỡ mili giây.',
          'NLB (Layer 4)': 'Throughput cực cao, hàng triệu request mỗi giây, độ trễ dưới một mili giây.',
          'GLB (Layer 3)': 'Scale-out throughput cao cho thiết bị bảo mật của bên thứ ba.',
        },
      },
    ],
    examTip: 'Chọn ALB cho microservice và định tuyến theo URL path (/api vs /app). Chọn NLB khi cần hiệu năng cực cao, IP tĩnh / Elastic IP, hoặc giao thức không phải HTTP (TCP/UDP). Chọn GLB khi cần chèn firewall của bên thứ ba.',
    commonTrap: 'ALB không gán được Elastic IP. Nếu đề đòi một load balancer có IP tĩnh cố định để khách hàng whitelist trên firewall, chọn NLB.',
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
        name: 'Mục đích chính',
        description: {
          'RDS Multi-AZ': 'High Availability và Disaster Recovery (failover tự động).',
          'RDS Read Replicas': 'Scale hiệu năng đọc và tách tải báo cáo.',
        },
      },
      {
        name: 'Kiểu replication',
        description: {
          'RDS Multi-AZ': 'Replication ĐỒNG BỘ (không mất dữ liệu giữa primary và standby).',
          'RDS Read Replicas': 'Replication BẤT ĐỒNG BỘ (luôn có độ trễ).',
        },
      },
      {
        name: 'Có phục vụ traffic không?',
        description: {
          'RDS Multi-AZ': 'KHÔNG. Standby hoàn toàn thụ động, không query đọc được.',
          'RDS Read Replicas': 'CÓ. Mỗi replica có DNS endpoint riêng để chạy truy vấn SELECT.',
        },
      },
      {
        name: 'Hỗ trợ đa Region',
        description: {
          'RDS Multi-AZ': 'Chỉ trong cùng một region (trải trên 2 Availability Zone).',
          'RDS Read Replicas': 'Tạo được trong cùng region HOẶC ở một AWS region khác.',
        },
      },
    ],
    examTip: 'Multi-AZ là để HA / Disaster Recovery. Read Replica là để scale throughput đọc. Hai thứ này kết hợp được với nhau (ví dụ primary Multi-AZ kèm read replica cross-region).',
    commonTrap: 'Standby trong Multi-AZ tiêu chuẩn KHÔNG phục vụ được truy vấn đọc. Nếu đề hỏi cách tách tải truy vấn BI hay analytics, đáp án là Read Replica chứ không phải Multi-AZ.',
  },
  {
    id: 'security-groups-vs-nacls',
    title: 'Security Groups vs Network ACLs (NACLs)',
    category: 'Security',
    services: ['Security Groups', 'Network ACLs (NACLs)'],
    dimensions: [
      {
        name: 'Cấp độ hoạt động',
        description: {
          'Security Groups': 'Mức instance / ENI (áp cho từng network interface của EC2/RDS).',
          'Network ACLs (NACLs)': 'Mức subnet (lớp phòng thủ đầu tiên cho mọi traffic ra vào subnet).',
        },
      },
      {
        name: 'Tính stateful',
        description: {
          'Security Groups': 'STATEFUL: traffic phản hồi luôn được cho qua, bất kể rule inbound/outbound.',
          'Network ACLs (NACLs)': 'STATELESS: traffic phản hồi phải được cho phép tường minh bằng rule outbound và dải ephemeral port.',
        },
      },
      {
        name: 'Loại rule',
        description: {
          'Security Groups': 'Chỉ có rule ALLOW. Mặc định deny ngầm phần còn lại. Không viết được DENY tường minh.',
          'Network ACLs (NACLs)': 'Hỗ trợ cả ALLOW và DENY, xét theo thứ tự số hiệu rule (ví dụ 100, 200).',
        },
      },
      {
        name: 'Chặn một IP cụ thể',
        description: {
          'Security Groups': 'KHÔNG chặn được một IP cụ thể (vì không có rule deny).',
          'Network ACLs (NACLs)': 'CÓ thể chặn một IP cụ thể bằng rule DENY với số hiệu thấp.',
        },
      },
    ],
    examTip: 'Khi đề hỏi cách chặn một IP hay một subnet độc hại ở tầng mạng, đáp án là Network ACL (ví dụ rule #: DENY 198.51.100.23/32).',
    commonTrap: 'Nhớ NACL là stateless: khi cho phép HTTP vào ở port 80, phải cho phép cả traffic đi ra trên dải ephemeral port (1024-65535) để client nhận được phản hồi.',
  },
  {
    id: 'sqs-vs-sns-vs-eventbridge',
    title: 'Amazon SQS vs Amazon SNS vs Amazon EventBridge',
    category: 'Integration',
    services: ['Amazon SQS', 'Amazon SNS', 'Amazon EventBridge'],
    dimensions: [
      {
        name: 'Mô hình',
        description: {
          'Amazon SQS': 'Hàng đợi (pull / polling). Một-một, message bị xóa sau khi xử lý.',
          'Amazon SNS': 'Pub/Sub (push). Một-nhiều, fanout tới nhiều subscriber.',
          'Amazon EventBridge': 'Event bus (push). Định tuyến theo nội dung JSON tới hơn 20 loại target AWS.',
        },
      },
      {
        name: 'Lưu giữ dữ liệu',
        description: {
          'Amazon SQS': 'Giữ message tối đa 14 ngày (mặc định 4 ngày) cho tới khi worker xóa.',
          'Amazon SNS': 'Tức thời; đẩy ngay cho subscriber, không có ai nhận thì bỏ.',
          'Amazon EventBridge': 'Mặc định tức thời; có tùy chọn Event Archive & Replay để xem lại sự kiện cũ.',
        },
      },
      {
        name: 'Lọc message',
        description: {
          'Amazon SQS': 'Không có (mọi consumer đọc chung một queue).',
          'Amazon SNS': 'Subscription Filter Policy dựa trên message attribute.',
          'Amazon EventBridge': 'So khớp pattern JSON nâng cao trên toàn bộ payload sự kiện.',
        },
      },
      {
        name: 'Tích hợp SaaS bên thứ ba',
        description: {
          'Amazon SQS': 'Không có tích hợp SaaS sẵn.',
          'Amazon SNS': 'Không có tích hợp SaaS sẵn.',
          'Amazon EventBridge': 'Có Partner Event Source gốc (Shopify, Datadog, Zendesk, Salesforce).',
        },
      },
    ],
    examTip: 'Dùng SQS để tách rời worker và điều tiết tốc độ. Dùng SNS để fanout tới nhiều subscriber. Dùng EventBridge khi schema sự kiện phức tạp, cần tích hợp SaaS hoặc soi nội dung payload JSON.',
    commonTrap: 'SNS không giữ hay đệm message cho worker đang offline. Worker chết thì message SNS chưa xử lý sẽ mất, trừ khi đã subscribe qua SQS kèm DLQ.',
  },
  {
    id: 'nat-gateway-vs-nat-instance',
    title: 'AWS NAT Gateway vs NAT Instance',
    category: 'Networking',
    services: ['NAT Gateway (Managed)', 'NAT Instance (Self-Managed EC2)'],
    dimensions: [
      {
        name: 'Quản lý & Bảo trì',
        description: {
          'NAT Gateway (Managed)': 'Dịch vụ do AWS quản lý: vá phần mềm, quản lý OS và co giãn đều tự động.',
          'NAT Instance (Self-Managed EC2)': 'EC2 instance bạn tự quản: tự vá OS Linux, tự lo bản vá bảo mật và tự cấu hình forwarding bằng iptables.',
        },
      },
      {
        name: 'Tính sẵn sàng cao',
        description: {
          'NAT Gateway (Managed)': 'Sẵn sàng cao trong phạm vi một AZ (tự thay phần cứng hỏng). Muốn chịu lỗi đa AZ thì triển khai ở nhiều AZ.',
          'NAT Instance (Self-Managed EC2)': 'Là điểm chết đơn lẻ trong AZ. Cần script failover phức tạp (heartbeat và đổi route table).',
        },
      },
      {
        name: 'Băng thông & Khả năng mở rộng',
        description: {
          'NAT Gateway (Managed)': 'Tự co giãn tới 100 Gbps băng thông theo nhu cầu, không phải đổi size instance thủ công.',
          'NAT Instance (Self-Managed EC2)': 'Bị giới hạn cứng bởi băng thông mạng của loại EC2 instance (ví dụ t3.nano so với c5.large).',
        },
      },
      {
        name: 'Hỗ trợ security group',
        description: {
          'NAT Gateway (Managed)': 'KHÔNG gán được security group trực tiếp lên NAT Gateway (chỉ còn NACL ở mức subnet).',
          'NAT Instance (Self-Managed EC2)': 'CÓ thể gắn security group để kiểm soát port và IP chi tiết.',
        },
      },
      {
        name: 'Source/Destination Check',
        description: {
          'NAT Gateway (Managed)': 'AWS xử lý tự động.',
          'NAT Instance (Self-Managed EC2)': 'BẮT BUỘC: phải tự tắt "Source/Dest. Check" trên EC2 instance, không thì routing sẽ hỏng.',
        },
      },
      {
        name: 'Mô hình chi phí',
        description: {
          'NAT Gateway (Managed)': 'Phí theo giờ (~0.045 USD/giờ) cộng phí xử lý dữ liệu (~0.045 USD/GB).',
          'NAT Instance (Self-Managed EC2)': 'Giá EC2 instance thông thường (dùng được Spot hoặc dòng T khi traffic nền thấp).',
        },
      },
    ],
    examTip: 'Với kiến trúc production cần tính sẵn sàng cao, tự co giãn tới 100 Gbps và không tốn công quản trị, luôn chọn AWS NAT Gateway.',
    commonTrap: 'Trong đề, nếu câu hỏi kiểu cũ hỏi vì sao NAT Instance không forward được traffic từ private subnet, đáp án gần như luôn là: bạn quên tắt "Source/Destination Check" trên EC2 instance.',
  },
  {
    id: 'direct-connect-vs-vpn',
    title: 'AWS Direct Connect (DX) vs AWS Site-to-Site VPN',
    category: 'Networking',
    services: ['AWS Direct Connect', 'AWS Site-to-Site VPN'],
    dimensions: [
      {
        name: 'Kết nối vật lý',
        description: {
          'AWS Direct Connect': 'Đường cáp quang vật lý riêng (1 Gbps, 10 Gbps, 100 Gbps) nối thẳng data center on-premises vào AWS.',
          'AWS Site-to-Site VPN': 'Tunnel IPsec chạy trên Internet công cộng, giữa customer gateway và AWS Virtual Private Gateway / Transit Gateway.',
        },
      },
      {
        name: 'Thời gian thiết lập',
        description: {
          'AWS Direct Connect': 'Mất vài tuần tới vài tháng để phối hợp kéo cross-connect với đối tác Direct Connect và nhà mạng.',
          'AWS Site-to-Site VPN': 'Dựng được trong vài phút ngay trên AWS Management Console.',
        },
      },
      {
        name: 'Độ trễ & Độ tin cậy',
        description: {
          'AWS Direct Connect': 'Độ trễ cực thấp, ổn định và đoán được vì không đi qua Internet công cộng.',
          'AWS Site-to-Site VPN': 'Độ trễ, jitter và throughput dao động theo chất lượng ISP công cộng.',
        },
      },
      {
        name: 'Mã hóa dữ liệu trên đường truyền',
        description: {
          'AWS Direct Connect': 'Mặc định KHÔNG mã hóa! Muốn bảo mật dữ liệu trên đường truyền thì dựng thêm IPsec VPN chạy trên Direct Connect (DX + VPN).',
          'AWS Site-to-Site VPN': 'Mặc định ĐÃ mã hóa bằng chuẩn IPsec AES-256.',
        },
      },
      {
        name: 'Cấu trúc chi phí',
        description: {
          'AWS Direct Connect': 'Phí cổng cố định hằng tháng cao, nhưng phí data egress rẻ hơn nhiều (0.02 USD/GB so với 0.09 USD/GB qua internet).',
          'AWS Site-to-Site VPN': 'Phí theo giờ rẻ cho mỗi kết nối VPN (0.05 USD/giờ) cộng phí egress Internet công cộng thông thường.',
        },
      },
    ],
    examTip: 'Chọn Direct Connect khi cần throughput cao (từ 10Gbps), độ trễ ổn định, hoặc chi phí egress mỗi GB thấp hơn. Nếu cần dựng ngay hoặc đầu tư ban đầu thấp, chọn Site-to-Site VPN. Muốn Direct Connect có mã hóa thì ghép DX với VPN.',
    commonTrap: 'Direct Connect KHÔNG mã hóa sẵn. Nếu đề hỏi một kết nối riêng tốc độ cao kèm mã hóa trên đường truyền để tuân thủ, đáp án là AWS Direct Connect + IPsec VPN.',
  },
  {
    id: 'sqs-vs-sns',
    title: 'Amazon SQS vs Amazon SNS',
    category: 'Integration',
    services: ['Amazon SQS', 'Amazon SNS'],
    dimensions: [
      {
        name: 'Mô hình giao tiếp',
        description: {
          'Amazon SQS': 'Pull / polling: consumer phía sau chủ động lấy message khỏi queue, xử lý rồi xóa.',
          'Amazon SNS': 'Push / PubSub: SNS đẩy sự kiện ngay tới mọi endpoint đã subscribe (HTTP, Lambda, SQS, email, SMS).',
        },
      },
      {
        name: 'Số lượng consumer',
        description: {
          'Amazon SQS': '1:1 cho mỗi message: mỗi message chỉ được đúng một worker xử lý (mẫu competing consumers).',
          'Amazon SNS': '1:nhiều (fanout): mỗi message publish ra được gửi đồng thời tới mọi endpoint đã subscribe.',
        },
      },
      {
        name: 'Độ bền của message',
        description: {
          'Amazon SQS': 'Queue bền: message được giữ tối đa 14 ngày (mặc định 4 ngày) cho tới khi consumer xử lý và xóa.',
          'Amazon SNS': 'Pub/sub tức thời: message không được lưu lâu dài; không có subscriber nào đang nghe thì message bị bỏ.',
        },
      },
      {
        name: 'Thứ tự & Khử trùng lặp',
        description: {
          'Amazon SQS': 'Có SQS FIFO queue (thứ tự nghiêm ngặt, message deduplication, message group ID).',
          'Amazon SNS': 'Có SNS FIFO topic (giữ thứ tự và khử trùng lặp khi ghép với SQS FIFO queue).',
        },
      },
    ],
    examTip: 'Nhớ quy tắc vàng: dùng SQS để tách rời tác vụ, điều tiết tốc độ và cho worker xử lý theo lô. Dùng SNS để phát thông báo hoặc làm kiến trúc fanout tới nhiều queue/function phía sau.',
    commonTrap: 'Riêng SNS không giữ hay xếp hàng message cho consumer đang offline. Luôn ghép SNS với SQS (mẫu fanout) để không mất message khi consumer gặp sự cố.',
  },
  {
    id: 'kinesis-vs-sqs',
    title: 'Amazon Kinesis Data Streams vs Amazon SQS',
    category: 'Integration',
    services: ['Kinesis Data Streams', 'Amazon SQS'],
    dimensions: [
      {
        name: 'Mô hình consumer',
        description: {
          'Kinesis Data Streams': 'Pub/Sub streaming: nhiều ứng dụng consumer độc lập cùng đọc đúng một luồng dữ liệu, mỗi bên theo tốc độ riêng.',
          'Amazon SQS': 'Hàng đợi message: từng message được một worker lấy về, xử lý rồi xóa khỏi queue.',
        },
      },
      {
        name: 'Phát lại & Lưu giữ dữ liệu',
        description: {
          'Kinesis Data Streams': 'PHÁT LẠI ĐƯỢC: record nằm trong stream tới 365 ngày (mặc định 24h) và consumer đọc lại được từ bất kỳ mốc thời gian nào.',
          'Amazon SQS': 'KHÔNG PHÁT LẠI ĐƯỢC: message đã được worker xác nhận và xóa thì không khôi phục hay xử lý lại được.',
        },
      },
      {
        name: 'Đảm bảo thứ tự',
        description: {
          'Kinesis Data Streams': 'Đảm bảo thứ tự nghiêm ngặt trong từng Shard theo partition key.',
          'Amazon SQS': 'Standard queue: thứ tự best-effort; FIFO queue: thứ tự FIFO nghiêm ngặt theo Message Group ID.',
        },
      },
      {
        name: 'Cơ chế co giãn',
        description: {
          'Kinesis Data Streams': 'Provisioned Shard (1MB/s vào, 2MB/s ra mỗi shard) hoặc chế độ On-Demand tự co giãn.',
          'Amazon SQS': 'Serverless hoàn toàn: tự co giãn tới throughput không giới hạn (Standard queue), không phải provision capacity.',
        },
      },
    ],
    examTip: 'Chọn Kinesis khi nhiều ứng dụng (ví dụ Analytics, Fraud, Dashboard) phải đọc và đọc lại đúng cùng một luồng clickstream hay dữ liệu cảm biến thời gian thực. Chọn SQS để tách rời tác vụ bất đồng bộ và scale worker theo chiều ngang.',
    commonTrap: 'Message SQS bị tiêu thụ rồi xóa. Nếu cần phát lại dữ liệu telemetry cũ hoặc nhiều consumer phía sau đọc cùng một sự kiện ở những thời điểm khác nhau thì SQS là lựa chọn sai — hãy dùng Kinesis.',
  },
  {
    id: 'aurora-global-vs-dynamodb-global',
    title: 'Aurora Global Database vs DynamoDB Global Tables',
    category: 'Database',
    services: ['Aurora Global Database', 'DynamoDB Global Tables'],
    dimensions: [
      {
        name: 'Mô hình database',
        description: {
          'Aurora Global Database': 'SQL quan hệ (tương thích MySQL/PostgreSQL), có transaction ACID đầy đủ và join phức tạp.',
          'DynamoDB Global Tables': 'NoSQL key-value và document, thời gian phản hồi một chữ số mili giây ở quy mô lớn.',
        },
      },
      {
        name: 'Kiến trúc replication',
        description: {
          'Aurora Global Database': 'Một primary, nhiều secondary: CHỈ một region nhận ghi; tối đa 5 region phụ làm read replica.',
          'DynamoDB Global Tables': 'Active-Active đa master: ứng dụng vừa ghi vừa đọc được ở bất kỳ region replica nào, đồng bộ hai chiều.',
        },
      },
      {
        name: 'Độ trễ replication',
        description: {
          'Aurora Global Database': 'Replication ở lớp storage riêng, độ trễ dưới một giây (thường < 1 giây).',
          'DynamoDB Global Tables': 'Replication cross-region dựa trên Streams, độ trễ lan truyền thường quanh mức 1 giây.',
        },
      },
      {
        name: 'Failover khi thảm họa',
        description: {
          'Aurora Global Database': 'Failover cross-region promote được một region phụ lên làm primary, RPO < 1s và RTO < 1 phút.',
          'DynamoDB Global Tables': 'Failover không downtime: vì mọi region đều active-active, traffic ghi chỉ việc chuyển sang region còn sống.',
        },
      },
    ],
    examTip: 'Nếu ứng dụng cần SQL quan hệ, ACID và disaster recovery đa region, chọn Aurora Global Database. Nếu cần ghi active-active toàn cầu với NoSQL serverless quy mô lớn, chọn DynamoDB Global Tables.',
    commonTrap: 'Aurora Global Database KHÔNG hỗ trợ ghi active-active trên nhiều region (chỉ một region nhận ghi, còn lại chỉ đọc). DynamoDB Global Tables thì CÓ hỗ trợ ghi active-active đa region.',
  },
  {
    id: 'secrets-manager-vs-parameter-store',
    title: 'AWS Secrets Manager vs Systems Manager Parameter Store',
    category: 'Security',
    services: ['AWS Secrets Manager', 'SSM Parameter Store'],
    dimensions: [
      {
        name: 'Xoay vòng tự động',
        description: {
          'AWS Secrets Manager': 'CÓ SẴN XOAY VÒNG TỰ ĐỘNG cho RDS, Aurora, DocumentDB và Redshift bằng các Lambda rotation function dựng sẵn.',
          'SSM Parameter Store': 'KHÔNG có xoay vòng tự động gốc. Muốn xoay credential phải cập nhật thủ công hoặc tự dựng luồng Lambda/EventBridge phức tạp.',
        },
      },
      {
        name: 'Chi phí',
        description: {
          'AWS Secrets Manager': 'Dịch vụ tính phí: 0.40 USD mỗi secret mỗi tháng cộng 0.05 USD cho mỗi 10.000 lời gọi API.',
          'SSM Parameter Store': 'Bậc Standard hoàn toàn MIỄN PHÍ (tối đa 10,000 parameter, kích thước 4KB). Advanced parameter tốn 0.05 USD/tháng.',
        },
      },
      {
        name: 'Hỗ trợ mã hóa KMS',
        description: {
          'AWS Secrets Manager': 'Mặc định mã hóa at rest bằng KMS AWS managed key hoặc customer managed key.',
          'SSM Parameter Store': 'Hỗ trợ kiểu String, StringList và SecureString (mã hóa bằng KMS).',
        },
      },
      {
        name: 'Truy cập cross-account',
        description: {
          'AWS Secrets Manager': 'Hỗ trợ resource-based policy ngay trên secret nên chia sẻ cross-account rất gọn.',
          'SSM Parameter Store': 'Chia sẻ cross-account thông qua AWS RAM (Resource Access Manager).',
        },
      },
    ],
    examTip: 'Khi đề nhắc tới xoay vòng tự động mật khẩu database (RDS, Aurora, Redshift), đáp án luôn là AWS Secrets Manager. Nếu chỉ là tham số cấu hình không cần xoay vòng hoặc cần rẻ nhất, chọn SSM Parameter Store.',
    commonTrap: 'SSM Parameter Store miễn phí thật, nhưng nó KHÔNG có sẵn cơ chế xoay vòng credential tự động.',
  },
  {
    id: 'cognito-user-pools-vs-identity-pools',
    title: 'Cognito User Pools vs Cognito Identity Pools',
    category: 'Security',
    services: ['Cognito User Pools (CUP)', 'Cognito Identity Pools (CIP)'],
    dimensions: [
      {
        name: 'Mục đích chính',
        description: {
          'Cognito User Pools (CUP)': 'Xác thực và thư mục người dùng ("Bạn là ai?"). Lo đăng ký, đăng nhập, khôi phục mật khẩu, MFA và social federation.',
          'Cognito Identity Pools (CIP)': 'Phân quyền và truy cập AWS ("Bạn được làm gì trên AWS?"). Cấp credential IAM tạm thời qua AWS STS để dùng tài nguyên AWS.',
        },
      },
      {
        name: 'Token / Credential trả về',
        description: {
          'Cognito User Pools (CUP)': 'JSON Web Token (JWT): ID Token, Access Token, Refresh Token. Dùng để xác thực với API (API Gateway / ALB).',
          'Cognito Identity Pools (CIP)': 'Credential AWS tạm thời (Access Key ID, Secret Access Key, Session Token) do AWS STS cấp.',
        },
      },
      {
        name: 'Đối tượng truy cập',
        description: {
          'Cognito User Pools (CUP)': 'API backend của ứng dụng, endpoint HTTP của API Gateway, Application Load Balancer.',
          'Cognito Identity Pools (CIP)': 'Gọi thẳng dịch vụ AWS: Amazon S3 (ví dụ upload ảnh trực tiếp), DynamoDB, Kinesis, v.v.',
        },
      },
      {
        name: 'Nhà cung cấp danh tính hỗ trợ',
        description: {
          'Cognito User Pools (CUP)': 'Thư mục người dùng có sẵn, Google, Facebook, Apple, Amazon, SAML 2.0, OpenID Connect.',
          'Cognito Identity Pools (CIP)': 'Cognito User Pool, Google, Facebook, Apple, SAML, OIDC và danh tính khách (unauthenticated).',
        },
      },
    ],
    examTip: 'Nhớ mẹo 5 giây: User Pool = xác thực (JWT). Identity Pool = phân quyền (credential AWS tạm thời để gọi dịch vụ AWS như S3).',
    commonTrap: 'JWT của User Pool không gọi thẳng AWS API được. Phải đổi qua Identity Pool để lấy credential IAM của AWS.',
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
