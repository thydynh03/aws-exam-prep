import type { Question, OptionExplanation } from './types';
import { detectQuestionClues } from './questionClues';
import { getCuratedExplanation } from './curatedExplanations';

interface RuleMatch {
  matchFn: (qText: string, choiceText: string, q: Question) => boolean;
  violationType: string;
  shortReasonVi: string;
  detailedReasonVi: (q: Question, choiceText: string, key: string) => string;
  contrastWithCorrectVi?: (q: Question) => string;
}

// Comprehensive AWS Architectural Traps and Anti-Pattern Rules
const DISTRACTOR_RULES: RuleMatch[] = [
  // 1. Snowball Edge used for daily / real-time / high-speed transfers
  {
    matchFn: (qText, cText) =>
      /\bsnowball\b/i.test(cText) &&
      (/\bdaily\b/i.test(cText) || /\bevery day\b/i.test(cText) || /\bquickly\b/i.test(qText) || /\bhigh-speed\b/i.test(qText)),
    violationType: 'Độ trễ vật lý & Vận hành bất khả thi',
    shortReasonVi: 'AWS Snowball là thiết bị di chuyển dữ liệu offline theo đợt hàng chục TB/PB, không thể lập lịch gửi thiết bị hàng ngày.',
    detailedReasonVi: (_q, _cText, key) =>
      `Phương án ${key} sai vì AWS Snowball Edge là thiết bị phần cứng vật lý được vận chuyển bằng dịch vụ bưu chính/chuyển phát nhanh (mất từ 3 đến 5 ngày cho mỗi lượt gửi nhận). Việc lập lịch thiết bị Snowball hàng ngày ('daily') cho dung lượng 500 GB trong khi chi nhánh đã có kết nối Internet tốc độ cao ('high-speed Internet') là bất khả thi trong thực tế, tốn kém chi phí logistics cực lớn, gây độ trễ vận chuyển nghiêm trọng và vi phạm trực tiếp yêu cầu 'as quickly as possible' cùng 'minimize operational complexity'.`,
    contrastWithCorrectVi: (q) =>
      `Phương án đúng (${q.answer}) sử dụng Amazon S3 Transfer Acceleration upload trực tiếp qua Internet vào S3 tận dụng hơn 400 điểm biên (Edge Locations) toàn cầu của AWS mà không cần quản lý thiết bị phần cứng.`,
  },

  // 2. Self-managed EC2 + EBS + Snapshots to transfer / aggregate files into S3
  {
    matchFn: (_qText, cText) =>
      /\bec2\b/i.test(cText) && /\bebs\b/i.test(cText) && (/\bsnapshot\b/i.test(cText) || /\brestore\b/i.test(cText)),
    violationType: 'Độ phức tạp vận hành cực cao (Anti-pattern)',
    shortReasonVi: 'Tự triển khai máy chủ EC2, gắn ổ EBS rồi snapshot xuyên vùng để trung chuyển vào S3 gây tốn công vận hành và độ trễ lớn.',
    detailedReasonVi: (_q, _cText, key) =>
      `Phương án ${key} sai vì đây là một anti-pattern nặng nề: tự duy trì các máy chủ EC2 trung gian ở từng Region, gắn ổ đĩa EBS, lập lịch chụp snapshot định kỳ rồi sao chép snapshot xuyên vùng và restore volume trước khi đưa vào S3. Quy trình này đòi hỏi phải tự cấu hình hạ tầng, viết script tự động hóa, theo dõi máy chủ và xử lý sự cố thủ công, tạo ra gánh nặng vận hành khổng lồ ('massive operational overhead') và độ trễ rất cao, đi ngược lại tiêu chí 'minimize operational complexity'.`,
    contrastWithCorrectVi: (q) =>
      `Phương án đúng (${q.answer}) sử dụng tính năng serverless có sẵn của Amazon S3 để truyền tải dữ liệu thẳng vào bucket mà không cần khởi tạo hay quản trị bất kỳ máy chủ EC2 nào.`,
  },

  // 3. Redundant intermediate S3 buckets + Cross-Region Replication (CRR) + delete original
  {
    matchFn: (_qText, cText) =>
      /\bclosest region\b/i.test(cText) && /\bcross-region replication\b/i.test(cText) && (/\bremove\b/i.test(cText) || /\bdelete\b/i.test(cText)),
    violationType: 'Quy trình trung gian dư thừa & Tăng chi phí',
    shortReasonVi: 'Tạo bucket S3 tạm ở từng Region rồi replicate sang bucket đích làm tăng chi phí truyền dữ liệu và công quản lý xóa file.',
    detailedReasonVi: (_q, _cText, key) =>
      `Phương án ${key} sai vì việc tải dữ liệu lên bucket S3 tại từng Region gần nhất rồi cấu hình Cross-Region Replication (CRR) sang bucket trung tâm, sau đó phải lập lịch xóa dữ liệu ở bucket gốc tạo ra quy trình trung gian nhiều bước phức tạp. Bạn sẽ phải quản lý nhiều bucket S3, chịu phí truyền dữ liệu liên vùng (CRR transfer fee) và tốn tài nguyên quản lý vòng đời dữ liệu, trong khi chỉ cần upload thẳng vào một bucket S3 duy nhất qua mạng phân phối biên.`,
    contrastWithCorrectVi: (q) =>
      `Phương án đúng (${q.answer}) cho phép các điểm chi nhánh trên toàn cầu đẩy trực tiếp dữ liệu vào duy nhất một bucket đích thông qua S3 Transfer Acceleration, loại bỏ hoàn toàn các bucket trung gian.`,
  },

  // 4. SQS Standard queue when strict ordering (FIFO) is required
  {
    matchFn: (qText, cText) =>
      (/\border that they are received\b/i.test(qText) || /\bordering\b/i.test(qText) || /\bfifo\b/i.test(qText) || /\bsequence\b/i.test(qText)) &&
      /\bsqs\b/i.test(cText) &&
      (/\bstandard\b/i.test(cText) || !/\bfifo\b/i.test(cText)),
    violationType: 'Không bảo toàn thứ tự & Trùng lặp thông điệp',
    shortReasonVi: 'Amazon SQS Standard queue chỉ sắp xếp theo nỗ lực tối đa (best-effort), không đảm bảo xử lý đơn hàng theo đúng thứ tự đến.',
    detailedReasonVi: (_q, _cText, key) =>
      `Phương án ${key} sai vì Amazon SQS Standard queue (hàng đợi tiêu chuẩn) hoạt động theo cơ chế 'best-effort ordering' và 'at-least-once delivery'. Điều này đồng nghĩa thông điệp có thể bị đảo lộn thứ tự khi đến consumer hoặc có thể bị gửi trùng lặp. Đề bài yêu cầu rõ ràng các đơn hàng phải được xử lý chính xác theo đúng thứ tự đã nhận ('processed in the order that they are received'), do đó bắt buộc phải sử dụng SQS FIFO queue.`,
    contrastWithCorrectVi: (q) =>
      `Phương án đúng (${q.answer}) sử dụng SQS FIFO queue đảm bảo thứ tự First-In, First-Out tuyệt đối và cơ chế deduplication ngăn chặn trùng lặp thông điệp.`,
  },

  // 5. Amazon SNS standard used when persistent queue buffering or FIFO is required
  {
    matchFn: (qText, cText) =>
      (/\border\b/i.test(qText) || /\bqueue\b/i.test(qText) || /\bbuffer\b/i.test(qText)) &&
      /\bsns\b/i.test(cText) &&
      !/\bsqs\b/i.test(cText),
    violationType: 'Sai mô hình hàng đợi đệm (Pub/Sub thay vì Queue)',
    shortReasonVi: 'Amazon SNS là dịch vụ Pub/Sub phát tán thông báo, không có cơ chế lưu trữ đệm (buffering) và không đảm bảo thứ tự tiếp nhận.',
    detailedReasonVi: (_q, _cText, key) =>
      `Phương án ${key} sai vì Amazon SNS là dịch vụ Publish/Subscribe hoạt động theo cơ chế đẩy thông báo tức thì (push-based fanout). SNS tiêu chuẩn không cung cấp hàng đợi lưu trữ đệm (buffer) để các worker pull tin nhắn về xử lý tuần tự theo khả năng, đồng thời không đảm bảo thứ tự nghiêm ngặt của các đơn hàng. Khi có đột biến lưu lượng (traffic spike), việc SNS đẩy trực tiếp sang Lambda có thể gây quá tải downstream hoặc làm sai lệch trình tự xử lý.`,
    contrastWithCorrectVi: (q) =>
      `Phương án đúng (${q.answer}) kết hợp API Gateway trực tiếp với hàng đợi Amazon SQS để đệm tin cậy và kiểm soát tốc độ xử lý.`,
  },

  // 6. API Gateway Authorizer misused to serialize or block orders
  {
    matchFn: (_qText, cText) =>
      /\bauthorizer\b/i.test(cText) && (/\bblock\b/i.test(cText) || /\bqueue\b/i.test(cText)),
    violationType: 'Lạm dụng sai mục đích dịch vụ (Anti-pattern nghiêm trọng)',
    shortReasonVi: 'Authorizer chỉ dùng để xác thực và phân quyền (AuthN/AuthZ), không dùng để điều phối luồng hay chặn request.',
    detailedReasonVi: (_q, _cText, key) =>
      `Phương án ${key} sai vì API Gateway Lambda/Cognito Authorizer chỉ có một nhiệm vụ duy nhất là xác thực danh tính (Authentication) và kiểm tra quyền truy cập (Authorization) của người dùng trước khi chuyển tiếp request vào backend. Dùng authorizer để chặn mọi request trong khi đang xử lý một đơn hàng sẽ biến API thành nút thắt cổ chai đơn điểm (blocking bottleneck), từ chối tất cả yêu cầu của các khách hàng khác và phá hủy tính mở rộng của ứng dụng phân tán.`,
  },

  // 7. Manual updates / manual certificate configuration when automation is required
  {
    matchFn: (qText, cText) =>
      (/\bmanually\b/i.test(cText) || /\bmanual\b/i.test(cText)) &&
      (/\bleast operational overhead\b/i.test(qText) || /\bminimize operational\b/i.test(qText) || /\bautomated\b/i.test(qText)),
    violationType: 'Thao tác thủ công vi phạm yêu cầu tự động hóa',
    shortReasonVi: 'Cập nhật hoặc quản trị thủ công đòi hỏi nhân lực, dễ xảy ra sai sót và vi phạm tiêu chí giảm thiểu công vận hành.',
    detailedReasonVi: (_q, _cText, key) =>
      `Phương án ${key} sai vì việc cập nhật chứng chỉ hoặc tài nguyên thủ công ('Manually update') đòi hỏi sự can thiệp liên tục của kỹ sư vận hành, dễ dẫn đến quên gia hạn chứng chỉ gây gián đoạn dịch vụ hệ thống (outage) và vi phạm trực tiếp tiêu chí 'LEAST operational overhead'. Các kiến trúc hiện đại trên AWS luôn ưu tiên các giải pháp tự động xoay khóa/chứng chỉ (như AWS KMS, AWS Certificate Manager, hoặc Secrets Manager auto-rotation).`,
  },

  // 8. Custom cryptography in Python Lambda instead of AWS KMS
  {
    matchFn: (_qText, cText) =>
      (/\bpython cryptography\b/i.test(cText) || /\bcustom encryption\b/i.test(cText) || /\bcustom code\b/i.test(cText)) &&
      /\blambda\b/i.test(cText),
    violationType: 'Tự phát triển mã hóa thủ công thay vì dùng dịch vụ chuẩn',
    shortReasonVi: 'Tự viết mã mã hóa bằng thư viện Python gây gánh nặng bảo trì khóa và không đạt chuẩn FIPS như AWS KMS.',
    detailedReasonVi: (_q, _cText, key) =>
      `Phương án ${key} sai vì việc tự viết code trong AWS Lambda bằng thư viện ngoài như Python cryptography để mã hóa dữ liệu buộc đội ngũ kỹ thuật phải tự quản lý khóa chủ, tự lo lắng về rò rỉ bộ nhớ, không có tích hợp kiểm toán nhật ký với CloudTrail và không đạt các chứng chỉ an toàn phần cứng như FIPS 140-2. AWS cung cấp AWS KMS (Key Management Service) chuyên dụng để giải quyết việc mã hóa/giải mã chỉ bằng một lệnh gọi API bảo mật cao và hoàn toàn không tốn công vận hành hạ tầng.`,
  },

  // 9. Storing high-availability data on EBS instead of S3
  {
    matchFn: (qText, cText) =>
      (/\bhighly available\b/i.test(qText) || /\bhigh availability\b/i.test(qText)) &&
      /\bebs\b/i.test(cText) &&
      (/\bstore.*data\b/i.test(cText) || /\bvolume\b/i.test(cText)),
    violationType: 'Giới hạn phạm vi lưu trữ Single-AZ',
    shortReasonVi: 'Amazon EBS chỉ gắn vào 1 EC2 trong 1 AZ duy nhất, không đạt tính sẵn sàng cao (Multi-AZ) tự nhiên như Amazon S3.',
    detailedReasonVi: (_q, _cText, key) =>
      `Phương án ${key} sai vì Amazon Elastic Block Store (EBS) là khối lưu trữ gắn liền với một Availability Zone duy nhất. Nếu AZ đó gặp sự cố về điện hoặc mạng, dữ liệu trên ổ EBS sẽ không thể truy cập được cho đến khi AZ phục hồi. Ngược lại, đề bài yêu cầu 'highly available storage', Amazon S3 tự động sao lưu dữ liệu phân tán trên tối thiểu 3 Availability Zones với độ bền 99.999999999% (11 9s) và độ sẵn sàng cực cao mà không cần gắn vào EC2.`,
  },

  // 10. Tape Gateway used for low-latency block/file access
  {
    matchFn: (qText, cText) =>
      /\btape gateway\b/i.test(cText) && (/\blow latency\b/i.test(qText) || /\bblock storage\b/i.test(qText) || /\bactive\b/i.test(qText)),
    violationType: 'Sai chủng loại dịch vụ lưu trữ (Băng từ sao lưu thay vì Block)',
    shortReasonVi: 'Tape Gateway chỉ dùng cho sao lưu băng từ ảo (VTL) dài hạn, không thể dùng làm ổ đĩa block cho ứng dụng đọc ghi độ trễ thấp.',
    detailedReasonVi: (_q, _cText, key) =>
      `Phương án ${key} sai vì AWS Storage Gateway Tape Gateway (Virtual Tape Library) được thiết kế chuyên biệt để thay thế các băng từ vật lý dùng cho sao lưu lưu trữ định kỳ (backup and archival). Nó không hỗ trợ giao thức gắn ổ đĩa block storage (iSCSI volumes) cho các ứng dụng chạy thường trực cần truy xuất dữ liệu với độ trễ thấp ('low latency').`,
  },

  // 11. Stored Volumes instead of Cached Volumes when on-prem storage is constrained
  {
    matchFn: (qText, cText) =>
      /\bstored volumes\b/i.test(cText) && (/\blimited space\b/i.test(qText) || /\badditional data\b/i.test(qText) || /\bcapacity\b/i.test(qText)),
    violationType: 'Không giải quyết được bài toán thiếu hụt dung lượng on-premises',
    shortReasonVi: 'Stored Volumes lưu toàn bộ dữ liệu gốc tại on-premises nên không thể khắc phục tình trạng thiếu dung lượng ổ đĩa tại chỗ.',
    detailedReasonVi: (_q, _cText, key) =>
      `Phương án ${key} sai vì Volume Gateway Stored Volumes lưu trữ 100% dữ liệu gốc tại hệ thống lưu trữ tại chỗ (on-premises) và chỉ sao lưu snapshot bất đồng bộ lên Amazon S3. Do công ty đang gặp vấn đề 'limited space for additional data' (hết chỗ chứa ổ cứng), việc dùng Stored Volumes không giải quyết được bài toán vì vẫn đòi hỏi dung lượng phần cứng lớn tại chỗ. Trong khi đó, Cached Volumes lưu trữ toàn bộ dữ liệu chính trên S3 và chỉ lưu đệm phần dữ liệu hay dùng tại on-prem.`,
  },

  // 12. S3 File Gateway when block storage (iSCSI) is required
  {
    matchFn: (qText, cText) =>
      /\bfile gateway\b/i.test(cText) && /\bblock storage\b/i.test(qText),
    violationType: 'Sai giao thức truy xuất lưu trữ (File share NFS/SMB thay vì Block iSCSI)',
    shortReasonVi: 'S3 File Gateway cung cấp giao thức tập tin NFS/SMB, không tương thích với hệ thống block storage iSCSI hiện tại.',
    detailedReasonVi: (_q, _cText, key) =>
      `Phương án ${key} sai vì Amazon S3 File Gateway cung cấp giao thức chia sẻ file theo chuẩn NFS hoặc SMB, trong khi hệ thống của công ty đang chạy trên nền tảng lưu trữ dạng khối (block storage). Ứng dụng không thể kết nối trực tiếp vào giao thức file share này mà cần giao thức iSCSI chuẩn khối của Volume Gateway.`,
  },

  // 13. Auto Scaling based on CPU metric when queue length (SQS depth) is the bottleneck
  {
    matchFn: (qText, cText) =>
      /\bsqs\b/i.test(qText) && /\bautoscale|auto scaling\b/i.test(qText + cText) && /\bcpuutilization\b/i.test(cText),
    violationType: 'Sai chỉ số kích hoạt mở rộng (Metric mismatch)',
    shortReasonVi: 'Với worker xử lý hàng đợi SQS, cần mở rộng theo số lượng tin nhắn trong queue (Queue Depth), không phải CPU.',
    detailedReasonVi: (_q, _cText, key) =>
      `Phương án ${key} sai vì khi các EC2 instances làm nhiệm vụ đọc và xử lý tin nhắn từ hàng đợi SQS, mức sử dụng CPU có thể vẫn thấp (do luồng xử lý bị nghẽn mạng, chờ I/O hoặc chờ cơ sở dữ liệu), trong khi số lượng tin nhắn tồn đọng trong queue đang tăng vọt. Kích hoạt Auto Scaling dựa trên CPUUtilization sẽ không phản ánh đúng tải công việc thực tế. Chuẩn thiết kế của AWS yêu cầu scale dựa trên chỉ số số lượng thông điệp sẵn sàng xử lý trong hàng đợi ('ApproximateNumberOfMessagesVisible').`,
    contrastWithCorrectVi: (q) =>
      `Phương án đúng (${q.answer}) cấu hình Auto Scaling dựa trực tiếp trên số lượng thông điệp trong hàng đợi SQS, giúp hệ thống phản hồi tức thì khi có biến động tải.`,
  },

  // 14. Creating new Auto Scaling groups on demand via SNS
  {
    matchFn: (_qText, cText) =>
      /\badditional auto scaling groups\b/i.test(cText) || /\bcreate.*auto scaling group\b/i.test(cText),
    violationType: 'Cấu hình kiến trúc sai nguyên lý (Anti-pattern)',
    shortReasonVi: 'Auto Scaling tự động tăng giảm số lượng instance trong nhóm hiện tại, không ai tạo thêm Auto Scaling Group mới khi có tải.',
    detailedReasonVi: (_q, _cText, key) =>
      `Phương án ${key} sai vì nguyên lý hoạt động của AWS Auto Scaling là tự động điều chỉnh số lượng máy chủ (Desired / Min / Max Capacity) bên trong một Auto Scaling Group duy nhất đã được cấu hình sẵn. Việc kích hoạt SNS để tạo ra các Auto Scaling Group mới hoàn toàn là một giải pháp sai lầm, gây hỗn loạn trong quản trị cân bằng tải và giám sát hệ thống.`,
  },

  // 15. Single-Region DynamoDB when multi-region continuous availability is required
  {
    matchFn: (qText, cText) =>
      (/\bmulti-region\b/i.test(qText) || /\bcontinuously available\b/i.test(qText) || /\bresilient\b/i.test(qText)) &&
      /\bsingle aws region\b/i.test(cText),
    violationType: 'Thiếu tính sẵn sàng Multi-Region',
    shortReasonVi: 'Triển khai bảng DynamoDB trong một Region duy nhất không đảm bảo tính sẵn sàng liên tục khi cả Region gặp sự cố.',
    detailedReasonVi: (_q, _cText, key) =>
      `Phương án ${key} sai vì việc đặt bảng DynamoDB trong một Region duy nhất ('single AWS Region') tạo ra điểm hỏng hóc đơn lẻ cấp độ vùng (single point of regional failure). Nếu Region đó gặp sự cố thảm họa, toàn bộ người chơi game trên toàn cầu sẽ bị gián đoạn. Để duy trì trải nghiệm liền mạch và khả năng phục hồi liên tục, kiến trúc bắt buộc phải phân tán đa vùng với DynamoDB Global Tables.`,
  },

  // 16. DynamoDB manual Cross-Region Replication instead of Global Tables
  {
    matchFn: (_qText, cText) =>
      /\bdynamodb\b/i.test(cText) && (/\bmanually\b/i.test(cText) || /\bstreams for cross-region\b/i.test(cText)),
    violationType: 'Tự triển khai sao chép thủ công tốn công vận hành',
    shortReasonVi: 'Tự viết code xử lý Streams để replicate DynamoDB đa vùng làm tăng độ phức tạp so với DynamoDB Global Tables.',
    detailedReasonVi: (_q, _cText, key) =>
      `Phương án ${key} sai vì tự viết code Lambda đọc DynamoDB Streams để sao chép dữ liệu giữa các Region là phương pháp thủ công thời kỳ đầu, đòi hỏi phải tự xử lý xung đột ghi, giám sát độ trễ và bảo trì mã nguồn. AWS đã cung cấp tính năng DynamoDB Global Tables được quản lý hoàn toàn (fully managed multi-active replication), tự động đồng bộ 2 chiều với độ trễ tính bằng mili-giây mà không cần cấu hình phức tạp.`,
  },

  // 17. S3 One Zone-IA used for critical or resilient workloads
  {
    matchFn: (qText, cText) =>
      /\bone zone\b/i.test(cText) && (/\bresilient\b/i.test(qText) || /\bhigh availability\b/i.test(qText) || /\bcritical\b/i.test(qText)),
    violationType: 'Rủi ro mất dữ liệu khi sự cố Availability Zone',
    shortReasonVi: 'S3 One Zone-IA chỉ lưu trữ trong 1 AZ duy nhất, dữ liệu sẽ bị mất hoàn toàn nếu AZ đó gặp thảm họa.',
    detailedReasonVi: (_q, _cText, key) =>
      `Phương án ${key} sai vì lớp lưu trữ S3 One Zone-IA chỉ nhân bản dữ liệu bên trong một Availability Zone duy nhất (thay vì tối thiểu 3 AZ như S3 Standard hay Standard-IA). Khi xảy ra thảm họa thiên tai hoặc sự cố phần cứng phá hủy AZ đó, toàn bộ dữ liệu sẽ bị mất vĩnh viễn không thể khôi phục. AWS nghiêm cấm sử dụng One Zone-IA cho dữ liệu quan trọng hoặc hệ thống yêu cầu độ bền cao.`,
  },

  // 18. NAT Gateway for S3/DynamoDB when Gateway VPC Endpoint is free and direct
  {
    matchFn: (qText, cText) =>
      /\bnat gateway\b/i.test(cText) && (/\bs3\b/i.test(qText) || /\bdynamodb\b/i.test(qText)),
    violationType: 'Chi phí cao & Tắc nghẽn không cần thiết',
    shortReasonVi: 'NAT Gateway tính phí theo giờ và dung lượng gigabyte, trong khi Gateway VPC Endpoint cho S3/DynamoDB hoàn toàn miễn phí.',
    detailedReasonVi: (_q, _cText, key) =>
      `Phương án ${key} sai vì NAT Gateway áp dụng cước phí theo từng giờ hoạt động cộng thêm phí xử lý trên từng Gigabyte dữ liệu lưu chuyển. Khi các máy chủ trong Private Subnet cần kết nối đến Amazon S3 hoặc DynamoDB, giải pháp tối ưu chi phí và bảo mật số 1 là dùng Gateway VPC Endpoint (hoàn toàn MIỄN PHÍ, lưu lượng đi thẳng trong mạng nội bộ AWS, không bao giờ phải ra Internet).`,
  },

  // 19. EBS Multi-Attach across multiple AZs (Misunderstanding AWS capability)
  {
    matchFn: (_qText, cText) =>
      /\bebs\b/i.test(cText) && (/\bmultiple availability zones\b/i.test(cText) || /\bacross azs\b/i.test(cText)),
    violationType: 'Hiểu sai giới hạn kỹ thuật của dịch vụ',
    shortReasonVi: 'EBS Multi-Attach chỉ hỗ trợ các EC2 trong CÙNG MỘT Availability Zone duy nhất, không thể gắn xuyên AZ.',
    detailedReasonVi: (_q, _cText, key) =>
      `Phương án ${key} sai vì tính năng EBS Multi-Attach (trên các ổ đĩa io1/io2) chỉ cho phép gắn đồng thời vào tối đa 16 máy chủ EC2 nằm trong CÙNG MỘT Availability Zone. Ổ đĩa EBS về mặt kiến trúc phần cứng gắn liền với một datacenter cụ thể và không bao giờ có thể gắn đồng thời xuyên qua các AZ khác nhau. Để chia sẻ file đa AZ, giải pháp bắt buộc là Amazon EFS hoặc Amazon FSx.`,
  },

  // 20. Modifying application code when the question asks "without modifying code"
  {
    matchFn: (qText, cText) =>
      (/\bwithout modifying\b/i.test(qText) || /\bno code change\b/i.test(qText) || /\bminimal application modification\b/i.test(qText)) &&
      (/\bmodify the application\b/i.test(cText) || /\bupdate the application code\b/i.test(cText) || /\bre-architect the application\b/i.test(cText)),
    violationType: 'Vi phạm ràng buộc không sửa đổi mã nguồn',
    shortReasonVi: 'Phương án yêu cầu sửa đổi mã nguồn ứng dụng, vi phạm trực tiếp ràng buộc không can thiệp code của đề bài.',
    detailedReasonVi: (_q, _cText, key) =>
      `Phương án ${key} sai vì đề bài đã đưa ra ràng buộc rõ ràng là giải pháp phải triển khai mà không được thay đổi mã nguồn ứng dụng ('without modifying application code'). Mọi lựa chọn yêu cầu lập trình viên phải sửa code, đổi thư viện SDK hoặc tái cấu trúc backend đều bị loại bỏ ngay lập tức để ưu tiên giải pháp hạ tầng trong suốt (như CloudFront, Global Accelerator hoặc Route 53).`,
  },

  // 21. Auto Scaling group across multiple Regions (Invalid regional scope)
  {
    matchFn: (_qText, cText) =>
      /\bauto scaling group\b/i.test(cText) &&
      (/\bacross.*(?:two|multiple).*regions\b/i.test(cText) || /\beach of two regions\b/i.test(cText) || /\bmultiple regions\b/i.test(cText)),
    violationType: 'Sai phạm vi tài nguyên AWS (ASG là Regional Resource)',
    shortReasonVi: 'Auto Scaling Group là tài nguyên cấp Region, không thể trải dài qua nhiều Region khác nhau.',
    detailedReasonVi: (_q, _cText, key) =>
      `Phương án ${key} sai hoàn toàn về mặt kỹ thuật AWS vì Auto Scaling Group (ASG) là một tài nguyên cấp Vùng (Regional service). Một ASG chỉ có thể quản lý và phân bổ các EC2 instances qua nhiều Availability Zones (AZs) bên trong duy nhất một Region, không thể tạo một ASG đơn lẻ trải rộng qua hai hay nhiều Region khác nhau. Tương tự, Application Load Balancer (ALB) cũng chỉ hoạt động và cân bằng tải bên trong một Region.`,
    contrastWithCorrectVi: (q) =>
      `Phương án đúng (${q.answer}) điều chỉnh Auto Scaling Group phân bổ đều các máy chủ qua nhiều Availability Zones trong cùng một Region để đạt tính sẵn sàng cao (High Availability).`,
  },

  // 22. Launch / Auto Scaling template in another Region for immediate HA
  {
    matchFn: (qText, cText) =>
      (/\bhigh availability\b/i.test(qText) || /\bhighly available\b/i.test(qText)) &&
      /\banother region\b/i.test(cText) &&
      (/\btemplate\b/i.test(cText) || /\bquickly create\b/i.test(cText)),
    violationType: 'Chiến lược Disaster Recovery thay vì High Availability tức thì',
    shortReasonVi: 'Tạo template ở Region khác là mô hình Disaster Recovery, không đem lại High Availability tức thời và gây downtime.',
    detailedReasonVi: (_q, _cText, key) =>
      `Phương án ${key} sai vì việc tạo Launch Template / Auto Scaling template ở một Region khác là mô hình khắc phục thảm họa (Disaster Recovery) dạng Pilot Light hoặc Warm Standby, không phải giải pháp High Availability (HA) theo thời gian thực cho ứng dụng đang chạy. Khi AZ hiện tại gặp sự cố, hệ thống sẽ bị gián đoạn (downtime), phải chờ khởi động lại máy chủ ở Region mới và chuyển hướng DNS bằng Route 53 failover. Hơn nữa, việc chuyển sang Region khác đòi hỏi đồng bộ dữ liệu liên vùng phức tạp và sửa đổi kiến trúc, vi phạm trực tiếp tiêu chí 'without modifying the application'.`,
    contrastWithCorrectVi: (q) =>
      `Phương án đúng (${q.answer}) phân bổ các EC2 instances qua nhiều Availability Zones trong cùng một Region, cho phép ALB tự động chuyển hướng lưu lượng tức thì mà không gây gián đoạn và không cần sửa code.`,
  },
];

// Fallback Heuristic Generator for any choice not covered by specific rules
function generateFallbackExplanation(
  question: Question,
  choiceKey: string,
  choiceText: string
): OptionExplanation {
  const clues = detectQuestionClues(question.text);
  const correctChoiceText =
    question.choices[question.answer] ||
    question.answer
      .split('')
      .map((k) => `${k}: ${question.choices[k] || ''}`)
      .join(' & ') ||
    '';
  const primaryService = question.serviceTags[0] || 'AWS';

  let violationType = 'Không tối ưu kiến trúc & Vi phạm ràng buộc đề bài';
  let shortReasonVi = `Phương án ${choiceKey} không đáp ứng tối ưu yêu cầu của đề bài so với phương án đúng (${question.answer}).`;
  let detailedReasonVi = `Phương án ${choiceKey} đưa ra giải pháp kỹ thuật chưa phù hợp trong ngữ cảnh bài toán: "${choiceText}". `;

  // Check specific keywords in choice
  const lowerChoice = choiceText.toLowerCase();
  const lowerQuestion = question.text.toLowerCase();

  if (lowerChoice.includes('ec2') && (lowerQuestion.includes('least operational') || lowerQuestion.includes('minimize operational'))) {
    violationType = 'Gia tăng độ phức tạp vận hành (EC2 vs Managed/Serverless)';
    shortReasonVi = 'Sử dụng EC2 đòi hỏi phải tự quản lý hệ điều hành, vá lỗi và mở rộng, tốn công vận hành hơn dịch vụ Managed.';
    detailedReasonVi += `Việc triển khai trên các máy chủ EC2 tự quản lý đi ngược lại yêu cầu "least operational overhead" của đề bài. Kiến trúc chuẩn khuyến nghị ưu tiên dịch vụ Managed hoặc Serverless hoàn toàn để AWS tự động xử lý bảo trì hạ tầng.`;
  } else if (lowerChoice.includes('manual') || lowerChoice.includes('manually') || lowerChoice.includes('cron script')) {
    violationType = 'Thao tác thủ công hoặc phụ thuộc cron script';
    shortReasonVi = 'Các bước thủ công hoặc custom script tiềm ẩn rủi ro lỗi con người và không đáp ứng tiêu chuẩn tự động hóa.';
    detailedReasonVi += `Phương án này yêu cầu cấu hình hoặc thao tác thủ công, không có cơ chế tự động mở rộng và phục hồi theo chuẩn Well-Architected Framework của AWS.`;
  } else if (lowerQuestion.includes('cost') && (lowerChoice.includes('provisioned') || lowerChoice.includes('nat gateway') || lowerChoice.includes('dedicated'))) {
    violationType = 'Chi phí cao không cần thiết';
    shortReasonVi = 'Phương án này gây phát sinh chi phí hạ tầng cao hơn nhiều so với giải pháp tối ưu của AWS.';
    detailedReasonVi += `Lựa chọn này làm tăng đáng kể chi phí cấp phát tài nguyên cố định hoặc phí truyền dữ liệu, vi phạm tiêu chí "most cost-effective" mà đề bài yêu cầu.`;
  } else if (lowerQuestion.includes('latency') || lowerQuestion.includes('fastest') || lowerQuestion.includes('quickly')) {
    violationType = 'Độ trễ cao / Không đáp ứng tốc độ yêu cầu';
    shortReasonVi = 'Giải pháp này không cung cấp tầng tăng tốc hoặc bộ đệm để đáp ứng yêu cầu độ trễ tối thiểu.';
    detailedReasonVi += `Phương án này thiếu cơ chế tăng tốc truyền tải (như S3 Transfer Acceleration, CloudFront, hoặc DAX/ElastiCache), không thể thỏa mãn yêu cầu xử lý dữ liệu với tốc độ cao nhất.`;
  } else if (clues.length > 0) {
    const clue = clues[0].clue;
    violationType = `Vi phạm nguyên tắc: ${clue.label}`;
    shortReasonVi = `Không đáp ứng đúng tiêu chí "${clues[0].matchText}" của bài toán.`;
    detailedReasonVi += `Đề bài có ràng buộc then chốt: "${clues[0].matchText}". Phương án ${choiceKey} không đáp ứng đúng mẫu thiết kế kiến trúc theo chuẩn "${clue.label}", do đó không phải là giải pháp tối ưu.`;
  } else {
    detailedReasonVi += `Trong khi đó, phương án ${question.answer} sử dụng đúng dịch vụ chuẩn của AWS (${primaryService}) đáp ứng toàn diện cả về tính khả thi, chi phí lẫn tính sẵn sàng của hệ thống.`;
  }

  const contrastWithCorrectVi = correctChoiceText
    ? `So với phương án đúng (${question.answer}): "${correctChoiceText}" được thiết kế đúng chuẩn Best Practice của AWS, đáp ứng trực diện yêu cầu mà không tạo ra các bước trung gian thừa thãi.`
    : undefined;

  return {
    key: choiceKey,
    text: choiceText,
    isCorrect: false,
    violationType,
    shortReasonVi,
    detailedReasonVi,
    contrastWithCorrectVi,
  };
}

/**
 * Generates an explanation for a single choice option
 */
export function generateOptionExplanation(
  question: Question,
  choiceKey: string,
  isUserSelected: boolean = false
): OptionExplanation {
  const choiceText = question.choices[choiceKey] || '';
  const correctKeys = new Set(question.answer.split(''));
  const isCorrect = correctKeys.has(choiceKey);

  // 1. Check curated repository first for 100% human-verified precision
  const curated = getCuratedExplanation(question.id);
  if (curated?.choiceAnalyses?.[choiceKey]) {
    const analysis = curated.choiceAnalyses[choiceKey];
    return {
      key: choiceKey,
      text: choiceText,
      isCorrect,
      isSelected: isUserSelected,
      violationType: analysis.violationType || (isCorrect ? 'Đáp án chính xác' : 'Phương án không phù hợp'),
      shortReasonVi: analysis.shortReasonVi,
      detailedReasonVi: analysis.detailedReasonVi,
      contrastWithCorrectVi: analysis.contrastWithCorrectVi,
    };
  }

  if (isCorrect) {
    return {
      key: choiceKey,
      text: choiceText,
      isCorrect: true,
      isSelected: isUserSelected,
      violationType: 'Đáp án chính xác',
      shortReasonVi: `Đây là đáp án đúng theo chuẩn kiến trúc khuyến nghị của AWS.`,
      detailedReasonVi: `Phương án ${choiceKey} là đáp án chính xác vì áp dụng đúng mẫu kiến trúc Well-Architected Framework: giải quyết triệt để yêu cầu bài toán với chi phí và độ phức tạp vận hành tối ưu nhất.`,
    };
  }

  const qText = question.text;

  // Search through comprehensive rules
  for (const rule of DISTRACTOR_RULES) {
    if (rule.matchFn(qText, choiceText, question)) {
      return {
        key: choiceKey,
        text: choiceText,
        isCorrect: false,
        isSelected: isUserSelected,
        violationType: rule.violationType,
        shortReasonVi: rule.shortReasonVi,
        detailedReasonVi: rule.detailedReasonVi(question, choiceText, choiceKey),
        contrastWithCorrectVi: rule.contrastWithCorrectVi ? rule.contrastWithCorrectVi(question) : undefined,
      };
    }
  }

  // Fallback to dynamic heuristic rule generator
  const fallback = generateFallbackExplanation(question, choiceKey, choiceText);
  fallback.isSelected = isUserSelected;
  return fallback;
}

/**
 * Generates explanations for all choices in a question
 */
export function generateAllOptionExplanations(
  question: Question,
  userAnswer?: string
): Record<string, OptionExplanation> {
  const userSelectedKeys = new Set((userAnswer || '').toUpperCase().split(''));
  const result: Record<string, OptionExplanation> = {};

  for (const key of question.choiceKeys) {
    const isUserSelected = userSelectedKeys.has(key);
    result[key] = generateOptionExplanation(question, key, isUserSelected);
  }

  return result;
}

/**
 * Returns explanations for the wrong choices selected by the user
 */
export function getSelectedWrongExplanations(
  question: Question,
  userAnswer: string
): OptionExplanation[] {
  if (!userAnswer) return [];
  const correctKeys = new Set(question.answer.split(''));
  const userSelectedKeys = userAnswer.toUpperCase().split('');

  const wrongExplanations: OptionExplanation[] = [];
  for (const key of userSelectedKeys) {
    if (!correctKeys.has(key) && question.choices[key]) {
      wrongExplanations.push(generateOptionExplanation(question, key, true));
    }
  }

  return wrongExplanations;
}
