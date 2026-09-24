import type { ServiceDeepDive } from '../types';

export const route53DeepDive: ServiceDeepDive = {
  serviceId: 'route53',
  serviceName: 'Amazon Route 53',
  category: 'Networking',
  tier: 'core',

  whyItExists:
    'Hệ thống DNS truyền thống chỉ ánh xạ tên miền thành địa chỉ IP tĩnh và hoàn toàn mù quáng trước trạng thái sống còn của máy chủ hay vị trí địa lý của người dùng. Route 53 giải quyết vấn đề này bằng cách kết hợp DNS thẩm quyền với mạng lưới Anycast toàn cầu, cơ chế kiểm tra sức khỏe (health checks) và các chính sách định tuyến thông minh để điều hướng lưu lượng tối ưu. Đổi lại, vì hoạt động ở tầng phân giải tên miền (DNS), Route 53 không thể can thiệp vào gói tin sau khi phân giải, và mọi quyết định failover đều chịu độ trễ do bộ đệm DNS cache tại các resolver trung gian.',

  howItWorks: [
    {
      title: 'Mạng lưới Anycast DNS toàn cầu và cam kết 100% SLA',
      explanation:
        'Route 53 triển khai mạng lưới Anycast DNS trải rộng khắp hàng trăm điểm Point of Presence (PoP) trên thế giới. Tất cả các Name Server trong cùng một delegation set (gồm 4 server thuộc 4 đuôi TLD khác nhau: .com, .net, .org, .co.uk) chia sẻ chung các dải IP Anycast. Khi resolver của ISP gửi truy vấn DNS, gói tin UDP/TCP cổng 53 sẽ tự động đi đến PoP gần nhất theo định tuyến BGP ngắn nhất của Internet.',
      soWhat:
        'Hệ thống đạt độ trễ phân giải cực thấp và khả năng hấp thụ các cuộc tấn công DDoS DNS khổng lồ mà không sập. Đây là dịch vụ hiếm hoi của AWS cam kết SLA 100% tính sẵn sàng cho authoritative DNS queries.',
    },
    {
      title: 'Alias Record — Phần mở rộng độc quyền vượt qua hạn chế CNAME',
      explanation:
        'Theo chuẩn DNS quốc tế (RFC 1034), bản ghi CNAME không bao giờ được phép tồn tại ở Zone Apex (naked domain, ví dụ "example.com" không có "www") vì sẽ xung đột với bản ghi SOA và NS. Alias record là cơ chế riêng của Route 53: thay vì trả về hostname CNAME bắt client phân giải tiếp, Route 53 tự động tra cứu địa chỉ IP nội bộ của tài nguyên AWS (ALB, NLB, CloudFront, S3 website) và trả thẳng bản ghi A/AAAA về cho resolver.',
      soWhat:
        'Cho phép trỏ domain gốc (apex domain) thẳng vào ALB hoặc CloudFront hoàn toàn hợp lệ. Đặc biệt, truy vấn Alias tới các tài nguyên AWS được miễn phí hoàn toàn, và Route 53 tự cập nhật khi IP của tài nguyên AWS thay đổi ngầm.',
    },
    {
      title: 'Health Checking và mối quan hệ sống còn với TTL',
      explanation:
        'Mạng lưới Route 53 health checkers phân tán toàn cầu gửi request (HTTP, HTTPS, TCP) tới endpoint theo chu kỳ 30 giây (hoặc 10 giây ở chế độ fast). Nếu số lần kiểm tra liên tiếp thất bại vượt ngưỡng (Failure Threshold, mặc định 3 lần), endpoint bị gán nhãn Unhealthy và Route 53 lập tức ngừng trả về IP đó trong các phản hồi DNS.',
      soWhat:
        'Route 53 loại bỏ IP chết chỉ sau vài chục giây, nhưng người dùng cuối vẫn có thể tiếp tục kết nối vào server chết nếu TTL (Time To Live) của bản ghi DNS đặt quá cao và đang nằm trong cache của ISP/client. Muốn failover nhanh thì bắt buộc phải hạ TTL (ví dụ 60s), đánh đổi lại là số lượng query và chi phí DNS sẽ tăng lên.',
    },
    {
      title: '7 Routing Policies điều phối lưu lượng theo ngữ cảnh',
      explanation:
        'Route 53 quyết định trả về IP nào dựa trên 7 thuật toán: (1) Simple: trả về một hoặc nhiều IP ngẫu nhiên, không hỗ trợ health check trên từng IP; (2) Weighted: phân chia % lưu lượng giữa các cụm endpoint; (3) Latency: trả về Region có độ trễ mạng thấp nhất tới client; (4) Failover: điều phối Active-Passive dựa trên kết quả Health Check; (5) Geolocation: định tuyến theo lục địa/quốc gia/bang của người truy vấn; (6) Geoproximity: định tuyến theo khoảng cách vật lý kết hợp tham số Bias; (7) Multivalue Answer: trả về ngẫu nhiên tối đa 8 bản ghi IP khỏe mạnh kèm kiểm tra sức khỏe.',
      soWhat:
        'Mỗi chính sách giải quyết một bài toán kiến trúc chuyên biệt: A/B testing hoặc canary deploy thì dùng Weighted; giảm độ trễ toàn cầu dùng Latency; phân phối nội dung theo bản quyền hoặc ngôn ngữ dùng Geolocation; chuyển đổi thảm họa dùng Failover; cân bằng tải DNS đơn giản có lọc lỗi dùng Multivalue.',
    },
    {
      title: 'Private Hosted Zone và kiến trúc Split-View DNS trong VPC',
      explanation:
        'Private Hosted Zone chỉ gắn kết (associate) với các VPC được chỉ định trên AWS. Khi một instance trong VPC gửi truy vấn DNS, Route 53 Resolver (AmazonProvidedDNS tại địa chỉ IP cơ sở + 2 của mạng VPC) sẽ ưu tiên tra cứu trong Private Hosted Zone trước khi ra ngoài Internet. Khi kết hợp với Public Hosted Zone cùng tên, hệ thống tạo nên kiến trúc Split-View (Split-Horizon) DNS.',
      soWhat:
        'Cùng một tên miền "app.example.com", máy chủ nội bộ trong VPC nhận được Private IP (10.x.x.x), còn người dùng bên ngoài Internet tra cứu nhận được Public IP. Bắt buộc phải bật hai cờ enableDnsHostnames và enableDnsSupport trong cấu hình VPC thì Private Zone mới hoạt động.',
    },
  ],

  chooseWhen: [
    {
      condition: 'Cần phân giải tên miền toàn cầu với độ sẵn sàng cao nhất và độ trễ thấp nhất',
      reason: 'Route 53 có mạng lưới Anycast DNS toàn cầu với cam kết 100% SLA và hỗ trợ Latency-based Routing đưa người dùng về Region nhanh nhất.',
    },
    {
      condition: 'Trỏ tên miền gốc (Zone Apex / naked domain như example.com) vào ALB, CloudFront hoặc S3 website',
      reason: 'Alias record là giải pháp duy nhất của AWS cho phép phân giải domain gốc trực tiếp vào tài nguyên AWS mà không vi phạm chuẩn RFC DNS.',
    },
    {
      condition: 'Thiết kế hệ thống khôi phục thảm họa (Disaster Recovery) kiểu Active-Passive giữa nhiều Region',
      reason: 'Failover Routing Policy kết hợp Health Check tự động chuyển hướng toàn bộ lưu lượng sang Region phụ khi Region chính bị sập.',
    },
    {
      condition: 'Thực hiện canary deployment hoặc kiểm thử A/B theo tỷ lệ phần trăm người dùng',
      reason: 'Weighted Routing Policy cho phép gán trọng số cụ thể (ví dụ 90% vào bản cũ, 10% vào bản mới) một cách chính xác ở tầng phân giải tên.',
    },
    {
      condition: 'Xây dựng hệ thống phân giải tên miền nội bộ bảo mật giữa các VPC và trung tâm dữ liệu on-premises',
      reason: 'Private Hosted Zone kết hợp Route 53 Resolver Endpoints (Inbound/Outbound) tạo cầu nối DNS hai chiều liền mạch qua Direct Connect hoặc VPN.',
    },
  ],

  avoidWhen: [
    {
      condition: 'Cần cân bằng tải và định tuyến dựa trên đường dẫn HTTP path (ví dụ /api, /static) hoặc HTTP headers',
      reason: 'Route 53 chỉ hoạt động ở tầng phân giải tên miền DNS (L4/L7 name resolution), hoàn toàn không đọc được nội dung gói tin HTTP.',
      useInstead: 'Application Load Balancer (ALB) hoặc Amazon CloudFront.',
    },
    {
      condition: 'Yêu cầu chuyển đổi dự phòng tức thì dưới 10 giây mà không bị cản trở bởi bộ nhớ đệm DNS cache',
      reason: 'DNS failover luôn phụ thuộc vào TTL và việc các local DNS resolver của ISP có tuân thủ TTL hay không.',
      useInstead: 'AWS Global Accelerator (dùng 2 địa chỉ Anycast IP tĩnh cố định, failover qua mạng trục AWS trong vòng vài chục giây không qua DNS).',
    },
    {
      condition: 'Cần lưu trữ đệm (cache) nội dung tĩnh tại các vị trí biên và bảo vệ ứng dụng bằng Web Application Firewall',
      reason: 'Route 53 không phải là Content Delivery Network (CDN) và không chứa dữ liệu hay proxy lưu lượng web.',
      useInstead: 'Amazon CloudFront tích hợp AWS WAF.',
    },
    {
      condition: 'Cần service discovery tự động và quản lý metadata cho hàng trăm microservices chạy động trong container',
      reason: 'Route 53 không thiết kế cho việc đăng ký và hủy đăng ký dịch vụ với tần suất tính bằng giây của container ephemeral.',
      useInstead: 'AWS Cloud Map hoặc cơ chế CoreDNS tích hợp trong Amazon EKS.',
    },
    {
      condition: 'Cần kết nối phiên người dùng gắn chặt vào một backend server cố định (Sticky Session / Session Affinity)',
      reason: 'Route 53 chỉ trả về IP ngẫu nhiên hoặc theo policy, không duy trì trạng thái kết nối hay cookie phiên.',
      useInstead: 'Application Load Balancer với tính năng Target Group Sticky Sessions.',
    },
  ],

  limits: [
    {
      name: 'Số lượng Hosted Zones mỗi tài khoản AWS',
      value: '500 zones mặc định',
      implication: 'Đủ cho hầu hết doanh nghiệp. Nếu triển khai mô hình SaaS multi-tenant cần zone riêng cho mỗi khách hàng thì phải gửi yêu cầu tăng quota qua Service Quotas.',
      adjustable: true,
    },
    {
      name: 'Số lượng bản ghi (records) trong một Hosted Zone',
      value: '10.000 records mặc định',
      implication: 'Khi vượt ngưỡng 10.000 bản ghi, có thể yêu cầu tăng quota lên hàng triệu bản ghi hoặc phân tách kiến trúc thành các subdomain delegation.',
      adjustable: true,
    },
    {
      name: 'Số lượng bản ghi IP trả về trong Multivalue Answer',
      value: 'Tối đa 8 healthy records',
      implication: 'Nếu có nhiều hơn 8 backend khỏe mạnh, Route 53 sẽ bốc ngẫu nhiên 8 bản ghi để trả về nhằm đảm bảo kích thước gói tin phản hồi DNS UDP không vượt ngưỡng 512 bytes.',
      adjustable: false,
    },
    {
      name: 'Chu kỳ kiểm tra sức khỏe tối thiểu (Health check interval)',
      value: '30 giây cho Standard, 10 giây cho Fast interval',
      implication: 'Thời gian tối thiểu để phát hiện endpoint hỏng là 3 lần kiểm tra liên tiếp (30 giây với Fast interval, 90 giây với Standard). Không thể phát hiện sự cố ở mức mili-giây.',
      adjustable: false,
    },
    {
      name: 'Số lượng VPC tối đa liên kết với một Private Hosted Zone',
      value: '500 VPCs',
      implication: 'Khi cần chia sẻ DNS nội bộ cho quy mô lớn hơn 500 VPC trong landing zone, nên chuyển sang sử dụng Route 53 Resolver Rules chia sẻ qua AWS RAM.',
      adjustable: true,
    },
    {
      name: 'Kích thước tối đa cho bản ghi TXT (Record size)',
      value: '4.000 ký tự (chuỗi con tối đa 255 ký tự)',
      implication: 'Khi cấu hình các bản ghi xác thực email phức tạp như DKIM hoặc SPF dài, bắt buộc phải chia chuỗi thành nhiều đoạn nhỏ dưới 255 ký tự bọc trong dấu ngoặc kép.',
      adjustable: false,
    },
    {
      name: 'Thời gian sống của bản ghi (TTL range)',
      value: '0 đến 2.147.483.647 giây',
      implication: 'Dù đặt TTL = 0, một số public resolver của các ISP vẫn ép một mức sàn tối thiểu (thường là 60s). Do đó không tồn tại cơ chế DNS failover tức thì 0 giây.',
      adjustable: false,
    },
  ],

  cost: {
    billingDimensions: [
      'Phí duy trì Hosted Zone: 0.50 USD / hosted zone / tháng cho 25 zone đầu tiên (cả public và private), giảm còn 0.10 USD / zone từ zone thứ 26 trở đi',
      'Số lượng truy vấn DNS tiêu chuẩn (Standard queries): 0.40 USD / 1 triệu truy vấn cho 1 tỷ truy vấn đầu tiên mỗi tháng',
      'Số lượng truy vấn DNS nâng cao: Latency-based queries giá 0.60 USD / 1 triệu; Geo DNS và Geoproximity queries giá 0.70 USD / 1 triệu truy vấn',
      'Phí Health Check: 0.50 USD / tháng cho endpoint AWS cơ bản; 0.75 USD / tháng cho non-AWS endpoint; cộng thêm 1.00 USD / tháng nếu bật Fast interval (10s) hoặc kiểm tra chuỗi nội dung (string matching)',
      'Phí Route 53 Resolver Endpoints: 0.125 USD / giờ cho mỗi ENI (Elastic Network Interface) + 0.40 USD / 1 triệu truy vấn DNS xử lý qua Resolver, giảm còn 0.20 USD / 1 triệu khi vượt 1 tỷ truy vấn mỗi tháng',
    ],
    hiddenCosts: [
      'Truy vấn Alias record trỏ tới tài nguyên AWS (ALB, CloudFront, S3 website) là HOÀN TOÀN MIỄN PHÍ; nhưng dùng CNAME trỏ tới AWS hoặc Alias trỏ sang bản ghi khác trong cùng zone thì vẫn tính phí truy vấn thông thường.',
      'Cấu hình TTL quá thấp (ví dụ 5s - 10s) để giảm thời gian failover sẽ làm tăng vọt số lượng DNS query từ các ISP resolver trên thế giới, khiến hóa đơn truy vấn tăng đột biến.',
      'Health check gửi request từ 8 đến 16 vantage point trên toàn cầu liên tục vào web server; ngoài phí health check, các request này tạo thêm phí data transfer out và chi phí log CloudWatch.',
      'Route 53 Resolver Inbound & Outbound Endpoints bắt buộc cần tối thiểu 2 ENI ở 2 AZ để đảm bảo HA, tạo ra chi phí cố định khoảng 183 USD/tháng cho mỗi cặp endpoint dù lượng truy vấn thực tế rất ít.',
    ],
    optimizationLevers: [
      'Luôn ưu tiên dùng Alias record thay vì CNAME khi trỏ tới ALB, NLB, CloudFront, API Gateway hoặc S3 để được miễn phí 100% tiền query.',
      'Đặt TTL dài (86400s / 1 ngày hoặc 3600s / 1 giờ) cho các bản ghi ít thay đổi như MX, TXT, verification records; chỉ hạ TTL xuống 60s trước các đợt bảo trì hoặc đối với bản ghi failover.',
      'Gom các domain nội bộ vào một Private Hosted Zone duy nhất thay vì tạo riêng rẽ quá nhiều zone không cần thiết.',
      'Sử dụng Route 53 Resolver Rules chia sẻ tập trung qua AWS Resource Access Manager (RAM) thay vì liên kết thủ công hàng trăm VPC vào từng Private Hosted Zone.',
    ],
  },

  security: {
    encryptionAtRest: [
      'Dữ liệu cấu hình hosted zone và resource records được AWS mã hóa và lưu trữ phân tán an toàn trên hạ tầng Anycast toàn cầu.',
      'Hỗ trợ DNSSEC (Domain Name System Security Extensions): Route 53 hỗ trợ ký số DNSSEC cho hosted zone bằng khóa KMS (AWS KMS asymmetric CMK) và kích hoạt DNSSEC validation trên Route 53 Resolver để bảo vệ người dùng khỏi tấn công giả mạo DNS (DNS spoofing) và đầu độc bộ nhớ đệm (DNS cache poisoning).',
    ],
    encryptionInTransit:
      'Truy vấn DNS công cộng mặc định chạy qua giao thức UDP/TCP port 53 dạng bản rõ theo chuẩn Internet. Đối với phân giải nội bộ qua Route 53 Resolver Endpoints, hỗ trợ giao thức DNS-over-HTTPS (DoH) để mã hóa toàn bộ lưu lượng truy vấn DNS trên đường truyền. Các API gọi cấu hình Route 53 đều bắt buộc đi qua HTTPS/TLS 1.2+ với chữ ký IAM SigV4.',
    accessControl: [
      'IAM Policies: Phân quyền chi tiết ở mức tài nguyên (record-level permissions), cho phép chỉ định user/role nào được sửa bản ghi cụ thể mà không phá vỡ toàn bộ hosted zone.',
      'Service Control Policies (SCPs): Đặt ở cấp AWS Organizations để khóa chặt, ngăn chặn mọi tài khoản thành viên xóa nhầm các Hosted Zone trọng yếu của doanh nghiệp.',
      'VPC Association Authorization: Để gắn kết một Private Hosted Zone ở AWS Account A với một VPC ở AWS Account B, bắt buộc Account A phải tạo lệnh ủy quyền (CreateVPCAssociationAuthorization) qua CLI/SDK trước khi Account B thực hiện liên kết.',
    ],
    defaultPosture:
      'Hosted Zone khi mới tạo hoàn toàn sạch, chỉ chứa sẵn bản ghi SOA và NS mặc định. DNSSEC mặc định tắt (phải tự bật và khai báo DS record tại Registrar). Private Hosted Zone mặc định cô lập tuyệt đối, chỉ các VPC được liên kết tường minh mới phân giải được.',
  },

  resilience: {
    failureScope: 'Global',
    builtInHA:
      'Route 53 là dịch vụ Global hoàn toàn, vận hành trên mạng lưới Anycast DNS trải dài qua hàng trăm PoP trên thế giới. Mỗi hosted zone được cấp ngẫu nhiên 4 Name Server (Delegation Set) nằm trên 4 Top-Level Domain khác nhau (.com, .net, .org, .co.uk) chạy trên hạ tầng mạng độc lập. AWS cam kết 100% SLA cho khả năng phân giải DNS thẩm quyền.',
    crossRegionStory:
      'Route 53 đóng vai trò là "nhạc trưởng" điều phối cho mọi kiến trúc Multi-Region Disaster Recovery trên AWS. Sử dụng Latency Routing để phân phối bình thường, kết hợp Failover Routing và Health Checks để tự động chuyển hướng toàn bộ người dùng từ Region gặp thảm họa sang Region dự phòng mà không cần can thiệp thủ công.',
    backupRestore:
      'Route 53 không có tính năng tự động sao lưu phiên bản hoặc thùng rác khôi phục (no recycle bin) khi bản ghi bị xóa. Thực hành chuẩn là quản lý toàn bộ bản ghi DNS dưới dạng Infrastructure as Code (Terraform, CloudFormation, CDK) trong kho mã nguồn Git, hoặc định kỳ xuất file zone theo định dạng chuẩn BIND lưu trữ trên S3.',
  },

  contrasts: [
    {
      againstServiceId: 'global-accelerator',
      againstServiceName: 'AWS Global Accelerator',
      coreDifference:
        'Route 53 điều phối lưu lượng ở tầng phân giải tên miền (DNS); Global Accelerator cung cấp 2 Anycast IP tĩnh cố định và điều hướng gói tin ở tầng mạng (L4) trên mạng trục riêng của AWS.',
      mechanismDifference:
        'Route 53 trả về các IP khác nhau cho client và bị phụ thuộc hoàn toàn vào bộ đệm DNS cache/TTL của ISP, nên khi failover luôn có độ trễ. Global Accelerator gán 2 IP tĩnh cố định không bao giờ đổi cho client kết nối tới Edge Location gần nhất, sau đó dùng mạng cáp quang riêng của AWS để chuyển hướng lưu lượng tới Region lành lặn trong vòng dưới 1 phút mà không bị ảnh hưởng bởi DNS caching.',
      chooseThisWhen: [
        'Cần định tuyến tên miền dựa trên vị trí địa lý (Geolocation) hoặc chia tỷ lệ phần trăm (Weighted) với chi phí thấp nhất',
        'Ứng dụng web thông thường chấp nhận được độ trễ chuyển đổi vài chục giây theo thời gian sống TTL của DNS',
        'Cần phân giải tên miền nội bộ giữa các VPC trên AWS (Private Hosted Zone)',
      ],
      chooseOtherWhen: [
        'Cần 2 địa chỉ IP tĩnh cố định (Static Anycast IPs) để đối tác hoặc khách hàng cấu hình whitelist trên tường lửa doanh nghiệp',
        'Yêu cầu chuyển đổi dự phòng tức thì giữa các Region (dưới 1 phút) mà không bị kẹt bởi DNS cache của máy trạm hay ISP',
        'Ứng dụng chạy các giao thức phi HTTP như UDP, gaming, IoT, VoIP cần giảm độ trễ và jitter bằng mạng trục riêng của AWS',
      ],
    },
    {
      againstServiceId: 'cloudfront',
      againstServiceName: 'Amazon CloudFront',
      coreDifference:
        'Route 53 là hệ thống chỉ đường (DNS) chỉ trả về địa chỉ IP; CloudFront là mạng lưới phân phối nội dung (CDN) lưu trữ bộ đệm (cache) và trực tiếp proxy dữ liệu web ở biên.',
      mechanismDifference:
        'Route 53 chỉ tham gia vào bước đầu tiên khi client hỏi "tên miền này có IP nào", sau đó client tự kết nối thẳng tới IP đó. CloudFront là một reverse proxy đứng giữa client và server gốc: nó nhận trọn vẹn kết nối HTTP/HTTPS, phục vụ nội dung từ cache tại Edge Location, hoặc tải từ origin (S3, ALB, EC2).',
      chooseThisWhen: [
        'Cần phân giải tên miền cho bất kỳ dịch vụ mạng nào (web, mail server MX, cơ sở dữ liệu, VPN, FTP)',
        'Cần các thuật toán định tuyến phức tạp (Weighted, Latency, Failover) tại tầng phân giải tên',
      ],
      chooseOtherWhen: [
        'Cần lưu bộ đệm (cache) nội dung tĩnh (ảnh, video, file tĩnh) để giảm tải cho máy chủ gốc và giảm chi phí data transfer',
        'Cần chấm dứt kết nối SSL/TLS tại điểm biên gần người dùng nhất và lọc request bằng AWS WAF ở tầng L7',
        'Cần chạy các đoạn mã xử lý request tùy biến ở biên (CloudFront Functions hoặc Lambda@Edge)',
      ],
    },
    {
      againstServiceId: 'alb',
      againstServiceName: 'Elastic Load Balancing (Application Load Balancer)',
      coreDifference:
        'Route 53 cân bằng tải ở tầng DNS giữa các Region hoặc các hệ thống khác nhau; ALB cân bằng tải ở tầng ứng dụng (L7) giữa các target trong cùng một Region.',
      mechanismDifference:
        'Route 53 chỉ chọn lựa IP để trả về trong gói tin DNS, không biết gì về nội dung HTTP. ALB mở trọn vẹn kết nối HTTP/HTTPS, phân tích URL path, Host header, query parameters và cookie để phân phối request tới đúng Target Group bên trong VPC.',
      chooseThisWhen: [
        'Cần cân bằng tải hoặc failover xuyên Region (Cross-Region Load Balancing / DR)',
        'Cần điều phối traffic trước khi client thiết lập kết nối TCP tới hạ tầng AWS',
      ],
      chooseOtherWhen: [
        'Cần định tuyến request dựa trên URL path (ví dụ /api sang cụm microservice A, /images sang cụm B) trong cùng một Region',
        'Cần bám phiên người dùng (Sticky Sessions / Session Affinity) dựa trên cookie',
        'Cần chứng chỉ SSL/TLS được cài đặt trực tiếp trên load balancer để giải mã và gỡ tải cho EC2/ECS',
      ],
    },
  ],

  examTraps: [
    {
      distractorPattern:
        'Đề bài yêu cầu trỏ tên miền gốc (naked domain hoặc zone apex như example.com) vào Application Load Balancer hoặc CloudFront, phương án gợi ý tạo bản ghi CNAME.',
      whyWrong:
        'Chuẩn DNS RFC 1034/1035 cấm tạo bản ghi CNAME tại đỉnh của zone (zone apex) vì CNAME không được phép cùng tồn tại với bản ghi SOA và NS bắt buộc của domain.',
      correctAnswer:
        'Tạo bản ghi Alias (bản ghi A/AAAA kiểu Alias) trỏ tới DNS name của ALB hoặc CloudFront distribution. Alias record là tính năng độc quyền của Route 53 hỗ trợ zone apex và hoàn toàn miễn phí truy vấn.',
      signalKeywords: ['zone apex', 'naked domain', 'root domain', 'example.com', 'trỏ vào ALB'],
      severity: 'high',
    },
    {
      distractorPattern:
        'Đề bài yêu cầu định tuyến người dùng tới máy chủ gần nhất theo khoảng cách địa lý và cần khả năng dịch chuyển linh hoạt vùng phủ sóng của từng cụm, phương án đưa ra Geolocation Routing.',
      whyWrong:
        'Geolocation routing phân bổ cứng nhắc theo ranh giới hành chính (quốc gia, bang, lục địa), không tính khoảng cách vật lý thực tế và không thể mở rộng hay thu hẹp vùng phủ sóng của server.',
      correctAnswer:
        'Sử dụng Geoproximity Routing kết hợp Route 53 Traffic Flow và tham số Bias. Tăng Bias (positive bias) để mở rộng vùng địa lý mà tài nguyên phục vụ, hoặc giảm Bias (negative bias) để thu hẹp lại.',
      signalKeywords: ['bias', 'geoproximity', 'traffic flow', 'dịch chuyển vùng phủ sóng', 'khoảng cách vật lý'],
      severity: 'high',
    },
    {
      distractorPattern:
        'Đề bài yêu cầu tối ưu hóa hiệu năng mạng toàn cầu với độ trễ thấp nhất (lowest latency), phương án gợi ý chọn Geolocation Routing vì cho rằng gần về địa lý là nhanh nhất.',
      whyWrong:
        'Khoảng cách địa lý không đảm bảo độ trễ mạng thấp nhất do cấu trúc cáp quang biển và peering giữa các nhà mạng ISP. Client ở gần một Region về mặt bản đồ vẫn có thể có độ trễ mạng cao hơn tới Region đó.',
      correctAnswer:
        'Chọn Latency-based Routing Policy. Chính sách này đo đạc độ trễ mạng thực tế giữa mạng của client và các AWS Region để chọn đích đến có thời gian phản hồi nhanh nhất.',
      signalKeywords: ['độ trễ thấp nhất', 'lowest latency', 'hiệu năng mạng tốt nhất', 'latency-based'],
      severity: 'high',
    },
    {
      distractorPattern:
        'Hệ thống đã cấu hình Route 53 Failover Routing với Health Check, nhưng khi server chính bị sập, người dùng vẫn tiếp tục gửi request vào IP hỏng trong vài phút; đáp án cho rằng Health Check bị cấu hình sai.',
      whyWrong:
        'Nguyên nhân cốt lõi là do bộ đệm DNS cache tại các local DNS resolver của ISP và máy trạm người dùng vẫn lưu trữ bản ghi cũ cho tới khi hết hạn TTL (Time To Live).',
      correctAnswer:
        'Hạ thấp giá trị TTL của bản ghi DNS (ví dụ xuống 60 giây) đối với các bản ghi failover để bộ nhớ đệm nhanh hết hạn. Nếu đề yêu cầu chuyển đổi tức thì không phụ thuộc TTL thì phải chọn AWS Global Accelerator.',
      signalKeywords: ['vẫn kết nối vào IP cũ', 'chậm chuyển hướng failover', 'DNS cache', 'TTL', 'resolver'],
      severity: 'high',
    },
    {
      distractorPattern:
        'Đề bài yêu cầu giải pháp cân bằng tải cho nhiều máy chủ web với chi phí thấp nhất, đáp án gợi ý dùng Multivalue Answer Routing thay thế hoàn toàn cho Application Load Balancer.',
      whyWrong:
        'Multivalue Answer routing chỉ trả về tối đa 8 IP khỏe mạnh ngẫu nhiên ở tầng DNS. Nó không phải là load balancer thực thụ: không có thuật toán round-robin chuẩn, không có sticky session, không terminate SSL và không kiểm tra được lỗi HTTP status code ở tầng ứng dụng.',
      correctAnswer:
        'Multivalue Answer chỉ phù hợp làm DNS-level load balancing đơn giản hoặc failover cơ bản giữa các IP công khai. Khi đề bài yêu cầu các tính năng L7 (sticky session, SSL termination, path-based routing) thì bắt buộc phải dùng ALB.',
      signalKeywords: ['thay thế load balancer', 'multivalue answer', 'sticky session', 'L7 routing'],
      severity: 'medium',
    },
    {
      distractorPattern:
        'Đã tạo Private Hosted Zone và liên kết với VPC, nhưng các EC2 instance trong VPC vẫn không thể phân giải được tên miền nội bộ; phương án gợi ý sửa file /etc/hosts hoặc gán Elastic IP.',
      whyWrong:
        'Để VPC có thể phân giải tên miền từ Private Hosted Zone, hai thuộc tính DNS quan trọng của VPC bắt buộc phải được kích hoạt ở mức cấu hình VPC.',
      correctAnswer:
        'Bật cả hai thuộc tính enableDnsHostnames = true và enableDnsSupport = true trong cấu hình của VPC.',
      signalKeywords: ['không phân giải được trong VPC', 'private hosted zone không nhận', 'enableDnsSupport', 'enableDnsHostnames'],
      severity: 'medium',
    },
    {
      distractorPattern:
        'Đề bài yêu cầu Route 53 Health Check trực tiếp một máy chủ EC2 chỉ có Private IP nằm trong private subnet không có Internet Gateway.',
      whyWrong:
        'Mạng lưới Route 53 Health Checkers nằm hoàn toàn ngoài Internet công cộng, không có quyền hay đường truyền mạng để kết nối trực tiếp vào địa chỉ IP riêng (Private IP) trong VPC.',
      correctAnswer:
        'Tạo một CloudWatch Metric theo dõi sức khỏe của EC2 (hoặc target group), sau đó tạo một Route 53 Health Check loại "CloudWatch Metric Alarm" để kích hoạt failover dựa trên alarm đó thay vì kiểm tra trực tiếp qua IP.',
      signalKeywords: ['private IP', 'private subnet', 'health check không tới được', 'CloudWatch alarm health check'],
      severity: 'high',
    },
  ],

  architectures: [
    {
      id: 'route53-multi-region-active-passive-dr',
      title: 'Hệ thống khôi phục thảm họa Multi-Region Active-Passive tự động',
      scenario:
        'Một ứng dụng ngân hàng trực tuyến yêu cầu triển khai kiến trúc Disaster Recovery giữa hai Region (Primary tại ap-southeast-1 và Secondary/DR tại ap-southeast-2). RTO < 2 phút. Khi toàn bộ cụm Primary gặp sự cố, hệ thống phải tự động điều hướng người dùng sang cụm Secondary mà không cần can thiệp thủ công.',
      steps: [
        {
          order: 1,
          component: 'Amazon Route 53 Public Hosted Zone',
          action: 'Quản lý tên miền công khai của ngân hàng với delegation set 4 Name Server toàn cầu.',
          whyThisChoice: 'Hạ tầng Anycast phân tán toàn cầu đảm bảo 100% SLA phân giải DNS, là điểm khởi đầu cho mọi quyết định điều hướng traffic.',
        },
        {
          order: 2,
          component: 'Application Load Balancer (Primary & Secondary)',
          action: 'Triển khai ALB tại cả 2 Region, đứng trước cụm EC2 Auto Scaling Group tương ứng.',
          whyThisChoice: 'ALB xử lý SSL termination và cân bằng tải L7 nội bộ trong từng Region, đồng thời cung cấp endpoint công khai cho Route 53 trỏ tới.',
        },
        {
          order: 3,
          component: 'Route 53 Health Check',
          action: 'Cấu hình kiểm tra sức khỏe HTTP endpoint của Primary ALB với chu kỳ 10 giây (Fast interval) và Failure Threshold = 3.',
          whyThisChoice: 'Fast interval giúp phát hiện sự cố sập cụm trong vòng 30 giây (3 x 10s), thỏa mãn ràng buộc khắt khe RTO < 2 phút của đề bài.',
        },
        {
          order: 4,
          component: 'Route 53 Failover Routing Policy',
          action: 'Tạo bản ghi Alias A cho domain chính với Policy là Failover. Bản ghi Primary trỏ vào Primary ALB gắn kèm Health Check; bản ghi Secondary trỏ vào Secondary ALB.',
          whyThisChoice: 'Khi Health Check chuyển sang trạng thái Unhealthy, Route 53 sẽ tự động loại bỏ Primary ALB và chỉ trả về Secondary ALB trong các câu trả lời DNS.',
        },
        {
          order: 5,
          component: 'DNS Record TTL Configuration',
          action: 'Đặt giá trị TTL cho bản ghi Failover ở mức 60 giây.',
          whyThisChoice: 'Rút ngắn thời gian lưu cache tại các resolver của ISP, đảm bảo người dùng nhanh chóng nhận được IP của Region Secondary.',
        },
      ],
      rejectedAlternatives: [
        {
          option: 'Sử dụng Simple Routing trỏ về 2 IP của 2 Region',
          whyRejected: 'Simple Routing không có tính năng kiểm tra sức khỏe và không tự failover. Khi Region chính sập, 50% người dùng vẫn bị trả về IP hỏng.',
        },
        {
          option: 'Chuyển đổi thủ công bằng cách cập nhật bản ghi DNS khi nhận CloudWatch Alarm',
          whyRejected: 'Vi phạm yêu cầu RTO < 2 phút vì phụ thuộc vào con người phản ứng, đăng nhập console và thao tác sửa bản ghi.',
        },
      ],
      tradeoffs: [
        'Cấu hình Fast interval health check (10s) tốn thêm chi phí so với chu kỳ chuẩn 30s.',
        'Vẫn tồn tại độ trễ tối đa khoảng 60 giây do các local DNS resolver của một số ISP giữ cache trước khi chuyển đổi hoàn toàn sang Region phụ.',
      ],
    },
    {
      id: 'route53-hybrid-split-view-dns',
      title: 'Kiến trúc Split-View DNS thông suốt giữa AWS VPC và On-Premises',
      scenario:
        'Doanh nghiệp mở rộng hạ tầng từ trung tâm dữ liệu on-premises lên AWS VPC qua kết nối Direct Connect. Máy chủ on-premises cần phân giải các dịch vụ nội bộ chạy trên AWS (ví dụ database.corp.internal), đồng thời EC2 trong VPC cần phân giải các máy chủ nội bộ dưới mặt đất (dc.corp.local). Không được để lộ thông tin IP và cấu trúc mạng ra Internet.',
      steps: [
        {
          order: 1,
          component: 'Route 53 Private Hosted Zone',
          action: 'Tạo Private Hosted Zone "corp.internal" và gắn kết (associate) trực tiếp với VPC của doanh nghiệp.',
          whyThisChoice: 'Bảo mật tuyệt đối, chỉ các tài nguyên nằm trong VPC được ủy quyền mới có thể truy vấn và phân giải các bản ghi nội bộ này.',
        },
        {
          order: 2,
          component: 'VPC DNS Attributes',
          action: 'Kích hoạt enableDnsHostnames = true và enableDnsSupport = true trên VPC.',
          whyThisChoice: 'Bắt buộc phải bật để kích hoạt Route 53 Resolver (AmazonProvidedDNS tại IP +2) phục vụ việc phân giải Private Hosted Zone.',
        },
        {
          order: 3,
          component: 'Route 53 Resolver Inbound Endpoint',
          action: 'Tạo Inbound Endpoint gồm tối thiểu 2 Elastic Network Interface (ENI) tại 2 Subnet ở 2 AZ khác nhau trong VPC.',
          whyThisChoice: 'Cung cấp các địa chỉ IP nội bộ trong VPC để DNS Server dưới on-premises có thể gửi truy vấn DNS vào AWS qua Direct Connect.',
        },
        {
          order: 4,
          component: 'On-Premises DNS Conditional Forwarder',
          action: 'Cấu hình trên DNS Server on-premises chuyển tiếp mọi truy vấn cho domain "*.corp.internal" về các IP của Inbound Endpoint.',
          whyThisChoice: 'Giúp máy chủ on-premises tra cứu thông suốt các bản ghi trong Private Hosted Zone của AWS.',
        },
        {
          order: 5,
          component: 'Route 53 Resolver Outbound Endpoint & Forwarding Rules',
          action: 'Tạo Outbound Endpoint và thiết lập Rule chuyển tiếp mọi truy vấn tên miền "*.corp.local" về IP của DNS Server on-premises.',
          whyThisChoice: 'Cho phép EC2 instance trong VPC tự động hỏi DNS Server dưới đất khi cần kết nối tới dịch vụ on-premises.',
        },
      ],
      rejectedAlternatives: [
        {
          option: 'Dùng Public Hosted Zone và nhập các địa chỉ IP riêng (Private IP) vào bản ghi công khai',
          whyRejected: 'Để lộ toàn bộ cấu trúc mạng nội bộ, sơ đồ dải IP và tên máy chủ doanh nghiệp ra ngoài Internet, tạo lỗ hổng bảo mật nghiêm trọng.',
        },
        {
          option: 'Tự dựng cụm EC2 chạy BIND / Unbound DNS server làm forwarder trung gian',
          whyRejected: 'Tăng gánh nặng vận hành, phải tự quản lý vá lỗi hệ điều hành, tự thiết lập Auto Scaling và High Availability thay vì dùng dịch vụ serverless có sẵn của AWS.',
        },
      ],
      tradeoffs: [
        'Chi phí cố định 0.125 USD/giờ cho mỗi ENI của Inbound và Outbound Endpoints (khoảng 365 USD/tháng cho 4 ENI phân bổ trên 2 AZ).',
        'Cần sự phối hợp cấu hình đồng bộ giữa đội ngũ Cloud và đội ngũ Network/System On-premises để duy trì các forwarder rules.',
      ],
    },
  ],

  integrationNotes: [
    {
      withServiceId: 'cloudfront',
      withServiceName: 'Amazon CloudFront',
      relationship: 'Bản ghi Alias A/AAAA trỏ tên miền gốc hoặc subdomain tới CloudFront distribution hoàn toàn miễn phí phí truy vấn. CloudFront yêu cầu chứng chỉ SSL từ ACM tại Region us-east-1.',
    },
    {
      withServiceId: 'alb',
      withServiceName: 'Application Load Balancer (ALB)',
      relationship: 'Bản ghi Alias trỏ tới ALB tự động theo dõi danh sách địa chỉ IP công khai thay đổi liên tục của ALB khi nó co giãn, loại bỏ hoàn toàn rủi ro IP tĩnh bị lỗi thời.',
    },
    {
      withServiceId: 's3',
      withServiceName: 'Amazon S3',
      relationship: 'Bản ghi Alias trỏ tên miền tới S3 Static Website Hosting bucket. Tên S3 bucket bắt buộc phải trùng khớp 100% với tên miền cấu hình trong Route 53 (ví dụ bucket "blog.example.com").',
    },
    {
      withServiceId: 'acm',
      withServiceName: 'AWS Certificate Manager (ACM)',
      relationship: 'Route 53 tích hợp cơ chế tự động tạo bản ghi CNAME để thực hiện DNS validation khi cấp phát chứng chỉ SSL/TLS miễn phí từ ACM chỉ bằng một cú nhấp chuột trong console.',
    },
    {
      withServiceId: 'vpc',
      withServiceName: 'Amazon VPC',
      relationship: 'Gắn kết với Private Hosted Zone để cung cấp giải pháp phân giải tên miền nội bộ bảo mật thông qua Route 53 Resolver (AmazonProvidedDNS tại địa chỉ IP cơ sở + 2).',
    },
    {
      withServiceId: 'direct-connect',
      withServiceName: 'AWS Direct Connect',
      relationship: 'Kết hợp cùng Route 53 Resolver Inbound và Outbound Endpoints để hiện thực hóa việc phân giải DNS hai chiều thông suốt giữa on-premises và đám mây qua kênh truyền riêng.',
    },
    {
      withServiceId: 'cloudwatch',
      withServiceName: 'Amazon CloudWatch',
      relationship: 'Route 53 Health Check có thể liên kết trực tiếp với CloudWatch Metric Alarms để kích hoạt DNS failover khi các chỉ số tầng ứng dụng (CPU, memory, custom metric) vượt ngưỡng báo động.',
    },
  ],

  deepLinks: [
    {
      label: 'Tổng quan các chính sách định tuyến (Routing Policies)',
      url: 'https://docs.aws.amazon.com/Route53/latest/DeveloperGuide/routing-policy.html',
    },
    {
      label: 'Bản ghi Alias và sự khác biệt với CNAME',
      url: 'https://docs.aws.amazon.com/Route53/latest/DeveloperGuide/resource-record-sets-choosing-alias-non-alias.html',
    },
    {
      label: 'Làm việc với Private Hosted Zones',
      url: 'https://docs.aws.amazon.com/Route53/latest/DeveloperGuide/hosted-zones-private.html',
    },
    {
      label: 'Route 53 Resolver và kiến trúc Hybrid Cloud DNS',
      url: 'https://docs.aws.amazon.com/Route53/latest/DeveloperGuide/resolver.html',
    },
  ],
};
