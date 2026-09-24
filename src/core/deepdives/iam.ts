import type { ServiceDeepDive } from '../types';

export const iamDeepDive: ServiceDeepDive = {
  serviceId: 'iam',
  serviceName: 'AWS IAM',
  category: 'Security',
  tier: 'core',

  whyItExists:
    'Quản trị hạ tầng đám mây bằng tài khoản root hay phát tán access key tĩnh vào mã nguồn luôn dẫn tới hai thảm họa: rò rỉ một key là mất kiểm soát toàn bộ tài nguyên, và không thể thu hồi quyền của một cá nhân mà không làm gián đoạn hệ thống. AWS IAM sinh ra để giải quyết triệt để vấn đề này bằng cách phân rã quyền hạn tới từng hành động API (action-level granularity) và chuyển đổi hoàn toàn sang cơ chế chứng chỉ tạm thời (short-lived credentials qua IAM Role và STS). Đổi lại, kiến trúc sư phải đánh đổi sự đơn giản lấy ma trận đánh giá quyền đa tầng cực kỳ phức tạp (kết hợp SCP, Permissions Boundary, Identity policy, Resource policy) và phải chấp nhận độ trễ lan truyền bất đồng bộ (eventual consistency) trên phạm vi toàn cầu.',

  howItWorks: [
    {
      title: 'Logic đánh giá Policy: Deny ngầm định và Explicit Deny tuyệt đối',
      explanation:
        'Mọi request gọi đến AWS API đều bắt đầu ở trạng thái từ chối ngầm định (Implicit Deny). IAM engine quét qua tất cả các policy áp dụng cho ngữ cảnh đó: nếu xuất hiện dù chỉ một lệnh Explicit Deny ở bất kỳ đâu, request bị hủy ngay lập tức mà không cần xét tiếp. Để được thực thi, request bắt buộc phải có ít nhất một Explicit Allow và đồng thời vượt qua toàn bộ các hàng rào thu hẹp quyền gồm: Service Control Policy (SCP) của AWS Organizations, Permissions Boundary của identity, và Session Policy khi assume role.',
      soWhat:
        'Không một Identity Policy hay Resource Policy nào có thể ghi đè (override) được một lệnh Deny đến từ SCP hoặc Permissions Boundary. Khi thiết kế guardrail bảo mật cho tổ chức, Explicit Deny là công cụ phòng thủ tối thượng để khóa chết các hành vi nguy hiểm mà tài khoản con không thể lách qua.',
    },
    {
      title: 'Ranh giới tài khoản: Khác biệt giữa Same-Account và Cross-Account',
      explanation:
        'Khi gọi tài nguyên trong cùng một tài khoản AWS, request chỉ cần một bên cho phép: hoặc Identity-based Policy có Allow (và Resource không Deny), hoặc Resource-based Policy có Allow (và Identity không Deny). Tuy nhiên, khi gọi chéo tài khoản (Cross-Account), IAM engine đòi hỏi sự đồng thuận của cả hai đầu: tài khoản nguồn (gọi đi) phải có Identity Policy cho phép gọi sang tài nguyên bên ngoài, và tài khoản đích (chứa tài nguyên) phải có Resource-based Policy hoặc Trust Policy của Role mở cửa cho tài khoản nguồn.',
      soWhat:
        'Cấu hình Bucket Policy cho phép tài khoản đối tác là chưa đủ; IAM user hay role ở tài khoản đối tác vẫn bắt buộc phải được admin của họ gán quyền gọi sang bucket đó. Quy tắc hai đầu ngăn chặn việc một tài khoản tự ý trút dữ liệu hoặc quyền lực sang bên ngoài mà admin bên kia không hay biết.',
    },
    {
      title: 'IAM Role và STS: Tách biệt Trust Policy và Permission Policy',
      explanation:
        'IAM Role hoàn toàn không có credential dài hạn (không mật khẩu, không access key cố định). Một role được cấu thành từ hai nửa độc lập: Trust Policy quy định "Principal nào được phép assume role này" (ví dụ: EC2 service, Lambda, hay một AWS account cụ thể), còn Permission Policy quy định "sau khi assume thì được phép làm gì". Khi principal gọi sts:AssumeRole, dịch vụ STS kiểm tra Trust Policy rồi cấp một bộ credential tạm thời (AccessKeyId, SecretAccessKey, SessionToken) có thời hạn từ 15 phút đến 12 giờ.',
      soWhat:
        'Gán quyền cho máy chủ EC2 hay Lambda function tuyệt đối không dùng access key tĩnh lưu trong code hay User Data. Thay vào đó, gán IAM Role qua Instance Profile; AWS SDK trên máy chủ sẽ tự động gọi Instance Metadata Service (IMDSv2) để lấy và tự xoay vòng credential tạm thời mà ứng dụng không cần can thiệp.',
    },
    {
      title: 'Permissions Boundary: Hàng rào ủy quyền quản trị an toàn',
      explanation:
        'Permissions Boundary là một managed policy đặt trần quyền tối đa mà một IAM User hoặc Role có thể nhận được. Quyền hạn thực tế của entity luôn là phép giao (intersection) giữa Identity-based Policy và Permissions Boundary. Dù Identity Policy có cấp AdministratorAccess (*:*), nhưng nếu Permissions Boundary chỉ cho phép thao tác trên S3, entity đó vẫn chỉ truy cập được S3.',
      soWhat:
        'Đây là cơ chế duy nhất cho phép trao quyền tạo IAM Role cho đội ngũ phát triển (delegated administration / self-service IAM) mà không sợ họ tự tạo ra các role có quyền Admin để leo thang đặc quyền (privilege escalation). Admin chỉ cần ép điều kiện iam:PermissionsBoundary khi gọi iam:CreateRole.',
    },
    {
      title: 'Kiến trúc toàn cầu và tính nhất quán sau cùng (Eventual Consistency)',
      explanation:
        'IAM là một dịch vụ Global với master control plane đặt tại us-east-1. Mọi thao tác ghi (tạo role, sửa policy, cập nhật group) được thực hiện tại us-east-1 rồi sao chép bất đồng bộ sang tất cả các AWS Regions khác trên toàn thế giới. Thao tác đọc và kiểm tra quyền được phân tán cục bộ tại từng Region để đảm bảo độ trễ thấp nhất cho các lệnh gọi API.',
      soWhat:
        'Quá trình đồng bộ dữ liệu IAM trên toàn cầu mất từ vài giây đến hàng chục giây. Các kịch bản tự động hóa CI/CD hoặc Terraform vừa tạo xong IAM Role mà lập tức chạy lệnh deploy Lambda hoặc gán vào EC2 ở Region khác sẽ gặp lỗi EntityDoesNotExist hoặc AccessDenied; mã tự động hóa bắt buộc phải có cơ chế retry và exponential backoff.',
    },
  ],

  chooseWhen: [
    {
      condition: 'Quản lý quyền truy cập của nhân viên nội bộ (Dev, Ops, Security) vào AWS Console và CLI',
      reason: 'IAM cung cấp khả năng xác thực có hỗ trợ MFA, phân quyền theo nhóm (IAM Group) và kiểm toán hành động qua CloudTrail.',
    },
    {
      condition: 'Cấp quyền cho ứng dụng chạy trên EC2, ECS, Lambda, EKS truy cập các tài nguyên AWS khác',
      reason: 'Sử dụng IAM Role kết hợp Instance Profile hoặc IAM Roles for Service Accounts (IRSA) để cấp credential tạm thời, loại bỏ nguy cơ lộ access key.',
    },
    {
      condition: 'Triển khai hạ tầng hoặc chia sẻ dữ liệu an toàn giữa nhiều tài khoản AWS (Cross-account access)',
      reason: 'IAM Role kết hợp STS AssumeRole hoặc Resource-based Policy là giải pháp chuẩn mực để kết nối các tài khoản trong mô hình multi-account.',
    },
    {
      condition: 'Tích hợp đăng nhập liên kết (Identity Federation) với hệ thống định danh doanh nghiệp qua SAML 2.0 hoặc OIDC',
      reason: 'Cho phép nhân viên sử dụng tài khoản doanh nghiệp hiện có (Active Directory, Okta, Azure AD) hoặc GitHub Actions để lấy credential AWS tạm thời.',
    },
    {
      condition: 'Phân quyền tự phục vụ (Self-service IAM) cho các nhóm phát triển mà vẫn giữ trần an toàn',
      reason: 'Permissions Boundary khóa cứng mức quyền tối đa, ngăn ngừa lập trình viên tự cấp quyền Administrator.',
    },
  ],

  avoidWhen: [
    {
      condition: 'Xác thực và phân quyền cho người dùng cuối (end-users) của ứng dụng web hoặc mobile',
      reason: 'IAM chỉ có hạn mức tối đa 5.000 user mỗi tài khoản và không có tính năng tự đăng ký, quên mật khẩu hay đăng nhập mạng xã hội.',
      useInstead: 'Amazon Cognito User Pools (cho định danh người dùng ứng dụng) kết hợp Identity Pools (để đổi lấy credential AWS scoped).',
    },
    {
      condition: 'Lưu trữ và tự động xoay vòng mật khẩu database, OAuth token hay API key của đối tác thứ ba',
      reason: 'IAM chỉ quản lý quyền gọi AWS API, không phải là kho lưu trữ dữ liệu bí mật có tính năng tự động xoay khóa (secret rotation).',
      useInstead: 'AWS Secrets Manager (cho database credentials cần tự xoay) hoặc Systems Manager Parameter Store.',
    },
    {
      condition: 'Chia sẻ tài nguyên mạng (VPC Subnet, Transit Gateway) giữa các tài khoản trong AWS Organizations',
      reason: 'Dùng IAM Role để ủy quyền cấu hình mạng chéo tài khoản rất cồng kềnh và không thể chia sẻ trực tiếp hạ tầng VPC.',
      useInstead: 'AWS Resource Access Manager (AWS RAM).',
    },
    {
      condition: 'Quản lý đăng nhập tập trung (SSO) và ma trận phân quyền cho hàng chục đến hàng trăm tài khoản AWS',
      reason: 'Tạo IAM User và Role thủ công trên từng tài khoản con là anti-pattern quản trị phân tán, khó thu hồi quyền khi nhân sự nghỉ việc.',
      useInstead: 'AWS IAM Identity Center (kế thừa AWS Single Sign-On).',
    },
    {
      condition: 'Lọc gói tin mạng, chặn IP độc hại hoặc chống tấn công DDoS/Web exploit',
      reason: 'IAM hoạt động ở tầng danh tính và ủy quyền API (Layer 7 API calls), hoàn toàn không có khả năng kiểm tra lưu lượng mạng.',
      useInstead: 'Security Groups, Network ACLs và AWS WAF.',
    },
  ],

  security: {
    encryptionAtRest: [
      'Toàn bộ dữ liệu danh tính, cấu hình policy và thông tin nhạy cảm (như hash mật khẩu, secret access key) được AWS tự động mã hóa ở tầng lưu trữ phân tán nội bộ bằng các tiêu chuẩn mật mã phần cứng FIPS 140-2/3.',
      'Khóa ký số (signing keys) của STS dùng để phát hành session token tạm thời được sinh và quản lý khép kín trong hạ tầng mật mã an toàn của AWS.',
    ],
    encryptionInTransit:
      'Mọi giao tiếp tới IAM endpoint (iam.amazonaws.com) và STS endpoint (sts.amazonaws.com) bắt buộc sử dụng giao thức HTTPS qua TLS 1.2 trở lên. Mọi request dùng HTTP văn bản thuần đều bị từ chối kết nối ngay tại tầng mạng.',
    accessControl: [
      'Identity-based Policies: Đính kèm trực tiếp vào User, Group hoặc Role để chỉ định những hành động mà đối tượng đó có thể thực hiện.',
      'Resource-based Policies: Đính kèm trực tiếp vào tài nguyên (S3 bucket policy, KMS key policy, IAM role trust policy) để xác định ai được truy cập tài nguyên.',
      'Service Control Policies (SCPs): Hàng rào bảo vệ áp dụng trên cấp độ Organization, OU hoặc Account để giới hạn quyền tối đa của các tài khoản thành viên.',
      'Permissions Boundaries: Managed policy dùng để đặt trần đặc quyền tối đa cho một IAM entity, ngăn chặn nguy cơ leo thang đặc quyền.',
      'Session Policies: Policy truyền vào lúc gọi AssumeRole để thu hẹp quyền của phiên làm việc tạm thời.',
    ],
    defaultPosture:
      'Mặc định đóng hoàn toàn (Implicit Deny). Khi mới tạo, mọi User hoặc Role đều không có bất kỳ quyền hạn nào trên hệ thống. Tài khoản Root là thực thể duy nhất có toàn quyền ban đầu, và best practice bắt buộc là phải bật MFA cho Root, khóa access key của Root, và tạo các IAM Role/User với đặc quyền tối thiểu để phục vụ công việc hàng ngày.',
  },

  resilience: {
    failureScope: 'Global',
    builtInHA:
      'IAM là dịch vụ Global được AWS thiết kế với độ khả dụng tối đa. Tầng data plane phục vụ việc kiểm tra và xác thực quyền được phân tán trên nhiều Availability Zone và nhiều Region trên toàn cầu, đảm bảo các lệnh gọi AWS API diễn ra liên tục ngay cả khi một số AZ hoặc Region gặp sự cố.',
    crossRegionStory:
      'Dữ liệu cấu hình từ us-east-1 được tự động nhân bản ngầm bất đồng bộ tới tất cả các Region thương mại trên thế giới. Dịch vụ STS hỗ trợ Regional STS Endpoints cho phép client lấy credential tạm thời ngay tại Region nội bộ, giảm độ trễ và loại bỏ sự phụ thuộc vào Region us-east-1 khi có sự cố kết nối liên vùng.',
    backupRestore:
      'AWS tự động duy trì tính toàn vẹn và bản sao dữ liệu của hệ thống IAM. Phía người dùng không có nút bấm "restore" cho một User hay Role đã bị xóa nhầm; do đó việc khôi phục cấu hình bắt buộc phải dựa trên triết lý Infrastructure as Code (CloudFormation, Terraform, AWS CDK) với các template được lưu trữ và kiểm soát phiên bản trong Git.',
  },

  contrasts: [
    {
      againstServiceId: 'cognito',
      againstServiceName: 'Amazon Cognito',
      coreDifference:
        'IAM quản lý danh tính và quyền của nhân sự hoặc hạ tầng nội bộ AWS; Cognito quản lý danh tính của hàng triệu người dùng cuối cho ứng dụng web và di động.',
      mechanismDifference:
        'IAM đánh giá quyền dựa trên IAM Policy cho các lệnh gọi AWS API; Cognito cung cấp User Pools để xử lý đăng ký, đăng nhập, MFA cho end-user và Identity Pools để đổi token lấy temporary AWS credentials theo vai trò người dùng.',
      chooseThisWhen: [
        'Cấp quyền cho lập trình viên, DevOps, quản trị viên truy cập AWS Console hoặc CLI',
        'Cấp quyền cho EC2 instance, ECS container hoặc Lambda gọi các AWS service khác',
      ],
      chooseOtherWhen: [
        'Xây dựng ứng dụng B2C hoặc SaaS có hàng nghìn tới hàng triệu người dùng tự đăng ký tài khoản',
        'Cần tích hợp đăng nhập qua mạng xã hội (Google, Facebook, Apple) hoặc OpenID Connect bên ngoài cho người dùng ứng dụng',
      ],
    },
    {
      againstServiceId: 'organizations',
      againstServiceName: 'AWS Organizations (Service Control Policies - SCP)',
      coreDifference:
        'IAM Policy cấp quyền thực thi (Allow/Deny) cho principal; SCP chỉ đóng vai trò hàng rào bảo vệ (Guardrail) giới hạn trần quyền tối đa của cả tài khoản.',
      mechanismDifference:
        'SCP được áp dụng ở cấp độ Root, OU hoặc Account trong AWS Organizations và không bao giờ tự cấp quyền (lệnh Allow trong SCP chỉ có nghĩa là không chặn). Một hành động chỉ thành công khi cả SCP cho phép và IAM Policy có quyền Allow.',
      chooseThisWhen: [
        'Cần cấp quyền cụ thể cho một cá nhân, nhóm người hoặc tài nguyên thực hiện tác vụ hàng ngày',
        'Định nghĩa logic phân quyền chi tiết tới mức tag tài nguyên hoặc điều kiện địa chỉ IP',
      ],
      chooseOtherWhen: [
        'Cần thiết lập rào chắn bắt buộc trên toàn doanh nghiệp (ví dụ: cấm tất cả các tài khoản con rời khỏi Region chỉ định, cấm tắt CloudTrail)',
        'Cần đảm bảo kể cả tài khoản root của các tài khoản con cũng không thể vượt quyền quy định của công ty',
      ],
    },
    {
      againstServiceId: 'secrets-manager',
      againstServiceName: 'AWS Secrets Manager',
      coreDifference:
        'IAM Role cung cấp danh tính và cấp credential tạm thời cho AWS API; Secrets Manager lưu trữ, quản lý và tự động xoay vòng bí mật cho hệ thống bên ngoài.',
      mechanismDifference:
        'IAM giải quyết bài toán "ai được phép gọi AWS API gì". Secrets Manager là kho lưu trữ dữ liệu nhạy cảm có payload (chuỗi kết nối, mật khẩu database), tích hợp hàm Lambda để tự động xoay vòng mật khẩu RDS mà ứng dụng không bị gián đoạn.',
      chooseThisWhen: [
        'Ứng dụng chạy trên EC2 hoặc Lambda cần gọi S3, DynamoDB, SQS (dùng IAM Role, không bao giờ dùng secret tĩnh)',
        'Phân quyền giữa các thành phần dịch vụ nội bộ chạy hoàn toàn trên AWS',
      ],
      chooseOtherWhen: [
        'Ứng dụng cần mật khẩu đăng nhập vào cơ sở dữ liệu quan hệ (RDS PostgreSQL, MySQL, Aurora)',
        'Cần lưu trữ token API của bên thứ ba (Stripe, GitHub API key) kèm khả năng tự động xoay khóa theo chu kỳ',
      ],
    },
    {
      againstServiceName: 'AWS IAM Identity Center (tiền thân là AWS SSO)',
      coreDifference:
        'IAM quản lý danh tính cục bộ trong phạm vi một tài khoản; IAM Identity Center quản lý đăng nhập một lần (SSO) và điều phối quyền tập trung xuyên suốt nhiều tài khoản AWS.',
      mechanismDifference:
        'IAM yêu cầu tạo user hoặc role riêng rẽ trên từng account. IAM Identity Center liên kết một lần với IdP doanh nghiệp (Okta, Microsoft Entra ID), sau đó dùng Permission Sets để tự động sinh và triển khai các IAM Role tương ứng xuống các tài khoản con trong Organization.',
      chooseThisWhen: [
        'Quản lý quyền dịch vụ (Machine-to-Machine, EC2 instance profile, Lambda execution role)',
        'Môi trường đơn tài khoản hoặc các kịch bản tự động hóa hạ tầng qua CI/CD',
      ],
      chooseOtherWhen: [
        'Quản lý con người (Human identity) đăng nhập vào nhiều tài khoản AWS trong tổ chức lớn',
        'Muốn nhân viên dùng một danh tính công ty duy nhất (SSO) để truy cập mọi AWS account và ứng dụng SaaS',
      ],
    },
  ],

  examTraps: [
    {
      distractorPattern:
        'Đề bài hỏi cách an toàn nhất để ứng dụng chạy trên EC2 kết nối tới S3, đáp án đưa ra việc tạo IAM User, lấy Access Key ID/Secret Access Key và lưu trong file cấu hình, biến môi trường, hoặc mã hóa bằng KMS rồi nhét vào User Data.',
      whyWrong:
        'Access key là credential dài hạn, cực kỳ dễ bị rò rỉ qua log, mã nguồn, snapshot EBS hoặc bị kẻ xâm nhập instance trích xuất. Lưu trữ credential tĩnh trên máy chủ vi phạm trực tiếp best practice an ninh hàng đầu của AWS.',
      correctAnswer:
        'Tạo một IAM Role với quyền truy cập S3 cần thiết, gán Role đó vào EC2 thông qua Instance Profile. Ứng dụng dùng AWS SDK sẽ tự động lấy temporary credentials từ IMDSv2.',
      signalKeywords: ['an toàn nhất', 'không hardcode', 'EC2 truy cập S3', 'access key', 'instance profile'],
      severity: 'high',
    },
    {
      distractorPattern:
        'Khi cấu hình cho Lambda hoặc tài khoản khác assume một IAM Role, đáp án đưa ra việc thêm quyền sts:AssumeRole vào Permission Policy của Role đó, hoặc cấu hình sai vị trí cho phép đối tượng ngoài.',
      whyWrong:
        'Permission Policy (Identity-based) quy định role được làm gì sau khi đã assume. Nó không quyết định ai được phép biến thành role đó. Việc cho phép một Principal (EC2, Lambda, tài khoản khác) assume role phải nằm trong Trust Policy (AssumeRolePolicyDocument).',
      correctAnswer:
        'Cấu hình Trust Policy của Role chỉ định Principal được phép thực hiện hành động sts:AssumeRole. Sau đó gán Permission Policy vào Role để cấp quyền thao tác trên tài nguyên.',
      signalKeywords: ['trust policy', 'assume role policy', 'cross-account role', 'Principal', 'sts:AssumeRole'],
      severity: 'high',
    },
    {
      distractorPattern:
        'Đề bài yêu cầu cấp quyền cho các lập trình viên ở tài khoản con truy cập dịch vụ DynamoDB, đáp án đề xuất đính kèm một SCP chứa Effect: Allow cho DynamoDB vào OU chứa tài khoản con đó.',
      whyWrong:
        'SCP chỉ là rào chắn trần (guardrail), không bao giờ tự cấp quyền cho bất kỳ ai. Allow trong SCP chỉ có ý nghĩa là "không chặn qua rào". Nếu không có IAM Policy ở tài khoản con cấp quyền Allow, người dùng vẫn chịu Implicit Deny.',
      correctAnswer:
        'Cần cả hai bước: đảm bảo SCP không chặn thao tác DynamoDB (cho phép qua rào), và quản trị viên của tài khoản con phải tạo IAM Policy cấp quyền Allow cho IAM user hoặc role của họ.',
      signalKeywords: ['Service Control Policy', 'SCP', 'Organizations', 'cấp quyền cho tài khoản con', 'guardrail'],
      severity: 'high',
    },
    {
      distractorPattern:
        'Tài khoản A cần truy cập S3 bucket ở tài khoản B. Đáp án chọn: chỉ cần cấu hình S3 Bucket Policy ở tài khoản B cho phép Principal là Role của tài khoản A, không cần cấu hình gì thêm ở tài khoản A.',
      whyWrong:
        'Trong truy cập liên tài khoản (cross-account), cơ chế IAM đòi hỏi sự cho phép ở cả hai phía: Resource Policy ở tài khoản B mở cửa cho A, và Identity Policy của Role ở tài khoản A phải cấp quyền gọi sang tài nguyên của B. Nếu thiếu quyền ở tài khoản A, request bị chặn ngay từ phía A.',
      correctAnswer:
        'Phải cấu hình đồng thời: (1) S3 Bucket Policy tại tài khoản B cho phép Role của tài khoản A, và (2) IAM Policy đính kèm vào Role tại tài khoản A cho phép các action s3:GetObject/s3:PutObject trên ARN của bucket tài khoản B.',
      signalKeywords: ['cross-account', 'tài khoản khác', 'bucket policy', 'hai phía', 'both accounts'],
      severity: 'high',
    },
    {
      distractorPattern:
        'Đề bài yêu cầu phân quyền cho trưởng phòng IT hoặc thực hiện tác vụ khẩn cấp, đáp án đề xuất chia sẻ mật khẩu tài khoản Root hoặc tạo Access Key cho tài khoản Root để chạy script tự động hóa.',
      whyWrong:
        'Tài khoản Root có quyền tối thượng không thể bị giới hạn bởi bất kỳ IAM Policy hay Permissions Boundary nào trong tài khoản. Để lộ Root credential là mất toàn bộ quyền kiểm soát tài khoản và dữ liệu.',
      correctAnswer:
        'Khóa tài khoản Root bằng MFA, xóa mọi Root access key. Tạo IAM Role hoặc User có quyền quản trị giới hạn (ví dụ AdministratorAccess) và áp dụng Permissions Boundary hoặc SCP.',
      signalKeywords: ['root account', 'access key cho root', 'tác vụ hàng ngày', 'best practice'],
      severity: 'high',
    },
    {
      distractorPattern:
        'Đề bài hỏi làm thế nào để cấp quyền cho một DevOps engineer tạo IAM Role cho Lambda nhưng không được tự ý cấp quyền Administrator, đáp án chọn tạo IAM Policy chỉ cho phép iam:CreateRole.',
      whyWrong:
        'Nếu chỉ cho phép iam:CreateRole mà không ép buộc Permissions Boundary, kỹ sư đó có thể tạo một Role mới chứa quyền AdministratorAccess (*:*) rồi tự gán vào chính mình hoặc vào Lambda để leo thang đặc quyền (Privilege Escalation).',
      correctAnswer:
        'Tạo một Permissions Boundary quy định mức quyền tối đa cho phép. Sau đó cấp quyền iam:CreateRole kèm theo điều kiện (Condition) bắt buộc: lệnh tạo role chỉ thành công nếu có đính kèm Permissions Boundary đó (iam:PermissionsBoundary).',
      signalKeywords: ['leo thang đặc quyền', 'privilege escalation', 'permission boundary', 'ủy quyền tạo role', 'delegated administration'],
      severity: 'high',
    },
    {
      distractorPattern:
        'Một người dùng có IAM Policy chứa Effect: Deny với Action s3:* trên mọi tài nguyên, nhưng S3 Bucket Policy lại có Effect: Allow chỉ đích danh User ARN đó. Đáp án cho rằng User vẫn đọc được bucket vì Bucket Policy chỉ định rõ ràng.',
      whyWrong:
        'Trong thứ tự đánh giá của AWS IAM, Explicit Deny ở bất kỳ tầng policy nào (Identity, Resource, SCP, Boundary) đều có giá trị tuyệt đối và đánh bại mọi Explicit Allow.',
      correctAnswer:
        'Request bị Deny ngay lập tức. Để sửa, phải gỡ bỏ Explicit Deny khỏi Identity Policy hoặc thu hẹp điều kiện NotResource/Condition của lệnh Deny.',
      signalKeywords: ['explicit deny', 'ghi đè', 'ưu tiên cao nhất', 'always evaluates to deny'],
      severity: 'medium',
    },
  ],

  architectures: [
    {
      id: 'iam-secure-cross-account-ci-cd',
      title: 'Pipeline CI/CD triển khai ứng dụng đa tài khoản không dùng Access Key',
      scenario:
        'Doanh nghiệp có tài khoản Công cụ tập trung (Tooling Account) chạy GitHub Actions runner, cần triển khai tài nguyên hạ tầng và ứng dụng sang các tài khoản Dev, Staging và Production. Ràng buộc: tuyệt đối không lưu access key tĩnh trên CI/CD runner, tuân thủ đặc quyền tối thiểu, có audit trail tập trung.',
      steps: [
        {
          order: 1,
          component: 'IAM OIDC Identity Provider',
          action: 'Thiết lập OIDC IdP kết nối GitHub Actions với AWS IAM trong Tooling Account.',
          whyThisChoice:
            'Cho phép runner của GitHub Actions lấy temporary credential trực tiếp từ STS qua OpenID Connect token, không cần lưu trữ bất kỳ secret dài hạn nào trên GitHub secrets.',
        },
        {
          order: 2,
          component: 'IAM Deployment Role (Target Accounts)',
          action: 'Tạo một Deployment Role tại mỗi tài khoản đích (Dev/Staging/Prod) kèm Permission Policy cấp quyền thao tác tài nguyên.',
          whyThisChoice:
            'Phân lập quyền hạn theo môi trường; tài khoản Prod có policy chặt chẽ hơn Dev, tuân thủ nguyên tắc đặc quyền tối thiểu.',
        },
        {
          order: 3,
          component: 'IAM Trust Policy (Cross-Account)',
          action: 'Cấu hình Trust Policy trên Deployment Role tại tài khoản đích, chỉ cho phép Tooling Role trong Tooling Account assume với sts:ExternalId bắt buộc.',
          whyThisChoice:
            'Ngăn chặn hiện tượng Confused Deputy và kiểm soát chính xác nguồn kích hoạt deployment từ đúng tài khoản công cụ.',
        },
        {
          order: 4,
          component: 'AWS STS',
          action: 'Pipeline runner gọi AssumeRole sang tài khoản đích để nhận session token có thời hạn tối đa 1 giờ.',
          whyThisChoice:
            'Token tự động hết hạn, giảm thiểu bán kính thiệt hại nếu runner hoặc log phiên build bị rò rỉ.',
        },
        {
          order: 5,
          component: 'AWS CloudTrail',
          action: 'Ghi lại mọi sự kiện AssumeRole và các lệnh gọi API tại cả tài khoản nguồn lẫn đích.',
          whyThisChoice:
            'Cung cấp bằng chứng audit trail đầy đủ để truy vết ai đã deploy phiên bản nào vào lúc nào sang tài khoản Production.',
        },
      ],
      rejectedAlternatives: [
        {
          option: 'Tạo IAM User có access key tại tài khoản Prod và lưu vào GitHub Secrets',
          whyRejected:
            'Access key tĩnh có nguy cơ bị lộ khi commit nhầm hoặc bị thành viên dự án sao chép; không thể tự động xoay vòng an toàn và khó thu hồi quyền tức thời.',
        },
        {
          option: 'Dùng chung một tài khoản AWS duy nhất cho cả Dev và Prod và phân quyền bằng tiền tố tên',
          whyRejected:
            'Vi phạm nguyên tắc phân lập bán kính sự cố (blast radius); lỗi cấu hình từ môi trường Dev có thể ảnh hưởng trực tiếp tới Production.',
        },
      ],
      tradeoffs: [
        'Cấu hình ban đầu phức tạp hơn: cần thiết lập OIDC IdP, Trust Policy cross-account và đồng bộ role giữa nhiều tài khoản.',
        'Thời gian chạy pipeline tốn thêm vài trăm mili giây cho bước gọi STS AssumeRole trước mỗi đợt deploy.',
      ],
    },
    {
      id: 'iam-delegated-admin-permission-boundary',
      title: 'Mô hình tự phục vụ an toàn cho đội phát triển với Permissions Boundary',
      scenario:
        'Bộ phận bảo mật muốn cho phép nhóm phát triển ứng dụng (Dev team) toàn quyền tự do tạo IAM Role cho Lambda và ECS mà không cần mở vé hỗ trợ IT. Ràng buộc: nhóm Dev không được phép tự cấp quyền AdministratorAccess hoặc can thiệp vào tài nguyên của nhóm khác.',
      steps: [
        {
          order: 1,
          component: 'Cloud Security Admin',
          action: 'Tạo một IAM Managed Policy đóng vai trò Permissions Boundary, quy định trần quyền tối đa (chỉ được thao tác S3, DynamoDB trong Region quy định, cấm mọi thao tác IAM modification).',
          whyThisChoice:
            'Tạo ra khung rào bảo vệ bất biến mà mọi role con do Dev tạo ra đều phải tuân theo.',
        },
        {
          order: 2,
          component: 'IAM Developer Role',
          action: 'Cấp quyền cho nhóm Dev với chính sách cho phép iam:CreateRole, iam:PutRolePolicy, nhưng đính kèm Condition bắt buộc iam:PermissionsBoundary phải trỏ đúng ARN của Boundary đã tạo ở Bước 1.',
          whyThisChoice:
            'Nếu lập trình viên cố tình tạo Role mà không đính kèm Boundary này, API call sẽ bị Deny ngay lập tức.',
        },
        {
          order: 3,
          component: 'IAM Developer Policy Restriction',
          action: 'Chặn quyền gỡ bỏ hoặc chỉnh sửa chính sách Permissions Boundary bằng Explicit Deny trên iam:DeleteRolePermissionsBoundary.',
          whyThisChoice:
            'Ngăn chặn lập trình viên dùng role mới tạo để gỡ rào bảo vệ của chính nó.',
        },
        {
          order: 4,
          component: 'Developer Team',
          action: 'Tự động tạo Role cho Lambda Function thông qua AWS CDK hoặc Terraform kèm tham số permissionsBoundary.',
          whyThisChoice:
            'Đội ngũ phát triển đạt tốc độ tự phục vụ 100% mà không phụ thuộc vào đội bảo mật.',
        },
      ],
      rejectedAlternatives: [
        {
          option: 'Đội bảo mật tạo thủ công từng Role cho mỗi microservice mới của nhóm Dev',
          whyRejected:
            'Tạo nút thắt cổ chai vận hành nghiêm trọng, làm chậm chu kỳ phát hành phần mềm của toàn bộ dự án.',
        },
        {
          option: 'Cấp quyền IAM Full Access cho nhóm Dev và dùng CloudWatch để phát hiện vi phạm sau khi đã xảy ra',
          whyRejected:
            'Phản ứng thụ động sau sự cố không ngăn chặn được việc nhân viên vô tình cấp quyền mở rộng làm lộ dữ liệu nhạy cảm.',
        },
      ],
      tradeoffs: [
        'Lập trình viên phải hiểu cách khai báo tham số permissionsBoundary trong file CloudFormation hoặc Terraform, nếu quên sẽ gặp lỗi Access Denied.',
        'Bảo trì Permissions Boundary đòi hỏi đội bảo mật phải cập nhật khi có dịch vụ AWS mới được phép đưa vào sử dụng.',
      ],
    },
  ],

  integrationNotes: [
    {
      withServiceId: 'sts',
      withServiceName: 'AWS Security Token Service (STS)',
      relationship:
        'STS là động cơ phát hành credential tạm thời cho IAM Role thông qua các API AssumeRole, AssumeRoleWithWebIdentity và AssumeRoleWithSAML.',
    },
    {
      withServiceId: 'organizations',
      withServiceName: 'AWS Organizations',
      relationship:
        'Cung cấp Service Control Policies (SCPs) để thiết lập rào chắn bảo vệ trần quyền trên toàn bộ các tài khoản AWS trong doanh nghiệp.',
    },
    {
      withServiceId: 'kms',
      withServiceName: 'AWS Key Management Service (KMS)',
      relationship:
        'IAM Policy kết hợp với KMS Key Policy để kiểm soát quyền giải mã dữ liệu; thiếu quyền ở một trong hai phía thì không giải mã được tài nguyên.',
    },
    {
      withServiceId: 'cloudtrail',
      withServiceName: 'AWS CloudTrail',
      relationship:
        'Ghi lại mọi hoạt động xác thực, gọi API, thay đổi policy và assume role trong IAM, phục vụ giám sát an ninh và kiểm toán tuân thủ.',
    },
    {
      withServiceId: 'ec2',
      withServiceName: 'Amazon EC2',
      relationship:
        'Gắn IAM Role vào EC2 thông qua Instance Profile, cho phép ứng dụng lấy credential tạm thời an toàn qua IMDSv2 mà không cần access key.',
    },
    {
      withServiceId: 'lambda',
      withServiceName: 'AWS Lambda',
      relationship:
        'Mỗi hàm Lambda bắt buộc phải có một IAM Execution Role quy định quyền ghi log CloudWatch và quyền truy cập các tài nguyên downstream.',
    },
    {
      withServiceId: 's3',
      withServiceName: 'Amazon S3',
      relationship:
        'Phân quyền S3 là sự kết hợp chặt chẽ giữa IAM Identity Policy và S3 Bucket Policy (Resource-based Policy) theo logic đánh giá quyền đa tầng.',
    },
  ],

  deepLinks: [
    {
      label: 'Logic đánh giá chính sách trong IAM',
      url: 'https://docs.aws.amazon.com/IAM/latest/UserGuide/reference_policies_evaluation-logic.html',
    },
    {
      label: 'Các phương pháp hay nhất về bảo mật trong IAM',
      url: 'https://docs.aws.amazon.com/IAM/latest/UserGuide/best-practices.html',
    },
    {
      label: 'Sử dụng IAM Role cho Amazon EC2 và STS',
      url: 'https://docs.aws.amazon.com/IAM/latest/UserGuide/id_roles_use_switch-role-ec2.html',
    },
    {
      label: 'Ranh giới phân quyền (Permissions Boundaries)',
      url: 'https://docs.aws.amazon.com/IAM/latest/UserGuide/access_policies_boundaries.html',
    },
  ],
};
