import type { ServiceDeepDive } from '../types';

export const ec2DeepDive: ServiceDeepDive = {
  serviceId: 'ec2',
  serviceName: 'Amazon EC2',
  category: 'Compute',
  tier: 'core',

  whyItExists:
    'Trước điện toán đám mây, muốn có máy chủ bạn phải dự toán tải trước nhiều tháng, mua phần cứng vật lý đắt đỏ và chấp nhận lãng phí tài nguyên khi nhàn rỗi. Amazon EC2 giải quyết bài toán này bằng cách biến năng lực tính toán thành máy chủ ảo hóa linh hoạt (IaaS), cho phép cấp phát hoặc hủy bỏ trong vài chục giây qua API. Đổi lại việc có toàn quyền kiểm soát tầng hệ điều hành, bạn phải gánh toàn bộ trách nhiệm vận hành: tự vá lỗi bảo mật OS, tự cấu hình mở rộng tự động, và tự thiết kế tính sẵn sàng đa Availability Zone.',

  howItWorks: [
    {
      title: 'Vòng đời Instance và sự khác biệt cốt lõi giữa EBS vs Instance Store',
      explanation:
        'Khi khởi chạy một EC2 instance, hypervisor (Nitro System hoặc Xen) cấp phát vCPU và bộ nhớ từ máy chủ vật lý của AWS. Ổ đĩa gắn vào instance có hai bản chất khác biệt: Amazon EBS là khối lưu trữ mạng độc lập kết nối qua mạng nội bộ của rack, còn Instance Store là các ổ đĩa SSD NVMe gắn vật lý trực tiếp trên cùng máy chủ chứa máy ảo. Khi bạn thực hiện lệnh Stop instance, máy chủ vật lý được giải phóng: toàn bộ dữ liệu trên Instance Store bị xóa sạch vĩnh viễn (ephemeral), trong khi EBS volume vẫn giữ nguyên vẹn trạng thái dữ liệu và sẽ được gắn lại khi bạn Start instance trên một máy chủ vật lý mới.',
      soWhat:
        'Không bao giờ đặt dữ liệu có trạng thái lâu dài lên Instance Store; nó chỉ phù hợp làm bộ đệm cache, scratch pad, hoặc file tạm phân tích. Khi đề bài yêu cầu dữ liệu phải bền vững qua các lần dừng hoặc khởi động lại máy chủ để bảo trì, đáp án bắt buộc phải chọn lưu trữ trên EBS.',
    },
    {
      title: 'Khởi tạo cấu hình tự động bằng User Data và bảo mật máy chủ với IMDSv2',
      explanation:
        'Trong quá trình boot lần đầu tiên, tiến trình cloud-init trên OS sẽ tự động gọi tới địa chỉ link-local 169.254.169.254 để kéo script User Data và thực thi với quyền root. Cũng qua địa chỉ link-local này, Instance Metadata Service (IMDS) cung cấp thông tin về instance (IP, subnet, AMI ID) và đặc biệt là temporary credentials từ IAM Instance Profile. Phiên bản IMDSv2 bảo vệ instance khỏi các cuộc tấn công SSRF (Server-Side Request Forgery) bằng phiên làm việc hướng kết nối: ứng dụng phải thực hiện request PUT kèm header X-aws-ec2-metadata-token-ttl-seconds để nhận token, rồi mới dùng token đó trong header X-aws-ec2-metadata-token của request GET tiếp theo.',
      soWhat:
        'User Data mặc định chỉ chạy một lần duy nhất lúc khởi tạo máy chủ nên không dùng để cập nhật cấu hình định kỳ. Không lưu trữ secret tĩnh trong User Data vì bất kỳ ai có quyền ec2:DescribeInstanceAttribute đều đọc được text thô. Luôn cấu hình ép buộc IMDSv2 (HttpTokens=required) để vô hiệu hóa các payload tấn công SSRF nhắm vào việc đánh cắp IAM credentials.',
    },
    {
      title: 'Giao tiếp mạng qua ENI và cơ chế kiểm tra gói tin Stateful của Security Group',
      explanation:
        'Mỗi EC2 instance kết nối vào VPC thông qua ít nhất một Elastic Network Interface (ENI) gắn với một subnet cố định. Mọi lưu lượng ra vào ENI đều đi qua Security Group hoạt động ở tầng ảo hóa của hypervisor. Security Group là tường lửa kiểm tra trạng thái (stateful): nếu một gói tin Inbound được phép đi vào theo rule, gói tin phản hồi của kết nối đó tự động được phép đi ra ngoài mà không cần xem xét Outbound rule, và ngược lại. Ngược lại, Network ACL ở tầng subnet là stateless, đòi hỏi cấu hình tường minh cả chiều đi lẫn chiều về bao gồm cả dải cổng tạm thời (ephemeral ports).',
      soWhat:
        'Khi một ứng dụng chạy trên EC2 chủ động gọi ra ngoài Internet (qua cổng 443 hoặc 80) nhưng không nhận được phản hồi, nguyên nhân không bao giờ nằm ở Outbound hay Inbound của Security Group. Hãy kiểm tra Network ACL xem đã mở ephemeral ports (1024-65535) cho chiều Inbound hay chưa, hoặc kiểm tra Route Table xem đã trỏ 0.0.0.0/0 tới NAT Gateway hay Internet Gateway chưa.',
    },
    {
      title: 'Điều khiển phân bố vật lý trên giá rack thông qua Placement Groups',
      explanation:
        'Theo mặc định, AWS tự động phân tán các instance ngẫu nhiên trên hạ tầng phần cứng để giảm thiểu rủi ro hỏng hóc chung. Tuy nhiên, bạn có thể can thiệp vị trí vật lý bằng ba loại Placement Group: Cluster gom các instance vào cùng một khoang mạng tốc độ cao trong 1 AZ duy nhất để đạt độ trễ cực thấp (10-100 Gbps); Spread đặt mỗi instance lên một rack phần cứng độc lập (nguồn và mạng riêng biệt, tối đa 7 instance mỗi AZ) để cô lập sự cố; và Partition chia nhóm instance thành các phân vùng độc lập (mỗi phân vùng chiếm một nhóm rack riêng) mà không chia sẻ phần cứng giữa các phân vùng.',
      soWhat:
        'Cluster Placement Group đánh đổi tính sẵn sàng cao (chỉ nằm trong đúng 1 AZ) để lấy thông lượng tối đa cho HPC hoặc tính toán phân tán. Spread Placement Group dùng cho một số lượng nhỏ máy chủ trọng yếu (như database primary và standby). Partition Placement Group là lựa chọn chuẩn cho các hệ thống phân tán nhận biết topology như Hadoop HDFS, Apache Cassandra hay Kafka.',
    },
  ],

  chooseWhen: [
    {
      condition: 'Ứng dụng yêu cầu toàn quyền kiểm soát hệ điều hành, can thiệp kernel hoặc cài đặt phần mềm cấp OS',
      reason:
        'EC2 cung cấp quyền root hoàn toàn trên máy ảo, cho phép tùy chỉnh kernel module, cài đặt network driver chuyên dụng hoặc chạy các agent bảo mật legacy của doanh nghiệp.',
    },
    {
      condition: 'Workload chạy liên tục 24/7 với yêu cầu phần cứng đặc thù (GPU, FPGA, máy chủ bộ nhớ cực lớn hàng TB)',
      reason:
        'Các instance families chuyên dụng (như G5/P4 cho AI/ML, X2gd cho in-memory database) cung cấp cấu hình phần cứng tối ưu mà các dịch vụ container serverless không hỗ trợ.',
    },
    {
      condition: 'Dự án di chuyển ứng dụng nguyên khối (monolith lift-and-shift) từ on-premises lên AWS',
      reason:
        'Cho phép giữ nguyên kiến trúc và thư viện phần mềm hiện tại mà không phải tốn thời gian tái cấu trúc code sang kiến trúc container hay serverless.',
    },
    {
      condition: 'Workload xử lý tính toán hàng loạt (batch), render, hoặc phân tích gen có thể chịu lỗi ngắt quãng',
      reason:
        'Tận dụng mô hình EC2 Spot Instances để cắt giảm tới 90% chi phí tính toán so với giá On-Demand.',
    },
    {
      condition: 'Hệ thống tính toán hiệu năng cao (HPC) cần độ trễ mạng liên node dưới một mili-giây',
      reason:
        'Kết hợp Cluster Placement Group với Elastic Fabric Adapter (EFA) cung cấp thông lượng mạng lên tới hàng trăm Gbps và bypass kernel OS để truyền dữ liệu trực tiếp.',
    },
  ],

  avoidWhen: [
    {
      condition: 'Tác vụ xử lý theo sự kiện, thời gian thực thi ngắn dưới 15 phút và tần suất không cố định',
      reason:
        'Chạy EC2 liên tục gây lãng phí lớn vì bạn phải trả tiền cho toàn bộ thời gian máy chủ nhàn rỗi.',
      useInstead: 'AWS Lambda (tự động co giãn theo event, scale về 0 và chỉ tính tiền theo số mili-giây chạy thực tế).',
    },
    {
      condition: 'Ứng dụng microservice hoặc web backend đóng gói được vào Docker container tiêu chuẩn',
      reason:
        'Tự quản lý cụm EC2 đòi hỏi vá lỗ hổng OS, cấu hình cluster autoscaler và bảo trì worker node phức tạp.',
      useInstead: 'AWS Fargate (trên Amazon ECS hoặc Amazon EKS) để chạy container serverless mà không cần quản lý máy chủ.',
    },
    {
      condition: 'Chạy cơ sở dữ liệu quan hệ tiêu chuẩn (PostgreSQL, MySQL, MariaDB, SQL Server, Oracle)',
      reason:
        'Tự cài database trên EC2 buộc bạn phải tự làm thủ công mọi việc: sao lưu định kỳ, vá lỗ hổng DB engine, và cấu hình đồng bộ Multi-AZ failover phức tạp.',
      useInstead: 'Amazon RDS hoặc Amazon Aurora (tự động sao lưu, tự động vá lỗi, Multi-AZ failover tự động trong 30 giây).',
    },
    {
      condition: 'Lưu trữ và phân phối website tĩnh (HTML, CSS, JavaScript client-side, hình ảnh)',
      reason:
        'Dùng máy chủ web Nginx hay Apache trên EC2 tốn kém chi phí, dễ bị nghẽn mạng và trở thành mục tiêu tấn công.',
      useInstead: 'Amazon S3 kết hợp Amazon CloudFront (chi phí cực rẻ, băng thông không giới hạn và bảo mật cao).',
    },
    {
      condition: 'Xử lý hàng đợi tác vụ độc lập mà không cần duy trì kết nối trạng thái liên tục',
      reason:
        'Tự duy trì worker instance trên EC2 dễ gặp lỗi xử lý dở dang khi máy chủ gặp sự cố và tốn công quản lý auto-scaling theo độ dài hàng đợi.',
      useInstead: 'Amazon SQS kết hợp AWS Lambda hoặc ECS Fargate Tasks.',
    },
  ],

  limits: [
    {
      name: 'Hạn ngạch vCPU On-Demand cho tài khoản mới (Standard vCPU Limit)',
      value: 'Mặc định từ 32 đến 64 vCPU (tùy thuộc Region và nhóm instance A, C, D, H, I, M, R, T, Z)',
      implication:
        'Tài khoản mới cố gắng launch số lượng lớn instance cho tác vụ batch hoặc load test sẽ bị từ chối với lỗi VcpuLimitExceeded. Cần gửi yêu cầu tăng hạn ngạch qua AWS Service Quotas trước khi triển khai hệ thống lớn.',
      adjustable: true,
    },
    {
      name: 'Số instance tối đa trong một Spread Placement Group',
      value: 'Tối đa 7 instance trên mỗi Availability Zone',
      implication:
        'Không thể sử dụng Spread Placement Group cho các fleet ứng dụng lớn hàng chục hay hàng trăm máy chủ. Giới hạn này sinh ra để AWS đảm bảo mỗi instance nằm trên một rack phần cứng và hệ thống nguồn riêng biệt.',
      adjustable: false,
    },
    {
      name: 'Phạm vi địa lý của Cluster Placement Group',
      value: '1 Availability Zone duy nhất',
      implication:
        'Cluster Placement Group không thể trải dài qua nhiều AZ. Để vừa có hiệu năng mạng nội bộ cực cao vừa có High Availability chịu lỗi, bạn phải tạo nhiều cụm độc lập ở các AZ khác nhau và tự đồng bộ dữ liệu ở tầng ứng dụng.',
      adjustable: false,
    },
    {
      name: 'Thời gian cảnh báo trước khi thu hồi Spot Instance (Spot Interruption Notice)',
      value: '2 phút (thông qua Amazon EventBridge hoặc EC2 Instance Metadata)',
      implication:
        'Ứng dụng chạy trên Spot Instance phải có cơ chế tiếp nhận sự kiện cảnh báo này để kịp thời lưu checkpointing tiến độ công việc hoặc deregister an toàn khỏi Target Group của Load Balancer.',
      adjustable: false,
    },
    {
      name: 'Kích thước tối đa của script User Data',
      value: '16 KB (trước khi mã hóa base64)',
      implication:
        'Không thể nhét toàn bộ các gói cài đặt nặng hoặc mã nguồn ứng dụng lớn vào User Data. Cần lưu trữ file cài đặt trên Amazon S3 rồi dùng User Data kéo về, hoặc đóng gói sẵn mọi thứ vào Custom AMI bằng EC2 Image Builder.',
      adjustable: false,
    },
    {
      name: 'Số lượng Security Group tối đa gắn vào một Elastic Network Interface (ENI)',
      value: 'Mặc định 5 Security Groups (có thể xin tăng tối đa lên 16)',
      implication:
        'Cần thiết kế kiến trúc phân quyền mạng hợp lý, gộp các quy tắc chung theo vai trò (ví dụ: Base-SG cho monitoring, App-SG cho traffic nghiệp vụ) thay vì tạo riêng rẽ quá nhiều Security Group.',
      adjustable: true,
    },
  ],

  cost: {
    billingDimensions: [
      'Thời gian chạy thực tế của instance (tính theo giây với mức tối thiểu 60 giây cho Linux, Windows và Ubuntu)',
      'Instance type và quy mô tài nguyên phần cứng (số vCPU, dung lượng RAM, GPU, kiến trúc chip x86 vs AWS Graviton ARM)',
      'Mô hình mua (Purchasing Option): On-Demand, Spot Instances, Reserved Instances (RI), hoặc Savings Plans',
      'Dung lượng và loại ổ đĩa EBS gắn kèm (GB-tháng, IOPS provisioned, Throughput provisioned)',
      'Địa chỉ Public IPv4: từ ngày 01/02/2024, AWS tính phí 0.005 USD cho mỗi giờ sử dụng đối với tất cả địa chỉ public IPv4 (gồm cả Elastic IP và auto-assigned public IP)',
    ],
    hiddenCosts: [
      'Chi phí truyền dữ liệu liên Availability Zone (Cross-AZ Data Transfer): Mọi traffic truyền giữa hai EC2 thuộc hai AZ khác nhau trong cùng Region (kể cả trong cùng một VPC) bị tính phí 0.01 USD/GB ở chiều gửi và 0.01 USD/GB ở chiều nhận (tổng cộng 0.02 USD/GB).',
      'Chi phí xử lý qua NAT Gateway: Các EC2 ở private subnet khi tải bản vá hoặc gọi Internet phải trả phí cố định 0.045 USD/giờ duy trì NAT Gateway cộng thêm 0.045 USD cho mỗi GB dữ liệu đi qua.',
      'Ổ đĩa EBS mồ côi (Unattached EBS volumes): Khi xóa EC2 instance mà không bật tùy chọn DeleteOnTermination cho các volume gắn thêm, các EBS volume này vẫn tồn tại độc lập và tiếp tục bị tính phí lưu trữ hàng tháng.',
      'Elastic IP không hoạt động: Nếu đăng ký Elastic IP mà không gắn vào instance đang chạy, hoặc instance bị Stop, AWS sẽ tính phí phạt vì lãng phí tài nguyên IPv4 công cộng.',
      'Băng thông đi ra ngoài Internet (Data Transfer Out): Miễn phí chiều vào (Inbound), nhưng chiều ra Internet có giá tăng dần theo khối lượng sau 100 GB đầu tiên miễn phí mỗi tháng.',
    ],
    optimizationLevers: [
      'Kết hợp linh hoạt các Purchasing Options: Dùng Compute Savings Plans hoặc Standard Reserved Instances (cam kết 1 hoặc 3 năm) cho mức tải cơ sở (baseline) chạy 24/7 để tiết kiệm tới 72%; dùng Auto Scaling Group kết hợp Spot Instances cho phần tải đột biến chịu được ngắt quãng để giảm tới 90%.',
      'Chuyển dịch sang bộ xử lý AWS Graviton (dòng instance có tiền tố "g" như c7g, m7g, r7g): Mang lại tỷ lệ hiệu năng trên chi phí tốt hơn tới 40% so với thế hệ x86 tương đương.',
      'Thiết lập VPC Gateway Endpoints cho Amazon S3 và DynamoDB: Tuyệt đối miễn phí, giúp lưu lượng truy cập từ EC2 tới S3/DynamoDB đi nội bộ trên mạng backbone của AWS thay vì đi qua NAT Gateway, triệt tiêu hoàn toàn phí xử lý dữ liệu của NAT.',
      'Tự động tắt/bật môi trường dev/test bằng AWS Instance Scheduler: Tự động Stop máy chủ ngoài giờ hành chính và dịp cuối tuần, giúp cắt giảm tới gần 70% chi phí chạy máy chủ cho các môi trường phi sản xuất.',
      'Sử dụng AWS Compute Optimizer: Tự động phân tích lịch sử sử dụng CPU, RAM, Network và IOPS qua học máy để đề xuất hạ kích thước instance (right-sizing) hoặc đổi thế hệ mới hơn mà không lãng phí tài nguyên.',
    ],
  },

  security: {
    encryptionAtRest: [
      'EBS Volume Encryption: Tích hợp trực tiếp với AWS KMS (dùng AWS managed key hoặc Customer Managed Key - CMK). Việc mã hóa diễn ra trong suốt tại máy chủ hypervisor của EC2 trước khi dữ liệu được gửi qua mạng lưu trữ đến EBS; toàn bộ snapshot và volume tạo từ snapshot đó tự động được mã hóa cùng khóa.',
      'Instance Store Encryption: Các thế hệ instance chạy trên AWS Nitro System tự động mã hóa dữ liệu trên SSD NVMe bằng chuẩn phần cứng XTS-AES-256; khóa mã hóa tạm thời do hypervisor quản lý và bị tiêu hủy vĩnh viễn khi instance bị terminate.',
    ],
    encryptionInTransit:
      'Lưu lượng mạng giữa các EC2 instance thuộc thế hệ Nitro trong cùng một VPC hoặc qua VPC Peering được tự động mã hóa ở tầng phần cứng với tốc độ đường truyền (line-rate encryption) mà không ảnh hưởng hiệu năng. Với các kết nối ra ngoài Internet hoặc giữa các tầng ứng dụng, bắt buộc sử dụng giao thức TLS/HTTPS hoặc thiết lập VPN/IPsec ở tầng phần mềm.',
    accessControl: [
      'IAM Instance Profile: Gán trực tiếp IAM Role vào EC2 instance. Ứng dụng chạy trên máy ảo dùng AWS SDK sẽ tự động lấy credentials tạm thời tự xoay vòng từ Metadata Service; tuyệt đối không bao giờ lưu trữ Access Key và Secret Access Key tĩnh trên máy chủ.',
      'Security Groups: Tường lửa ảo kiểm soát lưu lượng ra vào ở mức ENI theo cơ chế stateful, chỉ hỗ trợ quy tắc CHO PHÉP (Allow rules). Có thể chỉ định nguồn truy cập là CIDR block hoặc tham chiếu trực tiếp đến Security Group khác.',
      'Network ACLs (NACL): Tường lửa kiểm soát ở ranh giới subnet theo cơ chế stateless, hỗ trợ cả quy tắc CHO PHÉP (Allow) và TỪ CHỐI (Deny) được đánh giá tuần tự theo số thứ tự quy tắc.',
      'AWS Systems Manager Session Manager: Cung cấp kết nối shell tương tác an toàn vào instance thông qua giao diện Web Console hoặc AWS CLI mà không cần mở cổng SSH 22, không cần Public IP, và mọi lệnh thực thi đều được ghi log vào AWS CloudTrail và Amazon S3.',
    ],
    defaultPosture:
      'Mặc định khép kín: Security Group mới tạo chặn toàn bộ lưu lượng Inbound (Deny all) và mở toàn bộ lưu lượng Outbound (Allow all 0.0.0.0/0). Default Security Group của VPC cho phép toàn bộ lưu lượng nội bộ giữa các tài nguyên cùng gắn Security Group đó. EC2 nằm trong subnet riêng tư không có kết nối Internet hai chiều trừ khi có Route Table trỏ tới NAT Gateway.',
  },

  resilience: {
    failureScope: 'AZ',
    builtInHA:
      'EC2 đơn lẻ KHÔNG CÓ tính sẵn sàng cao sẵn có (zero built-in HA ở mức single instance). Một instance nằm cố định trong một Availability Zone duy nhất; nếu host vật lý hỏng hoặc cả AZ gặp sự cố, instance đó sẽ ngừng hoạt động. Để đạt tính sẵn sàng cao, kiến trúc bắt buộc phải triển khai Auto Scaling Group trải đều qua tối thiểu 2 hoặc 3 Availability Zones, đặt phía sau Application Load Balancer hoặc Network Load Balancer để tự động phát hiện lỗi và phân phối lại lưu lượng.',
    crossRegionStory:
      'EC2 không thể tự động failover hoặc chạy xuyên Region. Để xây dựng kế hoạch khắc phục thảm họa (Disaster Recovery): tạo AMI định kỳ từ instance và sử dụng AWS Backup hoặc script để sao chép AMI (Copy AMI) sang Region dự phòng. Tại Region đích, sử dụng infrastructure-as-code (Terraform/CloudFormation) hoặc pre-configured Auto Scaling Group để sẵn sàng launch instance mới từ AMI khi có thảm họa, kết hợp Amazon Route 53 Failover Routing Policy.',
    backupRestore:
      'Sao lưu dựa trên Amazon EBS Snapshots: Cơ chế chụp ảnh gia tăng (incremental snapshot) lưu trữ an toàn trên Amazon S3, chỉ sao lưu các block dữ liệu thay đổi kể từ lần snapshot gần nhất. Tự động hóa vòng đời sao lưu bằng Amazon Data Lifecycle Manager (DLM) hoặc AWS Backup để tuân thủ chính sách lưu trữ và tự động xóa bản cũ. Khôi phục bằng cách tạo EBS volume mới từ snapshot rồi gắn vào instance, hoặc tạo AMI mới từ snapshot để launch máy chủ mới.',
  },

  contrasts: [
    {
      againstServiceId: 'lambda',
      againstServiceName: 'AWS Lambda',
      coreDifference: 'EC2 là máy chủ ảo nguyên chiếc bạn tự quản lý và trả tiền theo thời gian chạy; Lambda là nền tảng chạy code serverless trả tiền chính xác theo số mili-giây thực thi.',
      mechanismDifference:
        'EC2 cung cấp máy ảo hoạt động liên tục, toàn quyền can thiệp hệ điều hành và chạy không giới hạn thời gian nhưng bạn phải tự lo việc vá lỗi OS và cấu hình scale. Lambda khởi chạy code bên trong các micro-VM cô lập (Firecracker) theo sự kiện, giới hạn thời gian tối đa 15 phút, AWS tự động quản lý toàn bộ hạ tầng, khả năng chịu lỗi và tự động co giãn từ 0 đến hàng nghìn lời gọi đồng thời.',
      chooseThisWhen: [
        'Tác vụ xử lý liên tục chạy dài hơn 15 phút hoặc cần socket mạng TCP mở duy trì liên tục (như WebSocket server, game server)',
        'Ứng dụng đòi hỏi quyền can thiệp sâu vào kernel OS, cài đặt phần mềm độc quyền hoặc yêu cầu cấu hình phần cứng chuyên biệt (GPU, bộ nhớ siêu lớn)',
        'Khối lượng xử lý ổn định 24/7 với tải đều đặn, khi mà việc mua Reserved Instances hoặc Savings Plans cho EC2 mang lại tổng chi phí rẻ hơn nhiều so với hàng trăm triệu lượt gọi Lambda',
      ],
      chooseOtherWhen: [
        'Xử lý logic nghiệp vụ theo sự kiện đột xuất từ S3, DynamoDB Streams, SQS hoặc API Gateway',
        'Ứng dụng web/API có lượng truy cập biến động mạnh và muốn hạ chi phí về 0 khi không có người dùng',
        'Muốn giải phóng hoàn toàn đội ngũ kỹ thuật khỏi gánh nặng quản trị hạ tầng, vá lỗi hệ điều hành và quản lý dung lượng',
      ],
    },
    {
      againstServiceId: 'ecs-fargate',
      againstServiceName: 'AWS Fargate',
      coreDifference: 'Cả hai đều phục vụ việc chạy ứng dụng lâu dài, nhưng EC2 bắt bạn quản lý cụm máy chủ bên dưới trong khi Fargate chạy container theo mô hình serverless hoàn toàn không máy chủ.',
      mechanismDifference:
        'Với EC2 Launch Type, bạn phải tự chọn instance type, quản lý OS, cài đặt container runtime, vá lỗi bảo mật định kỳ và thiết lập cả cơ chế mở rộng máy chủ (Cluster Auto Scaling) lẫn mở rộng container. Với AWS Fargate, bạn chỉ cần chỉ định dung lượng CPU và RAM cho từng Task/Pod; AWS tự động cấp phát môi trường thực thi cô lập, bảo mật và trừu tượng hóa hoàn toàn lớp máy chủ bên dưới.',
      chooseThisWhen: [
        'Cần truy cập trực tiếp vào tài nguyên phần cứng chuyên sâu như GPU cho mô hình học máy hoặc Elastic Fabric Adapter cho tính toán phân tán',
        'Cần tinh chỉnh kernel parameters, mount các giao thức filesystem đặc thù cấp OS hoặc chạy các daemon monitoring cấp máy chủ',
        'Tối ưu chi phí tối đa cho cụm container lớn chạy ổn định thông qua việc kết hợp Spot Instances và Reserved Instances tự quản lý',
      ],
      chooseOtherWhen: [
        'Ứng dụng đã được đóng gói thành Docker container và đội ngũ muốn tập trung hoàn toàn vào phát triển phần mềm thay vì vận hành máy chủ',
        'Muốn loại bỏ hoàn toàn công việc bảo trì AMI, vá bảo mật hệ điều hành và cân đối dung lượng trống trên worker node',
        'Cần khả năng co giãn container nhanh chóng mà không bị tắc nghẽn bởi thời gian chờ cụm EC2 bên dưới provision thêm instance mới',
      ],
    },
    {
      againstServiceName: 'AWS Elastic Beanstalk',
      coreDifference: 'EC2 là dịch vụ hạ tầng tính toán cơ bản (IaaS); Elastic Beanstalk là nền tảng quản lý triển khai ứng dụng (PaaS) tự động ghép nối EC2, Auto Scaling, ALB và RDS lại với nhau.',
      mechanismDifference:
        'Bên dưới Elastic Beanstalk vẫn là các tài nguyên AWS tiêu chuẩn (EC2, ASG, ALB) nhưng Beanstalk tự động tạo, cấu hình và quản lý vòng đời cho bạn thông qua file cấu hình đơn giản. Làm việc trực tiếp với EC2 đòi hỏi bạn phải tự tay thiết kế từng thành phần mạng VPC, viết script bootstrap và cấu hình từng dịch vụ riêng biệt hoặc qua các công cụ IaC.',
      chooseThisWhen: [
        'Cần kiểm soát tuyệt đối từng chi tiết cấu hình mạng VPC, Security Group, topology lưu trữ và các thông số chuyên sâu của hạ tầng',
        'Tổ chức quản lý toàn bộ hạ tầng bằng các công cụ chuyên nghiệp như Terraform, AWS CDK hoặc Ansible',
        'Kiến trúc ứng dụng phức tạp, phân tán nhiều tầng không đi theo mô hình web application hay worker tiêu chuẩn của Beanstalk',
      ],
      chooseOtherWhen: [
        'Cần đưa nhanh một ứng dụng web (Node.js, Java, Python, PHP, .NET) lên AWS chỉ bằng thao tác tải file zip code lên mà không cần học sâu về VPC hay ASG',
        'Đội ngũ phát triển phần mềm nhỏ không có kỹ sư chuyên trách về Cloud/DevOps để quản lý máy chủ',
      ],
    },
  ],

  examTraps: [
    {
      distractorPattern:
        'Đề bài yêu cầu giảm chi phí tối đa cho một hệ thống cơ sở dữ liệu quan hệ quan trọng (Critical Database) hoặc hệ thống xử lý giao dịch thanh toán, đáp án gợi ý dùng Spot Instances vì mức giảm giá lên tới 90%.',
      whyWrong:
        'Spot Instances có thể bị thu hồi bất kỳ lúc nào với thông báo trước chỉ 2 phút khi AWS cần lấy lại tài nguyên. Workload có trạng thái (stateful) hoặc cơ sở dữ liệu không chịu được sự cố gián đoạn đột ngột sẽ bị mất kết nối, failover liên tục hoặc hỏng hóc dữ liệu.',
      correctAnswer:
        'Sử dụng Reserved Instances hoặc Savings Plans cho các cơ sở dữ liệu và workload cốt lõi chạy liên tục. Chỉ dùng Spot Instances cho các tác vụ stateless, batch processing, render video, hoặc CI/CD có khả năng thử lại khi bị ngắt quãng.',
      signalKeywords: ['cost optimization', 'database', 'critical workload', 'cannot tolerate interruption', 'Spot instance'],
      severity: 'high',
    },
    {
      distractorPattern:
        'Đề bài hỏi cách bảo toàn dữ liệu trên ổ đĩa cục bộ (Instance Store) khi cần nâng cấp instance type bằng thao tác Stop rồi Start lại máy chủ.',
      whyWrong:
        'Instance Store là bộ nhớ tạm thời gắn trực tiếp trên máy chủ vật lý. Khi thực hiện Stop instance, phần cứng vật lý đó bị giải phóng và toàn bộ dữ liệu trên Instance Store sẽ bị xóa sạch vĩnh viễn, không thể khôi phục.',
      correctAnswer:
        'Phải sử dụng Amazon EBS volume cho tất cả các dữ liệu cần tồn tại qua các chu kỳ Stop và Start. Nếu buộc phải dùng Instance Store để đạt IOPS cao, phải thiết lập cơ chế sao lưu dữ liệu liên tục lên Amazon S3 hoặc EBS trước khi thực hiện thao tác dừng máy chủ.',
      signalKeywords: ['stop and start', 'instance store', 'ephemeral', 'data persistence', 'upgrade instance type'],
      severity: 'high',
    },
    {
      distractorPattern:
        'Đề bài yêu cầu một hệ thống vừa có độ trễ mạng nội bộ cực thấp (sub-millisecond latency, 10-100 Gbps) vừa phải đảm bảo High Availability chịu được sự cố mất hoàn toàn một Availability Zone, đáp án chọn tạo một Cluster Placement Group trải qua 2 AZ.',
      whyWrong:
        'Cluster Placement Group chỉ có thể tồn tại trong DUY NHẤT một Availability Zone. AWS không hỗ trợ và không cho phép tạo Cluster Placement Group mở rộng qua nhiều AZ.',
      correctAnswer:
        'Cluster Placement Group chỉ dùng cho mục tiêu tối ưu hiệu năng mạng trong 1 AZ. Muốn đạt High Availability, bạn phải tạo 2 Cluster Placement Group riêng biệt ở 2 AZ khác nhau và tự thực hiện đồng bộ dữ liệu ở tầng ứng dụng.',
      signalKeywords: ['cluster placement group', 'low latency', 'high throughput', 'multiple availability zones', 'high availability'],
      severity: 'high',
    },
    {
      distractorPattern:
        'EC2 instance trong private subnet gửi request ra ngoài Internet (ví dụ gọi REST API ngoài qua cổng 443) nhưng không nhận được response, đáp án gợi ý cần mở Inbound Rule trên Security Group cho các cổng ngẫu nhiên (ephemeral ports 1024-65535).',
      whyWrong:
        'Security Group hoạt động theo cơ chế stateful. Khi một kết nối bắt nguồn từ EC2 đi ra ngoài (Outbound hợp lệ), gói tin phản hồi quay trở lại tự động được cho phép đi qua mà không cần bất kỳ Inbound Rule nào.',
      correctAnswer:
        'Không cần chỉnh sửa Security Group. Nguyên nhân thực tế là do Network ACL (stateless) chưa mở Inbound cho ephemeral ports (1024-65535) từ 0.0.0.0/0, hoặc Route Table của private subnet chưa cấu hình default route 0.0.0.0/0 trỏ tới NAT Gateway.',
      signalKeywords: ['security group', 'inbound rule', 'ephemeral ports', 'outbound traffic', 'stateful'],
      severity: 'high',
    },
    {
      distractorPattern:
        'Ứng dụng chạy trên EC2 cần quyền đọc ghi dữ liệu vào S3 bucket hoặc truy vấn DynamoDB, đáp án đề xuất lưu trữ AWS Access Key ID và Secret Access Key trong file cấu hình ứng dụng hoặc biến môi trường hệ điều hành.',
      whyWrong:
        'Lưu trữ credentials tĩnh trực tiếp trên máy chủ vi phạm nghiêm trọng nguyên tắc bảo mật của AWS Well-Architected Framework. Khóa truy cập có thể bị lộ qua mã nguồn, log hệ thống, AMI backup hoặc khi máy chủ bị xâm nhập.',
      correctAnswer:
        'Tạo một IAM Role với quyền hạn tối thiểu (least privilege) và gán vào EC2 instance thông qua IAM Instance Profile. Ứng dụng dùng AWS SDK sẽ tự động lấy và xoay vòng credentials tạm thời an toàn thông qua Instance Metadata Service.',
      signalKeywords: ['access S3 from EC2', 'AWS credentials', 'IAM role', 'IAM instance profile', 'access key'],
      severity: 'high',
    },
    {
      distractorPattern:
        'Đề bài yêu cầu thực hiện script cập nhật cấu hình ứng dụng trên EC2 định kỳ mỗi lần restart máy chủ, đáp án đưa ra là cấu hình đoạn script đó trong User Data.',
      whyWrong:
        'Mặc định User Data script CHỈ chạy đúng một lần duy nhất trong toàn bộ vòng đời của instance (ở lần boot đầu tiên sau khi launch). Mọi lần reboot hay stop/start tiếp theo, User Data sẽ không được thực thi lại.',
      correctAnswer:
        'Để chạy script mỗi lần khởi động, phải thiết lập service bên trong hệ điều hành (như systemd unit, cron job @reboot), hoặc cấu hình chỉ thị cloud-init định dạng MIME đa phần với tần suất chạy per-boot, hoặc sử dụng AWS Systems Manager Run Command / State Manager.',
      signalKeywords: ['user data', 'run on every reboot', 'boot script', 'cloud-init'],
      severity: 'medium',
    },
    {
      distractorPattern:
        'Ứng dụng web chạy trên EC2 có lỗ hổng bảo mật SSRF (Server-Side Request Forgery) khiến kẻ tấn công trích xuất được IAM credentials của instance, đáp án đề xuất thay đổi Security Group hoặc mã hóa ổ đĩa EBS để ngăn chặn.',
      whyWrong:
        'Security Group chỉ lọc lưu lượng mạng ở ranh giới card mạng ENI và mã hóa EBS bảo vệ dữ liệu khi nghỉ; cả hai không thể ngăn chặn request bắt nguồn từ chính bên trong ứng dụng web gọi tới địa chỉ link-local 169.254.169.254.',
      correctAnswer:
        'Bắt buộc chuyển sang sử dụng IMDSv2 (cấu hình HttpTokens=required và đặt HttpPutResponseHopLimit=1). IMDSv2 đòi hỏi session token thông qua HTTP PUT với custom header, làm vô hiệu hóa hoàn toàn các kỹ thuật khai thác SSRF thông thường.',
      signalKeywords: ['SSRF', 'metadata service', 'IMDSv1 vs IMDSv2', 'stolen credentials', '169.254.169.254'],
      severity: 'high',
    },
  ],

  architectures: [
    {
      id: 'ec2-resilient-multi-az-web',
      title: 'Ứng dụng web 3 tầng chuẩn High Availability và Auto Scaling đa Availability Zone',
      scenario:
        'Một công ty thương mại điện tử cần triển khai ứng dụng web chịu tải biến động mạnh trong các đợt flash sale. Ràng buộc: hệ thống phải chịu được sự cố sập hoàn toàn một Availability Zone mà không gây gián đoạn dịch vụ, web server tuyệt đối không để lộ trực tiếp ra Internet, và tối ưu hóa chi phí hạ tầng cơ sở.',
      steps: [
        {
          order: 1,
          component: 'Amazon Route 53',
          action: 'Định tuyến người dùng truy cập tên miền thông qua Alias record trỏ trực tiếp về Application Load Balancer.',
          whyThisChoice: 'Route 53 Alias record hoàn toàn miễn phí truy vấn cho tài nguyên AWS và hỗ trợ trỏ trực tiếp từ Apex/Zone Apex domain.',
        },
        {
          order: 2,
          component: 'Application Load Balancer (ALB)',
          action: 'Đặt trong các Public Subnet trải rộng trên 3 Availability Zones; tiếp nhận traffic HTTPS, thực hiện TLS termination với chứng chỉ từ AWS Certificate Manager (ACM), và phân phối tải về Target Group.',
          whyThisChoice: 'ALB hoạt động ở tầng 7 (Layer 7), hỗ trợ định tuyến theo URL path/header, kiểm tra trạng thái sức khỏe (Health Check) tự động và tự động mở rộng theo lượng traffic.',
        },
        {
          order: 3,
          component: 'Mô hình Security Group phân tầng (Tiered Security Groups)',
          action: 'ALB Security Group mở cổng 443 cho 0.0.0.0/0; EC2 Web Security Group chỉ cho phép Inbound cổng 80/8080 với nguồn truy cập (Source) là chính ALB Security Group ID.',
          whyThisChoice: 'Ngăn chặn triệt để nguy cơ bypass Load Balancer; chỉ có traffic đã qua kiểm tra và phân phối từ ALB mới có thể chạm tới web server.',
        },
        {
          order: 4,
          component: 'Auto Scaling Group (ASG) & Launch Template',
          action: 'Quản lý các EC2 instances đặt hoàn toàn trong các Private Subnet trên 3 AZ. Cấu hình Launch Template chuẩn hóa với Amazon Linux 2023 AMI, IAM Instance Profile, ép buộc IMDSv2, và thiết lập Target Tracking Scaling Policy theo metric CPU Utilization hoặc ALB Request Count Per Target.',
          whyThisChoice: 'Tự động mở rộng số lượng instance khi có flash sale và thu hẹp lại khi hết giờ cao điểm để tiết kiệm chi phí; tự động phát hiện và thay thế instance bị hỏng.',
        },
        {
          order: 5,
          component: 'NAT Gateway đa AZ',
          action: 'Đặt mỗi NAT Gateway tại một Public Subnet của từng AZ để các EC2 ở Private Subnet tải bản vá phần mềm ra Internet.',
          whyThisChoice: 'Tránh việc các EC2 ở AZ khác phụ thuộc vào NAT Gateway duy nhất tại một AZ (loại bỏ Single Point of Failure giữa các vùng).',
        },
        {
          order: 6,
          component: 'Amazon Aurora Multi-AZ',
          action: 'Tầng cơ sở dữ liệu quan hệ được đặt trong các Database Subnet biệt lập; EC2 kết nối qua Aurora Cluster Endpoint với khả năng tự động failover sang replica trong dưới 30 giây.',
          whyThisChoice: 'Đảm bảo tính nhất quán và phục hồi nhanh chóng khi AZ gặp sự cố, phân tách hoàn toàn tầng lưu trữ dữ liệu khỏi tầng tính toán không trạng thái.',
        },
      ],
      rejectedAlternatives: [
        {
          option: 'Đặt các máy chủ EC2 trực tiếp trong Public Subnet và gán Elastic IP',
          whyRejected: 'Tạo bề mặt tấn công nguy hiểm từ Internet công cộng, tốn kém chi phí địa chỉ IPv4 công cộng, và không có khả năng cân bằng tải co giãn.',
        },
        {
          option: 'Dùng một EC2 instance kích thước siêu lớn (Scale-Up) để chịu tải flash sale',
          whyRejected: 'Tạo ra điểm chết đơn lẻ (SPOF) nghiêm trọng; nếu máy chủ vật lý hoặc AZ đó gặp sự cố, toàn bộ website thương mại điện tử sẽ sụp đổ hoàn toàn.',
        },
      ],
      tradeoffs: [
        'Triển khai đa AZ và duy trì NAT Gateway riêng biệt cho từng AZ làm tăng chi phí hạ tầng cố định hàng tháng và phát sinh phí truyền dữ liệu cross-AZ.',
        'Độ trễ khởi động instance mới trong ASG thường mất từ 2 đến 5 phút, đòi hỏi thiết lập ngưỡng cảnh báo sớm để đón đầu các đợt bùng nổ tải tức thì.',
      ],
    },
    {
      id: 'ec2-cost-optimized-batch-processing',
      title: 'Hệ thống xử lý Batch phân tán tối ưu chi phí kết hợp Spot và On-Demand',
      scenario:
        'Một công ty công nghệ y tế cần xử lý hàng triệu tệp tin ảnh chụp X-quang và phân tích dữ liệu mỗi đêm. Ràng buộc: toàn bộ khối lượng công việc phải hoàn thành trước 6:00 sáng mỗi ngày, chi phí hạ tầng tính toán phải thấp nhất có thể, nhưng hệ thống vẫn phải bảo đảm tiến độ ngay cả khi có lượng lớn Spot Instances bị thu hồi bất ngờ.',
      steps: [
        {
          order: 1,
          component: 'Amazon S3 & S3 Event Notifications',
          action: 'Lưu trữ các file ảnh chụp y tế đầu vào; khi file tải lên hoàn tất, S3 tự động phát sinh event thông báo đẩy metadata công việc vào hàng đợi.',
          whyThisChoice: 'Kho lưu trữ có độ bền 11 số 9, chi phí lưu trữ thấp và hỗ trợ tích hợp kích hoạt sự kiện tự động.',
        },
        {
          order: 2,
          component: 'Amazon SQS (Standard Queue)',
          action: 'Làm hàng đệm lưu trữ danh sách các tác vụ phân tích cần xử lý, tách rời hoàn toàn giữa nguồn sinh dữ liệu và cụm máy chủ tính toán.',
          whyThisChoice: 'Tách rời kiến trúc (decoupling), đảm bảo không bao giờ bị mất tác vụ dù cụm máy chủ xử lý có gặp sự cố gián đoạn.',
        },
        {
          order: 3,
          component: 'EC2 Auto Scaling Group hỗn hợp (Mixed Instances Policy)',
          action: 'Cấu hình Allocation Strategy kết hợp: duy trì một tỷ lệ nhỏ On-Demand instances (ví dụ 20%) làm năng lực cơ sở bảo đảm tiến độ tối thiểu, và 80% còn lại là Spot Instances đa dạng hóa qua nhiều instance types tương đương (như c5.large, c5a.large, c6i.large).',
          whyThisChoice: 'Đa dạng hóa instance pools giúp giảm thiểu tối đa rủi ro bị thu hồi Spot đồng loạt do cạn kiệt tài nguyên trong một pool cụ thể, đồng thời cắt giảm tới 80% chi phí tính toán.',
        },
        {
          order: 4,
          component: 'Target Tracking Scaling dựa trên Backlog Per Instance',
          action: 'Thiết lập chỉ số mở rộng dựa trên công thức tùy chỉnh: ApproximateNumberOfMessagesVisible chia cho số lượng instance đang chạy trong ASG.',
          whyThisChoice: 'Scaling theo độ dài hàng đợi phản ánh chính xác khối lượng công việc thực tế cần xử lý, tránh tình trạng scale dựa trên CPU vốn phản ánh sai lệch trong các tác vụ I/O bound.',
        },
        {
          order: 5,
          component: 'Xử lý cảnh báo ngắt quãng Spot (Interruption Handler)',
          action: 'Ứng dụng worker lắng nghe sự kiện cảnh báo trước 2 phút từ Amazon EventBridge; khi nhận thông báo, worker lập tức lưu checkpoint trạng thái xử lý dở dang lên S3 và nhả message về lại SQS queue.',
          whyThisChoice: 'Tận dụng trọn vẹn 120 giây quý giá để tránh mất dữ liệu đã tính toán và cho phép worker khác nhận lại tác vụ ngay lập tức.',
        },
      ],
      rejectedAlternatives: [
        {
          option: 'Chạy toàn bộ cụm máy chủ xử lý batch bằng các instance On-Demand cố định',
          whyRejected: 'Chi phí tính toán vô cùng đắt đỏ và gây lãng phí tài nguyên khổng lồ vào ban ngày khi không có công việc xử lý batch.',
        },
        {
          option: 'Sử dụng 100% Spot Instances từ một loại instance duy nhất (ví dụ chỉ chọn c5.large)',
          whyRejected: 'Nếu pool c5.large trong Region bị thiếu hụt tài nguyên, toàn bộ máy chủ sẽ bị thu hồi cùng lúc khiến công việc đình trệ và vi phạm cam kết hoàn thành trước 6:00 sáng.',
        },
      ],
      tradeoffs: [
        'Ứng dụng xử lý bắt buộc phải được thiết kế theo mô hình phi trạng thái (stateless) và phải có logic lưu checkpointing tiến độ phức tạp.',
        'Thời gian hoàn tất xử lý có thể dao động nhẹ tùy thuộc vào tần suất bị thu hồi Spot Instances trong đêm.',
      ],
    },
  ],

  integrationNotes: [
    {
      withServiceId: 'ebs',
      withServiceName: 'Amazon EBS',
      relationship:
        'Cung cấp ổ đĩa khối (block storage) bền vững và hiệu năng cao cho EC2 trong cùng một AZ; hỗ trợ chụp snapshot gia tăng lưu trữ trên S3 và thay đổi kích thước/loại ổ đĩa (Elastic Volumes) mà không cần tắt máy chủ.',
    },
    {
      withServiceId: 'auto-scaling',
      withServiceName: 'Amazon EC2 Auto Scaling',
      relationship:
        'Tự động theo dõi nhu cầu và điều chỉnh số lượng EC2 instances thông qua Launch Template và các chính sách Target Tracking / Step Scaling, đảm bảo duy trì tính sẵn sàng cao đa AZ và tối ưu chi phí.',
    },
    {
      withServiceId: 'alb',
      withServiceName: 'Application Load Balancer',
      relationship:
        'Đóng vai trò điểm tiếp nhận traffic tập trung ở tầng ứng dụng (HTTP/HTTPS), phân phối tải đồng đều tới các EC2 instances trong Target Group qua nhiều AZ và tự động ngắt định tuyến tới các instance không vượt qua Health Check.',
    },
    {
      withServiceId: 'iam',
      withServiceName: 'AWS IAM',
      relationship:
        'Cung cấp cơ chế cấp quyền bảo mật thông qua IAM Instance Profile, cho phép ứng dụng chạy trên EC2 nhận temporary credentials tự động từ Instance Metadata Service để gọi các API của AWS mà không cần lưu trữ static access keys.',
    },
    {
      withServiceId: 'cloudwatch',
      withServiceName: 'Amazon CloudWatch',
      relationship:
        'Giám sát các chỉ số cơ bản của hypervisor (CPU Utilization, Disk I/O, Network In/Out) mặc định 5 phút hoặc 1 phút (Detailed Monitoring); kết hợp cài đặt CloudWatch Agent trên OS để thu thập thêm chỉ số RAM Utilization và system logs.',
    },
    {
      withServiceId: 'systems-manager',
      withServiceName: 'AWS Systems Manager',
      relationship:
        'Tính năng Session Manager cho phép mở terminal điều khiển EC2 an toàn qua trình duyệt mà không cần mở cổng SSH 22 và không cần Public IP; tính năng Patch Manager tự động quét và cài đặt bản vá bảo mật hệ điều hành theo lịch trình.',
    },
    {
      withServiceId: 'vpc',
      withServiceName: 'Amazon VPC',
      relationship:
        'Cung cấp hạ tầng mạng riêng ảo cô lập để EC2 hoạt động, định tuyến luồng dữ liệu thông qua Subnets, Route Tables, Internet Gateway, NAT Gateway và bảo vệ tầng mạng bằng Security Groups và Network ACLs.',
    },
  ],

  deepLinks: [
    {
      label: 'Hướng dẫn lựa chọn EC2 Instance Types',
      url: 'https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/instance-types.html',
    },
    {
      label: 'Mô hình giá và các lựa chọn mua EC2 (Purchasing Options)',
      url: 'https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/instance-purchasing-options.html',
    },
    {
      label: 'Kiến trúc và cấu hình Placement Groups',
      url: 'https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/placement-groups.html',
    },
    {
      label: 'Cấu hình và bảo mật với Instance Metadata Service v2 (IMDSv2)',
      url: 'https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/configuring-instance-metadata-service.html',
    },
  ],
};
