/**
 * curatedExplanations.ts
 * Detailed, handcrafted, question-specific architectural explanations for AWS SAA-C03 exam questions.
 * Eliminates generic keyword-concatenated templates in favor of accurate, scenario-specific breakdowns.
 */

export interface CuratedChoiceAnalysis {
  isCorrect: boolean;
  violationType?: string;
  shortReasonVi: string;
  detailedReasonVi: string;
  contrastWithCorrectVi?: string;
}

export interface CuratedQuestionExplanation {
  objectiveVi: string;
  solutionVi: string;
  trapWarningVi: string;
  keyTakeawayVi: string;
  ruleEn: string;
  choiceAnalyses?: Record<string, CuratedChoiceAnalysis>;
}

export const CURATED_QUESTION_EXPLANATIONS: Record<number, CuratedQuestionExplanation> = {
  // Question 1: S3 Transfer Acceleration vs Snowball / EBS / CRR
  1: {
    objectiveVi:
      'Hệ thống thu thập 500 GB dữ liệu thời tiết hàng ngày từ các trạm quan trắc trên nhiều châu lục (kết nối Internet tốc độ cao), cần tổng hợp về một Amazon S3 bucket duy nhất nhanh nhất có thể (as quickly as possible) với độ phức tạp vận hành tối thiểu (minimize operational complexity).',
    solutionVi:
      'Phương án A là câu trả lời chính xác vì bật tính năng S3 Transfer Acceleration trên bucket đích và sử dụng multipart uploads: (1) S3 Transfer Acceleration định tuyến dữ liệu qua hơn 400 điểm biên (Edge Locations) toàn cầu của AWS, truyền qua mạng cáp quang nội bộ tối ưu hóa của AWS vào S3 bucket đích giúp tăng tốc độ tải lên từ 50-500% so với Internet công cộng; (2) Multipart upload cho phép tải song song các phần của file dung lượng lớn và tự động tải lại phần bị lỗi; (3) Toàn bộ giải pháp là tính năng serverless có sẵn của S3, hoàn toàn không cần quản lý máy chủ hay thiết bị phần cứng, thỏa mãn tối đa yêu cầu "minimize operational complexity".',
    trapWarningVi:
      'Cảnh giác 3 bẫy phổ biến: (1) Bẫy AWS Snowball (C): Snowball là thiết bị phần cứng vận chuyển qua đường bưu điện mất 3-5 ngày mỗi chiều, lập lịch hàng ngày ("daily") là bất khả thi và gây độ trễ vận chuyển cực lớn; (2) Bẫy EC2 trung gian + EBS snapshot (D): Tự cài EC2 gắn EBS rồi snapshot sao chép xuyên vùng là anti-pattern tốn công vận hành khổng lồ; (3) Bẫy tạo bucket trung gian + CRR rồi xóa (B): Làm phát sinh thêm chi phí truyền dữ liệu liên vùng (CRR data transfer fee) và tốn công xóa dọn rác ở bucket gốc.',
    keyTakeawayVi:
      'S3 Transfer Acceleration: Giải pháp tối ưu nhất để truyền dữ liệu từ các chi nhánh toàn cầu vào 1 S3 bucket tập trung nhanh nhất qua mạng backbone của AWS.',
    ruleEn:
      'AWS SAA-C03 Core Rule: To accelerate global data ingestion into a single S3 bucket across continents with minimal operational overhead, use Amazon S3 Transfer Acceleration with multipart uploads instead of physical appliances or self-managed intermediate compute.',
    choiceAnalyses: {
      A: {
        isCorrect: true,
        violationType: 'Đáp án chính xác',
        shortReasonVi: 'Bật S3 Transfer Acceleration và dùng multipart uploads là lựa chọn đúng đắn truyền thẳng vào S3 bucket đích.',
        detailedReasonVi:
          'S3 Transfer Acceleration tận dụng mạng phân phối biên toàn cầu của AWS để tăng tốc truyền tải dữ liệu xuyên lục địa vào duy nhất một S3 bucket, kết hợp multipart uploads để truyền song song các phần dữ liệu 500 GB hàng ngày mà không cần quản lý bất kỳ hạ tầng trung gian nào.',
      },
      B: {
        isCorrect: false,
        violationType: 'Quy trình trung gian dư thừa & Tăng chi phí',
        shortReasonVi: 'Tạo bucket S3 tạm ở từng Region rồi replicate sang bucket đích gây tốn chi phí và công xóa file.',
        detailedReasonVi:
          'Tạo các bucket S3 trung gian ở từng Region gần nhất rồi cấu hình Cross-Region Replication (CRR) sang bucket đích, sau đó phải lập lịch xóa dữ liệu ở bucket gốc tạo ra quy trình trung gian phức tạp, tốn phí truyền dữ liệu liên vùng và gia tăng chi phí lưu trữ tạm.',
        contrastWithCorrectVi:
          'Phương án A cho phép đẩy trực tiếp vào duy nhất một bucket đích qua điểm biên mà không cần tạo hay quản lý các bucket trung gian.',
      },
      C: {
        isCorrect: false,
        violationType: 'Độ trễ vật lý & Vận hành bất khả thi',
        shortReasonVi: 'AWS Snowball là thiết bị phần cứng offline, không thể lập lịch gửi nhận bưu chính hàng ngày.',
        detailedReasonVi:
          'AWS Snowball Edge là thiết bị phần cứng vật lý vận chuyển qua bưu điện/chuyển phát nhanh (mất từ 3 đến 5 ngày cho mỗi lượt gửi nhận). Việc lập lịch thiết bị Snowball hàng ngày ("daily") cho dung lượng 500 GB trong khi các chi nhánh đã có kết nối Internet tốc độ cao là bất khả thi và vi phạm trực tiếp yêu cầu "as quickly as possible" cùng "minimize operational complexity".',
        contrastWithCorrectVi:
          'Phương án đúng (A) sử dụng Amazon S3 Transfer Acceleration upload trực tiếp qua Internet vào S3 tận dụng hơn 400 điểm biên (Edge Locations) toàn cầu của AWS mà không cần quản lý thiết bị phần cứng.',
      },
      D: {
        isCorrect: false,
        violationType: 'Độ phức tạp vận hành cực cao (Anti-pattern)',
        shortReasonVi: 'Tự triển khai máy chủ EC2, gắn ổ EBS rồi snapshot sao chép xuyên vùng để nạp S3 là giải pháp thủ công tốn kém.',
        detailedReasonVi:
          'Tự duy trì máy chủ EC2 ở từng Region, gắn ổ đĩa EBS, lập lịch chụp snapshot định kỳ rồi sao chép snapshot xuyên vùng và restore volume trước khi đưa vào S3 là anti-pattern đòi hỏi phải tự viết script, theo dõi máy chủ và xử lý sự cố thủ công, tạo ra gánh nặng vận hành khổng lồ.',
        contrastWithCorrectVi:
          'Phương án A là giải pháp serverless có sẵn của AWS S3, hoàn toàn không cần khởi tạo hay quản trị máy chủ EC2 nào.',
      },
    },
  },

  // Question 2: API Gateway + SQS FIFO + Lambda vs SNS vs SQS Standard
  2: {
    objectiveVi:
      'Ứng dụng thương mại điện tử nhận đơn hàng qua Amazon API Gateway REST API. Yêu cầu kiến trúc cốt lõi: Đảm bảo các đơn hàng được xử lý chính xác theo đúng thứ tự đã nhận (processed in the order that they are received).',
    solutionVi:
      'Phương án B là câu trả lời chính xác vì tích hợp API Gateway trực tiếp với Amazon SQS FIFO queue và kích hoạt AWS Lambda xử lý: (1) SQS FIFO (First-In, First-Out) đảm bảo bảo toàn thứ tự nghiêm ngặt của tin nhắn theo Message Group ID; (2) SQS FIFO tích hợp cơ chế chống trùng lặp (deduplication) ngăn chặn xử lý đơn hàng 2 lần; (3) Lambda đọc từ SQS FIFO theo batch và xử lý tuần tự theo đúng trình tự đến.',
    trapWarningVi:
      'Cảnh giác 3 bẫy: (1) Bẫy SQS Standard queue (D): SQS Standard hoạt động theo cơ chế best-effort ordering, tin nhắn có thể bị xáo trộn thứ tự hoặc gửi trùng lặp; (2) Bẫy Amazon SNS (A): SNS là dịch vụ Pub/Sub đẩy thông báo 1-nhiều tức thời, không có cơ chế hàng đợi đệm và SNS standard không đảm bảo thứ tự; (3) Bẫy API Gateway Authorizer (C): Authorizer chỉ dùng để xác thực quyền (AuthN/AuthZ), dùng authorizer để chặn request sẽ làm nghẽn toàn bộ hệ thống bán hàng.',
    keyTakeawayVi:
      'Xử lý tuần tự theo đúng thứ tự tiếp nhận (Order preservation) trên AWS: Luôn luôn là giải pháp Amazon SQS FIFO queue.',
    ruleEn:
      'AWS SAA-C03 Core Rule: When strict FIFO message ordering and exactly-once processing are required for decoupled architectures, always choose Amazon SQS FIFO queues over SNS topics or standard queues.',
    choiceAnalyses: {
      A: {
        isCorrect: false,
        violationType: 'Sai mô hình hàng đợi đệm (Pub/Sub thay vì Queue FIFO)',
        shortReasonVi: 'Amazon SNS standard là dịch vụ Pub/Sub phát tán thông báo, không đảm bảo thứ tự đơn hàng đến.',
        detailedReasonVi:
          'Amazon SNS là dịch vụ Publish/Subscribe hoạt động theo cơ chế đẩy thông báo tức thì (push-based fanout). Nó không cung cấp hàng đợi lưu trữ đệm có kiểm soát tốc độ cho consumer và không đảm bảo thứ tự nghiêm ngặt của các đơn hàng.',
        contrastWithCorrectVi:
          'Phương án B sử dụng SQS FIFO queue có cơ chế bảo toàn thứ tự First-In-First-Out tuyệt đối.',
      },
      B: {
        isCorrect: true,
        violationType: 'Đáp án chính xác',
        shortReasonVi: 'Tích hợp API Gateway với SQS FIFO queue và cấu hình trigger Lambda xử lý tuần tự.',
        detailedReasonVi:
          'Amazon SQS FIFO queue đảm bảo thứ tự tin nhắn được giữ nguyên vẹn từ lúc nhận đến lúc xử lý, kết hợp cơ chế deduplication ngăn đơn hàng bị xử lý trùng lặp, đáp ứng hoàn hảo yêu cầu đề bài.',
      },
      C: {
        isCorrect: false,
        violationType: 'Lạm dụng sai mục đích dịch vụ (Anti-pattern nghiêm trọng)',
        shortReasonVi: 'Authorizer chỉ dùng để kiểm tra phân quyền người dùng, không dùng để chặn luồng xử lý đơn hàng.',
        detailedReasonVi:
          'API Gateway Authorizer chỉ có nhiệm vụ kiểm tra token/danh tính người dùng. Việc dùng authorizer để chặn mọi request trong khi một đơn hàng đang xử lý sẽ làm sập khả năng mở rộng của API và chặn cả những khách hàng hợp lệ khác.',
      },
      D: {
        isCorrect: false,
        violationType: 'Không bảo toàn thứ tự & Nguy cơ trùng lặp thông điệp',
        shortReasonVi: 'SQS Standard queue chỉ sắp xếp theo nỗ lực tối đa (best-effort), có thể bị đảo lộn thứ tự.',
        detailedReasonVi:
          'Amazon SQS Standard queue hoạt động theo cơ chế "best-effort ordering" và "at-least-once delivery". Tin nhắn có thể đến consumer không đúng thứ tự và có thể bị lặp lại, vi phạm yêu cầu "processed in the order that they are received". Đề bài yêu cầu xử lý tuần tự chính xác, do đó bắt buộc phải sử dụng SQS FIFO queue.',
        contrastWithCorrectVi:
          'Phương án B sử dụng SQS FIFO queue đảm bảo thứ tự First-In-First-Out nghiêm ngặt.',
      },
    },
  },

  // Question 3: The exact question in the user's screenshot!
  3: {
    objectiveVi:
      'Ứng dụng container chạy trên Amazon EC2 cần tải chứng chỉ bảo mật và giao tiếp với các ứng dụng khác. Yêu cầu kiến trúc: (1) Mã hóa và giải mã chứng chỉ gần thời gian thực (near real-time); (2) Lưu trữ chứng chỉ đã mã hóa trên hệ thống lưu trữ có tính sẵn sàng cao (High Availability); (3) Giảm thiểu tối đa gánh nặng vận hành quản trị (LEAST operational overhead).',
    solutionVi:
      'Phương án C là câu trả lời chính xác nhất vì kết hợp hoàn hảo giữa AWS KMS Customer Managed Key và Amazon S3: (1) **AWS KMS Customer Managed Key**: Cung cấp API mã hóa phong bì (envelope encryption) tức thì với độ trễ thấp, tích hợp trực tiếp IAM Role của EC2 để cấp quyền mà không cần lưu khóa tĩnh hay tự viết code thuật toán; (2) **Amazon S3**: Cung cấp kho lưu trữ đối tượng có độ sẵn sàng cao và độ bền 99.999999999% (11 số 9) tự động nhân bản qua tối thiểu 3 Availability Zones; (3) Cả KMS và S3 đều là dịch vụ Serverless/Managed hoàn toàn, không cần bảo trì máy chủ hay phần cứng, thỏa mãn tuyệt đối ràng buộc "LEAST operational overhead".',
    trapWarningVi:
      'Cảnh giác 3 bẫy kinh điển trong câu này: (1) **Bẫy Amazon EBS (Phương án D)**: Ổ đĩa EBS chỉ gắn với 1 EC2 trong 1 AZ duy nhất nên KHÔNG phải là kho lưu trữ có tính sẵn sàng cao (HA) độc lập đa vùng như S3; (2) **Bẫy cập nhật thủ công (Phương án A)**: Yêu cầu "Manually update certificates" trực tiếp vi phạm tiêu chí giảm thiểu công vận hành tự động; (3) **Bẫy thư viện mã hóa trong Lambda (Phương án B)**: Tự viết code mật mã học ("Python cryptography library") trong Lambda là anti-pattern so với dịch vụ KMS chuyên dụng đạt chuẩn FIPS 140-2 của AWS.',
    keyTakeawayVi:
      'AWS KMS + Amazon S3: Cặp bài trùng chuẩn kiến trúc AWS để mã hóa phong bì theo phân quyền IAM Role và lưu trữ dữ liệu an toàn Multi-AZ với chi phí và công vận hành thấp nhất.',
    ruleEn:
      'AWS SAA-C03 Core Rule: For low-latency encryption and highly available storage with least operational overhead, use AWS KMS customer managed keys with EC2 IAM roles and store encrypted objects in Amazon S3 (Multi-AZ 11 9s durability) rather than Single-AZ EBS or custom Lambda cryptography.',
    choiceAnalyses: {
      A: {
        isCorrect: false,
        violationType: 'Thao tác thủ công vi phạm tiêu chí giảm thiểu vận hành',
        shortReasonVi: 'Cập nhật chứng chỉ thủ công ("Manually update") làm tăng công vận hành và dễ gây lỗi.',
        detailedReasonVi:
          'Việc cập nhật chứng chỉ thủ công ("Manually update certificates as needed") đòi hỏi sự can thiệp liên tục của kỹ sư vận hành, dễ dẫn đến quên gia hạn chứng chỉ gây gián đoạn dịch vụ hệ thống và vi phạm trực tiếp tiêu chí "LEAST operational overhead".',
        contrastWithCorrectVi:
          'Phương án C tự động hóa việc mã hóa/giải mã thông qua API của AWS KMS kết hợp IAM Role gắn vào EC2.',
      },
      B: {
        isCorrect: false,
        violationType: 'Tự phát triển mã hóa thủ công (Anti-pattern bảo mật)',
        shortReasonVi: 'Tự viết code mã hóa trong Lambda bằng thư viện Python tốn công bảo trì và không đạt chuẩn FIPS 140-2.',
        detailedReasonVi:
          'Tự viết code trong AWS Lambda bằng thư viện ngoài như Python cryptography để mã hóa dữ liệu buộc đội ngũ kỹ thuật phải tự quản lý khóa chủ, tự lo lắng về rò rỉ bộ nhớ, không có tích hợp kiểm toán nhật ký CloudTrail và không đạt các chứng chỉ an toàn phần cứng như FIPS 140-2 của AWS KMS.',
        contrastWithCorrectVi:
          'Phương án C sử dụng dịch vụ AWS KMS chuyên biệt có sẵn với các mô-đun bảo mật phần cứng (HSM) đạt chuẩn FIPS 140-2 Cryptographic Module Validation Program.',
      },
      C: {
        isCorrect: true,
        violationType: 'Đáp án chính xác',
        shortReasonVi: 'Dùng AWS KMS Customer Managed Key phân quyền cho EC2 Role và lưu trữ dữ liệu mã hóa trên S3.',
        detailedReasonVi:
          'AWS KMS customer managed key cho phép EC2 instance sử dụng quyền IAM role để thực hiện các thao tác mã hóa/giải mã tự động với độ trễ thấp. Dữ liệu sau khi mã hóa được lưu trên Amazon S3 có tính sẵn sàng cao (High Availability) tự động nhân bản qua tối thiểu 3 Availability Zones với độ bền 99.999999999% (11 9s) và ít tốn công vận hành nhất.',
      },
      D: {
        isCorrect: false,
        violationType: 'Giới hạn phạm vi lưu trữ Single-AZ (Không đạt chuẩn HA)',
        shortReasonVi: 'Amazon EBS chỉ gắn vào 1 EC2 trong 1 AZ duy nhất, không phải kho lưu trữ tính sẵn sàng cao độc lập.',
        detailedReasonVi:
          'Amazon Elastic Block Store (EBS) là khối lưu trữ cục bộ chỉ gắn liền với một Availability Zone duy nhất. Nếu AZ đó gặp sự cố về điện hoặc mạng, dữ liệu trên ổ EBS sẽ không thể truy cập được. Đề bài yêu cầu "highly available storage", Amazon S3 tự động sao lưu phân tán trên tối thiểu 3 Availability Zones với độ bền 11 9s và độ sẵn sàng cực cao mà không bị ràng buộc vào 1 EC2 duy nhất.',
        contrastWithCorrectVi:
          'Phương án C lưu trữ trên Amazon S3 tự động đạt chuẩn Multi-AZ High Availability.',
      },
    },
  },

  // Question 4: Storage Gateway Volume Gateway Cached Volumes vs Stored Volumes vs File Gateway vs Tape
  4: {
    objectiveVi:
      'Công ty lưu trữ 5 TB dữ liệu trên hệ thống block storage tại chỗ (on-premises), đang bị giới hạn dung lượng trống (limited space for additional data). Ứng dụng tại chỗ cần truy xuất dữ liệu thường dùng với độ trễ thấp (low latency) và yêu cầu giải pháp lưu trữ đám mây có hiệu quả vận hành cao nhất (MOST operational efficiency).',
    solutionVi:
      'Phương án B là câu trả lời chính xác vì sử dụng AWS Storage Gateway Volume Gateway với Cached Volumes qua giao thức iSCSI: (1) **Cached Volumes** lưu trữ 100% dữ liệu chính trên Amazon S3 và chỉ lưu trữ đệm (cache) dữ liệu được truy xuất thường xuyên tại chỗ (on-premises), giải quyết triệt để vấn đề hết dung lượng ổ cứng tại on-prem; (2) Cung cấp giao diện chuẩn iSCSI tương thích hoàn toàn với ứng dụng block storage hiện tại mà không cần viết lại ứng dụng; (3) Cho phép ứng dụng đọc ghi dữ liệu hay dùng với độ trễ thấp từ bộ nhớ cache cục bộ.',
    trapWarningVi:
      'Cảnh giác các bẫy: (1) Bẫy Stored Volumes (C): Stored Volumes lưu toàn bộ dữ liệu gốc tại chỗ và chỉ backup snapshot lên S3, do đó không giải quyết được vấn đề thiếu chỗ chứa tại chỗ; (2) Bẫy S3 File Gateway (A): Cung cấp chia sẻ file SMB/NFS, không tương thích với hệ thống block storage iSCSI hiện tại; (3) Bẫy Tape Gateway (D): Dành riêng cho sao lưu băng từ ảo (VTL), không dùng cho ứng dụng đọc ghi trực tiếp.',
    keyTakeawayVi:
      'Storage Gateway Cached Volumes: Giải pháp hàng đầu để mở rộng block storage on-premise lên đám mây khi dung lượng tại chỗ bị cạn kiệt nhưng vẫn cần độ trễ thấp cho dữ liệu hay dùng.',
    ruleEn:
      'AWS SAA-C03 Core Rule: When on-premises block storage is capacity-constrained and low latency is required for active data, use AWS Storage Gateway Volume Gateway with cached volumes (iSCSI), storing the primary dataset in Amazon S3.',
    choiceAnalyses: {
      A: {
        isCorrect: false,
        violationType: 'Sai giao thức truy xuất (File SMB thay vì Block iSCSI)',
        shortReasonVi: 'S3 File Gateway cung cấp giao thức tập tin NFS/SMB, không tương thích với block storage hiện có.',
        detailedReasonVi:
          'Ứng dụng của công ty đang chạy trên nền tảng lưu trữ dạng khối (block storage). S3 File Gateway chỉ cung cấp giao thức file share SMB/NFS, ứng dụng không thể kết nối trực tiếp dạng ổ đĩa khối iSCSI.',
      },
      B: {
        isCorrect: true,
        violationType: 'Đáp án chính xác',
        shortReasonVi: 'Dùng Volume Gateway Cached Volumes cung cấp ổ đĩa iSCSI và cache dữ liệu thường dùng tại chỗ.',
        detailedReasonVi:
          'Cached Volumes lưu dữ liệu chính trên Amazon S3 và chỉ giữ dữ liệu truy cập thường xuyên trong bộ nhớ đệm cục bộ, giải quyết ngay lập tức tình trạng cạn kiệt dung lượng ổ cứng tại chỗ trong khi vẫn đảm bảo độ trễ truy xuất thấp qua giao thức iSCSI.',
      },
      C: {
        isCorrect: false,
        violationType: 'Không giải quyết được bài toán thiếu hụt dung lượng on-premises',
        shortReasonVi: 'Stored Volumes lưu 100% dữ liệu tại chỗ nên không khắc phục được tình trạng hết dung lượng ổ cứng.',
        detailedReasonVi:
          'Volume Gateway Stored Volumes lưu trữ toàn bộ dữ liệu gốc tại on-premises và chỉ sao lưu snapshot lên S3. Công ty đang gặp vấn đề "limited space for additional data", do đó Stored Volumes hoàn toàn không giải quyết được vấn đề vì vẫn đòi hỏi dung lượng phần cứng lớn tại chỗ.',
      },
      D: {
        isCorrect: false,
        violationType: 'Sai mục đích dịch vụ (Băng từ sao lưu lưu trữ)',
        shortReasonVi: 'Tape Gateway chỉ dùng cho sao lưu băng từ ảo dài hạn, không hỗ trợ ổ đĩa block cho ứng dụng.',
        detailedReasonVi:
          'Tape Gateway (Virtual Tape Library) được thiết kế chuyên biệt để thay thế các băng từ vật lý dùng cho sao lưu lưu trữ định kỳ (backup and archival). Nó không hỗ trợ gắn ổ đĩa block storage (iSCSI) cho ứng dụng chạy thường trực.',
      },
    },
  },

  // Question 5: Scaling Auto Scaling Groups via SQS queue depth
  5: {
    objectiveVi:
      'Hệ thống xử lý đơn hàng giao đồ ăn gồm 2 nhóm EC2: Nhóm 1 nhận đơn (nhanh) và Nhóm 2 xử lý giao đơn (chậm hơn). Đảm bảo cả hai nhóm mở rộng (scale) tương xứng trong giờ cao điểm và tuyệt đối không làm mất dữ liệu đơn hàng khi có sự kiện co giãn (scaling event).',
    solutionVi:
      'Phương án D là câu trả lời chính xác vì sử dụng 2 hàng đợi Amazon SQS riêng biệt cho khâu nhận đơn và giao đơn, và cấu hình Auto Scaling Group mở rộng dựa trên số lượng thông điệp trong từng hàng đợi (ApproximateNumberOfMessagesVisible): (1) Hàng đợi SQS đóng vai trò bộ đệm phân rã (decoupling buffer) chống mất mát dữ liệu khi tải tăng đột biến; (2) Số lượng thông điệp trong queue (Queue Depth) phản ánh chính xác khối lượng công việc tồn đọng thực tế, cho phép Auto Scaling tăng số lượng instance kịp thời.',
    trapWarningVi:
      'Cảnh giác các bẫy: (1) Bẫy mở rộng theo CPUUtilization (A): EC2 xử lý tin nhắn SQS có thể bị nghẽn I/O, cơ sở dữ liệu hoặc chờ mạng khiến CPU thấp trong khi hàng đợi đang tồn đọng hàng ngàn đơn hàng; (2) Bẫy SNS tạo thêm Auto Scaling Group (B): Auto Scaling tự động tăng/giảm số lượng instance trong nhóm hiện có, không ai tạo ra các Auto Scaling Group mới khi có tải.',
    keyTakeawayVi:
      'Mở rộng nhóm xử lý hàng đợi SQS: Luôn cấu hình Auto Scaling theo số lượng tin nhắn trong queue (Backlog Per Instance / Queue Depth), không dùng CPU.',
    ruleEn:
      'AWS SAA-C03 Core Rule: To scale worker instances processing decoupled asynchronous workloads without data loss, scale the Auto Scaling group based on the number of messages in the Amazon SQS queue (ApproximateNumberOfMessagesVisible) rather than CPU utilization.',
    choiceAnalyses: {
      A: {
        isCorrect: false,
        violationType: 'Sai chỉ số kích hoạt mở rộng (Metric mismatch)',
        shortReasonVi: 'Mở rộng theo CPU không phản ánh đúng tải tồn đọng tin nhắn trong hàng đợi SQS.',
        detailedReasonVi:
          'Khi worker xử lý hàng đợi SQS, mức sử dụng CPU có thể vẫn thấp (do chờ I/O hoặc chờ cơ sở dữ liệu), trong khi số lượng tin nhắn tồn đọng trong queue đang tăng vọt. Kích hoạt Auto Scaling dựa trên CPUUtilization sẽ làm chậm trễ việc mở rộng máy chủ.',
      },
      B: {
        isCorrect: false,
        violationType: 'Cấu hình kiến trúc sai nguyên lý (Anti-pattern)',
        shortReasonVi: 'Auto Scaling tự tăng giảm instance trong nhóm, không tạo thêm Auto Scaling Group mới.',
        detailedReasonVi:
          'Nguyên lý hoạt động của AWS Auto Scaling là tự động điều chỉnh số lượng máy chủ bên trong một Auto Scaling Group duy nhất đã cấu hình sẵn. Kích hoạt SNS để tạo ra các Auto Scaling Group mới là giải pháp sai lầm gây hỗn loạn trong quản trị.',
      },
      C: {
        isCorrect: false,
        violationType: 'Cơ chế thông báo không kích hoạt Auto Scaling trực tiếp',
        shortReasonVi: 'SQS không gửi thông báo đẩy để tự kích hoạt scaling trực tiếp cho Auto Scaling Group.',
        detailedReasonVi:
          'Amazon SQS là hàng đợi thụ động, nó không gửi notification đẩy trực tiếp đến Auto Scaling Group để scale. Auto Scaling cần theo dõi CloudWatch metric về độ sâu của hàng đợi (Queue Depth).',
      },
      D: {
        isCorrect: true,
        violationType: 'Đáp án chính xác',
        shortReasonVi: 'Dùng 2 SQS queues và scale Auto Scaling Groups dựa trên số lượng tin nhắn trong từng queue.',
        detailedReasonVi:
          'Cấu hình Auto Scaling dựa trên chỉ số số lượng thông điệp có thể xử lý trong hàng đợi SQS (ApproximateNumberOfMessagesVisible) giúp hệ thống đo lường chính xác khối lượng đơn hàng tồn đọng và tự động mở rộng kịp thời trước khi xảy ra nghẽn.',
      },
    },
  },

  // Question 6: DynamoDB Global Tables
  6: {
    objectiveVi:
      'Hệ thống lưu trữ dữ liệu người dùng của game trực tuyến trên Amazon DynamoDB cần thiết kế kiến trúc có khả năng hoạt động liên tục (continuously available), chống chịu sự cố (resilient), và tối ưu chi phí nhất (MOST cost-effectively).',
    solutionVi:
      'Phương án D là câu trả lời chính xác vì sử dụng DynamoDB Global Tables để tự động nhân bản đa vùng (Multi-Region replication) ở chế độ active-active, kết hợp provisioned capacity mode và tính năng auto scaling: (1) Global Tables cung cấp khả năng chịu lỗi xuyên vùng (Multi-Region resilience) và đọc/ghi với độ trễ thấp cục bộ cho game thủ; (2) Chế độ Provisioned kết hợp Auto Scaling tối ưu chi phí hơn On-Demand đối với tải game có lưu lượng người chơi ổn định và dự báo được theo chu kỳ ngày/đêm.',
    trapWarningVi:
      'Cảnh giác: (1) Bẫy Single-Region (A): Không đáp ứng được tiêu chí liên tục khả dụng khi có sự cố toàn bộ Region; (2) Bẫy tự sao chép bằng DynamoDB Streams thủ công (C): Tốn công xây dựng và vận hành phức tạp hơn tính năng Global Tables tự động có sẵn của AWS.',
    keyTakeawayVi:
      'DynamoDB Global Tables: Giải pháp chuẩn AWS cho cơ sở dữ liệu NoSQL phân tán toàn cầu đa vùng active-active có tính sẵn sàng cao nhất.',
    ruleEn:
      'AWS SAA-C03 Core Rule: For continuous multi-region availability and resilience in DynamoDB, use DynamoDB Global Tables with auto-scaled provisioned capacity for predictable workloads to minimize cost.',
  },

  // Question 7: S3 File Gateway vs Mountpoint
  7: {
    objectiveVi:
      'Ứng dụng kết xuất đồ họa (media rendering) chạy tại on-premises cần truy xuất dữ liệu lưu trên Amazon S3 với độ trễ thấp (low latency) và duy trì hiệu năng xử lý với chi phí tối ưu nhất (MOST cost-effective).',
    solutionVi:
      'Phương án B là câu trả lời chính xác vì triển khai Amazon S3 File Gateway tại on-premises: (1) S3 File Gateway cung cấp giao thức tập tin chuẩn (NFS/SMB) cho ứng dụng on-prem kết nối trực tiếp; (2) Bộ nhớ đệm cục bộ (Local Cache) của gateway lưu trữ các file thường dùng tại chỗ, đảm bảo độ trễ truy xuất thấp tương đương ổ đĩa nội bộ; (3) Dữ liệu gốc lưu trên S3 với chi phí lưu trữ thấp nhất.',
    trapWarningVi:
      'Cảnh giác: (1) Bẫy Mountpoint for S3 (A): Mountpoint là client mã nguồn mở cho Linux EC2, không có bộ nhớ đệm dung lượng lớn tại chỗ cho ứng dụng on-premise; (2) Bẫy FSx for Windows (C): Copy sang FSx làm tăng chi phí lưu trữ đắt đỏ hơn nhiều so với S3.',
    keyTakeawayVi:
      'Amazon S3 File Gateway: Cầu nối hoàn hảo giữa ứng dụng tập tin on-premises và kho lưu trữ S3 đám mây với bộ nhớ đệm cục bộ độ trễ thấp.',
    ruleEn:
      'AWS SAA-C03 Core Rule: To provide on-premises applications with low-latency access to data stored in Amazon S3, deploy an AWS Storage Gateway S3 File Gateway with local caching.',
  },

  // Question 8: AWS Global Accelerator vs CloudFront for ERP
  8: {
    objectiveVi:
      'Hệ thống ERP chạy trên EC2 tại us-east-1 phục vụ khách hàng quốc tế qua public API. Khách hàng quốc tế phàn nàn về độ trễ phản hồi API chậm. Cần giải pháp cải thiện thời gian phản hồi với chi phí tối ưu nhất (MOST cost-effectively).',
    solutionVi:
      'Phương án C là câu trả lời chính xác vì sử dụng AWS Global Accelerator: (1) Cung cấp 2 địa chỉ IP Anycast tĩnh làm điểm truy cập gần nhất với khách hàng trên toàn cầu; (2) Tiếp nhận lưu lượng của khách hàng tại Edge Location gần nhất và chuyển tiếp qua mạng cáp quang nội bộ tốc độ cao của AWS tới thẳng EC2 ở us-east-1, giảm thiểu số lượng hop mạng và bỏ qua tình trạng nghẽn của Internet công cộng; (3) Tối ưu hoàn hảo cho các giao dịch API tương tác động (dynamic transactional API) của hệ thống ERP.',
    trapWarningVi:
      'Cảnh giác: (1) Bẫy Amazon CloudFront CachingOptimized (B): Hệ thống ERP xử lý các giao dịch API đọc ghi biến động liên tục (non-cacheable), cơ chế cache của CloudFront không cải thiện được các lệnh gọi API động; (2) Bẫy AWS Direct Connect (A): Đắt đỏ và mất nhiều tháng triển khai cho từng khách hàng quốc tế; (3) Bẫy Site-to-Site VPN (D): Vẫn chạy trên Internet công cộng nên vẫn bị ảnh hưởng bởi độ trễ và jitter.',
    keyTakeawayVi:
      'AWS Global Accelerator: Tăng tốc các luồng dữ liệu động, không thể cache (dynamic API / TCP / UDP) qua mạng cáp quang riêng toàn cầu của AWS.',
    ruleEn:
      'AWS SAA-C03 Core Rule: To accelerate dynamic, non-cacheable API traffic for global users to a single AWS Region cost-effectively, use AWS Global Accelerator with Anycast IP routing over the AWS global network.',
  },

  // Question 9: Comprehend Sentiment Analysis + SQS + Lambda + DynamoDB TTL
  9: {
    objectiveVi:
      'Tự động hóa quy trình khảo sát ý kiến khách hàng (hàng ngàn khảo sát mỗi giờ), tự động đánh giá cảm xúc (sentiment analysis) và lưu trữ kết quả trong 12 tháng qua theo cách mở rộng tốt nhất (MOST scalable).',
    solutionVi:
      'Phương án A là câu trả lời chính xác vì kết hợp chuỗi dịch vụ serverless: API Gateway nhận kết quả khảo sát -> đẩy vào Amazon SQS để đệm chống tràn tải -> AWS Lambda kích hoạt để gọi Amazon Comprehend (dịch vụ NLP chuyên phân tích cảm xúc văn bản) -> lưu kết quả vào Amazon DynamoDB với tính năng TTL (Time To Live) 365 ngày để tự động xóa dữ liệu cũ miễn phí mà không tốn công vận hành.',
    trapWarningVi:
      'Cảnh giác các bẫy dịch vụ AI của AWS: (1) Bẫy Amazon Rekognition (C): Rekognition chỉ dùng để phân tích hình ảnh và video, KHÔNG phân tích cảm xúc văn bản khảo sát; (2) Bẫy Amazon Lex (D): Lex dùng để xây dựng chatbot đàm thoại bằng giọng nói/văn bản, không phải dịch vụ phân tích sắc thái cảm xúc chuyên sâu như Comprehend; (3) Bẫy máy chủ EC2 (B): Tự chạy máy chủ EC2 mở rộng kém hơn kiến trúc serverless hoàn toàn.',
    keyTakeawayVi:
      'Amazon Comprehend: Dịch vụ AI chuyên dụng để phân tích cảm xúc (Sentiment Analysis) trong văn bản. DynamoDB TTL: Tự động hết hạn và dọn dẹp dữ liệu cũ sau 365 ngày không tốn phí.',
    ruleEn:
      'AWS SAA-C03 Core Rule: For scalable sentiment analysis of customer survey text, ingest via API Gateway and SQS, process with AWS Lambda calling Amazon Comprehend, and store in DynamoDB with TTL for automatic 12-month expiration.',
  },

  // Question 10: Systems Manager Patching ALB Target Group (Answer: C, D)
  10: {
    objectiveVi:
      'Quản trị và vá lỗi (patching) các máy chủ Amazon EC2 trong IP address target group phía sau ALB bằng AWS Systems Manager. Cần tự động gỡ bỏ EC2 khỏi dịch vụ trong khi vá lỗi để không nhận traffic và giải quyết lỗi phát sinh trong cửa sổ bảo trì mà không gây gián đoạn.',
    solutionVi:
      'Kết hợp hai phương án C và D (Choose two) là giải pháp tối ưu và chính xác nhất theo tiêu chuẩn AWS: (1) Phương án C: Sử dụng tài liệu tự động hóa chuẩn AWS Systems Manager Automation "AWSEC2-PatchLoadBalancerInstance". Tài liệu này được thiết kế riêng để tự động deregister instance/IP khỏi target group, chờ kết thúc các kết nối đang xử lý (connection draining), áp dụng bản vá lỗi hệ điều hành bằng Patch Manager, khởi động lại nếu cần, rồi register lại vào target group và chờ health check chuyển sang Healthy trước khi chuyển sang máy chủ tiếp theo; (2) Phương án D: Sử dụng Systems Manager Maintenance Windows để xác định lịch biểu bảo trì định kỳ ngoài giờ cao điểm, kiểm soát tốc độ thực thi (concurrency limit) và ngưỡng lỗi (error threshold), giúp tự động hóa việc đưa từng máy chủ ra khỏi dịch vụ để vá lỗi an toàn.',
    trapWarningVi:
      'Cảnh giác 3 bẫy phổ biến của câu hỏi này: (1) Bẫy State Manager (Phương án E): State Manager dùng để duy trì cấu hình mong muốn liên tục (drift detection/compliance), KHÔNG thiết kế cho việc lập lịch vá lỗi định kỳ trong khung giờ; việc dùng ALB health check để ngắt traffic sẽ làm rớt các kết nối của khách hàng đang xử lý (không có connection draining); (2) Bẫy đổi Target Type (Phương án A): Target Type (IP vs Instance) là thuộc tính bất biến khi tạo target group và việc đổi target type hoàn toàn không giải quyết được việc tự động hóa gỡ bỏ instance khi vá lỗi; (3) Bẫy giữ nguyên document cũ (Phương án B): Đề bài đã nêu rõ quy trình hiện tại gặp lỗi, giữ nguyên sẽ không khắc phục được.',
    keyTakeawayVi:
      'Công thức SAA-C03: "Vá lỗi EC2 sau ALB không gây gián đoạn" = AWSEC2-PatchLoadBalancerInstance (tự động deregister + drain + patch + re-register) + Systems Manager Maintenance Windows (lập lịch khung giờ bảo trì).',
    ruleEn:
      'AWS SAA-C03 Core Rule: To safely patch EC2 instances behind an ALB without dropping client connections, schedule the AWSEC2-PatchLoadBalancerInstance Automation document within Systems Manager Maintenance Windows.',
    choiceAnalyses: {
      A: {
        isCorrect: false,
        violationType: 'Không giải quyết được yêu cầu & Cấu hình không khả thi',
        shortReasonVi: 'Đổi target type không tự động hóa việc gỡ bỏ EC2 khi vá lỗi và Target Type là bất biến sau khi tạo.',
        detailedReasonVi:
          'Target Group khi đã tạo với target type là IP address thì không thể chuyển đổi trực tiếp sang instance type. Quan trọng hơn, dù target group dạng nào thì nếu không có quy trình tự động gỡ bỏ (deregister) và chờ connection draining thì việc vá lỗi vẫn gây lỗi cho người dùng.',
        contrastWithCorrectVi:
          'Phương án C và D xử lý thẳng vào cốt lõi quy trình tự động hóa việc gỡ bỏ và đưa lại vào dịch vụ.',
      },
      B: {
        isCorrect: false,
        violationType: 'Tiếp tục gặp lỗi vận hành',
        shortReasonVi: 'Đề bài nêu rõ quy trình hiện tại đang nhận lỗi, tiếp tục dùng mà không thay đổi sẽ không giải quyết được.',
        detailedReasonVi:
          'Đề bài đã chỉ rõ: "When the company attempts to follow the security protocol during the next patch, the company receives errors during the patching window." Việc tiếp tục giữ nguyên document mà không cấu hình cơ chế tương thích sẽ tiếp tục gây ra lỗi tương tự.',
        contrastWithCorrectVi:
          'Cần dùng tài liệu chuyên dụng AWSEC2-PatchLoadBalancerInstance để xử lý việc ngắt kết nối an toàn.',
      },
      C: {
        isCorrect: true,
        violationType: 'Đáp án chính xác (1/2)',
        shortReasonVi: 'Tài liệu AWSEC2-PatchLoadBalancerInstance tự động hóa hoàn toàn việc deregister, drain traffic, patch và re-register.',
        detailedReasonVi:
          'Tài liệu tự động hóa AWSEC2-PatchLoadBalancerInstance của Systems Manager là giải pháp chuẩn của AWS: tự động ngắt instance khỏi target group, chờ hoàn tất connection draining để các request hiện tại không bị gián đoạn, chạy bản vá lỗi, kiểm tra health check và đăng ký lại vào target group.',
      },
      D: {
        isCorrect: true,
        violationType: 'Đáp án chính xác (2/2)',
        shortReasonVi: 'Systems Manager Maintenance Windows quản lý lịch biểu và giới hạn phạm vi tác vụ vá lỗi trong khung giờ bảo trì.',
        detailedReasonVi:
          'Systems Manager Maintenance Windows cho phép định nghĩa khung giờ bảo trì (window), tần suất lặp lại, thời gian dừng tác vụ trước khi hết giờ (cutoff), đồng thời cho phép gán Automation Task để thực hiện vá lỗi từng máy một cách có kiểm soát.',
      },
      E: {
        isCorrect: false,
        violationType: 'Sai công cụ & Gián đoạn kết nối người dùng',
        shortReasonVi: 'State Manager dùng cho quản lý cấu hình liên tục, không dùng cho khung giờ bảo trì; health check ngắt kết nối đột ngột.',
        detailedReasonVi:
          'Systems Manager State Manager dùng để đảm bảo trạng thái máy chủ tuân thủ chính sách liên tục (như cài agent, cập nhật antivirus định kỳ). Việc dựa vào ALB Health Check để điều hướng traffic sẽ khiến các request của người dùng đang xử lý bị ngắt đột ngột và nhận lỗi HTTP 502/504 thay vì được connection draining êm dịu.',
        contrastWithCorrectVi:
          'Phải dùng Maintenance Windows để lập lịch và AWSEC2-PatchLoadBalancerInstance để connection draining êm dịu.',
      },
    },
  },

  // Question 104: High Availability for EC2 Auto Scaling Group behind ALB
  104: {
    objectiveVi:
      'Ứng dụng web đa tầng hiện chạy 6 máy chủ EC2 front-end trong 1 Auto Scaling Group ở duy nhất 1 Availability Zone (Single-AZ) phía sau Application Load Balancer (ALB). Cần chuyển sang kiến trúc có tính sẵn sàng cao (High Availability) mà tuyệt đối không cần chỉnh sửa ứng dụng (without modifying the application).',
    solutionVi:
      'Phương án B là câu trả lời chính xác vì chỉnh sửa cấu hình Auto Scaling Group hiện tại để phân bổ đều 3 instances trên mỗi Availability Zone qua 2 AZs (3 instances across each of two Availability Zones): (1) Đạt chuẩn High Availability: Khi một AZ gặp thảm họa (mất điện, hỏng mạng), 3 instances ở AZ còn lại vẫn duy trì phục vụ người dùng liên tục và ASG sẽ tự động khởi tạo thêm 3 instances mới ở AZ lành lặn để bù đủ Desired Capacity = 6; (2) Application Load Balancer (ALB) tự động phát hiện và cân bằng tải đều qua cả 2 AZ; (3) Hoàn toàn không sửa đổi mã nguồn ứng dụng hay kiến trúc mạng phức tạp, giữ nguyên chi phí và đạt chuẩn Well-Architected Reliability Pillar.',
    trapWarningVi:
      'Cảnh giác 3 bẫy kinh điển: (1) Bẫy ASG xuyên Region (Phương án A): Auto Scaling Group là tài nguyên Regional, KHÔNG THỂ trải dài qua 2 Region khác nhau; (2) Bẫy tạo template ở Region khác (Phương án C): Đây là chiến lược Disaster Recovery (DR) dự phòng thảm họa, không phải High Availability (HA) tức thời, gây downtime và đòi hỏi định tuyến liên vùng phức tạp; (3) Bẫy ALB Round-robin (Phương án D): Thuật toán cân bằng tải của ALB không giải quyết được rủi ro Single Point of Failure khi toàn bộ máy chủ vẫn nằm trong 1 AZ duy nhất.',
    keyTakeawayVi:
      'Công thức SAA-C03: "High Availability cho EC2 Auto Scaling mà không sửa app" = Phân bổ instances đồng đều qua ít nhất 2 Availability Zones (Multi-AZ trong cùng 1 Region). Auto Scaling Group không bao giờ trải rộng xuyên 2 Region.',
    ruleEn:
      'AWS SAA-C03 Core Rule: Auto Scaling groups (ASGs) and ALBs are regional resources that span multiple Availability Zones within a single Region. An ASG cannot span multiple Regions. High Availability without application changes is achieved by distributing instances across multiple AZs in the same Region.',
    choiceAnalyses: {
      A: {
        isCorrect: false,
        violationType: 'Sai phạm vi cấp độ tài nguyên (ASG là Regional Resource)',
        shortReasonVi: 'Auto Scaling Group là tài nguyên cấp Vùng (Region), không thể tạo một ASG trải dài qua 2 Region khác nhau.',
        detailedReasonVi:
          'Phương án A sai hoàn toàn về mặt kỹ thuật AWS vì Auto Scaling Group (ASG) là một tài nguyên cấp Regional. Một ASG chỉ có thể quản lý và phân bổ các EC2 instances qua các Availability Zones (AZs) bên trong duy nhất MỘT Region, không thể trải dài qua hai Region khác nhau. Tương tự, Application Load Balancer (ALB) cũng chỉ hoạt động trong phạm vi một Region duy nhất.',
        contrastWithCorrectVi:
          'Phương án B điều chỉnh ASG phân bổ đều các máy chủ qua 2 Availability Zones trong cùng một Region, hoàn toàn đúng chuẩn kiến trúc AWS.',
      },
      B: {
        isCorrect: true,
        violationType: 'Đáp án chính xác',
        shortReasonVi: 'Chỉnh sửa Auto Scaling group phân bổ 3 instances trên mỗi AZ qua 2 Availability Zones đạt chuẩn High Availability.',
        detailedReasonVi:
          'Phương án B là đáp án chuẩn xác nhất: Phân bổ 6 instances đều qua 2 Availability Zones (mỗi AZ 3 instances). ALB tự động phân phối lưu lượng qua cả 2 AZ. Nếu một AZ gặp sự cố, 3 instances ở AZ còn lại vẫn tiếp tục phục vụ lưu lượng và ASG sẽ tự động tạo thêm 3 instances ở AZ còn hoạt động để duy trì đủ tải, đáp ứng hoàn hảo yêu cầu High Availability mà không cần sửa đổi ứng dụng.',
      },
      C: {
        isCorrect: false,
        violationType: 'Chiến lược Disaster Recovery thay vì High Availability tức thì',
        shortReasonVi: 'Tạo template ở Region khác là giải pháp Disaster Recovery (phục hồi sau thảm họa), không đem lại High Availability tức thời.',
        detailedReasonVi:
          'Phương án C sai vì việc tạo Auto Scaling template ở một Region khác thuộc về mô hình khắc phục thảm họa (Disaster Recovery - Pilot Light/Warm Standby). Khi AZ hiện tại gặp sự cố, hệ thống vẫn sẽ bị ngắt kết nối (downtime), phải chờ khởi động lại ở Region khác và cấu hình chuyển đổi DNS (Route 53 failover). Hơn nữa, việc sao chép sang Region khác đòi hỏi đồng bộ dữ liệu liên vùng và cấu hình phức tạp, không đáp ứng tiêu chí High Availability tức thì và "without modifying the application".',
        contrastWithCorrectVi:
          'High Availability (HA) giải quyết sự cố tức thì trong cùng Region bằng cách dùng Multi-AZ (Phương án B), trong khi Disaster Recovery (DR xuyên Region) dùng cho kịch bản toàn bộ một Region bị thảm họa lớn.',
      },
      D: {
        isCorrect: false,
        violationType: 'Không loại bỏ được rủi ro Single Point of Failure',
        shortReasonVi: 'Cấu hình round-robin trên ALB không giải quyết được vấn đề toàn bộ 6 instances vẫn nằm trong 1 AZ duy nhất.',
        detailedReasonVi:
          'Phương án D sai vì Application Load Balancer (ALB) vốn đã mặc định phân phối tải đều tới các targets. Việc đổi thuật toán cân bằng tải trên ALB hoàn toàn vô nghĩa nếu toàn bộ 6 máy chủ EC2 vẫn đang nằm chung trong một Availability Zone duy nhất. Khi AZ đó gặp sự cố về điện hoặc mạng, toàn bộ 6 máy chủ đều chết cùng lúc (Single Point of Failure), do đó không đem lại High Availability.',
        contrastWithCorrectVi:
          'Cốt lõi của High Availability ở tầng điện toán là phân bổ máy chủ sang nhiều Availability Zones vật lý tách biệt (Phương án B).',
      },
    },
  },
};

export function getCuratedExplanation(questionId: number): CuratedQuestionExplanation | undefined {
  return CURATED_QUESTION_EXPLANATIONS[questionId];
}
