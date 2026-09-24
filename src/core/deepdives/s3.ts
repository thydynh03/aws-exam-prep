import type { ServiceDeepDive } from '../types';

export const s3DeepDive: ServiceDeepDive = {

  serviceId: 's3',
  serviceName: 'Amazon S3',
  category: 'Storage',
  tier: 'core',

  whyItExists:
    'Ổ cứng gắn vào máy chủ luôn vướng ba giới hạn: dung lượng có trần, hỏng là mất, và chỉ máy chủ đó truy cập được. S3 bỏ hẳn khái niệm ổ đĩa, thay bằng kho object phẳng gọi qua HTTP. Đổi lại, bạn mất khả năng sửa một phần file và mất ngữ nghĩa thư mục thật. Đó chính là ranh giới quyết định khi nào dùng S3 và khi nào phải quay về EBS hay EFS.',

  howItWorks: [
    {
      title: 'Không gian tên phẳng, thư mục do Console vẽ ra',
      explanation:
        'S3 không có thư mục. "folder/file.txt" chỉ là một key dạng chuỗi, dấu gạch chéo không mang ý nghĩa gì với hệ thống, chỉ được Console hiển thị thành cây thư mục cho dễ nhìn. Muốn liệt kê "thư mục" thực chất là quét toàn bộ key theo tiền tố.',
      soWhat:
        'Đổi tên một "thư mục" nghĩa là copy rồi xóa từng object, chi phí và thời gian tỉ lệ thuận với số object. Ứng dụng nào cần thao tác thư mục thường xuyên thì S3 là lựa chọn sai, phải dùng EFS hoặc FSx.',
    },
    {
      title: 'Ghi là thay thế nguyên object, không sửa tại chỗ',
      explanation:
        'Không có API ghi đè 10 byte giữa file. Mọi thay đổi đều là PUT lại toàn bộ object, tạo ra một phiên bản mới. Multipart Upload chia nhỏ khi tải lên nhưng vẫn ráp thành một object duy nhất ở cuối.',
      soWhat:
        'S3 không bao giờ là nơi đặt file cơ sở dữ liệu, file log đang được ghi liên tục, hay ổ đĩa boot. Thấy đề nhắc "cập nhật từng phần" hoặc "ghi ngẫu nhiên" thì loại S3 ngay.',
    },
    {
      title: 'Độ bền 11 số 9 đến từ nhân bản across-AZ',
      explanation:
        'Với Standard, Standard-IA và các lớp Glacier, mỗi object được nhân ra tối thiểu 3 Availability Zone trong Region trước khi S3 trả về mã 200. Hai lớp cố tình bỏ bước này để đổi lấy thứ khác: One Zone-IA rẻ hơn Standard-IA khoảng 20%, còn S3 Express One Zone đổi lấy độ trễ một chữ số mili giây.',
      soWhat:
        'Mất cả một AZ vẫn không mất dữ liệu. Nhưng độ bền không phải là sao lưu: lệnh xóa hay ghi đè nhầm vẫn nhân ra cả 3 AZ. Chống mất do thao tác sai phải bật Versioning, không phải trông vào độ bền.',
    },
    {
      title: 'Hiệu năng chia theo tiền tố key',
      explanation:
        'Mỗi tiền tố trong một bucket được bảo đảm tối thiểu 3.500 request mỗi giây cho nhóm PUT/COPY/POST/DELETE và 5.500 cho nhóm GET/HEAD. Đây là mức sàn chứ không phải trần: S3 tự phân mảnh và vượt qua mức này sau một thời gian chịu tải. Bucket không có trần request tổng thể.',
      soWhat:
        'Nghẽn hiệu năng S3 gần như luôn là do thiết kế key dồn hết vào một tiền tố. Cách chữa là rải tiền tố, không phải tạo thêm bucket.',
    },
  ],

  chooseWhen: [
    {
      condition: 'Dữ liệu ghi một lần, đọc nhiều lần: ảnh, video, backup, log đã đóng, artifact build',
      reason: 'Đúng với mô hình thay thế nguyên object của S3, không vướng giới hạn ghi tại chỗ.',
    },
    {
      condition: 'Đề yêu cầu chi phí thấp nhất cho lưu trữ dài hạn kèm ràng buộc tuân thủ',
      reason:
        'Lifecycle chuyển tự động xuống Glacier, cộng Object Lock ở chế độ Compliance để không ai xóa được kể cả root.',
    },
    {
      condition: 'Cần một điểm lưu trữ chung cho nhiều service phân tích',
      reason:
        'Athena, Redshift Spectrum, EMR, Glue đều đọc thẳng từ S3, không cần nạp dữ liệu vào từng hệ thống riêng. Đây là nền của data lake.',
    },
    {
      condition: 'Phục vụ nội dung tĩnh cho người dùng toàn cầu',
      reason: 'Ghép CloudFront phía trước để cache ở biên, giảm cả độ trễ lẫn chi phí data transfer.',
    },
    {
      condition: 'Dung lượng không đoán trước được và có thể tăng đột biến',
      reason: 'Không phải khai báo trước dung lượng, không có bước mở rộng thủ công như EBS.',
    },
  ],

  avoidWhen: [
    {
      condition: 'Ứng dụng cần ghi ngẫu nhiên vào giữa file, hoặc cần khóa file theo byte',
      reason: 'S3 chỉ thay thế nguyên object, không có ghi tại chỗ.',
      useInstead: 'Amazon EBS cho một máy chủ, Amazon EFS khi nhiều máy chủ cùng ghi.',
    },
    {
      condition: 'Cần giao thức file chuẩn POSIX hoặc SMB để ứng dụng cũ mount vào',
      reason: 'S3 chỉ nói HTTP REST, không có ngữ nghĩa POSIX như quyền, inode hay hard link.',
      useInstead: 'EFS cho Linux, FSx for Windows File Server cho SMB.',
    },
    {
      condition: 'Ứng dụng cần độ trễ dưới 1 ms',
      reason:
        'S3 trả byte đầu tiên trong khoảng vài chục tới hơn trăm ms, vì mỗi request phải đi qua tầng HTTP và phải ghi nhận đủ số bản sao. Ngoại lệ duy nhất là S3 Express One Zone, đổi lại nó chỉ nằm trong một AZ.',
      useInstead: 'ElastiCache khi cần cache, EBS io2 Block Express khi cần ổ đĩa độ trễ thấp.',
    },
    {
      condition: 'Dùng làm ổ đĩa boot hoặc nơi đặt file dữ liệu của cơ sở dữ liệu',
      reason: 'Không phải block storage, không mount được làm ổ đĩa hệ thống.',
      useInstead: 'EBS cho ổ boot, RDS hoặc Aurora cho cơ sở dữ liệu.',
    },
    {
      condition: 'Dữ liệu nhỏ nhưng truy cập cực kỳ thường xuyên, mỗi lần chỉ vài KB',
      reason:
        'Tính tiền theo số request nên hàng triệu lượt đọc file nhỏ sẽ đắt hơn hẳn so với đọc từ cache hay database.',
      useInstead: 'DynamoDB hoặc ElastiCache.',
    },
  ],

  limits: [
    {
      name: 'Kích thước tối đa một object',
      value: '5 TB',
      implication: 'Dữ liệu lớn hơn phải tự chia mảnh ở tầng ứng dụng.',
      adjustable: false,
    },
    {
      name: 'Kích thước tối đa cho một lần PUT đơn lẻ',
      value: '5 GB',
      implication:
        'Vượt mức này bắt buộc dùng Multipart Upload. AWS khuyến nghị dùng từ mốc 100 MB. Đây là con số hay bị hỏi.',
      adjustable: false,
    },
    {
      name: 'Số bucket mỗi tài khoản',
      value: 'Mặc định 10.000, xin tăng được tới 1.000.000',
      implication:
        'Từ 2024 AWS đã nâng mặc định từ 100 lên 10.000, nhưng đề thi cũ vẫn có thể dùng mốc 100. Dù sao cũng đừng thiết kế kiểu mỗi khách hàng một bucket, hãy phân tách bằng tiền tố key kèm IAM policy.',
      adjustable: true,
    },
    {
      name: 'Thông lượng baseline mỗi tiền tố',
      value: '3.500 PUT/COPY/POST/DELETE và 5.500 GET/HEAD mỗi giây',
      implication:
        'Đây là mức sàn được bảo đảm, không phải trần cứng. Rải key ra nhiều tiền tố để tăng thông lượng ngay lập tức, thay vì tạo thêm bucket.',
      adjustable: false,
    },
    {
      name: 'Thời gian lưu tối thiểu bị tính tiền',
      value:
        'Standard-IA và One Zone-IA 30 ngày, Glacier Instant Retrieval 90 ngày, Glacier Flexible 90 ngày, Deep Archive 180 ngày. Standard và Intelligent-Tiering không có mức này.',
      implication:
        'Chuyển lớp quá sớm sẽ đắt hơn là cứ để nguyên. Lifecycle chuyển file sống 7 ngày xuống IA là bẫy chi phí kinh điển. Việc Intelligent-Tiering không bị ràng buộc thời gian chính là lý do nó an toàn khi chưa rõ mẫu truy cập.',
      adjustable: false,
    },
    {
      name: 'Kích thước tối thiểu bị tính tiền',
      value: '128 KB cho Standard-IA, One Zone-IA và Glacier Instant Retrieval; 40 KB cho Glacier Flexible và Deep Archive',
      implication:
        'Hai lớp Glacier sâu còn cộng thêm khoảng 32 KB metadata cho mỗi object. Vì vậy hàng triệu file nhỏ chuyển xuống lớp rẻ có thể làm hóa đơn tăng thay vì giảm. Cách chữa là gộp file nhỏ lại trước khi lưu trữ.',
      adjustable: false,
    },
  ],

  cost: {
    billingDimensions: [
      'Dung lượng lưu trữ tính theo GB-tháng, đơn giá khác nhau theo từng storage class',
      'Số lượng request, tính riêng cho nhóm PUT/COPY/POST/LIST và nhóm GET/SELECT',
      'Data transfer đi ra Internet, tính theo GB',
      'Phí truy xuất dữ liệu ở các lớp IA và Glacier, tính theo GB lấy ra',
      'Phí cho tính năng bật thêm: Replication, Inventory, Object Lambda, phí giám sát của Intelligent-Tiering',
    ],
    hiddenCosts: [
      'Data transfer ra Internet là khoản đắt nhất và hay bị quên khi ước tính. Đặt CloudFront phía trước rẻ hơn hẳn vì giá truyền từ CloudFront thấp hơn và cache chặn bớt lượt đọc gốc.',
      'Phí lấy dữ liệu từ Glacier Deep Archive, cộng thời gian chờ tới 12 giờ ở chế độ Standard.',
      'Multipart Upload dở dang không tự xóa, vẫn tính tiền âm thầm. Phải đặt lifecycle rule AbortIncompleteMultipartUpload.',
      'Cross-Region Replication nhân đôi tiền lưu trữ và cộng thêm phí truyền liên Region.',
      'Versioning giữ mọi phiên bản cũ, nên tiền lưu trữ tăng dần mà nhìn số object hiện tại không thấy.',
    ],
    optimizationLevers: [
      'S3 Intelligent-Tiering khi không đoán được mẫu truy cập, đây là đáp án an toàn khi đề nói "access pattern thay đổi hoặc không rõ".',
      'Lifecycle rule chuyển dần Standard sang IA rồi Glacier khi mẫu truy cập đã biết rõ và ổn định.',
      'S3 Storage Lens và Storage Class Analysis để biết nên chuyển lớp lúc nào.',
      'Đặt VPC Gateway Endpoint cho S3 để lưu lượng không đi qua NAT Gateway, cắt được khoản phí xử lý theo GB của NAT.',
    ],
  },

  security: {
    encryptionAtRest: [
      'SSE-S3: AWS quản lý khóa, bật mặc định cho mọi bucket từ 2023, không tốn thêm tiền. Đáp án mặc định khi đề chỉ nói "mã hóa dữ liệu".',
      'SSE-KMS: khóa do bạn kiểm soát trong KMS, có audit trail qua CloudTrail và xoay khóa được. Đổi lại mỗi request tốn thêm một lượt gọi KMS nên có thể chạm rate limit; bật S3 Bucket Key để cắt tới 99% số lượt gọi đó.',
      'SSE-C: bạn tự giữ khóa và gửi kèm mỗi request. AWS không lưu khóa, mất khóa là mất dữ liệu vĩnh viễn.',
      'Client-side: mã hóa trước khi gửi lên. Chọn khi yêu cầu là AWS không bao giờ được thấy dữ liệu thô.',
    ],
    encryptionInTransit:
      'HTTPS mặc định. Muốn ép buộc thì thêm điều kiện aws:SecureTransport = false vào bucket policy để chặn mọi request HTTP.',
    accessControl: [
      'IAM policy: gắn vào user hoặc role, trả lời câu hỏi "principal này được làm gì".',
      'Bucket policy: gắn vào bucket, trả lời câu hỏi "ai được đụng vào tài nguyên này". Đây là cách duy nhất cấp quyền cho principal ở tài khoản khác mà không cần role.',
      'ACL: cơ chế cũ, AWS khuyến nghị tắt bằng Object Ownership. Đề nhắc tới ACL thường là để gài.',
      'Presigned URL: cấp quyền tạm thời cho người không có tài khoản AWS, thừa hưởng quyền của người ký nên hết hạn theo credential đó.',
      'VPC endpoint policy: giới hạn bucket nào được truy cập qua endpoint, dùng để chặn tuồn dữ liệu ra bucket lạ.',
    ],
    defaultPosture:
      'Mặc định đóng hoàn toàn. Block Public Access bật sẵn ở cả 4 mức cho bucket mới, và mã hóa SSE-S3 cũng đã bật sẵn. Bucket bị lộ ra Internet gần như luôn là do có người chủ động tắt Block Public Access.',
  },

  resilience: {
    failureScope: 'Region',
    builtInHA:
      'AWS lo sẵn ở mức Region: dữ liệu nằm trên tối thiểu 3 AZ, không có gì phải cấu hình. Ngoại lệ là One Zone-IA và Express One Zone chỉ nằm trong một AZ.',
    crossRegionStory:
      'Cross-Region Replication sao chép bất đồng bộ, RPO tính bằng phút. Cần RPO có cam kết thì bật Replication Time Control, SLA 15 phút cho 99,99% object. Bắt buộc bật Versioning ở CẢ hai bucket. Muốn một endpoint duy nhất tự định tuyến tới bản sao gần nhất thì dùng Multi-Region Access Point.',
    backupRestore:
      'Độ bền của AWS không thay cho sao lưu. Chống xóa nhầm là Versioning, chống xóa ác ý là MFA Delete, chống xóa theo quy định là Object Lock. Muốn quản lý tập trung cùng các service khác thì dùng AWS Backup.',
  },

  contrasts: [
    {
      againstServiceId: 'ebs',
      againstServiceName: 'Amazon EBS',
      coreDifference: 'S3 là kho object gọi qua HTTP; EBS là ổ đĩa block gắn vào đúng một EC2.',
      mechanismDifference:
        'EBS cho ghi tại chỗ theo từng block nên chạy được hệ điều hành và cơ sở dữ liệu. EBS bị khóa trong một AZ, S3 trải khắp Region.',
      chooseThisWhen: [
        'Cần truy cập từ nhiều máy, nhiều Region hoặc từ Internet',
        'Dung lượng tăng không đoán trước',
        'Chấp nhận độ trễ hàng chục ms để đổi lấy chi phí thấp',
      ],
      chooseOtherWhen: [
        'Cần ổ boot cho EC2',
        'Chạy cơ sở dữ liệu tự quản lý cần IOPS ổn định',
        'Cần độ trễ dưới một phần nghìn giây',
      ],
      relatedComparisonId: 's3-vs-ebs-vs-efs',
    },
    {
      againstServiceId: 'efs',
      againstServiceName: 'Amazon EFS',
      coreDifference: 'Cả hai đều chia sẻ được cho nhiều máy, nhưng EFS nói NFS còn S3 nói HTTP.',
      mechanismDifference:
        'EFS giữ đúng ngữ nghĩa POSIX: quyền, khóa file, ghi tại chỗ, thư mục thật. Ứng dụng cũ mount vào là chạy, không phải sửa code. S3 buộc ứng dụng phải nói SDK hoặc REST.',
      chooseThisWhen: [
        'Ứng dụng viết mới, gọi được SDK',
        'Cần phục vụ ra Internet hoặc ghép CloudFront',
        'Ưu tiên chi phí thấp nhất cho lưu trữ dài hạn',
      ],
      chooseOtherWhen: [
        'Ứng dụng cũ bắt buộc mount filesystem',
        'Nhiều EC2 cùng ghi vào một cây thư mục',
        'Cần khóa file theo chuẩn POSIX',
      ],
      relatedComparisonId: 's3-vs-ebs-vs-efs',
    },
    {
      againstServiceName: 'Amazon S3 Glacier Deep Archive',
      coreDifference: 'Cùng là S3, khác ở đánh đổi giữa giá lưu và thời gian chờ lúc lấy ra.',
      mechanismDifference:
        'Deep Archive rẻ hơn Standard khoảng 23 lần nhưng lấy dữ liệu mất 12 giờ ở chế độ Standard, và tối thiểu 180 ngày mới hết bị tính phí sớm.',
      chooseThisWhen: ['Dữ liệu còn được đọc trong vòng vài tháng tới'],
      chooseOtherWhen: [
        'Lưu trữ tuân thủ 7 đến 10 năm',
        'Xác suất đọc lại gần như bằng không',
        'Đề chấp nhận thời gian lấy tính bằng giờ',
      ],
    },
    {
      againstServiceName: 'AWS Storage Gateway (File Gateway)',
      coreDifference:
        'File Gateway đặt một thiết bị ngay tại trung tâm dữ liệu của bạn, cho máy chủ nội bộ mount qua NFS hoặc SMB như một file server bình thường, còn dữ liệu thì được đẩy ngầm lên S3.',
      mechanismDifference:
        'Máy chủ dưới trung tâm dữ liệu vẫn tưởng đang ghi vào file server, thực tế dữ liệu nằm trên S3 và có cache cục bộ cho phần nóng. Đây là cầu nối cho hệ thống cũ không sửa được code.',
      chooseThisWhen: ['Ứng dụng đã chạy trên cloud và gọi được API S3'],
      chooseOtherWhen: [
        'Hệ thống dưới on-premises cần giao thức file',
        'Đang lai ghép hai môi trường trong giai đoạn chuyển đổi',
      ],
    },
  ],

  examTraps: [
    {
      distractorPattern:
        'Đề nói cần chi phí thấp nhất, đáp án gợi ý chuyển sang One Zone-IA trong khi yêu cầu vẫn đòi chịu được sự cố mất một AZ.',
      whyWrong:
        'One Zone-IA chỉ giữ dữ liệu trong một AZ. Mất AZ đó là mất dữ liệu thật, không phải chỉ gián đoạn.',
      correctAnswer:
        'Chỉ chọn One Zone-IA khi dữ liệu tái tạo lại được, ví dụ ảnh thumbnail sinh từ ảnh gốc. Còn lại chọn Standard-IA.',
      signalKeywords: ['có thể tái tạo lại', 'bản sao thứ hai', 'chịu được mất một AZ'],
      severity: 'high',
    },
    {
      distractorPattern:
        'Đề yêu cầu chống xóa nhầm, đáp án đưa ra độ bền 11 số 9 như bằng chứng dữ liệu đã an toàn.',
      whyWrong:
        'Độ bền chỉ chống hỏng phần cứng. Lệnh xóa của người dùng được nhân bản y hệt sang cả 3 AZ.',
      correctAnswer:
        'Bật Versioning, thêm MFA Delete nếu đề nhấn mạnh chống xóa ác ý, và Object Lock khi có yêu cầu tuân thủ.',
      signalKeywords: ['xóa nhầm', 'ghi đè', 'khôi phục phiên bản trước', 'ransomware'],
      severity: 'high',
    },
    {
      distractorPattern:
        'Đề nói mẫu truy cập không dự đoán được, đáp án đưa ra lifecycle rule chuyển xuống IA sau 30 ngày.',
      whyWrong:
        'Lifecycle cố định chỉ đúng khi đã biết rõ quy luật. Dữ liệu bị chuyển xuống IA rồi lại bị đọc nhiều sẽ phát sinh phí truy xuất, tổng chi phí tăng.',
      correctAnswer: 'S3 Intelligent-Tiering, vì nó tự dịch chuyển theo hành vi thực tế.',
      signalKeywords: ['không dự đoán được', 'mẫu truy cập thay đổi', 'không rõ tần suất'],
      severity: 'high',
    },
    {
      distractorPattern:
        'Đề hỏi cách cho EC2 trong subnet riêng tư truy cập S3, đáp án đưa ra NAT Gateway.',
      whyWrong:
        'NAT Gateway chạy được nhưng tính phí theo từng GB đi qua, trong khi có phương án miễn phí.',
      correctAnswer:
        'VPC Gateway Endpoint cho S3. Miễn phí, lưu lượng không rời khỏi mạng AWS. Thấy cặp từ "subnet riêng tư" và "chi phí thấp nhất" thì nghĩ ngay tới Gateway Endpoint.',
      signalKeywords: ['private subnet', 'không đi qua Internet', 'giảm chi phí data transfer'],
      severity: 'high',
    },
    {
      distractorPattern:
        'Đề yêu cầu chia sẻ file cho nhiều EC2 cùng ghi, trong đáp án có S3 vì nghe giống "lưu trữ dùng chung".',
      whyWrong: 'S3 không phải filesystem, không mount được, không có khóa file.',
      correctAnswer: 'Amazon EFS. Thấy chữ "cùng lúc ghi" hoặc "mount" thì loại S3 ngay.',
      signalKeywords: ['concurrently', 'mount', 'shared file system', 'POSIX'],
      severity: 'medium',
    },
    {
      distractorPattern:
        'Đề yêu cầu sao chép sang Region khác để phục hồi thảm họa, đáp án chỉ bật Versioning ở bucket nguồn rồi tạo replication rule.',
      whyWrong:
        'Cross-Region Replication đòi Versioning bật ở CẢ bucket nguồn lẫn bucket đích. Thiếu một đầu là rule không chạy, mà lỗi lại không hiện rõ.',
      correctAnswer:
        'Bật Versioning ở cả hai bucket, tạo IAM role cho S3 thực hiện sao chép. Cần cam kết thời gian thì thêm Replication Time Control.',
      signalKeywords: ['cross-region replication', 'sao chép sang Region khác', 'disaster recovery'],
      severity: 'high',
    },
    {
      distractorPattern:
        'Đề cần tăng tốc tải lên từ nơi cách xa Region, đáp án đưa ra CloudFront.',
      whyWrong:
        'Trong ngữ cảnh đề thi, CloudFront là đáp án cho chiều phân phối nội dung; chiều tải lên có công cụ chuyên biệt riêng.',
      correctAnswer:
        'S3 Transfer Acceleration khi tải lên từ xa, ghép thêm Multipart Upload cho file lớn. Nếu khối lượng lên tới hàng chục TB và đường truyền yếu thì chuyển sang Snowball.',
      signalKeywords: ['tải lên từ nhiều châu lục', 'upload nhanh hơn', 'người dùng ở xa Region'],
      severity: 'medium',
    },
  ],

  integrationNotes: [
    { withServiceId: 'cloudfront', withServiceName: 'Amazon CloudFront', relationship: 'Đặt trước S3 để cache ở biên, giảm độ trễ và cắt phí data transfer. Dùng OAC để chặn truy cập thẳng vào bucket.' },
    { withServiceId: 'kms', withServiceName: 'AWS KMS', relationship: 'SSE-KMS mã hóa bằng khóa do bạn kiểm soát, đổi lại mỗi request tốn thêm một lượt gọi KMS. Bật S3 Bucket Key để giảm số lượt gọi đó.' },
    { withServiceId: 'lambda', withServiceName: 'AWS Lambda', relationship: 'S3 Event Notification kích hoạt Lambda khi có object mới, nền của mọi pipeline xử lý ảnh và tài liệu.' },
    { withServiceId: 'sqs', withServiceName: 'Amazon SQS', relationship: 'Đẩy event qua SQS thay vì gọi thẳng Lambda khi cần chịu tải đột biến và cần thử lại khi lỗi.' },
    { withServiceId: 'athena', withServiceName: 'Amazon Athena', relationship: 'Truy vấn SQL thẳng trên file trong S3, không cần nạp vào database. Lưu dạng Parquet và phân vùng để giảm lượng dữ liệu quét, vì Athena tính tiền theo TB quét.' },
    { withServiceId: 'vpc', withServiceName: 'Amazon VPC', relationship: 'Gateway Endpoint cho phép subnet riêng tư gọi S3 mà không cần NAT Gateway.' },
  ],

  architectures: [
    {
      id: 's3-static-site-global',
      title: 'Website tĩnh phục vụ toàn cầu, chi phí thấp nhất',
      scenario:
        'Công ty có trang marketing lượng truy cập tăng giảm thất thường, người dùng ở ba châu lục. Yêu cầu: không quản lý máy chủ, chịu được đột biến truy cập, chi phí thấp nhất, bắt buộc HTTPS.',
      steps: [
        { order: 1, component: 'Amazon S3', action: 'Chứa file HTML, CSS, JS, ảnh; bật static website hosting.', whyThisChoice: 'Không có máy chủ nào phải vá lỗi hay mở rộng. Trả tiền theo dung lượng thực dùng.' },
        { order: 2, component: 'Amazon CloudFront', action: 'Đặt trước S3, cache tại hơn 700 điểm biên trên toàn cầu.', whyThisChoice: 'Giảm độ trễ cho người dùng xa Region, và giá data transfer từ CloudFront rẻ hơn từ S3.' },
        { order: 3, component: 'Origin Access Control', action: 'Chặn mọi truy cập trực tiếp vào bucket, chỉ CloudFront đọc được.', whyThisChoice: 'Nếu để bucket public thì người dùng vẫn gọi thẳng S3 được, vừa mất cache vừa hở bảo mật.' },
        { order: 4, component: 'AWS Certificate Manager', action: 'Cấp chứng chỉ TLS miễn phí, gắn vào CloudFront.', whyThisChoice: 'Chứng chỉ ACM miễn phí và tự gia hạn. Lưu ý phải cấp ở Region us-east-1 mới dùng được cho CloudFront.' },
        { order: 5, component: 'Amazon Route 53', action: 'Alias record trỏ tên miền vào CloudFront.', whyThisChoice: 'Alias record không tính phí truy vấn, khác với CNAME, và dùng được cho cả domain gốc.' },
      ],
      rejectedAlternatives: [
        { option: 'EC2 chạy Nginx sau ALB', whyRejected: 'Phải vá lỗi hệ điều hành, trả tiền cả lúc không ai truy cập, và vẫn phải cấu hình Auto Scaling cho đột biến.' },
        { option: 'Chỉ S3 không có CloudFront', whyRejected: 'Người dùng ở xa Region chịu độ trễ cao, và S3 static hosting không hỗ trợ HTTPS cho tên miền riêng.' },
      ],
      tradeoffs: [
        'Cache ở biên nghĩa là nội dung mới không hiện ngay, phải invalidate hoặc đặt tên file có phiên bản.',
        'Chỉ phục vụ được nội dung tĩnh; phần động phải tách sang API Gateway cộng Lambda.',
      ],
    },
    {
      id: 's3-compliance-archive',
      title: 'Lưu trữ tuân thủ 7 năm, không ai được xóa',
      scenario:
        'Tổ chức tài chính phải giữ bản ghi giao dịch 7 năm theo quy định. Gần như không bao giờ đọc lại, trừ khi bị thanh tra. Yêu cầu: kể cả tài khoản root cũng không xóa được, và chi phí thấp nhất có thể.',
      steps: [
        { order: 1, component: 'Amazon S3', action: 'Ghi bản ghi vào bucket riêng đã bật Versioning.', whyThisChoice: 'Object Lock bắt buộc phải có Versioning, và trên thực tế thi thì phải bật ngay lúc tạo bucket.' },
        { order: 2, component: 'S3 Object Lock chế độ Compliance', action: 'Đặt thời hạn giữ 7 năm.', whyThisChoice: 'Chế độ Compliance chặn xóa với mọi tài khoản kể cả root. Chế độ Governance thì người có quyền đặc biệt vẫn bỏ khóa được, nên không đạt yêu cầu đề.' },
        { order: 3, component: 'S3 Lifecycle', action: 'Chuyển thẳng sang Glacier Deep Archive sau 1 ngày.', whyThisChoice: 'Xác suất đọc gần bằng không nên chấp nhận chờ 12 giờ lúc lấy ra, đổi lấy giá rẻ nhất trong các lớp.' },
        { order: 4, component: 'AWS CloudTrail', action: 'Ghi log mọi thao tác trên bucket.', whyThisChoice: 'Thanh tra thường đòi bằng chứng ai đã chạm vào dữ liệu, không chỉ đòi bản thân dữ liệu.' },
      ],
      rejectedAlternatives: [
        { option: 'Bucket policy chặn lệnh Delete', whyRejected: 'Người có quyền sửa policy là gỡ được. Không đạt chuẩn WORM mà cơ quan quản lý yêu cầu.' },
        { option: 'Object Lock chế độ Governance', whyRejected: 'Quyền s3:BypassGovernanceRetention vẫn cho phép xóa, nên không phải bất biến thật.' },
      ],
      tradeoffs: [
        'Đã khóa Compliance thì chính bạn cũng không sửa hay xóa được cho tới khi hết hạn, kể cả khi ghi nhầm dữ liệu.',
        'Vẫn phải trả tiền lưu trữ suốt 7 năm cho cả những bản ghi vô dụng.',
      ],
    },
  ],

  deepLinks: [
    { label: 'Storage classes và tiêu chí chọn', url: 'https://docs.aws.amazon.com/AmazonS3/latest/userguide/storage-class-intro.html' },
    { label: 'Tối ưu hiệu năng theo tiền tố', url: 'https://docs.aws.amazon.com/AmazonS3/latest/userguide/optimizing-performance.html' },
    { label: 'Object Lock và mô hình WORM', url: 'https://docs.aws.amazon.com/AmazonS3/latest/userguide/object-lock.html' },
    { label: 'Bảng giá S3', url: 'https://aws.amazon.com/s3/pricing/' },
  ],
};
