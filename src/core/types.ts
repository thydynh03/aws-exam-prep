export type AWSDomain = 
  | 'Domain 1: Design Secure Architectures'
  | 'Domain 2: Design Resilient Architectures'
  | 'Domain 3: Design High-Performing Architectures'
  | 'Domain 4: Design Cost-Optimized Architectures';

export type Difficulty = 'Easy' | 'Medium' | 'Hard';

export type MasteryStatus = 'NEW' | 'LEARNING' | 'REVIEW' | 'MASTERED';

export type ConfidenceLevel = 'guessing' | 'low' | 'medium' | 'high';

export interface RawQuestion {
  question_id: number | string;
  question: string;
  choices: Record<string, string>;
  answer: string;
  answer_description: string;
  answers_community: string[];
  topic: string | number;
}

export interface CommunityVote {
  choice: string;
  percentage: number;
  raw: string;
}

export interface Question {
  id: number;
  originalId: string;
  text: string;
  choices: Record<string, string>;
  choiceKeys: string[];
  answer: string; // sorted uppercase letters e.g. "A" or "CD"
  answerDescription: string;
  communityVotes: CommunityVote[];
  topic: string;
  serviceTags: string[];
  domain: AWSDomain;
  difficulty: Difficulty;
  isMultiSelect: boolean;
  expectedChoicesCount: number;
}

export interface OptionExplanation {
  key: string;
  text: string;
  isCorrect: boolean;
  isSelected?: boolean;
  violationType: string;
  shortReasonVi: string;
  detailedReasonVi: string;
  contrastWithCorrectVi?: string;
}

export type AppMode = 
  | 'home' 
  | 'study' 
  | 'exam' 
  | 'result' 
  | 'review' 
  | 'weakness' 
  | 'domain' 
  | 'flashcards' 
  | 'services' 
  | 'studyplan';

export interface ExamSession {
  id: string;
  startedAt: number;
  durationSeconds: number;
  timeRemainingSeconds: number;
  status: 'running' | 'paused' | 'submitted';
  questionIds: number[];
  currentIndex: number;
  answers: Record<number, string>; // questionId -> selected choice(s), e.g. "A" or "CD"
  markedForReview: Record<number, boolean>;
  submittedAt?: number;
  result?: ExamResult;
  examTitle?: string;
}

export interface QuestionResult {
  questionId: number;
  userAnswer: string;
  correctAnswer: string;
  isCorrect: boolean;
  wasMarked: boolean;
  timeSpentSeconds?: number;
  domain: AWSDomain;
}

export interface DomainScore {
  domain: AWSDomain;
  total: number;
  correct: number;
  scorePercent: number;
}

export interface ExamResult {
  id: string;
  sessionId: string;
  date: string;
  totalQuestions: number;
  answeredCount: number;
  correctCount: number;
  incorrectCount: number;
  unansweredCount: number;
  scorePercent: number;
  scaledScore: number; // AWS scaled 100 - 1000
  passed: boolean;
  timeUsedSeconds: number;
  questionResults: QuestionResult[];
  domainScores: DomainScore[];
}

export interface ExamAttemptRecord {
  id: string;
  date: string;
  scorePercent: number;
  scaledScore: number;
  passed: boolean;
  totalQuestions: number;
  correctCount: number;
  incorrectCount: number;
  unansweredCount: number;
  timeUsedSeconds: number;
  examType?: string;
}

export interface StudyItemProgress {
  selectedAnswer: string;
  isSubmitted: boolean;
  isCorrect: boolean;
  attemptsCount: number;
  lastAttemptedAt: number;
  confidence?: ConfidenceLevel;
  isDifficult?: boolean;
}

export interface StudyProgress {
  currentIndex: number;
  items: Record<number, StudyItemProgress>;
}

export interface PersonalNote {
  questionId: number;
  noteText: string;
  updatedAt: number;
}

export interface Flashcard {
  id: string;
  deckId: 'services' | 'domains' | 'traps' | 'comparisons';
  title: string;
  category: string;
  front: string;
  back: string;
  keyTakeaway: string;
  commonTrap?: string;
  relatedServices?: string[];
  box: number; // Leitner box 1..5
  reviewsCount: number;
  lastReviewedAt?: number;
  nextReviewDue?: number;
}

export interface FlashcardReviewRecord {
  cardId: string;
  rating: 'again' | 'hard' | 'good' | 'easy';
  timestamp: number;
}

export interface ServiceComparison {
  id: string;
  title: string;
  services: string[];
  category: string;
  dimensions: {
    name: string;
    description: Record<string, string>;
  }[];
  examTip: string;
  commonTrap: string;
  docsUrls?: Array<{ label: string; url: string }>;
}

export interface AWSServiceGuide {
  id: string;
  name: string;
  category: string;
  abbreviation?: string;
  summary: string;
  coreConcepts: string[];
  useCases: string[];
  examRelevance: string;
  commonTraps: string[];
  relatedServices: string[];
  docsUrl: string;
}

// ============================================================
// Lớp nội dung chuyên sâu cho từng AWS service (Service Deep Dive)
// Toàn bộ đều optional và nằm ở map riêng SERVICE_DEEP_DIVES,
// nên AWS_SERVICES hiện có không phải sửa dòng nào.
// ============================================================

/** Một giới hạn hoặc quota cần nhớ khi đi thi. */
export interface DeepDiveLimit {
  /** Tên giới hạn, ví dụ "Thời gian chạy tối đa" */
  name: string;
  /** Giá trị, ví dụ "15 phút" */
  value: string;
  /** Giới hạn này ép ta đổi sang kiến trúc nào khi vượt ngưỡng */
  implication?: string;
  /** Xin tăng được qua Service Quotas, hay là hard limit */
  adjustable?: boolean;
}

/** Một bước trong kiến trúc tham chiếu. */
export interface DeepDiveArchitectureStep {
  order: number;
  /** Thành phần thực hiện bước này, ví dụ "Amazon S3" */
  component: string;
  /** Bước này làm gì */
  action: string;
  /** Vì sao chọn thành phần này thay vì phương án khác */
  whyThisChoice?: string;
}

/** Một ví dụ kiến trúc thực tế hoàn chỉnh. */
export interface DeepDiveArchitecture {
  id: string;
  title: string;
  /** Bối cảnh nghiệp vụ và ràng buộc: RTO/RPO, ngân sách, tuân thủ... */
  scenario: string;
  steps: DeepDiveArchitectureStep[];
  /** Phương án đã cân nhắc rồi loại, kèm lý do */
  rejectedAlternatives?: Array<{ option: string; whyRejected: string }>;
  /** Đánh đổi phải chấp nhận */
  tradeoffs?: string[];
}

/** Cơ chế hoạt động bên trong, thứ quyết định mọi giới hạn phía trên. */
export interface DeepDiveMechanism {
  /** Tên cơ chế, ví dụ "Envelope Encryption" */
  title: string;
  /** Dữ liệu hoặc request đi qua đâu, ai làm gì */
  explanation: string;
  /** Hệ quả kiến trúc rút ra từ cơ chế này */
  soWhat?: string;
}

/** Tiêu chí quyết định nên hoặc không nên dùng. */
export interface DeepDiveCriterion {
  /** Dấu hiệu nhận biết trong đề bài hoặc trong yêu cầu thực tế */
  condition: string;
  /** Vì sao dấu hiệu đó dẫn tới kết luận này */
  reason: string;
  /** Khi không nên dùng: service thay thế đúng đắn */
  useInstead?: string;
}

/** Mô hình chi phí. Không có freeTier vì SAA-C03 không hỏi tới. */
export interface DeepDiveCostModel {
  /** Các chiều bị tính tiền: GB-tháng, số request, giờ chạy... */
  billingDimensions: string[];
  /** Chi phí hay bị bỏ sót: data transfer, NAT, cross-AZ, IOPS... */
  hiddenCosts?: string[];
  /** Đòn bẩy tối ưu: Spot, RI, Savings Plan, lifecycle, tiering... */
  optimizationLevers?: string[];
}

/**
 * Bảo mật. Domain 1 của SAA-C03 chiếm 30% đề thi, cao nhất trong 4 domain,
 * nên mọi service đều cần trả lời được các câu hỏi trong đây.
 */
export interface DeepDiveSecurity {
  /** Các lựa chọn mã hóa khi lưu, kèm đánh đổi của từng lựa chọn */
  encryptionAtRest?: string[];
  /** Mã hóa trên đường truyền */
  encryptionInTransit?: string;
  /** Ai cấp quyền, bằng cơ chế nào: IAM policy, resource policy, ACL... */
  accessControl?: string[];
  /** Trạng thái mặc định là đóng hay mở, đây là chỗ đề hay gài */
  defaultPosture?: string;
}

/**
 * Khả năng chịu lỗi. Domain 2 chiếm 26% đề thi.
 * failureScope là trường có giá trị so sánh chéo cao nhất: học xong nhiều
 * service sẽ nhận ra ngay cái nào zonal, cái nào regional, cái nào global.
 */
export interface DeepDiveResilience {
  /** Ranh giới sự cố: mất AZ, mất Region, hay không bao giờ mất */
  failureScope: 'AZ' | 'Region' | 'Global';
  /** Tính sẵn sàng có sẵn, AWS lo hay mình phải tự dựng */
  builtInHA: string;
  /** Có sao chép liên Region không, đồng bộ hay bất đồng bộ, RPO bao nhiêu */
  crossRegionStory?: string;
  /** Sao lưu và khôi phục thuộc trách nhiệm ai, làm bằng gì */
  backupRestore?: string;
}

/** So sánh sâu với một service dễ nhầm. */
export interface DeepDiveContrast {
  /** id trong AWS_SERVICES nếu có */
  againstServiceId?: string;
  againstServiceName: string;
  /** Khác biệt cốt lõi gói trong một câu */
  coreDifference: string;
  /** Khác nhau ở cơ chế, không chỉ ở tính năng */
  mechanismDifference?: string;
  chooseThisWhen: string[];
  chooseOtherWhen: string[];
  /** Trỏ tới bảng chi tiết trong SERVICE_COMPARISONS nếu đã có */
  relatedComparisonId?: string;
}

/** Bẫy đề thi, chi tiết hơn commonTraps. */
export interface DeepDiveExamTrap {
  /** Đề bài thường đánh lừa theo kiểu nào */
  distractorPattern: string;
  /** Vì sao đáp án đó sai về mặt kỹ thuật */
  whyWrong: string;
  /** Đáp án đúng và dấu hiệu nhận ra nó */
  correctAnswer: string;
  /** Từ khóa chốt hạ trong đề */
  signalKeywords?: string[];
  severity?: 'high' | 'medium' | 'low';
}

/** Độ sâu nội dung, quyết định theo tần suất service xuất hiện trong bộ đề. */
export type DeepDiveTier = 'core' | 'standard' | 'brief';

export interface ServiceDeepDive {
  /** id khớp với AWS_SERVICES khi service đó đã có entry */
  serviceId: string;
  /** Tên hiển thị, dùng cho service chưa có trong AWS_SERVICES */
  serviceName: string;
  category: string;
  tier: DeepDiveTier;
  /** Service này sinh ra để giải quyết vấn đề gì */
  whyItExists?: string;
  howItWorks?: DeepDiveMechanism[];
  architectures?: DeepDiveArchitecture[];
  chooseWhen?: DeepDiveCriterion[];
  /** Anti-pattern: khi nào KHÔNG nên dùng */
  avoidWhen?: DeepDiveCriterion[];
  limits?: DeepDiveLimit[];
  cost?: DeepDiveCostModel;
  /** Bảo mật, Domain 1 chiếm 30% đề */
  security?: DeepDiveSecurity;
  /** Chịu lỗi và DR, Domain 2 chiếm 26% đề */
  resilience?: DeepDiveResilience;
  contrasts?: DeepDiveContrast[];
  examTraps?: DeepDiveExamTrap[];
  /**
   * Service này thường đứng cạnh ai trong kiến trúc.
   * withServiceName là bắt buộc để UI không in id thô như "vpc" ra màn hình.
   */
  integrationNotes?: Array<{
    withServiceId: string;
    withServiceName: string;
    relationship: string;
  }>;
  deepLinks?: Array<{ label: string; url: string }>;
}

/** Một service kèm số câu hỏi liên quan, sinh từ scripts/extractServices.mjs. */
export interface ServiceQuestionLink {
  id: string;
  name: string;
  category: string;
  count: number;
  questionIds: number[];
}

export interface StudyPlanDay {
  day: number;
  week: number;
  title: string;
  focusDomain: AWSDomain;
  targetServices: string[];
  recommendedQuestionsCount: number;
  completed: boolean;
}

export interface StudyPlanConfig {
  targetDays: number;
  dailyMinutes: number;
  startDate: string;
  days: StudyPlanDay[];
}

export interface LearningProfile {
  questionMastery: Record<number, {
    status: MasteryStatus;
    attempts: number;
    correctCount: number;
    incorrectCount: number;
    lastConfidence?: ConfidenceLevel;
    lastAttemptedAt: number;
  }>;
  streakDays: number;
  lastActiveDate: string;
  todayGoalTarget: number;
  todayCompletedCount: number;
}
