/**
 * semanticExplanationEngine.ts
 * Intelligent, context-aware explanation engine for AWS SAA-C03 questions.
 * Eliminates keyword-concatenation artifacts and generates question-tailored explanations.
 */

import type { Question } from './types';
import { CURATED_QUESTION_EXPLANATIONS, type CuratedQuestionExplanation } from './curatedExplanations';

export interface SemanticExplanation {
  objectiveVi: string;
  solutionVi: string;
  trapWarningVi: string;
  keyTakeawayVi: string;
  ruleEn: string;
}

/**
 * Known AWS services and their specific architectural values
 */
interface ServiceBenefit {
  pattern: RegExp;
  name: string;
  roleVi: string;
  advantageVi: string;
}

const SERVICE_BENEFITS: ServiceBenefit[] = [
  {
    pattern: /\b(kms|key management service)\b/i,
    name: 'AWS KMS',
    roleVi: 'quản lý khóa mật mã và mã hóa phong bì (envelope encryption)',
    advantageVi: 'bảo vệ dữ liệu với phần cứng chuẩn FIPS 140-2 và kiểm soát quyền qua IAM Role tự động không cần lưu khóa tĩnh',
  },
  {
    pattern: /\b(s3|amazon s3|s3 bucket)\b/i,
    name: 'Amazon S3',
    roleVi: 'lưu trữ đối tượng có tính sẵn sàng cao và khả năng mở rộng vô hạn',
    advantageVi: 'tự động nhân bản qua tối thiểu 3 Availability Zones với độ bền 99.999999999% (11 9s)',
  },
  {
    pattern: /\b(sqs fifo|fifo queue)\b/i,
    name: 'Amazon SQS FIFO',
    roleVi: 'hàng đợi thông điệp First-In, First-Out',
    advantageVi: 'bảo toàn tuyệt đối thứ tự tiếp nhận và loại trừ thông điệp trùng lặp (deduplication)',
  },
  {
    pattern: /\b(sqs|simple queue service)\b/i,
    name: 'Amazon SQS',
    roleVi: 'hàng đợi thông điệp phân rã kiến trúc',
    advantageVi: 'lưu đệm tin nhắn chống tràn tải (backpressure) và tách rời các thành phần của hệ thống',
  },
  {
    pattern: /\b(lambda|aws lambda)\b/i,
    name: 'AWS Lambda',
    roleVi: 'tính toán phi máy chủ (Serverless compute)',
    advantageVi: 'tự động co giãn theo từng request, chỉ trả tiền khi code chạy và hoàn toàn không tốn công bảo trì hệ điều hành',
  },
  {
    pattern: /\b(dynamodb global tables|global table)\b/i,
    name: 'DynamoDB Global Tables',
    roleVi: 'cơ sở dữ liệu NoSQL phân tán toàn cầu active-active',
    advantageVi: 'tự động nhân bản đa vùng (Multi-Region) với độ trễ micro-giây và khả năng phục hồi thảm họa tức thì',
  },
  {
    pattern: /\b(dynamodb|amazon dynamodb)\b/i,
    name: 'Amazon DynamoDB',
    roleVi: 'cơ sở dữ liệu NoSQL dạng key-value',
    advantageVi: 'đáp ứng độ trễ một chữ số mili-giây ở bất kỳ quy mô nào và tích hợp TTL tự động xóa dữ liệu hết hạn miễn phí',
  },
  {
    pattern: /\b(cloudfront|amazon cloudfront)\b/i,
    name: 'Amazon CloudFront',
    roleVi: 'mạng phân phối nội dung (CDN) tại các điểm biên',
    advantageVi: 'lưu đệm nội dung tĩnh/động gần người dùng nhất để giảm tải cho origin và giảm độ trễ truy cập',
  },
  {
    pattern: /\b(global accelerator|aws global accelerator)\b/i,
    name: 'AWS Global Accelerator',
    roleVi: 'tăng tốc lưu lượng truy cập qua mạng backbone riêng của AWS',
    advantageVi: 'cung cấp 2 địa chỉ IP Anycast tĩnh giúp định tuyến người dùng qua tuyến đường mạng nhanh nhất và chịu lỗi cao',
  },
  {
    pattern: /\b(transfer acceleration|s3 transfer acceleration)\b/i,
    name: 'S3 Transfer Acceleration',
    roleVi: 'tăng tốc tải lên dữ liệu vào S3 xuyên lục địa',
    advantageVi: 'truyền dữ liệu từ xa vào Edge Location gần nhất rồi đi qua mạng cáp quang tối ưu của AWS vào bucket đích',
  },
  {
    pattern: /\b(efs|amazon efs)\b/i,
    name: 'Amazon EFS',
    roleVi: 'hệ thống tệp chia sẻ chuẩn POSIX/NFS cho Linux',
    advantageVi: 'cho phép hàng trăm máy chủ EC2 đọc ghi đồng thời trên nhiều Availability Zones',
  },
  {
    pattern: /\b(gateway vpc endpoint|vpc endpoint)\b/i,
    name: 'Gateway VPC Endpoint',
    roleVi: 'kết nối mạng riêng biệt nội bộ tới S3 và DynamoDB',
    advantageVi: 'kết nối an toàn không qua Internet công cộng và hoàn toàn miễn phí (không tốn phí NAT Gateway)',
  },
  {
    pattern: /\b(aurora|amazon aurora|aurora serverless)\b/i,
    name: 'Amazon Aurora',
    roleVi: 'cơ sở dữ liệu quan hệ hiệu năng cao tương thích MySQL/PostgreSQL',
    advantageVi: 'tự động nhân bản 6 bản sao trên 3 Availability Zones với khả năng failover nhanh chóng',
  },
  {
    pattern: /\b(auto scaling|auto scaling group)\b/i,
    name: 'Auto Scaling Group',
    roleVi: 'tự động co giãn số lượng máy chủ theo nhu cầu',
    advantageVi: 'duy trì số lượng instance tối ưu theo tải thực tế, tự động thay thế instance lỗi và phân bổ đều qua nhiều AZ',
  },
  {
    pattern: /\b(secrets manager|aws secrets manager)\b/i,
    name: 'AWS Secrets Manager',
    roleVi: 'quản lý và bảo vệ thông tin đăng nhập bí mật',
    advantageVi: 'hỗ trợ tự động xoay vòng mật khẩu định kỳ (auto-rotation) cho cơ sở dữ liệu qua Lambda',
  },
  {
    pattern: /\b(eventbridge|amazon eventbridge)\b/i,
    name: 'Amazon EventBridge',
    roleVi: 'xe bus định tuyến sự kiện (Serverless event bus)',
    advantageVi: 'kết nối các ứng dụng bất đồng bộ bằng các quy tắc lọc sự kiện theo thời gian thực',
  },
];

/**
 * Extracts dominant architectural constraint from question text
 */
function extractDominantConstraint(text: string): { labelVi: string; tipVi: string; ruleEn: string } {
  const lower = text.toLowerCase();

  if (lower.includes('least operational overhead') || lower.includes('minimal operational') || lower.includes('minimize operational complexity')) {
    return {
      labelVi: 'giảm thiểu tối đa độ phức tạp vận hành (LEAST operational overhead)',
      tipVi: 'Ưu tiên dịch vụ Managed hoặc Serverless hoàn toàn do AWS quản lý hạ tầng (như S3, KMS, Lambda, DynamoDB, SQS); tránh các phương án tự cài phần mềm, tự viết script hoặc tự vận hành cụm máy chủ EC2.',
      ruleEn: 'Prioritize fully managed and serverless AWS services to eliminate operational overhead and infrastructure maintenance.',
    };
  }

  if (lower.includes('most cost-effective') || lower.includes('lowest cost') || lower.includes('minimize cost') || lower.includes('least expensive')) {
    return {
      labelVi: 'tối ưu hóa chi phí triệt để (MOST cost-effective)',
      tipVi: 'Chọn phương án có tổng chi phí sở hữu (TCO) thấp nhất: tận dụng Gateway VPC Endpoint (miễn phí), S3 Lifecycle chuyển tier lưu trữ rẻ hơn, hoặc EC2 Spot Instances cho tác vụ chấp nhận ngắt quãng.',
      ruleEn: 'Select the architecture that fulfills functional requirements at the lowest cost, avoiding over-provisioned resources or unnecessary data transfer fees.',
    };
  }

  if (lower.includes('fastest') || lower.includes('as quickly as possible') || lower.includes('lowest latency') || lower.includes('sub-millisecond')) {
    return {
      labelVi: 'tối ưu tốc độ và độ trễ tối thiểu (Lowest Latency / High Performance)',
      tipVi: 'Áp dụng các cơ chế tăng tốc biên (Edge Locations): S3 Transfer Acceleration, CloudFront CDN, AWS Global Accelerator hoặc bộ nhớ đệm ElastiCache/DAX.',
      ruleEn: 'Leverage edge caching and acceleration layers to minimize latency and accelerate data transfers over the AWS private global backbone.',
    };
  }

  if (lower.includes('highly available') || lower.includes('fault-tolerant') || lower.includes('resilient') || lower.includes('disaster recovery')) {
    return {
      labelVi: 'tính sẵn sàng cao và khả năng chống chịu sự cố (High Availability & Resilience)',
      tipVi: 'Thiết kế hệ thống trải rộng tối thiểu 2-3 Availability Zones hoặc đa Region, loại bỏ hoàn toàn các điểm lỗi đơn lẻ (Single Point of Failure - SPOF).',
      ruleEn: 'Eliminate single points of failure by architecting across multiple Availability Zones or Regions with automated failover.',
    };
  }

  if (lower.includes('order that they are received') || lower.includes('strict order') || lower.includes('fifo')) {
    return {
      labelVi: 'đảm bảo thứ tự tiếp nhận nghiêm ngặt (Strict FIFO Ordering)',
      tipVi: 'Bắt buộc sử dụng hàng đợi Amazon SQS FIFO kết hợp Message Group ID để đảm bảo xử lý First-In First-Out và ngăn chặn trùng lặp đơn hàng.',
      ruleEn: 'Use Amazon SQS FIFO queues to guarantee strict message ordering and exactly-once processing.',
    };
  }

  return {
    labelVi: 'đáp ứng đúng chuẩn Well-Architected Framework của AWS',
    tipVi: 'Phân tích kỹ các yêu cầu cốt lõi của đề bài để loại bỏ các phương án anti-pattern hoặc cấu hình sai dịch vụ chuyên dụng của AWS.',
    ruleEn: 'Apply AWS Well-Architected best practices tailored to the specific functional and operational constraints of the workload.',
  };
}

/**
 * Identifies services present in a specific choice text
 */
function identifyServicesInChoice(choiceText: string): ServiceBenefit[] {
  const found: ServiceBenefit[] = [];
  for (const s of SERVICE_BENEFITS) {
    if (s.pattern.test(choiceText)) {
      found.push(s);
    }
  }
  return found;
}

/**
 * Generates an intelligent, scenario-specific semantic explanation for any question
 */
export function generateSemanticExplanation(question: Question): SemanticExplanation {
  // 1. Check curated repository first for 100% precision
  const curated = CURATED_QUESTION_EXPLANATIONS[question.id];
  if (curated) {
    return {
      objectiveVi: curated.objectiveVi,
      solutionVi: curated.solutionVi,
      trapWarningVi: curated.trapWarningVi,
      keyTakeawayVi: curated.keyTakeawayVi,
      ruleEn: curated.ruleEn,
    };
  }

  // 2. Dynamic context extraction
  const correctChoiceText = question.choices[question.answer] || '';
  const correctServices = identifyServicesInChoice(correctChoiceText);
  const constraint = extractDominantConstraint(question.text);

  // Extract scenario summary from question text
  const cleanQText = question.text.replace(/\n+/g, ' ').trim();
  const sentences = cleanQText.split(/(?<=[.?!])\s+/);
  const scenarioIntro = sentences.slice(0, 2).join(' ');

  // Objective
  const objectiveVi = `${scenarioIntro} Đề bài yêu cầu giải pháp kiến trúc tối ưu nhằm: ${constraint.labelVi}.`;

  // Solution
  let solutionVi = `Phương án ${question.answer} là câu trả lời chính xác: "${correctChoiceText}".\n\n`;
  if (correctServices.length > 0) {
    const serviceDetails = correctServices
      .map(s => `• **${s.name}**: Đảm nhận vai trò ${s.roleVi}, đem lại ưu thế ${s.advantageVi}.`)
      .join('\n');
    solutionVi += `Giải pháp này áp dụng đúng các công nghệ chuẩn của AWS:\n${serviceDetails}\n\nQua đó giải quyết triệt để yêu cầu của đề bài mà vẫn đáp ứng hoàn hảo ràng buộc ${constraint.labelVi}.`;
  } else {
    solutionVi += `Phương án này triển khai trực tiếp các dịch vụ chuẩn theo khuyến nghị của AWS Well-Architected Framework, đáp ứng trọn vẹn mục tiêu kiến trúc với chi phí và độ phức tạp vận hành tối ưu nhất.`;
  }

  // Trap Warning based on wrong choices
  const wrongChoices = question.choiceKeys
    .filter(k => k !== question.answer)
    .map(k => ({ key: k, text: question.choices[k] || '' }));

  const trapPoints: string[] = [];
  for (const wc of wrongChoices) {
    const lower = wc.text.toLowerCase();
    if (lower.includes('ec2') && !correctChoiceText.toLowerCase().includes('ec2')) {
      trapPoints.push(`Phương án ${wc.key} tự quản lý máy chủ EC2 làm tăng gánh nặng vá lỗi và vận hành hạ tầng.`);
    } else if (lower.includes('ebs') && correctChoiceText.toLowerCase().includes('s3')) {
      trapPoints.push(`Phương án ${wc.key} dùng Amazon EBS chỉ gắn với 1 EC2 trong 1 AZ duy nhất, không đạt chuẩn lưu trữ tính sẵn sàng cao Multi-AZ như S3.`);
    } else if (lower.includes('manual') || lower.includes('manually')) {
      trapPoints.push(`Phương án ${wc.key} yêu cầu thao tác thủ công, vi phạm nguyên tắc tự động hóa của kiến trúc hiện đại.`);
    } else if (lower.includes('standard') && correctChoiceText.toLowerCase().includes('fifo')) {
      trapPoints.push(`Phương án ${wc.key} dùng hàng đợi tiêu chuẩn (Standard) không bảo toàn thứ tự nghiêm ngặt (FIFO).`);
    } else if (lower.includes('nat gateway') && correctChoiceText.toLowerCase().includes('endpoint')) {
      trapPoints.push(`Phương án ${wc.key} dùng NAT Gateway gây tốn kém chi phí hơn nhiều so với Gateway VPC Endpoint miễn phí.`);
    }
  }

  const trapWarningVi = trapPoints.length > 0
    ? `Cảnh giác các bẫy thường gặp trong câu này:\n${trapPoints.map(t => `- ${t}`).join('\n')}`
    : `Cảnh giác bẫy đề thi: ${constraint.tipVi}`;

  // Key Takeaway
  const primaryServiceName = correctServices[0]?.name || question.serviceTags[0] || 'AWS Solution';
  const keyTakeawayVi = `${primaryServiceName}: Lựa chọn chuẩn xác đáp ứng tiêu chí "${constraint.labelVi}".`;

  // RuleEn
  const ruleEn = `AWS SAA-C03 Core Rule: ${constraint.ruleEn}`;

  return {
    objectiveVi,
    solutionVi,
    trapWarningVi,
    keyTakeawayVi,
    ruleEn,
  };
}

/**
 * Returns curated question explanation if exists
 */
export function getCuratedExplanation(questionId: number): CuratedQuestionExplanation | undefined {
  return CURATED_QUESTION_EXPLANATIONS[questionId];
}
