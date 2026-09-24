import type { ServiceDeepDive } from '../types';

export const dynamodbDeepDive: ServiceDeepDive = {
  serviceId: 'dynamodb',
  serviceName: 'Amazon DynamoDB',
  category: 'Database',
  tier: 'core',

  whyItExists:
    'Cơ sở dữ liệu quan hệ truyền thống chỉ mở rộng theo chiều dọc (scale up); khi lượng ghi vượt trần một máy chủ hoặc chạm ngưỡng nghẽn khóa (locking contention), việc sharding thủ công trở thành ác mộng vận hành. DynamoDB sinh ra để cung cấp thông lượng ghi đọc vô hạn với độ trễ một chữ số mili giây ổn định bất kể bảng lớn 10 GB hay 100 TB, bằng kiến trúc phân vùng ngang tự động dựa trên hàm băm. Để đổi lấy sự mở rộng vô hạn đó, bạn phải đánh đổi hoàn toàn: không có câu lệnh JOIN, không có khóa ngoại, không thể tùy ý truy vấn ad-hoc theo các cột bất kỳ nếu không thiết kế index trước, và giới hạn kích thước mỗi bản ghi ở mức rất nhỏ (400 KB).',

  howItWorks: [
    {
      title: 'Băm Partition Key để định tuyến trực tiếp vào Partition vật lý',
      explanation:
        'Bảng DynamoDB được chia thành nhiều partition vật lý ngầm bên dưới (mỗi partition tối đa 10 GB lưu trữ, 1.000 WCU, 3.000 RCU). Khi ứng dụng gửi request (GetItem, PutItem), Request Router của DynamoDB băm giá trị của Partition Key bằng hàm băm nội bộ (MD5) để xác định chính xác partition vật lý nào đang giữ item đó, rồi gửi thẳng request đến máy chủ lưu trữ tương ứng. Nếu bảng có Sort Key, các item có cùng Partition Key sẽ được lưu trữ liền kề nhau trên cùng partition vật lý và sắp xếp theo thứ tự Sort Key.',
      soWhat:
        'Thời gian truy xuất item theo Partition Key luôn không đổi (O(1)) dù bảng có 1 nghìn hay 1 tỷ bản ghi. Tuy nhiên, nếu Partition Key có ít giá trị phân biệt (low cardinality) hoặc có một key nhận phần lớn lưu lượng (ví dụ ngày hiện tại, trạng thái "ACTIVE"), toàn bộ tải sẽ dồn vào đúng một partition vật lý gây ra "hot partition" và dính lỗi ProvisionedThroughputExceededException dù bảng tổng thể vẫn còn dư dung lượng và throughput.',
    },
    {
      title: 'Mô hình lưu trữ 3 AZ và cơ chế đọc nhất quán (Eventually vs Strongly Consistent)',
      explanation:
        'Mỗi partition vật lý là một nhóm replica gồm 3 node lưu trữ nằm trên 3 Availability Zone độc lập trong Region, được đồng bộ qua thuật toán đồng thuận Paxos với một node được bầu làm Leader. Khi có lệnh ghi (PutItem/UpdateItem/DeleteItem), request phải đi qua Leader và chỉ trả về mã thành công khi đa số (tối thiểu 2/3 node) đã ghi nhận vào ổ đĩa. Khi đọc (GetItem/Query), mặc định DynamoDB thực hiện Eventually Consistent Read bằng cách đọc từ một node ngẫu nhiên bất kỳ (có thể trả về dữ liệu cũ trễ dưới 1 giây). Nếu bật cờ ConsistentRead=true, request được chuyển thẳng tới node Leader hoặc node đã xác thực đồng thuận để lấy bản ghi mới nhất.',
      soWhat:
        'Đọc Eventually Consistent tốn một nửa chi phí (1 RCU cho 2 lượt đọc 4 KB) và có thông lượng gấp đôi, là lựa chọn mặc định cho hầu hết ứng dụng web. Strongly Consistent Read tốn gấp đôi RCU (1 RCU cho mỗi lượt đọc 4 KB), độ trễ cao hơn đôi chút và sẽ thất bại nếu node Leader đang trong quá trình bầu lại hoặc mạng giữa các AZ bị phân mảnh. Không bao giờ chọn Strongly Consistent khi đọc từ Global Secondary Index (GSI) vì GSI chỉ hỗ trợ Eventually Consistent.',
    },
    {
      title: 'Hai chế độ công suất: On-Demand vs Provisioned Capacity Mode',
      explanation:
        'Ở chế độ Provisioned, bạn ấn định sẵn số Read Capacity Unit (RCU) và Write Capacity Unit (WCU) cho bảng, có thể bật Auto Scaling để tự động tăng giảm theo ngưỡng sử dụng CloudWatch (phản hồi trong vài phút). Ở chế độ On-Demand (Pay-per-request), DynamoDB tự động cấp phát và thích ứng tức thì với lưu lượng truy cập lên tới gấp đôi mức đỉnh trước đó mà không cần khai báo trước, tính tiền theo từng Request Unit thực tế (RRU/WRU).',
      soWhat:
        'On-Demand là cứu cánh cho các ứng dụng có lưu lượng tăng đột biến không dự đoán trước được (flash sale, sự kiện ra mắt) hoặc bảng mới chưa rõ mẫu tải, tránh bị nghẽn (throttling). Nhưng nếu ứng dụng có lưu lượng ổn định và dự đoán được, On-Demand đắt hơn khoảng 5 đến 7 lần so với Provisioned Mode kết hợp Reserved Capacity (cam kết 1-3 năm). Bài toán chi phí luôn yêu cầu chuyển sang Provisioned khi mẫu tải đã vào quỹ đạo ổn định.',
    },
    {
      title: 'DynamoDB Streams: Change Data Capture hướng sự kiện với thứ tự nghiêm ngặt',
      explanation:
        'Khi bật Streams, mọi thao tác tạo, sửa, xóa item đều được ghi vào một log luồng tuần tự theo thời gian thực ở mức từng shard. Mỗi bản ghi trong Stream có thể chứa khóa (KEYS_ONLY), ảnh mới (NEW_IMAGE), ảnh cũ (OLD_IMAGE), hoặc cả hai (NEW_AND_OLD_IMAGES). Bản ghi được lưu trữ chính xác trong 24 giờ rồi tự động xoá. Các consumer (phổ biến nhất là AWS Lambda) đọc các shard theo đúng thứ tự xảy ra của từng item.',
      soWhat:
        'Streams là xương sống cho kiến trúc hướng sự kiện (EDA) serverless: đồng bộ dữ liệu sang Elasticsearch/OpenSearch để tìm kiếm toàn văn, phát tán thông báo qua SNS/SQS, cập nhật cache, hoặc sao chép dữ liệu liên Region trong Global Tables. Không bao giờ viết code ứng dụng vừa ghi DynamoDB vừa gọi service khác (nguy cơ lỗi dual-write); hãy ghi vào DynamoDB và để Streams kích hoạt tác vụ tiếp theo bất đồng bộ.',
    },
    {
      title: 'Secondary Indexes: Đánh đổi lưu trữ để đa dạng hóa truy vấn (LSI vs GSI)',
      explanation:
        'Bảng DynamoDB chỉ truy vấn hiệu quả theo Primary Key. Muốn truy vấn theo thuộc tính khác phải dùng Secondary Index. Local Secondary Index (LSI) dùng chung Partition Key với bảng chính nhưng đổi Sort Key, chia sẻ WCU/RCU của bảng chính và phải tạo ngay lúc tạo bảng. Global Secondary Index (GSI) cho phép định nghĩa cả Partition Key và Sort Key hoàn toàn mới, sở hữu thông lượng WCU/RCU độc lập, có thể thêm hoặc xóa bất kỳ lúc nào.',
      soWhat:
        'LSI giới hạn tổng kích thước dữ liệu của một partition key (item collection) không quá 10 GB; nếu vượt quá bảng sẽ từ chối nhận thêm dữ liệu cho key đó. GSI không có giới hạn 10 GB này, nhưng sao chép bất đồng bộ từ bảng chính. Hệ quả sống còn: nếu GSI không được cấp đủ WCU (ở chế độ Provisioned), việc sao chép bị nghẽn (backpressure) sẽ làm nghẽn luôn cả thao tác ghi trên bảng chính (GSI write throttling leads to main table throttling).',
    },
  ],

  chooseWhen: [
    {
      condition: 'Cần độ trễ đọc/ghi siêu thấp và ổn định ở mức một chữ số mili giây (single-digit millisecond) ở mọi quy mô dữ liệu',
      reason:
        'Kiến trúc phân vùng ngang tự động dựa trên băm khóa giúp DynamoDB duy trì độ trễ đọc/ghi dưới 10 ms ổn định dù bảng có dung lượng 10 GB hay 100 TB.',
    },
    {
      condition: 'Kiến trúc hoàn toàn Serverless cần cơ sở dữ liệu co giãn không giới hạn và tự động scale về 0',
      reason:
        'DynamoDB không có khái niệm máy chủ, không cần quản lý hệ điều hành, không lo connection pooling cạn kiệt khi hàng nghìn Lambda function khởi chạy đồng thời.',
    },
    {
      condition: 'Mô hình dữ liệu dạng Key-Value hoặc Document với mẫu truy cập (access pattern) đã xác định rõ từ trước',
      reason:
        'Tối ưu hoàn hảo cho các tác vụ lưu session đăng nhập, giỏ hàng thương mại điện tử, bảng xếp hạng game, hồ sơ người dùng theo ID.',
    },
    {
      condition: 'Ứng dụng phân tán đa Region cần cơ sở dữ liệu Active-Active toàn cầu với độ trễ nội địa',
      reason:
        'DynamoDB Global Tables tự động sao chép hai chiều giữa các Region với độ trễ dưới 1 giây, cho phép người dùng ở mọi châu lục đọc/ghi trực tiếp vào Region gần nhất.',
    },
    {
      condition: 'Thu thập dữ liệu cảm biến IoT, clickstream hoặc telemetry với tốc độ ghi cực lớn và tự động dọn dẹp dữ liệu cũ',
      reason:
        'Khả năng scale ghi không trần kết hợp với tính năng Time to Live (TTL) tự động xóa các bản ghi hết hạn ngầm trong nền mà hoàn toàn không tốn WCU.',
    },
  ],

  avoidWhen: [
    {
      condition: 'Ứng dụng cần thực hiện các câu lệnh SQL JOIN phức tạp giữa nhiều bảng hoặc cần truy vấn ad-hoc linh hoạt',
      reason:
        'DynamoDB không hỗ trợ JOIN; việc quét toàn bộ bảng (Scan) để lọc dữ liệu ở tầng ứng dụng cực kỳ chậm và tốn kém chi phí RCU.',
      useInstead: 'Amazon RDS hoặc Amazon Aurora cho cơ sở dữ liệu quan hệ ACID đầy đủ, hoặc Amazon Athena để truy vấn trực tiếp trên data lake S3.',
    },
    {
      condition: 'Cần tìm kiếm văn bản toàn văn (full-text search), tìm kiếm gần đúng (fuzzy search) hoặc phân tích log nâng cao',
      reason:
        'DynamoDB chỉ hỗ trợ tìm kiếm chính xác theo khóa hoặc so sánh chuỗi tiền tố đơn giản (begins_with) trên Sort Key.',
      useInstead: 'Amazon OpenSearch Service (dùng DynamoDB Streams kết hợp Lambda để tự động đồng bộ dữ liệu sang OpenSearch).',
    },
    {
      condition: 'Kích thước của từng bản ghi lớn (vượt quá vài trăm KB) như file media, PDF hoặc payload nhị phân',
      reason:
        'Giới hạn kích thước cứng của mỗi item trong DynamoDB là 400 KB, và lưu trữ dữ liệu dung lượng lớn trên SSD của DynamoDB đắt hơn nhiều so với object storage.',
      useInstead: 'Amazon S3 để lưu file thô, chỉ lưu metadata và đường dẫn S3 URL bên trong DynamoDB.',
    },
    {
      condition: 'Hệ thống phân tích dữ liệu lớn (OLAP), data warehouse chạy báo cáo tổng hợp (aggregation) trên hàng triệu dòng dữ liệu',
      reason:
        'DynamoDB thiết kế tối ưu cho xử lý giao dịch trực tuyến (OLTP). Chạy báo cáo tổng hợp trên DynamoDB sẽ tiêu tốn toàn bộ throughput RCU và rất chậm.',
      useInstead: 'Amazon Redshift cho kho dữ liệu phân tích, hoặc xuất dữ liệu DynamoDB ra S3 để phân tích bằng Amazon Athena / Amazon EMR.',
    },
    {
      condition: 'Hệ thống doanh nghiệp cũ (ERP, CRM) với hàng trăm bảng quan hệ chặt chẽ và phụ thuộc vào Stored Procedures',
      reason:
        'Chi phí viết lại toàn bộ mã nguồn ứng dụng để chuyển đổi mô hình quan hệ sang Single-Table Design của NoSQL là quá lớn và không khả thi.',
      useInstead: 'Amazon RDS (PostgreSQL/MySQL/Oracle) hoặc Amazon Aurora để tương thích nguyên vẹn cấu trúc cơ sở dữ liệu cũ.',
    },
  ],

  limits: [
    {
      name: 'Kích thước tối đa của một Item',
      value: '400 KB',
      implication:
        'Bao gồm cả tên thuộc tính (attribute name) tính bằng UTF-8 và giá trị dữ liệu. Vượt quá ngưỡng này lệnh PutItem sẽ bị từ chối với lỗi ValidationException. Giải pháp là nén dữ liệu hoặc lưu payload lớn lên S3 và chỉ giữ S3 URI trong DynamoDB.',
      adjustable: false,
    },
    {
      name: 'Giới hạn lưu trữ và thông lượng của một Partition vật lý',
      value: '10 GB dung lượng, 1.000 WCU, 3.000 RCU',
      implication:
        'Khi partition vượt quá 10 GB hoặc vượt quá thông lượng, DynamoDB sẽ tự động chia đôi partition. Tuy nhiên, nếu một Partition Key đơn lẻ nhận lưu lượng vượt 1.000 WCU hoặc 3.000 RCU, hệ thống sẽ trả về lỗi ProvisionedThroughputExceededException (hot partition).',
      adjustable: false,
    },
    {
      name: 'Dung lượng dữ liệu trả về tối đa cho một request Query hoặc Scan',
      value: '1 MB',
      implication:
        'DynamoDB dừng xử lý khi đạt 1 MB dữ liệu đọc từ ổ đĩa (trước khi lọc bằng FilterExpression) và trả về LastEvaluatedKey trong response. Ứng dụng bắt buộc phải triển khai vòng lặp phân trang (pagination) để lấy hết dữ liệu.',
      adjustable: false,
    },
    {
      name: 'Giới hạn kích thước Item Collection khi bảng có Local Secondary Index (LSI)',
      value: '10 GB cho mỗi giá trị Partition Key',
      implication:
        'Tổng kích thước của tất cả các item có cùng Partition Key trên bảng chính cộng với toàn bộ các mục tương ứng trong tất cả LSI không được vượt quá 10 GB. Nếu vượt ngưỡng, mọi thao tác ghi thêm item mới cho Partition Key đó sẽ thất bại.',
      adjustable: false,
    },
    {
      name: 'Số lượng Secondary Indexes trên mỗi bảng',
      value: 'Tối đa 5 LSI; mặc định 20 GSI',
      implication:
        'LSI chỉ có thể tạo lúc tạo bảng ban đầu, không thể thêm hoặc xóa sau này (hard limit). GSI có thể tạo hoặc xóa bất kỳ lúc nào trên bảng đang chạy, và có thể xin tăng quota GSI vượt mốc 20 qua Service Quotas.',
      adjustable: true,
    },
    {
      name: 'Giới hạn thao tác theo lô (Batch Operations)',
      value: 'BatchWriteItem tối đa 25 items (hoặc 16 MB); BatchGetItem tối đa 100 items (hoặc 16 MB)',
      implication:
        'Batch operations không đảm bảo tính nguyên tử (không phải all-or-nothing). Các item không xử lý được do thiếu capacity sẽ nằm trong UnprocessedItems hoặc UnprocessedKeys; ứng dụng bắt buộc phải tự viết mã thử lại với exponential backoff.',
      adjustable: false,
    },
    {
      name: 'Giới hạn Transaction (TransactWriteItems / TransactGetItems)',
      value: 'Tối đa 100 items (hoặc 4 MB tổng payload)',
      implication:
        'Đảm bảo tính chất ACID (All-or-Nothing) trên nhiều item và nhiều bảng khác nhau trong cùng một AWS account và Region. Tuy nhiên, mỗi thao tác transaction tiêu tốn gấp 2 lần WCU và RCU thông thường.',
      adjustable: false,
    },
  ],

  cost: {
    billingDimensions: [
      'Thông lượng ở chế độ Provisioned: tính phí theo số WCU và RCU được cấp phát mỗi giờ (1 WCU cho 1 KB ghi/giây, 1 RCU cho 4 KB đọc strongly consistent/giây), bất kể có sử dụng hay không.',
      'Thông lượng ở chế độ On-Demand: tính phí theo số Write Request Units (WRU) và Read Request Units (RRU) thực tế tiêu thụ trong tháng (1 WRU cho 1 KB ghi, 1 RRU cho 4 KB đọc strongly consistent).',
      'Dung lượng lưu trữ bảng và index: tính theo GB-tháng, phân loại theo lớp bảng DynamoDB Standard hoặc DynamoDB Standard-IA (Infrequent Access).',
      'DynamoDB Streams: tính theo số lượng request GetRecords đọc dữ liệu luồng (miễn phí khi được kích hoạt trực tiếp từ AWS Lambda).',
      'Global Tables: tính phí theo Replicated Write Units (rWCU hoặc rWRU) để nhân bản dữ liệu sang các Region đích, cộng thêm phí Data Transfer Out liên Region.',
      'Sao lưu và phục hồi: tính phí dung lượng duy trì Point-in-Time Recovery (PITR) liên tục và dung lượng lưu trữ On-Demand Backup trên S3.',
    ],
    hiddenCosts: [
      'Scan bảng kèm FilterExpression là cái bẫy hóa đơn lớn nhất: FilterExpression chỉ loại bỏ bản ghi sau khi DynamoDB đã đọc toàn bộ dữ liệu từ ổ đĩa; bạn vẫn phải trả đủ 100% RCU cho toàn bộ dung lượng đã quét qua.',
      'Hot partition làm lãng phí Provisioned Capacity: Khi bạn tăng WCU/RCU của cả bảng để gánh một partition bị nghẽn, bạn đang trả tiền nhân lên cho tất cả các partition khác dù chúng đang rảnh rỗi.',
      'Throttling từ GSI làm nghẽn bảng chính: Nếu GSI ở chế độ Provisioned không được cấp đủ WCU tương xứng với tốc độ ghi của bảng chính, DynamoDB sẽ throttle cả thao tác ghi ở bảng chính để bảo vệ GSI.',
      'Đọc Strongly Consistent và Transaction tốn gấp đôi tiền: Strongly Consistent Read tiêu tốn gấp 2 lần RCU so với Eventually Consistent Read; TransactWriteItems tốn gấp 2 lần WCU và TransactGetItems tốn gấp 2 lần RCU.',
      'Global Tables nhân đôi chi phí ghi và phát sinh phí mạng: Mỗi thao tác ghi tại Region nguồn sẽ bị tính thêm Replicated Write Units ở tất cả các Region đích kèm chi phí truyền dữ liệu liên Region.',
    ],
    optimizationLevers: [
      'Sử dụng chế độ On-Demand cho các ứng dụng mới ra mắt hoặc có lưu lượng tăng giảm đột ngột; chuyển sang Provisioned kèm Auto Scaling khi mẫu truy cập đã ổn định và đoán trước được.',
      'Mua DynamoDB Reserved Capacity cho chế độ Provisioned khi tải nền ổn định (cam kết 1 hoặc 3 năm) để tiết kiệm từ 50% đến 77% chi phí so với Provisioned thông thường.',
      'Bật DynamoDB Time to Live (TTL) để hệ thống tự động dọn dẹp các bản ghi hết hạn (session cũ, giỏ hàng tạm) ngầm trong nền mà hoàn toàn KHÔNG tiêu tốn WCU.',
      'Chuyển các bảng lưu trữ dữ liệu lịch sử ít truy cập sang lớp bảng DynamoDB Standard-IA (Infrequent Access) để giảm tới 60% chi phí lưu trữ GB-tháng.',
      'Thiết kế dữ liệu theo Single-Table Design và luôn ưu tiên dùng thao tác Query thay vì Scan; áp dụng ProjectionExpression để chỉ nhận về các thuộc tính cần thiết nhằm tiết kiệm băng thông mạng.',
    ],
  },

  security: {
    encryptionAtRest: [
      'AWS Owned Key: Mã hóa AES-256 mặc định cho mọi bảng, AWS tự quản lý khóa hoàn toàn, không tốn thêm chi phí và không bị tính vào hạn ngạch gọi KMS API.',
      'AWS Managed Key (aws/dynamodb): Khóa KMS mặc định trong tài khoản của bạn cho DynamoDB, cho phép bạn theo dõi sự kiện sử dụng khóa trong AWS CloudTrail.',
      'Customer Managed Key (CMK): Khóa do bạn tự tạo và quản lý trong AWS KMS, cho phép thiết lập chính sách xoay khóa, phân quyền chi tiết theo IAM và kiểm toán đầy đủ; phát sinh chi phí gọi KMS API khi bảng khởi tạo hoặc xoay khóa.',
    ],
    encryptionInTransit:
      'Bắt buộc sử dụng giao thức HTTPS với TLS 1.2 hoặc TLS 1.3 cho toàn bộ kết nối giữa client và DynamoDB endpoint. Mọi kết nối HTTP không mã hóa đều bị từ chối ở tầng mạng.',
    accessControl: [
      'IAM Policy: Cấp quyền chi tiết ở mức tài nguyên bảng (table-level), secondary index (index-level) hoặc luồng dữ liệu (stream-level).',
      'Fine-Grained Access Control (FGAC): Sử dụng các IAM Condition Keys như dynamodb:LeadingKeys (giới hạn user chỉ được đọc/ghi item có Partition Key khớp với Cognito Identity ID của họ) và dynamodb:Attributes (giới hạn chỉ được đọc hoặc ghi một số trường nhất định).',
      'VPC Gateway Endpoint: Cho phép các tài nguyên trong VPC (như EC2, Lambda) truy cập DynamoDB an toàn qua mạng backbone nội bộ của AWS mà không cần Internet Gateway hay NAT Gateway; hỗ trợ gán Endpoint Policy để chặn tuồn dữ liệu ra bảng ngoài tài khoản.',
    ],
    defaultPosture:
      'Mặc định đóng hoàn toàn. DynamoDB không có địa chỉ IP công khai trực tiếp và không hỗ trợ Resource Policy trực tiếp trên bảng. Mọi request gửi tới DynamoDB bắt buộc phải được xác thực và ký số bằng AWS Signature Version 4 (SigV4) thông qua IAM credential hợp lệ.',
  },

  resilience: {
    failureScope: 'Region',
    builtInHA:
      'Tính sẵn sàng cao mặc định ở cấp độ Region do AWS quản lý: Dữ liệu của từng partition được nhân bản đồng bộ sang 3 Availability Zone độc lập bằng giao thức đồng thuận Paxos. Mất hoàn toàn một AZ hệ thống vẫn duy trì đọc ghi bình thường mà không cần người dùng can thiệp hay chuyển đổi failover; SLA cam kết 99.99% cho bảng đơn Region.',
    crossRegionStory:
      'DynamoDB Global Tables cung cấp giải pháp đa Region Active-Active (Multi-Master) được quản lý hoàn toàn với SLA cam kết 99.999%. Dữ liệu ghi tại bất kỳ Region nào sẽ được tự động sao chép bất đồng bộ sang tất cả các Region còn lại dựa trên DynamoDB Streams với độ trễ thường dưới 1 giây. Xung đột ghi đồng thời được giải quyết tự động theo cơ chế Last-Writer-Wins (bản ghi có timestamp mới nhất sẽ thắng).',
    backupRestore:
      'Point-in-Time Recovery (PITR) liên tục bảo vệ bảng với RPO bằng 0, cho phép khôi phục chính xác tới từng giây trong vòng 35 ngày gần nhất mà không ảnh hưởng tới hiệu năng bảng. On-Demand Backup chụp snapshot bảng bất kỳ lúc nào để lưu trữ lâu dài trên S3 phục vụ tuân thủ quy chuẩn. Mọi thao tác khôi phục luôn tạo ra một bảng MỚI, không bao giờ ghi đè lên bảng đang hoạt động.',
  },

  contrasts: [
    {
      againstServiceId: 'rds',
      againstServiceName: 'Amazon RDS & Amazon Aurora',
      coreDifference:
        'DynamoDB là NoSQL scale ngang vô hạn theo key-value/document với độ trễ mili-giây cố định; RDS/Aurora là cơ sở dữ liệu quan hệ mạnh về JOIN, ACID phức tạp và truy vấn ad-hoc.',
      mechanismDifference:
        'DynamoDB băm partition key để rải dữ liệu ra hàng trăm server lưu trữ độc lập nên không thể thực hiện JOIN giữa các bảng hiệu quả; RDS/Aurora lưu trữ tập trung trên các instance/storage engine có khả năng tối ưu hóa các phép toán quan hệ phức tạp, khóa dòng/bảng và transaction đa bảng sâu.',
      chooseThisWhen: [
        'Workload cần thông lượng đọc/ghi khổng lồ (hàng chục đến hàng trăm nghìn ops/s) với độ trễ một chữ số mili-giây ổn định',
        'Mẫu truy cập dữ liệu đơn giản, tra cứu theo ID hoặc dải thời gian cố định',
        'Kiến trúc hoàn toàn serverless, không muốn bận tâm về quản lý instance hay connection pooling',
        'Cần active-active multi-region toàn cầu thông suốt với Global Tables',
      ],
      chooseOtherWhen: [
        'Ứng dụng cần các câu lệnh SQL JOIN phức tạp, nhóm dữ liệu GROUP BY và truy vấn phân tích ad-hoc linh hoạt',
        'Mô hình dữ liệu quan hệ chặt chẽ đòi hỏi toàn vẹn tham chiếu (foreign key constraints)',
        'Hệ thống ERP, CRM, phần mềm đóng gói sẵn (COTS) yêu cầu chuẩn giao tiếp cơ sở dữ liệu quan hệ',
      ],
      relatedComparisonId: 'rds-vs-aurora-vs-dynamodb',
    },
    {
      againstServiceId: 'elasticache',
      againstServiceName: 'Amazon ElastiCache (Redis / Memcached)',
      coreDifference:
        'DynamoDB là cơ sở dữ liệu chính lưu trên ổ đĩa SSD (kèm bộ tăng tốc DAX tích hợp sâu); ElastiCache là tầng cache hoàn toàn trên RAM độc lập.',
      mechanismDifference:
        'ElastiCache đòi hỏi ứng dụng tự viết code quản lý logic cache-aside (kiểm tra cache miss, nạp từ database, cập nhật vô hiệu hóa cache) và tự quản lý cluster; DAX (DynamoDB Accelerator) là cache write-through/read-through nằm ngay trước DynamoDB, tương thích 100% với DynamoDB API nên ứng dụng không cần sửa logic truy vấn ngoài việc đổi endpoint SDK.',
      chooseThisWhen: [
        'Dữ liệu cần lưu trữ bền vững lâu dài, không chấp nhận rủi ro mất dữ liệu khi restart',
        'Muốn tăng tốc DynamoDB lên độ trễ micro-giây mà KHÔNG muốn viết lại code xử lý cache phức tạp (dùng DAX)',
        'Hệ thống serverless không muốn duy trì quản lý hạ tầng cụm máy chủ cache',
      ],
      chooseOtherWhen: [
        'Cần các cấu trúc dữ liệu nâng cao trên RAM của Redis như Pub/Sub, Sorted Sets (ZSET), Bitmaps, Geospatial indexing',
        'Cần một tầng cache dùng chung đứng trước nhiều database khác nhau (RDS, Aurora, API bên thứ ba)',
        'Chỉ cần lưu trữ dữ liệu tạm thời (ephemeral cache) với chi phí thấp nhất trên RAM',
      ],
    },
    {
      againstServiceName: 'Amazon DocumentDB (with MongoDB compatibility)',
      coreDifference:
        'DynamoDB là NoSQL serverless thuần túy dạng key-value và document với cú pháp API riêng của AWS; DocumentDB là cơ sở dữ liệu document tương thích chuẩn MongoDB chạy trên cụm instance.',
      mechanismDifference:
        'DynamoDB tự động phân vùng và co giãn hoàn toàn theo từng request; DocumentDB sử dụng kiến trúc tách rời tính toán và lưu trữ tương tự Aurora (chạy trên các compute instance quản lý được kích thước và chia sẻ volume lưu trữ 6 bản sao across-AZ).',
      chooseThisWhen: [
        'Ứng dụng xây mới hoàn toàn trên AWS theo hướng serverless, ưu tiên tích hợp chặt chẽ với Lambda và IAM',
        'Cần khả năng tự co giãn thông lượng từ 0 lên hàng triệu request mà không cần quan tâm đến kích thước instance',
        'Cần giải pháp cơ sở dữ liệu Multi-Region Active-Active toàn cầu',
      ],
      chooseOtherWhen: [
        'Hệ thống hiện tại đang chạy MongoDB và muốn chuyển đổi lên AWS (Lift-and-Shift) mà không muốn viết lại driver hoặc câu lệnh query',
        'Cần các pipeline truy vấn tổng hợp phức tạp (aggregation pipelines) chuẩn của MongoDB',
        'Kích thước document lớn vượt quá giới hạn 400 KB của DynamoDB (DocumentDB hỗ trợ document tới 16 MB)',
      ],
    },
  ],

  examTraps: [
    {
      distractorPattern:
        'Đề bài cho kích thước item (ví dụ 6 KB) và số lượt đọc/ghi mỗi giây, đáp án tính RCU bằng cách lấy dung lượng chia thẳng mà không làm tròn lên bội số của 4 KB, hoặc quên nhân hệ số cho Strongly Consistent / Transaction.',
      whyWrong:
        'DynamoDB luôn làm tròn kích thước item lên bội số của 4 KB khi đọc và 1 KB khi ghi TRƯỚC KHI tính đơn vị. 1 RCU = 1 Strongly Consistent Read (tối đa 4 KB) hoặc 2 Eventually Consistent Reads (mỗi item tối đa 4 KB). Đọc item 6 KB sẽ tính là 8 KB -> tốn 2 RCU cho Strongly Consistent hoặc 1 RCU cho Eventually Consistent. Ghi item 1.5 KB làm tròn thành 2 KB -> tốn 2 WCU. Transaction tốn gấp đôi cả RCU và WCU.',
      correctAnswer:
        'Bước 1: Làm tròn dung lượng item lên bội số tiếp theo (4 KB cho đọc, 1 KB cho ghi). Bước 2: Chia cho 4 KB (đọc) hoặc 1 KB (ghi). Bước 3: Nhân với số thao tác/giây. Bước 4: Chia 2 nếu đọc Eventually Consistent, hoặc nhân 2 nếu dùng Transaction.',
      signalKeywords: ['tính RCU', 'tính WCU', 'strongly consistent', 'eventually consistent', 'read capacity units'],
      severity: 'high',
    },
    {
      distractorPattern:
        'Đề bài yêu cầu lấy dữ liệu theo một thuộc tính không phải khóa chính kèm yêu cầu tối ưu chi phí và hiệu năng; đáp án đề xuất chạy lệnh Scan kèm FilterExpression.',
      whyWrong:
        'FilterExpression KHÔNG làm giảm chi phí RCU. DynamoDB vẫn phải đọc toàn bộ bảng hoặc phân vùng từ đĩa vật lý (tiêu tốn RCU trên từng byte quét qua), sau đó mới áp dụng filter trên bộ nhớ để loại bỏ bản ghi trước khi trả về cho client. Scan bảng 100 GB để lấy 1 item sẽ bị tính tiền RCU của cả 100 GB.',
      correctAnswer:
        'Tạo Global Secondary Index (GSI) với thuộc tính cần tìm làm Partition Key, sau đó sử dụng thao tác Query. Thao tác Query chỉ đọc đúng item cần lấy và tiêu tốn RCU tối thiểu.',
      signalKeywords: ['Scan', 'FilterExpression', 'tối ưu chi phí đọc', 'truy vấn thuộc tính phụ'],
      severity: 'high',
    },
    {
      distractorPattern:
        'Bảng DynamoDB bị lỗi ProvisionedThroughputExceededException trong giờ cao điểm; đáp án đề xuất tăng gấp đôi tổng RCU/WCU của cả bảng hoặc tạo thêm Read Replica.',
      whyWrong:
        'DynamoDB không có khái niệm Read Replica như RDS. Nếu Partition Key có độ phân tán kém (ví dụ dùng trường Country, Status hoặc Ngày), toàn bộ request dồn vào một partition vật lý duy nhất. Một partition vật lý bị chặn cứng ở mức tối đa 1.000 WCU hoặc 3.000 RCU; việc tăng WCU/RCU của toàn bảng chỉ phân bổ thêm dung lượng cho các partition rảnh rỗi mà không giải quyết được nút thắt cổ chai ở partition nóng.',
      correctAnswer:
        'Tái thiết kế Partition Key có độ biến thiên cao (high cardinality), hoặc sử dụng kỹ thuật Write Sharding (thêm hậu tố ngẫu nhiên ngầm từ 1..N hoặc hash prefix vào Partition Key) để rải đều tải ra nhiều partition vật lý.',
      signalKeywords: ['ProvisionedThroughputExceededException', 'hot partition', 'throttling', 'write sharding', 'cardinality'],
      severity: 'high',
    },
    {
      distractorPattern:
        'Bảng chính gặp lỗi ghi chậm hoặc bị throttle dù WCU của bảng chính vẫn còn dư dả; đáp án kết luận do bảng chính bị lỗi phần cứng hoặc do DynamoDB bị quá tải.',
      whyWrong:
        'Khi bảng chính có Global Secondary Index (GSI) ở chế độ Provisioned, nếu WCU của GSI được cấu hình quá thấp so với WCU của bảng chính, quá trình sao chép bất đồng bộ sang GSI sẽ bị dồn ứ (backpressure). Để bảo vệ tính toàn vẹn, DynamoDB sẽ tự động throttle luôn các thao tác ghi trên BẢNG CHÍNH.',
      correctAnswer:
        'Luôn đảm bảo WCU được cấp phát cho GSI bằng hoặc lớn hơn WCU của bảng chính, hoặc bật Auto Scaling cho cả GSI lẫn bảng chính; hoặc chuyển bảng sang chế độ On-Demand.',
      signalKeywords: ['GSI throttling', 'bảng chính bị throttle', 'thông lượng GSI', 'backpressure'],
      severity: 'high',
    },
    {
      distractorPattern:
        'Đề bài yêu cầu giảm thời gian phản hồi của ứng dụng đọc DynamoDB từ mili-giây xuống micro-giây mà KHÔNG muốn viết lại logic ứng dụng hoặc muốn công sức triển khai tối thiểu; đáp án đưa ra Amazon ElastiCache Redis.',
      whyWrong:
        'Tích hợp ElastiCache Redis đòi hỏi phải viết lại tầng dữ liệu của ứng dụng theo mô hình cache-aside (tự kiểm tra key trong Redis, nếu miss thì gọi DynamoDB, rồi ghi ngược vào Redis). Đây là giải pháp đòi hỏi sửa code đáng kể.',
      correctAnswer:
        'Chọn Amazon DynamoDB Accelerator (DAX). DAX là cụm in-memory cache tương thích 100% với DynamoDB API ở mức giao thức; lập trình viên chỉ cần trỏ DynamoDB SDK client sang DAX endpoint mà không phải thay đổi bất kỳ dòng code truy vấn nào.',
      signalKeywords: ['microsecond latency', 'không sửa code', 'minimal application changes', 'DAX vs ElastiCache'],
      severity: 'high',
    },
    {
      distractorPattern:
        'Đề bài yêu cầu dọn dẹp các session hết hạn để tiết kiệm chi phí; đáp án đề xuất viết hàm Lambda chạy định kỳ mỗi giờ để Scan bảng và chạy DeleteItem cho các item quá hạn.',
      whyWrong:
        'Lambda chạy Scan định kỳ tiêu tốn lượng lớn RCU và WCU, vừa tốn tiền Lambda vừa có nguy cơ làm throttle bảng. DynamoDB có sẵn tính năng TTL hoàn toàn miễn phí.',
      correctAnswer:
        'Bật DynamoDB TTL trên thuộc tính chứa timestamp Unix epoch (tính bằng giây). DynamoDB sẽ tự động xóa các item hết hạn trong vòng 48 giờ trên tiến trình ngầm của hệ thống mà hoàn toàn KHÔNG tiêu tốn WCU.',
      signalKeywords: ['xóa dữ liệu hết hạn', 'session expiration', 'không tốn WCU', 'TTL', 'tự động dọn dẹp'],
      severity: 'medium',
    },
    {
      distractorPattern:
        'Bảng đã chạy production cần thêm một cách sắp xếp dữ liệu mới; đáp án đề xuất tạo thêm một Local Secondary Index (LSI).',
      whyWrong:
        'Local Secondary Index (LSI) CHỈ CÓ THỂ được tạo tại thời điểm tạo bảng ban đầu; một khi bảng đã tạo xong thì không bao giờ thêm, sửa hoặc xóa LSI được nữa. Ngoài ra LSI còn áp đặt giới hạn 10 GB cho mỗi item collection.',
      correctAnswer:
        'Tạo Global Secondary Index (GSI). GSI có thể được tạo, chỉnh sửa hoặc xóa bỏ tại bất kỳ thời điểm nào trên một bảng đang hoạt động mà không gây gián đoạn dịch vụ.',
      signalKeywords: ['thêm index vào bảng có sẵn', 'modify existing table', 'LSI vs GSI', 'item collection limit'],
      severity: 'medium',
    },
  ],

  integrationNotes: [
    {
      withServiceId: 'lambda',
      withServiceName: 'AWS Lambda',
      relationship:
        'DynamoDB Streams kích hoạt trực tiếp AWS Lambda qua cơ chế Event Source Mapping để xử lý Change Data Capture (CDC), tự động scale theo số shard và đảm bảo thứ tự xử lý trên từng item.',
    },
    {
      withServiceId: 'dax',
      withServiceName: 'Amazon DynamoDB Accelerator (DAX)',
      relationship:
        'Cung cấp cụm in-memory cache tương thích 100% với giao diện API của DynamoDB, giảm độ trễ đọc lặp lại từ mili-giây xuống micro-giây mà không cần thay đổi logic ứng dụng.',
    },
    {
      withServiceId: 'api-gateway',
      withServiceName: 'Amazon API Gateway',
      relationship:
        'API Gateway có thể tích hợp trực tiếp (Service Integration) với DynamoDB thông qua VTL mapping template để thực hiện PutItem/GetItem mà không cần chạy Lambda trung gian, tối ưu hóa độ trễ và chi phí.',
    },
    {
      withServiceId: 'cognito',
      withServiceName: 'Amazon Cognito',
      relationship:
        'Cognito Identity Pool kết hợp với Fine-Grained Access Control (FGAC) sử dụng condition key dynamodb:LeadingKeys cho phép ứng dụng mobile/web client truy cập trực tiếp các item của chính mình một cách an toàn.',
    },
    {
      withServiceId: 'kinesis',
      withServiceName: 'Amazon Kinesis Data Streams',
      relationship:
        'Kinesis Data Streams for DynamoDB cho phép stream toàn bộ sự kiện thay đổi dữ liệu của bảng vào Kinesis Data Streams để lưu trữ dài hạn (tới 365 ngày) hoặc phân tích thời gian thực với Kinesis Data Analytics, khắc phục giới hạn lưu 24 giờ của DynamoDB Streams.',
    },
    {
      withServiceId: 'opensearch',
      withServiceName: 'Amazon OpenSearch Service',
      relationship:
        'Nhận dữ liệu đồng bộ từ DynamoDB Streams thông qua Lambda hoặc OpenSearch Ingestion để cung cấp khả năng tìm kiếm toàn văn (full-text search), tìm kiếm gần đúng (fuzzy search) và phân tích log mà DynamoDB không hỗ trợ.',
    },
    {
      withServiceId: 's3',
      withServiceName: 'Amazon S3',
      relationship:
        'Tính năng Export Table to S3 cho phép xuất toàn bộ bảng ra file JSON/Ion lưu trên S3 mà không tiêu tốn RCU hay ảnh hưởng hiệu năng bảng; Import Table from S3 cho phép nạp lượng lớn dữ liệu vào bảng mới với chi phí tối ưu.',
    },
  ],

  architectures: [
    {
      id: 'dynamodb-global-gaming-leaderboard',
      title: 'Hệ thống bảng xếp hạng và hồ sơ game thủ toàn cầu độ trễ cực thấp',
      scenario:
        'Một tựa game di động nhiều người chơi phát hành toàn cầu tại Bắc Mỹ, Châu Âu và Đông Á. Yêu cầu: Game thủ truy cập hồ sơ và bảng xếp hạng với độ trễ dưới 5 ms tại mọi khu vực, ghi điểm số tức thì không bị khóa bảng, chịu được đột biến khi ra mắt tính năng mới, và khôi phục thảm họa tự động nếu một Region gặp sự cố.',
      steps: [
        {
          order: 1,
          component: 'Amazon Route 53',
          action: 'Sử dụng Latency-based routing để định tuyến người chơi đến API Gateway và Region AWS có độ trễ mạng thấp nhất.',
          whyThisChoice: 'Tối ưu hóa độ trễ vòng mạng (round-trip time) cho game thủ ở các vị trí địa lý khác nhau trên thế giới.',
        },
        {
          order: 2,
          component: 'Amazon API Gateway & AWS Lambda',
          action: 'Tiếp nhận request, xác thực token qua Amazon Cognito và gọi dữ liệu mà không cần duy trì cụm máy chủ backend.',
          whyThisChoice: 'Tự động co giãn theo số lượng người chơi đồng thời, không tốn chi phí máy chủ rảnh rỗi khi ngoài giờ cao điểm.',
        },
        {
          order: 3,
          component: 'Amazon DynamoDB Accelerator (DAX)',
          action: 'Đặt cụm DAX trước DynamoDB tại mỗi Region để cache điểm số bảng xếp hạng top 100 và dữ liệu hồ sơ tĩnh của game thủ.',
          whyThisChoice: 'Giảm độ trễ đọc từ mili-giây xuống micro-giây và giảm áp lực tiêu thụ RCU lên bảng DynamoDB bên dưới cho các mục đọc lặp lại nhiều lần.',
        },
        {
          order: 4,
          component: 'Amazon DynamoDB Global Tables',
          action: 'Bảng chính được triển khai dưới dạng Global Table nhân bản qua 3 Region (us-east-1, eu-west-1, ap-northeast-1) ở chế độ On-Demand, tự động đồng bộ hai chiều bất đồng bộ qua Streams.',
          whyThisChoice: 'Cung cấp cơ sở dữ liệu Multi-Region Active-Active; game thủ ghi điểm trực tiếp vào Region gần nhất và dữ liệu tự động đồng bộ toàn cầu với SLA 99.999%.',
        },
        {
          order: 5,
          component: 'DynamoDB Streams & AWS Lambda',
          action: 'Kích hoạt hàm Lambda khi có sự kiện ghi điểm số kỷ lục mới để gửi push notification qua Amazon SNS tới bạn bè của game thủ.',
          whyThisChoice: 'Tách rời tác vụ thông báo bất đồng bộ khỏi luồng ghi điểm chính, đảm bảo giao dịch ghi điểm luôn hoàn tất nhanh nhất có thể.',
        },
      ],
      rejectedAlternatives: [
        {
          option: 'Amazon RDS MySQL Multi-AZ kèm Cross-Region Read Replica',
          whyRejected:
            'Chỉ hỗ trợ ghi vào một Region chính duy nhất (Single-Master), game thủ ở các châu lục khác sẽ chịu độ trễ mạng hàng trăm mili-giây khi ghi điểm; quy trình failover liên Region cũng phải can thiệp thủ công.',
        },
        {
          option: 'Tự dựng cụm Redis Cluster trên EC2 đa Region',
          whyRejected:
            'Đòi hỏi chi phí vận hành hạ tầng rất lớn, và việc đồng bộ hai chiều active-active giữa các cụm Redis ở 3 châu lục cực kỳ phức tạp, dễ phát sinh lỗi phân mảnh não (split-brain).',
        },
      ],
      tradeoffs: [
        'Cơ chế giải quyết xung đột Last-Writer-Wins của Global Tables dựa vào timestamp; nếu hai thiết bị ghi đồng thời vào cùng một thuộc tính thì bản ghi đến sau sẽ ghi đè bản ghi đến trước.',
        'Chi phí Replicated Write Units nhân lên theo số lượng Region tham gia Global Tables, cần giám sát để tránh bùng nổ chi phí khi tần suất ghi quá cao.',
      ],
    },
    {
      id: 'dynamodb-serverless-order-processing',
      title: 'Xử lý đơn hàng thương mại điện tử kiến trúc Serverless hướng sự kiện',
      scenario:
        'Nền tảng thương mại điện tử cần hệ thống quản lý giỏ hàng và xử lý đơn hàng chịu tải các đợt Flash Sale. Yêu cầu: Giỏ hàng tạm tự động hủy sau 7 ngày nếu không thanh toán mà không tốn chi phí quét bảng; khi thanh toán thành công phải đảm bảo trừ tiền và trừ kho nguyên tử (All-or-Nothing); thông báo thay đổi trạng thái đơn hàng tới các hệ thống vận chuyển mà không làm nghẽn luồng mua sắm chính.',
      steps: [
        {
          order: 1,
          component: 'Amazon DynamoDB Single-Table Design',
          action: 'Bảng đơn duy nhất chứa cả Customer, Cart, Order, và OrderItem sử dụng Partition Key (PK) và Sort Key (SK) kết hợp GSI để truy vấn nhanh toàn bộ dữ liệu liên quan trong một request.',
          whyThisChoice: 'Tránh hoàn toàn các phép toán JOIN tốn kém, cho phép lấy toàn bộ chi tiết đơn hàng và thông tin khách hàng chỉ bằng một lệnh Query duy nhất.',
        },
        {
          order: 2,
          component: 'DynamoDB Time to Live (TTL)',
          action: 'Gán thuộc tính expire_at (dạng Unix epoch timestamp tính bằng giây) cho các bản ghi giỏ hàng tạm thời; DynamoDB tự động thu hồi tài nguyên sau 7 ngày.',
          whyThisChoice: 'Dọn dẹp hàng triệu bản ghi rác hoàn toàn tự động trong tiến trình ngầm của AWS mà không tiêu tốn bất kỳ WCU nào và không cần viết cronjob.',
        },
        {
          order: 3,
          component: 'DynamoDB Transactions (TransactWriteItems)',
          action: 'Thực hiện trừ số dư tài khoản khách hàng, trừ số lượng tồn kho sản phẩm và tạo bản ghi Order mới trong một transaction nguyên tử duy nhất (ACID).',
          whyThisChoice: 'Đảm bảo nguyên tắc All-or-Nothing: nếu số lượng tồn kho không đủ hoặc tài khoản không đủ tiền, toàn bộ transaction tự động rollback, ngăn ngừa hoàn toàn tình trạng bán vượt số lượng tồn (overselling).',
        },
        {
          order: 4,
          component: 'DynamoDB Streams',
          action: 'Bắt trọn vẹn bản ghi trạng thái đơn hàng vừa chuyển sang PAID bằng stream view NEW_AND_OLD_IMAGES.',
          whyThisChoice: 'Cung cấp luồng Change Data Capture (CDC) đáng tin cậy theo thứ tự nghiêm ngặt mà không gây ảnh hưởng tới hiệu năng của bảng chính.',
        },
        {
          order: 5,
          component: 'AWS Lambda & Amazon EventBridge',
          action: 'Lambda đọc DynamoDB Stream và đẩy sự kiện OrderPlaced lên Amazon EventBridge Event Bus để phân phối tới các downstream service độc lập (in hóa đơn, đóng gói hàng, gửi email).',
          whyThisChoice: 'Kiến trúc giải trừ ghép nối (decoupling) hoàn toàn: sự chậm trễ hoặc sự cố ở dịch vụ gửi email/in hóa đơn không bao giờ làm gián đoạn luồng đặt hàng của khách hàng.',
        },
      ],
      rejectedAlternatives: [
        {
          option: 'Dùng Cronjob chạy Lambda định kỳ Scan bảng để tìm và xóa giỏ hàng cũ',
          whyRejected:
            'Gây tiêu tốn lượng lớn RCU và chi phí Lambda khi bảng phình to hàng triệu bản ghi, đồng thời có thể gây nghẽn băng thông của bảng chính trong giờ cao điểm.',
        },
        {
          option: 'Gọi trực tiếp API của bên vận chuyển và kho ngay trong luồng thanh toán API Gateway',
          whyRejected:
            'Khiến thời gian phản hồi của request thanh toán bị kéo dài, và nếu hệ thống bên thứ ba gặp sự cố sẽ làm thất bại cả giao dịch mua sắm của người dùng.',
        },
      ],
      tradeoffs: [
        'Thao tác Transaction (TransactWriteItems) tiêu tốn gấp 2 lần WCU so với lệnh PutItem thông thường, làm tăng chi phí ghi trong các đợt flash sale.',
        'DynamoDB TTL không đảm bảo xóa chính xác tại đúng giây hết hạn mà có độ trễ bất đồng bộ lên tới 48 giờ; ứng dụng cần tự kiểm tra thêm điều kiện timestamp ở tầng truy vấn nếu đòi hỏi tính thời gian thực tuyệt đối.',
      ],
    },
  ],

  deepLinks: [
    {
      label: 'Mô hình dữ liệu và các khái niệm cốt lõi DynamoDB',
      url: 'https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/HowItWorks.CoreComponents.html',
    },
    {
      label: 'Chế độ công suất On-Demand và Provisioned',
      url: 'https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/HowItWorks.ReadWriteCapacityMode.html',
    },
    {
      label: 'Thực hành tối ưu thiết kế Partition Key',
      url: 'https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/bp-partition-key-design.html',
    },
    {
      label: 'Hướng dẫn cấu hình và vận hành Global Tables',
      url: 'https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/GlobalTables.html',
    },
  ],
};
