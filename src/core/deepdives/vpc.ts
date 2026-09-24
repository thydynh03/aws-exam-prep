import type { ServiceDeepDive } from '../types';

export const vpcDeepDive: ServiceDeepDive = {
  serviceId: 'vpc',
  serviceName: 'Amazon VPC',
  category: 'Networking',
  tier: 'core',

  whyItExists:
    'Thời kỳ đầu của đám mây, các máy chủ chạy chung trên một mạng phẳng công cộng và bất kỳ ai cũng có thể dò quét cổng nếu cấu hình sơ hở. Amazon VPC sinh ra để cắt riêng một phân vùng mạng ảo cô lập hoàn toàn, cho phép bạn tự định nghĩa dải IP, sơ đồ subnet, bảng định tuyến và ranh giới bảo mật hệt như trung tâm dữ liệu vật lý. Đổi lại, bạn phải tự gánh trách nhiệm thiết kế topology mạng; việc phân bổ sai dải CIDR, cạn kiệt IP hoặc định tuyến nhầm subnet sẽ làm tắc nghẽn toàn bộ hệ thống, cô lập dịch vụ và làm phình to chi phí gateway.',

  howItWorks: [
    {
      title: 'Mạng ảo hóa bằng phần mềm (SDN) và router ngầm không điểm nghẽn',
      explanation:
        'VPC không có dây cáp hay router phần cứng vật lý nào. Khi EC2 gửi gói tin, card mạng ảo (ENI) đóng gói packet vào giao thức overlay (Geneve trên phần cứng Nitro) và tra cứu Mapping Service phân tán của AWS để tìm vị trí máy chủ vật lý đích. Router ngầm của VPC (mặc định tại IP .1 của mỗi subnet) là một router vô hình được quản lý bằng phần mềm trên toàn Region, tự động xử lý mọi tuyến đường cục bộ (local route) mà không có điểm lỗi đơn lẻ (no single point of failure).',
      soWhat:
        'Router nội bộ trong VPC không bao giờ bị nghẽn băng thông hay sập nguồn, và lưu lượng giữa hai subnet bất kỳ trong cùng VPC luôn thông suốt mà không cần cấu hình thêm router. Trừ khi bạn chặn bằng Network ACL hoặc Security Group, không gì trong VPC có thể ngăn hai subnet cùng VPC nhìn thấy nhau.',
    },
    {
      title: 'Hai tầng phòng thủ: Security Group (Stateful) và Network ACL (Stateless)',
      explanation:
        'Gói tin từ ngoài vào ENI phải đi qua Network ACL ở ranh giới subnet trước, rồi mới chạm tới Security Group gắn trực tiếp trên ENI. Security Group là stateful: nó tự động ghi nhớ phiên kết nối (connection tracking), hễ traffic vào được chấp nhận thì traffic phản hồi tự động được đi ra bất kể rule outbound. Ngược lại, Network ACL là stateless: kiểm tra từng packet độc lập theo số thứ tự từ thấp đến cao (gặp rule khớp là dừng), hoàn toàn không nhớ phiên.',
      soWhat:
        'Dùng Security Group làm chốt chặn bảo mật chính cho máy chủ và ứng dụng vì nó cho phép tham chiếu theo ID của Security Group khác thay vì dải IP cố định. Dùng Network ACL làm lá chắn diện rộng ở cấp subnet, đặc biệt khi cần chặn dứt điểm một địa chỉ IP hay dải CIDR độc hại (Security Group không có rule Deny, chỉ NACL mới có Deny). Với NACL, nếu mở chiều Inbound cho client thì bắt buộc phải mở dải cổng ephemeral (1024-65535) ở chiều Outbound để gói tin phản hồi có đường quay về.',
    },
    {
      title: 'Cửa ngõ ra Internet: Internet Gateway (Regional) vs NAT Gateway (Zonal)',
      explanation:
        'Internet Gateway (IGW) là thành phần ảo phân tán ở cấp Region, tự động mở rộng theo tải, thực hiện chuyển đổi địa chỉ mạng 1-1 (1-to-1 NAT) giữa IP nội bộ và Public IP/Elastic IP của EC2; nó không tốn phí giờ và không giới hạn băng thông. Ngược lại, NAT Gateway thực hiện Source NAT (NAPT) cho các máy chủ trong private subnet; nó chạy trên hạ tầng nằm trong một AZ cụ thể, gắn 1 Elastic IP cố định, xử lý từ 5 Gbps đến 100 Gbps và tính phí cả theo giờ lẫn theo GB dữ liệu truyền qua.',
      soWhat:
        'Mất một AZ thì NAT Gateway ở AZ đó sẽ chết theo, kéo theo mọi private subnet phụ thuộc vào nó mất kết nối ra ngoài; do đó kiến trúc High Availability bắt buộc phải tạo NAT Gateway độc lập ở từng AZ. Ngoài ra, vì NAT Gateway tính phí trên từng GB dữ liệu đi qua, tuyệt đối không để các luồng dữ liệu khổng lồ đi tới các dịch vụ AWS nội bộ chạy qua NAT Gateway.',
    },
    {
      title: 'VPC Endpoint: Chặn rò rỉ dữ liệu và triệt tiêu chi phí NAT',
      explanation:
        'Các dịch vụ AWS công cộng (S3, DynamoDB, SQS, KMS...) mặc định có endpoint nằm ngoài Internet. VPC Endpoint đưa các dịch vụ này trực tiếp vào mạng nội bộ của bạn. Gateway Endpoint bổ sung prefix list vào Route Table của subnet để bẻ hướng lưu lượng ngầm sang S3 và DynamoDB hoàn toàn miễn phí. Interface Endpoint (AWS PrivateLink) cấy trực tiếp một ENI mang IP nội bộ vào subnet của bạn, sử dụng Private DNS để phân giải tên miền dịch vụ, tính phí theo giờ và theo GB.',
      soWhat:
        'Khi private subnet cần gọi S3 hoặc DynamoDB, luôn ưu tiên tạo Gateway Endpoint để cắt đứt 100% chi phí NAT Gateway và chi phí data transfer. Với hơn 100 dịch vụ AWS khác hoặc SaaS bên ngoài, Interface Endpoint là con đường duy nhất để giao tiếp mà gói tin không bao giờ phải chạm tới Internet công cộng.',
    },
  ],

  chooseWhen: [
    {
      condition: 'Xây dựng ứng dụng nhiều tầng (multi-tier) cần cô lập ranh giới an toàn',
      reason:
        'Phân tách rõ ràng: tầng web nằm ở public subnet nhận traffic từ Internet, tầng ứng dụng nằm ở private subnet chỉ nhận traffic từ ALB, và tầng database nằm ở isolated subnet không có đường ra Internet.',
    },
    {
      condition: 'Cần kết nối an toàn với trung tâm dữ liệu on-premises',
      reason:
        'VPC cung cấp hạ tầng để thiết lập AWS Site-to-Site VPN hoặc AWS Direct Connect qua Virtual Private Gateway (VGW) hoặc Transit Gateway, biến đám mây thành một phần mở rộng liền mạch của mạng doanh nghiệp.',
    },
    {
      condition: 'Có yêu cầu tuân thủ an ninh khắt khe (PCI-DSS, HIPAA, SOC 2, tài chính)',
      reason:
        'Cho phép giám sát toàn bộ luồng mạng qua VPC Flow Logs, kiểm soát lưu lượng 2 lớp bằng Security Group và Network ACL, và ngăn chặn thất thoát dữ liệu bằng VPC Endpoint Policy.',
    },
    {
      condition: 'Vận hành cụm container (EKS/ECS) hoặc cụm cơ sở dữ liệu quan hệ (RDS/Aurora)',
      reason:
        'Cung cấp địa chỉ IP nội bộ cố định, bảo đảm hiệu năng mạng độ trễ thấp giữa các node và hỗ trợ chia sẻ dịch vụ an toàn giữa các cụm.',
    },
    {
      condition: 'Chia sẻ dịch vụ an toàn giữa nhiều tài khoản AWS mà không muốn nối toàn bộ mạng',
      reason:
        'Dùng VPC Endpoint Service (PrivateLink) để đối tác hoặc các tài khoản khác gọi tới dịch vụ của bạn qua một ENI nội bộ mà không cần mở VPC Peering hay để lộ dải CIDR.',
    },
  ],

  avoidWhen: [
    {
      condition: 'Ứng dụng serverless thuần túy chỉ gồm API Gateway, AWS Lambda, DynamoDB và S3',
      reason:
        'Đưa Lambda vào VPC khi không cần gọi tài nguyên nội bộ (như RDS) sẽ làm tăng độ phức tạp quản lý dải IP, tăng nguy cơ cạn kiệt ENI/IP, và bắt buộc phải tốn tiền dựng NAT Gateway chỉ để Lambda gọi các API công cộng.',
      useInstead: 'Chạy Lambda bên ngoài VPC theo cấu hình serverless mặc định của AWS.',
    },
    {
      condition: 'Chỉ lưu trữ và phân phối website tĩnh hoặc tài nguyên tĩnh (ảnh, video, JS/CSS)',
      reason:
        'VPC là ảo hóa mạng máy chủ. Triển khai máy chủ web trong VPC chỉ để phục vụ file tĩnh vừa tốn chi phí hạ tầng (EC2, ALB, NAT) vừa không có khả năng chịu tải biên toàn cầu.',
      useInstead: 'Amazon S3 kết hợp Amazon CloudFront.',
    },
    {
      condition: 'Cần mạng kết nối lưới giữa hàng chục đến hàng trăm VPC và mạng văn phòng',
      reason:
        'VPC Peering là kết nối điểm-điểm không bắc cầu; với 50 VPC sẽ cần hơn 1.200 kết nối peering, gây quá tải quản trị bảng định tuyến và dễ nhầm lẫn.',
      useInstead: 'AWS Transit Gateway hoặc AWS Cloud WAN theo mô hình hub-and-spoke.',
    },
    {
      condition: 'Bảo vệ ứng dụng chống DDoS và lọc bot ở quy mô toàn cầu',
      reason:
        'VPC chỉ có phạm vi cục bộ trong 1 Region, không có mạng lưới điểm biên phân tán để hấp thụ và triệt tiêu các đợt tấn công DDoS hàng trăm Gbps trước khi chạm vào hạ tầng.',
      useInstead: 'Amazon CloudFront kết hợp AWS Shield và AWS WAF.',
    },
    {
      condition: 'Triển khai ứng dụng container đơn giản mà nhóm phát triển không có chuyên môn về mạng',
      reason:
        'Tự thiết kế VPC, tính toán CIDR, cấu hình subnet, IGW, NAT GW và route table mang lại gánh nặng vận hành quá lớn cho một ứng dụng đơn lẻ.',
      useInstead: 'AWS App Runner hoặc AWS Elastic Beanstalk.',
    },
  ],

  limits: [
    {
      name: 'Số lượng VPC trên mỗi Region cho một tài khoản',
      value: '5 VPC mặc định',
      implication:
        'Đây là soft limit, có thể gửi yêu cầu tăng qua Service Quotas lên tới 100 VPC. Tuy nhiên, doanh nghiệp lớn nên áp dụng chiến lược đa tài khoản (Multi-Account với AWS Organizations) thay vì nhét quá nhiều VPC vào một tài khoản.',
      adjustable: true,
    },
    {
      name: 'Kích thước CIDR block của một VPC',
      value: 'Tối thiểu /28 (16 IP), tối đa /16 (65.536 IP)',
      implication:
        'Không thể tạo VPC với CIDR lớn hơn /16 (ví dụ /8 hay /12). Nếu thiếu IP, AWS cho phép gắn thêm tối đa 4 dải CIDR thứ cấp (Secondary CIDR) vào VPC hiện có.',
      adjustable: false,
    },
    {
      name: 'Số địa chỉ IP bị AWS bảo lưu cố định trong mỗi subnet',
      value: '5 địa chỉ IP (.0 Network, .1 VPC Router, .2 AWS DNS, .3 Reserved, .255 Broadcast)',
      implication:
        'Subnet nhỏ nhất /28 có 16 IP nhưng chỉ có đúng 11 IP khả dụng cho máy chủ. Đây là bẫy tính toán IP cực kỳ phổ biến trong đề thi SAA-C03.',
      adjustable: false,
    },
    {
      name: 'Băng thông cơ sở của một NAT Gateway',
      value: '5 Gbps cơ bản, tự động mở rộng lên tới 100 Gbps',
      implication:
        'Mỗi NAT Gateway tự động scale băng thông. Nếu workload cần thông lượng lớn hơn 100 Gbps ra Internet, bạn bắt buộc phải chia tải ra nhiều subnet và nhiều NAT Gateway.',
      adjustable: false,
    },
    {
      name: 'Số quy tắc (rules) trên một Network ACL',
      value: 'Mặc định 20 inbound và 20 outbound, có thể tăng lên tối đa 40',
      implication:
        'Không nên lạm dụng NACL để làm tường lửa lọc chi tiết từng ứng dụng; việc tăng quá 20 rules có thể làm suy giảm hiệu năng xử lý gói tin của mạng.',
      adjustable: true,
    },
    {
      name: 'Số Security Group gắn vào một card mạng (ENI)',
      value: 'Mặc định 5 Security Groups',
      implication:
        'Có thể xin tăng tối đa lên 16, nhưng tích số (số Security Group trên ENI * số rule mỗi Security Group) không được vượt quá 1.000.',
      adjustable: true,
    },
    {
      name: 'Số kết nối VPC Peering hoạt động trên mỗi VPC',
      value: 'Mặc định 50, tối đa 125',
      implication:
        'Khi quy mô kết nối vượt quá ngưỡng này, kiến trúc bắt buộc phải chuyển đổi sang AWS Transit Gateway (hỗ trợ tới 5.000 VPC attachments).',
      adjustable: true,
    },
    {
      name: 'Số bảng định tuyến (Route Tables) trên mỗi VPC',
      value: '200 Route Tables',
      implication:
        'Mỗi subnet chỉ được gắn với đúng 1 Route Table tại một thời điểm (nhưng một Route Table có thể gắn cho nhiều subnet). Đủ thoải mái cho hầu hết kiến trúc phân tầng.',
      adjustable: true,
    },
  ],

  cost: {
    billingDimensions: [
      'Bản thân Amazon VPC, Subnet, Route Table và Internet Gateway hoàn toàn MIỄN PHÍ',
      'Phí duy trì NAT Gateway: tính theo giờ hoạt động (~0.045 USD/giờ mỗi NAT Gateway) cộng phí xử lý dữ liệu (~0.045 USD cho mỗi GB dữ liệu truyền qua)',
      'Phí VPC Interface Endpoint (PrivateLink): tính theo giờ hoạt động (~0.01 USD/giờ mỗi AZ) cộng phí xử lý dữ liệu (~0.01 USD/GB)',
      'Phí truyền dữ liệu (Data Transfer): miễn phí chiều vào (Inbound); tính phí chiều ra Internet (Outbound từ 0.09 USD/GB); tính phí truyền dữ liệu giữa các Availability Zone (Cross-AZ: 0.01 USD/GB mỗi chiều, tổng 0.02 USD/GB khứ hồi); tính phí VPC Peering xuyên Region',
      'Phí địa chỉ Public IPv4: 0.005 USD/giờ cho tất cả địa chỉ public IPv4 (từ tháng 2/2024), áp dụng cho cả Elastic IP đang gắn, Elastic IP nhàn rỗi, và public IP tự động gán cho EC2',
      'Phí lưu trữ và phân tích VPC Flow Logs: tính theo phí nạp và lưu trữ dữ liệu vào Amazon CloudWatch Logs hoặc Amazon S3',
    ],
    hiddenCosts: [
      'NAT Gateway ngốn chi phí kép khi xử lý dữ liệu lớn: EC2 trong private subnet tải file lớn từ S3 mà không có Gateway Endpoint sẽ bị tính phí NAT Data Processing (0.045 USD/GB) cộng thêm phí Data Transfer thông thường.',
      'Chi phí Cross-AZ Data Transfer âm thầm: Giao tiếp giữa EC2 ở AZ-a với RDS hoặc ElastiCache ở AZ-b tốn 0.02 USD/GB cho một vòng khứ hồi. Trong kiến trúc microservice có lưu lượng lớn, khoản này có thể lên tới hàng nghìn USD mỗi tháng mà ít khi bị để ý.',
      'Bỏ quên NAT Gateway trong môi trường thử nghiệm: 1 NAT Gateway rảnh rỗi không có byte dữ liệu nào đi qua vẫn tiêu tốn khoảng ~32.40 USD/tháng phí cố định theo giờ. Dựng ở 3 AZ là gần 100 USD/tháng cho VPC không ai dùng.',
      'Nhân bản Interface Endpoint theo số AZ: Tạo Interface Endpoint trên 3 AZ sẽ tạo ra 3 ENI và bị tính phí cố định theo giờ cho cả 3, ngay cả khi ứng dụng chỉ phát sinh request ở 1 AZ duy nhất.',
      'Địa chỉ Public IPv4 nhàn rỗi hoặc cấp phát thừa: Mỗi IP tốn 0.005 USD/giờ (~3.60 USD/tháng). Hàng trăm EC2 trong public subnet được bật auto-assign public IPv4 không cần thiết sẽ tích tụ hóa đơn đáng kể.',
    ],
    optimizationLevers: [
      'Bắt buộc tạo VPC Gateway Endpoint cho S3 và DynamoDB ngay từ đầu: Hoàn toàn miễn phí, bẻ toàn bộ lưu lượng dữ liệu nặng ra khỏi NAT Gateway.',
      'Tối ưu định tuyến trong cùng Availability Zone (AZ affinity): Cấu hình ứng dụng ưu tiên giao tiếp với cache node hoặc read replica trong cùng AZ để triệt tiêu phí Cross-AZ 0.02 USD/GB.',
      'Sử dụng NAT Instance thay thế NAT Gateway cho môi trường Dev/Test: Tận dụng instance loại nhỏ (như t4g.nano hoặc Spot) để tiết kiệm tới 80-90% chi phí so với việc duy trì NAT Gateway cố định.',
      'Dùng chung NAT Gateway giữa các AZ trong môi trường Non-Production: Chấp nhận đánh đổi tính sẵn sàng AZ ở môi trường dev để chỉ duy trì 1 NAT Gateway duy nhất cho toàn VPC.',
      'Chuyển đổi sang kiến trúc Dual-Stack (IPv6) cho các subnet công cộng để giảm dần số lượng địa chỉ Public IPv4 phải trả phí thuê.',
    ],
  },

  security: {
    encryptionAtRest: [
      'VPC là cấu trúc mạng logic, không lưu trữ dữ liệu payload của người dùng nên không có mã hóa dữ liệu lưu trữ trực tiếp trên VPC.',
      'Dữ liệu duy nhất của VPC được lưu trữ là VPC Flow Logs: khi đẩy về Amazon S3 được mã hóa bằng SSE-S3 hoặc SSE-KMS; khi đẩy về CloudWatch Logs được mã hóa mặc định hoặc qua KMS Customer Managed Key.',
    ],
    encryptionInTransit:
      'Lưu lượng nội bộ VPC giữa các instance chạy trên hệ thống AWS Nitro trong cùng một Region tự động được mã hóa ở tầng vật lý (Nitro in-transit encryption) mà không làm suy giảm hiệu năng. Với lưu lượng truyền ra ngoài, giữa các VPC không cùng Region, hoặc về on-premises, người dùng phải chủ động triển khai TLS/HTTPS ở tầng ứng dụng, hoặc dùng IPsec VPN (AES-256) / MACsec trên AWS Direct Connect.',
    accessControl: [
      'Security Group: Tường lửa ảo stateful ở cấp độ card mạng (ENI), kiểm tra port và protocol, hỗ trợ cho phép (Allow) theo CIDR hoặc tham chiếu trực tiếp theo Security Group ID khác.',
      'Network ACL: Tường lửa ảo stateless ở cấp độ ranh giới Subnet, lọc gói tin theo thứ tự số quy tắc (rule number), hỗ trợ cả quy tắc Cho phép (Allow) lẫn Từ chối (Deny).',
      'VPC Route Tables: Kiểm soát hướng đi của gói tin, quyết định subnet nào có thể giao tiếp với Internet, peering, gateway hay hoàn toàn bị cách ly.',
      'VPC Endpoint Policies: Resource-based policy gắn trực tiếp vào VPC Endpoint để kiểm soát những IAM principal nào được phép đi qua endpoint và chỉ được thao tác trên tài nguyên cụ thể nào.',
    ],
    defaultPosture:
      'VPC mới tạo hoàn toàn đóng kín với Internet (không có Internet Gateway). Default Security Group: Mở toàn bộ chiều Inbound từ chính nó và mở toàn bộ chiều Outbound (0.0.0.0/0). Tuy nhiên, Custom Security Group tạo mới: MẶC ĐỊNH CHẶN TOÀN BỘ INBOUND và MỞ TOÀN BỘ OUTBOUND. Default Network ACL: Mở toàn bộ Inbound và Outbound. Nhưng Custom Network ACL tạo mới: MẶC ĐỊNH CHẶN TOÀN BỘ INBOUND VÀ OUTBOUND.',
  },

  resilience: {
    failureScope: 'Region',
    builtInHA:
      'Bản thân cấu trúc VPC, router ngầm và Internet Gateway là dịch vụ cấp Region được AWS quản lý phân tán trên hạ tầng dự phòng đa AZ, tự động co giãn và không có điểm lỗi đơn lẻ. Tuy nhiên, Subnet và NAT Gateway lại gắn chặt với từng Availability Zone (AZ-scoped), nên tính sẵn sàng cao của ứng dụng phụ thuộc vào việc kiến trúc sư có thiết kế trải đều trên tối thiểu 2 AZ hay không.',
    crossRegionStory:
      'VPC không thể trải rộng qua nhiều Region. Để liên kết hai VPC ở hai Region khác nhau, bắt buộc sử dụng Inter-Region VPC Peering (lưu lượng đi trên đường trục cáp quang riêng toàn cầu của AWS, tự động mã hóa AES-256) hoặc AWS Transit Gateway Inter-Region Peering. Lưu ý rằng Gateway Endpoint (S3/DynamoDB) không thể truy cập xuyên Region qua VPC Peering.',
    backupRestore:
      'VPC là cấu hình mạng ảo, không có khái niệm snapshot hay sao lưu dữ liệu. Toàn bộ kiến trúc mạng (VPC, CIDR, subnets, route tables, security groups, gateways) phải được định nghĩa bằng mã (Infrastructure as Code - IaC) qua AWS CloudFormation hoặc Terraform để có thể tái tạo nhanh chóng ở một Region khác khi xây dựng phương án khắc phục thảm họa (Disaster Recovery).',
  },

  contrasts: [
    {
      againstServiceId: 'transit-gateway',
      againstServiceName: 'AWS Transit Gateway',
      coreDifference:
        'VPC Peering kết nối điểm-điểm trực tiếp giữa 2 VPC; AWS Transit Gateway đóng vai trò bộ định tuyến đám mây trung tâm (Cloud Router) kết nối hàng nghìn VPC và mạng on-premises theo mô hình hub-and-spoke.',
      mechanismDifference:
        'VPC Peering không dùng thiết bị trung gian, không có trần băng thông nhưng không hỗ trợ định tuyến bắc cầu (non-transitive). Transit Gateway là dịch vụ mạng có hạ tầng quản lý, hỗ trợ định tuyến bắc cầu giữa các VPC và VPN/Direct Connect, sở hữu bảng định tuyến riêng biệt, nhưng tính phí duy trì cổng theo giờ và phí dữ liệu xử lý theo GB.',
      chooseThisWhen: [
        'Số lượng VPC ít (dưới 5 đến 10 VPC) và không có nhu cầu mở rộng phức tạp',
        'Cần truyền khối lượng dữ liệu khổng lồ giữa 2 VPC và muốn tối ưu chi phí (peering không mất phí cổng và phí xử lý dữ liệu)',
        'Cần độ trễ mạng thấp nhất có thể giữa hai VPC trong cùng Region',
      ],
      chooseOtherWhen: [
        'Mạng doanh nghiệp lớn có hàng chục tới hàng nghìn VPC cần kết nối với nhau',
        'Cần định tuyến bắc cầu giữa nhiều VPC hoặc chia sẻ một kết nối Direct Connect/VPN duy nhất cho toàn bộ VPC',
        'Cần kiểm soát lưu lượng tập trung qua một VPC tường lửa kiểm tra an ninh (Security Inspection VPC)',
      ],
    },
    {
      againstServiceName: 'AWS PrivateLink (VPC Interface Endpoint)',
      coreDifference:
        'VPC Peering mở toàn bộ kết nối mạng hai chiều giữa 2 VPC; AWS PrivateLink chỉ mở duy nhất một dịch vụ cụ thể qua card mạng nội bộ (ENI) mà không để lộ mạng.',
      mechanismDifference:
        'VPC Peering đòi hỏi hai VPC phải có dải địa chỉ IP không trùng lặp (non-overlapping CIDRs) và cho phép các máy chủ nhìn thấy dải IP của nhau. PrivateLink sử dụng Network Load Balancer phía dịch vụ và cấy ENI vào VPC tiêu thụ; nó hoạt động bình thường ngay cả khi hai VPC BỊ TRÙNG DẢI IP (overlapping CIDRs) và giao tiếp hoàn toàn một chiều từ consumer sang provider.',
      chooseThisWhen: [
        'Cần kết nối toàn diện hai chiều giữa hai VPC tin cậy của cùng một tổ chức',
        'Các ứng dụng cần gọi nhiều port/protocol tùy biến khác nhau giữa hai bên',
        'Hai VPC đã được quy hoạch dải CIDR cẩn thận, không trùng lặp IP',
      ],
      chooseOtherWhen: [
        'Cung cấp dịch vụ cho khách hàng hoặc đối tác bên ngoài mà không muốn nối toàn bộ mạng',
        'Hai VPC bị trùng dải IP (overlapping CIDR) nhưng vẫn bắt buộc phải gọi dịch vụ của nhau',
        'Yêu cầu an ninh nghiêm ngặt: chỉ cho phép truy cập đúng một cổng dịch vụ duy nhất, chặn đứng mọi nguy cơ quét cổng hay xâm nhập ngang',
      ],
    },
    {
      againstServiceName: 'NAT Instance (Tự quản lý trên EC2)',
      coreDifference:
        'NAT Gateway là dịch vụ phân tán tự động mở rộng do AWS quản lý hoàn toàn; NAT Instance là máy chủ EC2 thông thường do bạn tự cài đặt hệ điều hành và cấu hình iptables.',
      mechanismDifference:
        'NAT Gateway có sẵn tính sẵn sàng cao trong 1 AZ, tự động co giãn băng thông từ 5 Gbps lên 100 Gbps và không cần bảo trì OS. NAT Instance là một điểm lỗi đơn lẻ (single point of failure), băng thông bị trần bởi instance type, đòi hỏi tự vá lỗi bảo mật, và bắt buộc phải tắt thuộc tính Source/Destination Check trên card mạng mới chuyển tiếp được traffic.',
      chooseThisWhen: [
        'Môi trường Production yêu cầu tính sẵn sàng cao, không tốn công quản trị và vận hành',
        'Lưu lượng mạng lớn cần băng thông tự động co giãn lên tới 100 Gbps',
        'Không muốn chịu trách nhiệm vá lỗi bảo mật ở mức hệ điều hành',
      ],
      chooseOtherWhen: [
        'Môi trường Dev/Test cần tiết kiệm chi phí tối đa (dùng t4g.nano hoặc Spot instance rẻ hơn nhiều so với NAT Gateway)',
        'Cần các tính năng NAT nâng cao mà NAT Gateway không hỗ trợ, như gán Security Group trực tiếp hoặc cấu hình port forwarding phức tạp',
      ],
      relatedComparisonId: 'nat-gateway-vs-nat-instance',
    },
  ],

  examTraps: [
    {
      distractorPattern:
        'Đề bài yêu cầu hệ thống ở 2 Availability Zone trong private subnet có tính sẵn sàng cao ra Internet, đáp án đề xuất tạo 1 NAT Gateway duy nhất ở một public subnet để cả 2 AZ dùng chung nhằm tiết kiệm chi phí.',
      whyWrong:
        'NAT Gateway chỉ có tính sẵn sàng cao trong nội bộ MỘT Availability Zone duy nhất. Nếu AZ chứa NAT Gateway đó gặp sự cố, toàn bộ các private subnet ở cả hai AZ đều mất sạch đường ra Internet, vi phạm trực tiếp yêu cầu High Availability của đề bài.',
      correctAnswer:
        'Tạo 2 NAT Gateway đặt ở 2 Public Subnet thuộc 2 AZ khác nhau; mỗi Private Subnet trỏ default route (0.0.0.0/0) tới NAT Gateway nằm trong cùng AZ với nó.',
      signalKeywords: ['high availability', 'multi-az', 'redundancy', 'private subnet internet', 'resilient'],
      severity: 'high',
    },
    {
      distractorPattern:
        'VPC A kết nối Peering với VPC B, và VPC B kết nối Peering với VPC C. Đề bài hỏi làm thế nào để máy chủ ở VPC A giao tiếp được với VPC C, đáp án đề xuất thêm route chuyển tiếp qua VPC B trong bảng định tuyến.',
      whyWrong:
        'VPC Peering TUYỆT ĐỐI KHÔNG hỗ trợ định tuyến bắc cầu (transitive routing). VPC B không bao giờ làm trung gian chuyển tiếp gói tin từ VPC A sang VPC C.',
      correctAnswer:
        'Thiết lập một kết nối VPC Peering trực tiếp mới giữa VPC A và VPC C, hoặc chuyển toàn bộ kiến trúc sang sử dụng AWS Transit Gateway.',
      signalKeywords: ['transitive routing', 'VPC A to VPC C', 'peering connection', 'edge to edge routing'],
      severity: 'high',
    },
    {
      distractorPattern:
        'Kỹ sư tạo một Network ACL mới cho subnet chứa Web Server, cấu hình Inbound Rule cho phép cổng 80 và 443 nhưng người dùng vẫn không thể mở được trang web. Đáp án gợi ý kiểm tra lại Security Group hoặc Internet Gateway.',
      whyWrong:
        'Khác với Default NACL (mở sẵn tất cả), một Custom NACL khi tạo mới sẽ MẶC ĐỊNH CHẶN TOÀN BỘ cả Inbound lẫn Outbound. Hơn nữa, vì NACL là stateless, chiều Outbound bắt buộc phải mở tường minh dải cổng Ephemeral (1024-65535) thì gói tin phản hồi mới có thể gửi ngược lại trình duyệt của client.',
      correctAnswer:
        'Thêm quy tắc Outbound Rule trong Network ACL cho phép dải cổng Ephemeral Ports (1024-65535) đi tới 0.0.0.0/0.',
      signalKeywords: ['custom network acl', 'stateless', 'ephemeral ports', 'timeout', 'inbound allowed but no response'],
      severity: 'high',
    },
    {
      distractorPattern:
        'Đề bài yêu cầu cho phép EC2 trong private subnet tải dữ liệu từ Amazon S3 với yêu cầu chi phí thấp nhất và không đi qua Internet công cộng, đáp án đưa ra là sử dụng NAT Gateway hoặc Interface Endpoint (PrivateLink).',
      whyWrong:
        'NAT Gateway và Interface Endpoint đều tính phí duy trì theo giờ và phí dữ liệu xử lý theo GB. Trong khi đó, Gateway Endpoint dành cho S3 và DynamoDB là hoàn toàn MIỄN PHÍ.',
      correctAnswer:
        'Tạo VPC Gateway Endpoint cho Amazon S3 và gắn vào Route Table của private subnet. Đây là phương án có chi phí thấp nhất và tối ưu nhất.',
      signalKeywords: ['private subnet to S3', 'lowest cost', 'cost-effective', 'without internet', 'Gateway Endpoint'],
      severity: 'high',
    },
    {
      distractorPattern:
        'Đề bài nói cần cấp phát một subnet cho 12 máy chủ EC2, đáp án gợi ý chọn dải CIDR /28 vì theo lý thuyết mạng thông thường dải này có 16 địa chỉ IP (đủ cho 12 máy).',
      whyWrong:
        'AWS luôn bảo lưu cố định 5 địa chỉ IP đầu và cuối trong MỌI subnet (.0 Network address, .1 VPC router, .2 AWS DNS, .3 Dành cho tương lai, .255 Network broadcast). Dải /28 có 16 IP nhưng chỉ còn 16 - 5 = 11 IP khả dụng, không đủ cho 12 máy chủ.',
      correctAnswer:
        'Phải chọn dải CIDR tối thiểu là /27 (có 32 - 5 = 27 IP khả dụng).',
      signalKeywords: ['CIDR block', 'usable IP addresses', 'reserved IP addresses', 'subnet size'],
      severity: 'high',
    },
    {
      distractorPattern:
        'Hai công ty sáp nhập hoặc hai môi trường muốn kết nối VPC với nhau qua VPC Peering nhưng cả hai VPC đều có dải mạng là 10.0.0.0/16. Đáp án đề xuất tạo Peering Connection và dùng bảng định tuyến chia nhỏ subnet.',
      whyWrong:
        'VPC Peering không thể thiết lập nếu hai VPC có dải CIDR trùng lặp hoặc giao nhau (overlapping CIDRs). Bảng định tuyến không thể giải quyết xung đột IP cấp mạng này.',
      correctAnswer:
        'Sử dụng AWS PrivateLink để chia sẻ dịch vụ cụ thể qua Network Load Balancer (hoạt động tốt kể cả khi trùng IP), hoặc thêm dải CIDR thứ cấp (Secondary CIDR) không trùng lặp vào VPC.',
      signalKeywords: ['overlapping CIDR', 'matching IP range', 'merger', 'VPC peering failed'],
      severity: 'medium',
    },
    {
      distractorPattern:
        'EC2 instance trong một subnet đã được gán địa chỉ Public IPv4 và Security Group đã mở port 80 từ 0.0.0.0/0, nhưng vẫn không thể truy cập từ Internet. Đề bài hỏi nguyên nhân nằm ở đâu.',
      whyWrong:
        'Có Public IP và mở Security Group là chưa đủ. Subnet chỉ trở thành Public Subnet thực sự khi Route Table gắn với nó có một route trỏ 0.0.0.0/0 tới Internet Gateway (igw). Thiếu route này thì gói tin không biết đường đi ra Internet.',
      correctAnswer:
        'Bảng định tuyến (Route Table) của subnet đang thiếu route 0.0.0.0/0 trỏ đích đến Internet Gateway.',
      signalKeywords: ['cannot reach ec2', 'public ip assigned', 'route table missing', 'internet gateway route'],
      severity: 'medium',
    },
  ],

  architectures: [
    {
      id: 'vpc-standard-three-tier',
      title: 'Kiến trúc mạng 3 tầng tiêu chuẩn doanh nghiệp trên Multi-AZ',
      scenario:
        'Một ứng dụng web thương mại điện tử phục vụ khách hàng trên toàn quốc với yêu cầu nghiêm ngặt về bảo mật và tính sẵn sàng cao. Ràng buộc: Tầng Web tiếp nhận lưu lượng công cộng từ Internet; tầng App chứa logic nghiệp vụ chạy trên EC2/ECS trong vùng riêng tư, chỉ nhận kết nối từ Load Balancer nhưng cần ra Internet để tải bản vá bảo mật; tầng Database (Amazon RDS PostgreSQL Multi-AZ) hoàn toàn cô lập, không được phép kết nối Internet dưới bất kỳ hình thức nào. Hệ thống phải duy trì hoạt động bình thường kể cả khi một Availability Zone gặp sự cố.',
      steps: [
        {
          order: 1,
          component: 'Amazon VPC & Subnets',
          action: 'Khởi tạo VPC với CIDR 10.0.0.0/16 trải trên 2 Availability Zone. Tại mỗi AZ, chia thành 3 subnet: Public Subnet (/24), Private App Subnet (/24), và Isolated DB Subnet (/24).',
          whyThisChoice: 'Phân đoạn mạng rõ ràng theo nguyên tắc phòng thủ theo chiều sâu (defense in depth), cô lập hoàn toàn database khỏi nguy cơ tấn công từ mạng ngoài.',
        },
        {
          order: 2,
          component: 'Internet Gateway & Public Route Table',
          action: 'Gắn 1 Internet Gateway vào VPC. Tạo bảng định tuyến Public Route Table với route 0.0.0.0/0 trỏ tới Internet Gateway, gắn bảng này vào 2 Public Subnet.',
          whyThisChoice: 'Cung cấp đường truyền Internet hai chiều cho Application Load Balancer đặt tại tầng công cộng.',
        },
        {
          order: 3,
          component: 'NAT Gateway Multi-AZ',
          action: 'Tạo 2 NAT Gateway đặt tại 2 Public Subnet ở 2 AZ khác nhau, mỗi NAT Gateway gắn 1 Elastic IP tĩnh riêng biệt.',
          whyThisChoice: 'Đảm bảo tính sẵn sàng cao ở mức AZ; nếu một AZ gặp sự cố, các private subnet ở AZ còn lại vẫn giữ nguyên kết nối Internet qua NAT Gateway cục bộ của nó.',
        },
        {
          order: 4,
          component: 'Private & Isolated Route Tables',
          action: 'Tạo 2 Route Table riêng cho 2 Private App Subnet (Route Table AZ-a trỏ 0.0.0.0/0 tới NAT GW a, Route Table AZ-b trỏ 0.0.0.0/0 tới NAT GW b). Tạo 1 Isolated Route Table cho các DB Subnet chỉ chứa duy nhất local route (10.0.0.0/16).',
          whyThisChoice: 'Đảm bảo máy chủ ứng dụng ra được Internet tải cập nhật an toàn theo đúng AZ của mình, trong khi database bị cô lập hoàn toàn ở tầng định tuyến.',
        },
        {
          order: 5,
          component: 'Chained Security Groups',
          action: 'Thiết lập chuỗi Security Group: ALB SG mở port 443 từ 0.0.0.0/0; App SG chỉ mở port 8080 với nguồn là ALB SG; DB SG chỉ mở port 5432 với nguồn là App SG.',
          whyThisChoice: 'Tham chiếu trực tiếp theo Security Group ID thay vì dải IP giúp duy trì bảo mật tự động khi máy chủ mở rộng hoặc co cụm qua Auto Scaling.',
        },
        {
          order: 6,
          component: 'VPC Gateway Endpoint cho Amazon S3',
          action: 'Tạo Gateway Endpoint cho S3 và gắn vào Route Table của các Private App Subnet.',
          whyThisChoice: 'Bẻ luồng dữ liệu nặng đọc ghi media giữa ứng dụng và S3 vào mạng nội bộ AWS hoàn toàn miễn phí, tránh làm phình to chi phí xử lý dữ liệu của NAT Gateway.',
        },
      ],
      rejectedAlternatives: [
        {
          option: 'Sử dụng 1 NAT Gateway duy nhất dùng chung cho cả 2 AZ để tiết kiệm chi phí',
          whyRejected: 'Tạo ra điểm lỗi đơn lẻ (single point of failure). Nếu AZ chứa NAT Gateway đó sập, toàn bộ tầng ứng dụng ở cả 2 AZ đều mất kết nối Internet.',
        },
        {
          option: 'Đặt cơ sở dữ liệu chung vào Private App Subnet',
          whyRejected: 'Vi phạm nguyên tắc phân quyền tối thiểu; nếu bảng định tuyến của App Subnet bị cấu hình sai hoặc bị tấn công leo thang, database có nguy cơ bị lộ ra ngoài.',
        },
        {
          option: 'Dùng NAT Instance chạy trên EC2 thay vì NAT Gateway cho môi trường Production',
          whyRejected: 'Đòi hỏi tự vá lỗi hệ điều hành, không tự động co giãn băng thông và phải tự xây dựng cơ chế failover phức tạp bằng script chuyển đổi Route Table.',
        },
      ],
      tradeoffs: [
        'Phải trả chi phí duy trì cố định cho 2 NAT Gateway độc lập (~65 USD/tháng chưa tính dung lượng dữ liệu xử lý).',
        'Cần quản lý nhiều Route Table riêng biệt cho từng subnet thay vì dùng chung một Route Table mặc định.',
      ],
    },
    {
      id: 'vpc-hub-and-spoke-transit-gateway',
      title: 'Mạng doanh nghiệp tập trung đa VPC và On-Premises với AWS Transit Gateway',
      scenario:
        'Một tập đoàn tài chính sở hữu hơn 30 tài khoản AWS với hàng chục VPC riêng biệt (chia theo môi trường Prod, Dev, Shared Services) cùng một trung tâm dữ liệu on-premises. Yêu cầu: Kết nối tất cả VPC về trung tâm dữ liệu với băng thông cao; các VPC môi trường Prod được giao tiếp với nhau nhưng Dev tuyệt đối không được chạm vào Prod; toàn bộ lưu lượng đi ra Internet phải được kiểm tra tập trung qua cụm tường lửa (Inspection VPC). Tuyệt đối không sử dụng mô hình kết nối lưới VPC Peering do vượt quá khả năng quản trị.',
      steps: [
        {
          order: 1,
          component: 'AWS Transit Gateway (TGW)',
          action: 'Khởi tạo 1 Transit Gateway trung tâm ở Region chính, chia sẻ qua AWS Resource Access Manager (RAM) cho toàn bộ Organization.',
          whyThisChoice: 'Đóng vai trò bộ định tuyến đám mây trung tâm (Cloud Router), giảm độ phức tạp kết nối từ O(N^2) xuống O(N).',
        },
        {
          order: 2,
          component: 'Transit Gateway VPC Attachments',
          action: 'Gắn kết (attach) từng VPC vào Transit Gateway bằng cách chọn các subnet riêng biệt tại từng AZ để đảm bảo dự phòng.',
          whyThisChoice: 'Mỗi VPC attachment cung cấp băng thông lên đến 50 Gbps và tự động cân bằng tải qua nhiều Availability Zone.',
        },
        {
          order: 3,
          component: 'AWS Direct Connect & Transit VIF',
          action: 'Kết nối đường cáp quang chuyên dụng AWS Direct Connect từ on-premises vào Transit Gateway qua Direct Connect Gateway và Transit Virtual Interface (Transit VIF).',
          whyThisChoice: 'Cung cấp đường truyền vật lý tốc độ cao, độ trễ ổn định và cho phép tất cả các VPC truy cập tài nguyên nội bộ qua duy nhất một điểm kết nối.',
        },
        {
          order: 4,
          component: 'Transit Gateway Route Table Segmentation',
          action: 'Tạo các bảng định tuyến riêng biệt trên TGW: Prod TGW Route Table và Dev TGW Route Table. Prod route table chứa route tới các VPC Prod và On-Premises; Dev route table chỉ chứa route tới On-Premises và Dev VPC, loại bỏ hoàn toàn route sang Prod.',
          whyThisChoice: 'Thực hiện phân đoạn mạng ảo (VRF - Virtual Routing and Forwarding) ở mức đám mây, cách ly tuyệt đối môi trường thử nghiệm khỏi dữ liệu sản xuất.',
        },
        {
          order: 5,
          component: 'Centralized Egress & Inspection VPC',
          action: 'Tạo một Centralized Inspection VPC chứa AWS Network Firewall và cụm NAT Gateway tập trung. Cấu hình default route (0.0.0.0/0) của các VPC spoke trỏ tới Transit Gateway, sau đó TGW chuyển tiếp toàn bộ lưu lượng Internet qua Inspection VPC trước khi ra ngoài.',
          whyThisChoice: 'Tập trung hóa việc thanh tra an ninh mạng tại một chốt chặn duy nhất và tiết kiệm hàng nghìn USD chi phí duy trì NAT Gateway riêng rẽ ở từng VPC.',
        },
      ],
      rejectedAlternatives: [
        {
          option: 'Thiết lập Full Mesh kết nối bằng VPC Peering giữa hơn 30 VPC',
          whyRejected: '30 VPC đòi hỏi tới 435 kết nối Peering độc lập; không thể quản trị bảng định tuyến thủ công và không hỗ trợ kết nối bắc cầu về trung tâm dữ liệu.',
        },
        {
          option: 'Dùng Virtual Private Gateway (VGW) riêng rẽ cho từng VPC kết nối về on-premises',
          whyRejected: 'Mỗi VPC phải kéo một kênh VPN hoặc kết nối riêng, vượt quá giới hạn phần cứng của router on-premises và gây tốn kém chi phí quản lý.',
        },
      ],
      tradeoffs: [
        'Phát sinh chi phí duy trì hàng tháng cho từng Transit Gateway Attachment (~0.05 USD/giờ mỗi VPC) và phí xử lý dữ liệu qua TGW (~0.02 USD/GB).',
        'Tăng thêm độ trễ khoảng dưới 1 mili giây khi gói tin phải đi qua một chặng chuyển tiếp trung gian.',
      ],
    },
  ],

  integrationNotes: [
    {
      withServiceId: 'ec2',
      withServiceName: 'Amazon EC2',
      relationship:
        'EC2 cắm card mạng ảo (Elastic Network Interface - ENI) vào subnet của VPC để nhận địa chỉ IP nội bộ; Security Group gắn trực tiếp vào ENI kiểm soát lưu lượng ra vào máy chủ.',
    },
    {
      withServiceId: 's3',
      withServiceName: 'Amazon S3',
      relationship:
        'Kết nối qua VPC Gateway Endpoint hoàn toàn miễn phí, giữ lưu lượng truyền file nặng trong mạng backbone của AWS và loại bỏ chi phí NAT Gateway.',
    },
    {
      withServiceId: 'rds',
      withServiceName: 'Amazon RDS',
      relationship:
        'RDS bắt buộc phải nằm trong một DB Subnet Group chứa tối thiểu 2 subnet ở 2 AZ khác nhau để sẵn sàng cho tính năng tự động chuyển đổi dự phòng Multi-AZ failover.',
    },
    {
      withServiceId: 'alb-nlb',
      withServiceName: 'Elastic Load Balancing (ALB & NLB)',
      relationship:
        'Load Balancer internet-facing đặt tại các public subnet để tiếp nhận lưu lượng từ Internet, sau đó chuyển tiếp tới các target EC2/ECS nằm an toàn trong private subnet.',
    },
    {
      withServiceId: 'transit-gateway',
      withServiceName: 'AWS Transit Gateway',
      relationship:
        'Đóng vai trò trung tâm điều phối kết nối mạng cho hàng trăm VPC, VPN và Direct Connect theo mô hình hub-and-spoke có hỗ trợ định tuyến bắc cầu.',
    },
    {
      withServiceId: 'direct-connect',
      withServiceName: 'AWS Direct Connect',
      relationship:
        'Cung cấp đường truyền vật lý chuyên dụng tốc độ cao, độ trễ thấp từ trung tâm dữ liệu on-premises vào VPC thông qua Direct Connect Gateway và Virtual Private Gateway (VGW).',
    },
    {
      withServiceId: 'lambda',
      withServiceName: 'AWS Lambda',
      relationship:
        'Lambda kết nối vào VPC thông qua Hyperplane ENI dùng chung để truy cập RDS, ElastiCache trong private subnet mà không bị trễ thời gian khởi động (cold start).',
    },
    {
      withServiceId: 'cloudwatch',
      withServiceName: 'Amazon CloudWatch',
      relationship:
        'VPC Flow Logs đẩy bản ghi lưu lượng mạng IP được chấp nhận (ACCEPT) hoặc bị từ chối (REJECT) vào CloudWatch Logs để giám sát và kích hoạt cảnh báo an ninh thời gian thực.',
    },
  ],

  deepLinks: [
    {
      label: 'Khái niệm và kiến trúc Amazon VPC',
      url: 'https://docs.aws.amazon.com/vpc/latest/userguide/what-is-amazon-vpc.html',
    },
    {
      label: 'Bảng định tuyến và quy tắc định tuyến (Route Tables)',
      url: 'https://docs.aws.amazon.com/vpc/latest/userguide/VPC_Route_Tables.html',
    },
    {
      label: 'So sánh Security Groups và Network ACLs',
      url: 'https://docs.aws.amazon.com/vpc/latest/userguide/infrastructure-security.html',
    },
    {
      label: 'Cơ chế hoạt động của NAT Gateway',
      url: 'https://docs.aws.amazon.com/vpc/latest/userguide/vpc-nat-gateway.html',
    },
    {
      label: 'VPC Endpoints và AWS PrivateLink',
      url: 'https://docs.aws.amazon.com/vpc/latest/privatelink/concepts.html',
    },
  ],
};
