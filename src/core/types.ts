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
