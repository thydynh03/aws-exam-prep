import type { 
  ExamSession, 
  ExamResult, 
  ExamAttemptRecord, 
  StudyProgress, 
  PersonalNote, 
  LearningProfile, 
  StudyPlanConfig 
} from './types';

const STORAGE_KEYS = {
  THEME: 'aws_exam_prep_theme',
  LANGUAGE: 'aws_exam_prep_language',
  BOOKMARKS: 'aws_exam_prep_bookmarks',
  STUDY_PROGRESS: 'aws_exam_prep_study_progress',
  ACTIVE_EXAM: 'aws_exam_prep_active_exam',
  EXAM_HISTORY: 'aws_exam_prep_exam_history',
  PERSONAL_NOTES: 'aws_exam_prep_personal_notes',
  FLASHCARD_PROGRESS: 'aws_exam_prep_flashcard_progress',
  LEARNING_PROFILE: 'aws_exam_prep_learning_profile',
  STUDY_PLAN: 'aws_exam_prep_study_plan',
  NOTES_SECTION_OPEN: 'aws_exam_prep_notes_section_open',
};

class SafeStorage {
  private memoryStore: Map<string, string> = new Map();

  private isLocalStorageAvailable(): boolean {
    try {
      if (typeof window === 'undefined' || !window.localStorage) return false;
      const testKey = '__storage_test__';
      window.localStorage.setItem(testKey, '1');
      window.localStorage.removeItem(testKey);
      return true;
    } catch {
      return false;
    }
  }

  public getItem<T>(key: string, defaultValue: T): T {
    try {
      if (this.isLocalStorageAvailable()) {
        const item = window.localStorage.getItem(key);
        if (item === null) return defaultValue;
        return JSON.parse(item) as T;
      } else {
        const item = this.memoryStore.get(key);
        if (!item) return defaultValue;
        return JSON.parse(item) as T;
      }
    } catch (err) {
      console.warn(`[SafeStorage] Error reading key "${key}", falling back to default`, err);
      return defaultValue;
    }
  }

  public setItem<T>(key: string, value: T): boolean {
    try {
      const serialized = JSON.stringify(value);
      if (this.isLocalStorageAvailable()) {
        window.localStorage.setItem(key, serialized);
      } else {
        this.memoryStore.set(key, serialized);
      }
      return true;
    } catch (err) {
      console.warn(`[SafeStorage] Error writing key "${key}"`, err);
      return false;
    }
  }

  public removeItem(key: string): void {
    try {
      if (this.isLocalStorageAvailable()) {
        window.localStorage.removeItem(key);
      }
      this.memoryStore.delete(key);
    } catch (err) {
      console.warn(`[SafeStorage] Error removing key "${key}"`, err);
    }
  }
}

const safeStorage = new SafeStorage();

export const storage = {
  // Theme
  getTheme(): 'light' | 'dark' {
    const saved = safeStorage.getItem<'light' | 'dark' | null>(STORAGE_KEYS.THEME, null);
    if (saved === 'light' || saved === 'dark') return saved;
    if (typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      return 'dark';
    }
    return 'light';
  },

  setTheme(theme: 'light' | 'dark'): void {
    safeStorage.setItem(STORAGE_KEYS.THEME, theme);
  },

  // Language
  getLanguage(): 'en' | 'vi' {
    const saved = safeStorage.getItem<'en' | 'vi' | null>(STORAGE_KEYS.LANGUAGE, null);
    if (saved === 'en' || saved === 'vi') return saved;
    return 'vi';
  },

  setLanguage(language: 'en' | 'vi'): void {
    safeStorage.setItem(STORAGE_KEYS.LANGUAGE, language);
  },

  // Bookmarks
  getBookmarks(): number[] {
    return safeStorage.getItem<number[]>(STORAGE_KEYS.BOOKMARKS, []);
  },

  setBookmarks(bookmarks: number[]): void {
    safeStorage.setItem(STORAGE_KEYS.BOOKMARKS, bookmarks);
  },

  toggleBookmark(questionId: number): boolean {
    const bookmarks = this.getBookmarks();
    const index = bookmarks.indexOf(questionId);
    let isNowBookmarked = false;
    if (index >= 0) {
      bookmarks.splice(index, 1);
    } else {
      bookmarks.push(questionId);
      isNowBookmarked = true;
    }
    safeStorage.setItem(STORAGE_KEYS.BOOKMARKS, bookmarks);
    return isNowBookmarked;
  },

  isBookmarked(questionId: number): boolean {
    const bookmarks = this.getBookmarks();
    return bookmarks.includes(questionId);
  },

  // Study Progress
  getStudyProgress(): StudyProgress {
    return safeStorage.getItem<StudyProgress>(STORAGE_KEYS.STUDY_PROGRESS, {
      currentIndex: 0,
      items: {},
    });
  },

  saveStudyProgress(progress: StudyProgress): void {
    safeStorage.setItem(STORAGE_KEYS.STUDY_PROGRESS, progress);
  },

  resetStudyProgress(): void {
    safeStorage.removeItem(STORAGE_KEYS.STUDY_PROGRESS);
  },

  resetQuestionProgress(questionId: number): void {
    const progress = this.getStudyProgress();
    if (progress.items[questionId]) {
      delete progress.items[questionId];
      this.saveStudyProgress(progress);
    }
  },

  // Active Exam Session (for recovery on refresh)
  getActiveExam(): ExamSession | null {
    const session = safeStorage.getItem<ExamSession | null>(STORAGE_KEYS.ACTIVE_EXAM, null);
    if (!session) return null;
    if (session.status === 'submitted') return null; // already completed
    return session;
  },

  saveActiveExam(session: ExamSession | null): void {
    if (!session) {
      safeStorage.removeItem(STORAGE_KEYS.ACTIVE_EXAM);
    } else {
      safeStorage.setItem(STORAGE_KEYS.ACTIVE_EXAM, session);
    }
  },

  clearActiveExam(): void {
    safeStorage.removeItem(STORAGE_KEYS.ACTIVE_EXAM);
  },

  // Exam History
  getExamHistory(): ExamAttemptRecord[] {
    return safeStorage.getItem<ExamAttemptRecord[]>(STORAGE_KEYS.EXAM_HISTORY, []);
  },

  saveExamAttempt(result: ExamResult): void {
    const history = this.getExamHistory();
    const record: ExamAttemptRecord = {
      id: result.id,
      date: result.date,
      scorePercent: result.scorePercent,
      scaledScore: result.scaledScore,
      passed: result.passed,
      totalQuestions: result.totalQuestions,
      correctCount: result.correctCount,
      incorrectCount: result.incorrectCount,
      unansweredCount: result.unansweredCount,
      timeUsedSeconds: result.timeUsedSeconds,
    };
    // Prepend latest attempt
    history.unshift(record);
    // Keep last 50 attempts
    if (history.length > 50) history.pop();
    safeStorage.setItem(STORAGE_KEYS.EXAM_HISTORY, history);
  },

  clearExamHistory(): void {
    safeStorage.removeItem(STORAGE_KEYS.EXAM_HISTORY);
  },

  setExamHistory(history: ExamAttemptRecord[]): void {
    safeStorage.setItem(STORAGE_KEYS.EXAM_HISTORY, history);
  },

  // Personal Notes
  getAllNotes(): Record<number, PersonalNote> {
    return safeStorage.getItem<Record<number, PersonalNote>>(STORAGE_KEYS.PERSONAL_NOTES, {});
  },

  setAllNotes(notes: Record<number, PersonalNote>): void {
    safeStorage.setItem(STORAGE_KEYS.PERSONAL_NOTES, notes);
  },

  getNote(questionId: number): PersonalNote | null {
    const notes = this.getAllNotes();
    return notes[questionId] || null;
  },

  saveNote(questionId: number, noteText: string): void {
    const notes = this.getAllNotes();
    if (!noteText.trim()) {
      delete notes[questionId];
    } else {
      notes[questionId] = {
        questionId,
        noteText: noteText.trim(),
        updatedAt: Date.now(),
      };
    }
    safeStorage.setItem(STORAGE_KEYS.PERSONAL_NOTES, notes);
  },

  deleteNote(questionId: number): void {
    const notes = this.getAllNotes();
    delete notes[questionId];
    safeStorage.setItem(STORAGE_KEYS.PERSONAL_NOTES, notes);
  },

  isNotesSectionOpen(): boolean {
    return safeStorage.getItem<boolean>(STORAGE_KEYS.NOTES_SECTION_OPEN, false);
  },

  setNotesSectionOpen(isOpen: boolean): void {
    safeStorage.setItem(STORAGE_KEYS.NOTES_SECTION_OPEN, isOpen);
  },

  // Hydrate all user-specific study data from remote or cached state
  hydrateFromUserData(data: {
    progress?: StudyProgress;
    notes?: Record<number, PersonalNote>;
    bookmarks?: number[];
    examHistory?: ExamAttemptRecord[];
  }): void {
    if (data.progress) {
      safeStorage.setItem(STORAGE_KEYS.STUDY_PROGRESS, data.progress);
    }
    if (data.notes) {
      safeStorage.setItem(STORAGE_KEYS.PERSONAL_NOTES, data.notes);
    }
    if (data.bookmarks) {
      safeStorage.setItem(STORAGE_KEYS.BOOKMARKS, data.bookmarks);
    }
    if (data.examHistory) {
      safeStorage.setItem(STORAGE_KEYS.EXAM_HISTORY, data.examHistory);
    }
  },

  // Export/snapshot active user's study data
  exportActiveUserData(): {
    progress: StudyProgress;
    notes: Record<number, PersonalNote>;
    bookmarks: number[];
    examHistory: ExamAttemptRecord[];
  } {
    return {
      progress: this.getStudyProgress(),
      notes: this.getAllNotes(),
      bookmarks: this.getBookmarks(),
      examHistory: this.getExamHistory(),
    };
  },

  // Clear active user's data upon logout/switching so another user doesn't see old progress
  clearActiveUserData(): void {
    safeStorage.removeItem(STORAGE_KEYS.STUDY_PROGRESS);
    safeStorage.removeItem(STORAGE_KEYS.PERSONAL_NOTES);
    safeStorage.removeItem(STORAGE_KEYS.BOOKMARKS);
    safeStorage.removeItem(STORAGE_KEYS.EXAM_HISTORY);
    safeStorage.removeItem(STORAGE_KEYS.ACTIVE_EXAM);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('aws_storage_updated'));
    }
  },

  // Flashcards Progress (cardId -> review state)
  getFlashcardProgress(): Record<string, { box: number; reviewsCount: number; lastReviewedAt: number; nextReviewDue: number }> {
    return safeStorage.getItem(STORAGE_KEYS.FLASHCARD_PROGRESS, {});
  },

  saveFlashcardReview(cardId: string, box: number, nextDue: number): void {
    const progress = this.getFlashcardProgress();
    const existing = progress[cardId] || { box: 1, reviewsCount: 0, lastReviewedAt: 0, nextReviewDue: 0 };
    progress[cardId] = {
      box,
      reviewsCount: existing.reviewsCount + 1,
      lastReviewedAt: Date.now(),
      nextReviewDue: nextDue,
    };
    safeStorage.setItem(STORAGE_KEYS.FLASHCARD_PROGRESS, progress);
  },

  resetFlashcardProgress(): void {
    safeStorage.removeItem(STORAGE_KEYS.FLASHCARD_PROGRESS);
  },

  // Learning Profile & Streak
  getLearningProfile(): LearningProfile {
    const today = new Date().toISOString().slice(0, 10);
    const defaultProfile: LearningProfile = {
      questionMastery: {},
      streakDays: 1,
      lastActiveDate: today,
      todayGoalTarget: 20,
      todayCompletedCount: 0,
    };
    const profile = safeStorage.getItem<LearningProfile>(STORAGE_KEYS.LEARNING_PROFILE, defaultProfile);

    // Calculate streak
    if (profile.lastActiveDate !== today) {
      const lastDate = new Date(profile.lastActiveDate);
      const currentDate = new Date(today);
      const diffDays = Math.floor((currentDate.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24));
      
      if (diffDays === 1) {
        profile.streakDays += 1;
      } else if (diffDays > 1) {
        profile.streakDays = 1;
      }
      profile.lastActiveDate = today;
      profile.todayCompletedCount = 0;
      safeStorage.setItem(STORAGE_KEYS.LEARNING_PROFILE, profile);
    }

    return profile;
  },

  saveLearningProfile(profile: LearningProfile): void {
    safeStorage.setItem(STORAGE_KEYS.LEARNING_PROFILE, profile);
  },

  incrementDailyActivity(count = 1): void {
    const profile = this.getLearningProfile();
    profile.todayCompletedCount += count;
    safeStorage.setItem(STORAGE_KEYS.LEARNING_PROFILE, profile);
  },

  // Study Plan
  getStudyPlan(): StudyPlanConfig | null {
    return safeStorage.getItem<StudyPlanConfig | null>(STORAGE_KEYS.STUDY_PLAN, null);
  },

  saveStudyPlan(plan: StudyPlanConfig): void {
    safeStorage.setItem(STORAGE_KEYS.STUDY_PLAN, plan);
  },
};
