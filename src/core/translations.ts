export type Language = 'en' | 'vi';

export interface Translations {
  nav: {
    dashboard: string;
    study: string;
    domains: string;
    weakness: string;
    flashcards: string;
    architecture: string;
    studyPlan: string;
    examSimulator: string;
    search: string;
    searchShortcut: string;
    shortcuts: string;
    themeLight: string;
    themeDark: string;
    switchLang: string;
    questionProgress: string;
    timeRemaining: string;
    pauseTimer: string;
    resumeTimer: string;
  };
  badges: {
    examSimulation: string;
    studyMode: string;
    reviewMode: string;
    examReport: string;
    weaknessDrills: string;
    domainPractice: string;
    flashcards: string;
    awsDirectory: string;
    studyPlan30Day: string;
  };
  question: {
    questionLabel: string;
    selectOne: string;
    selectMultiple: string;
    markForReview: string;
    marked: string;
    bookmark: string;
    bookmarked: string;
    examClues: string;
    hideClues: string;
    cluesFound: string;
    expandGuidance: string;
    collapseGuidance: string;
    correctAnswer: string;
    yourSelection: string;
    eliminateOption: string;
    restoreOption: string;
    submitAnswer: string;
    nextQuestion: string;
    prevQuestion: string;
    resetAnswer: string;
    viewExplanation: string;
    hideExplanation: string;
    awsDocs: string;
    communityConsensus: string;
    detailedExplanation: string;
    officialVerified: string;
    coreRule: string;
    vietnameseBreakdown: string;
    objective: string;
    whyCorrect: string;
    trapWarning: string;
    whyWrong: string;
    whyWrongDetail: string;
    distractorAnalysis: string;
    collapseDistractors: string;
    expandDistractors: string;
    yourWrongSelection: string;
    contrastCorrect: string;
    coreFlaw: string;
    technicalAnalysis: string;
    otherDistractors: string;
  };
  exam: {
    title: string;
    standardSubtitle: string;
    questionsCount: string;
    duration: string;
    passScore: string;
    submitExam: string;
    confirmSubmitTitle: string;
    confirmSubmitDesc: string;
    answered: string;
    unanswered: string;
    flagged: string;
    reviewScreen: string;
    returnToExam: string;
    finalSubmit: string;
    cancel: string;
    timeWarning: string;
    timeExpired: string;
    questionOf: string;
    helpGlossary: string;
    selectOneInstruction: string;
    selectTwoInstruction: string;
    selectThreeInstruction: string;
    selectCountInstruction: string;
    clearResponse: string;
    previous: string;
    next: string;
    goToReviewScreen: string;
    reviewAll: string;
    reviewIncomplete: string;
    reviewMarked: string;
    endExam: string;
    returnToCurrentQuestion: string;
    timeRemainingLabel: string;
    incomplete: string;
    complete: string;
    questionStatusSummary: string;
    clickRowToView: string;
    unansweredRemaining: string;
    submitGradeDesc: string;
    totalQuestions: string;
    submitAndGrade: string;
    unansweredWarning: string;
    helpTitle: string;
    helpSubtitle: string;
    timingPacing: string;
    timingPacingDesc: string;
    markForReviewHelp: string;
    markForReviewHelpDesc: string;
    multiSelectHelp: string;
    multiSelectHelpDesc: string;
    glossaryTitle: string;
  };
  home: {
    title: string;
    subtitle: string;
    readinessScore: string;
    readinessLabel: string;
    streakDays: string;
    cardsReviewed: string;
    questionsAttempted: string;
    passProbability: string;
    dangerousMisconceptions: string;
    heroCtaExam: string;
    heroCtaStudy: string;
    recentAttempts: string;
    noAttemptsYet: string;
    viewAll: string;
    cardDomainsTitle: string;
    cardDomainsDesc: string;
    cardDomainsBtn: string;
    cardWeaknessTitle: string;
    cardWeaknessDesc: string;
    cardWeaknessBtn: string;
    cardFlashcardsTitle: string;
    cardFlashcardsDesc: string;
    cardFlashcardsBtn: string;
    cardArchitectureTitle: string;
    cardArchitectureDesc: string;
    cardArchitectureBtn: string;
    cardStudyPlanTitle: string;
    cardStudyPlanDesc: string;
    cardStudyPlanBtn: string;
  };
  flashcards: {
    title: string;
    subtitle: string;
    cardCount: string;
    flipCard: string;
    pressSpace: string;
    again: string;
    hard: string;
    good: string;
    easy: string;
    leitnerBox: string;
    deckAll: string;
    deckServices: string;
    deckDomains: string;
    deckTraps: string;
    deckComparisons: string;
    mastered: string;
    learning: string;
    notStarted: string;
    rateRecall: string;
    advanceBox: string;
    keepBox: string;
    resetBox: string;
    previousCard: string;
    nextCard: string;
    noCards: string;
    reviewedTimes: string;
  };
  architecture: {
    title: string;
    subtitle: string;
    tabServices: string;
    tabComparisons: string;
    searchPlaceholder: string;
    allCategories: string;
    matrixHeaderDimension: string;
    matrixHeaderRule: string;
    matrixHeaderTraps: string;
    filterByCategory: string;
    viewMatrix: string;
  };
  study: {
    filter: string;
    all: string;
    incorrect: string;
    bookmarked: string;
    pastMistakes: string;
    navigator: string;
    noQuestionsFound: string;
    resetFilter: string;
    confidenceSelf: string;
    checkAnswer: string;
    retryQuestion: string;
    resetQuestion: string;
    resetAllQuestions: string;
    resetAllConfirmTitle: string;
    resetAllConfirmDesc: string;
    resetSuccess: string;
    resetAllSuccess: string;
    clearSelection: string;
    clearFilters: string;
    targetedReview: string;
    targetedReviewDesc: string;
    stepByStep: string;
    tableList: string;
    reviewingCount: string;
    searchPlaceholder: string;
    noMatch: string;
    mastered: string;
    missed: string;
  };
  domains: {
    title: string;
    subtitle: string;
    available: string;
    accuracy: string;
    mastered: string;
    testedObjectives: string;
    attempted: string;
    start20: string;
    start40: string;
    percentOfExam: string;
  };
  weakness: {
    title: string;
    subtitle: string;
    examReadiness: string;
    dangerousTitle: string;
    confidentWrong: string;
    dangerousDesc: string;
    fragileTitle: string;
    guessedCorrect: string;
    fragileDesc: string;
    zeroDangerous: string;
    zeroDangerousDesc: string;
    confidence: string;
    weakestServices: string;
    rankedByError: string;
    notEnoughData: string;
    notEnoughDataDesc: string;
    errorRate: string;
    drill: string;
    drillFragile: string;
    drillDangerous: string;
  };
  studyPlan: {
    title: string;
    subtitle: string;
    reset: string;
    resetConfirm: string;
    week: string;
    day: string;
    completed: string;
    markDone: string;
    practiceNow: string;
    overallProgress: string;
    daysCompleted: string;
    milestone: string;
    planCompletion: string;
    pacing: string;
    studyStreak: string;
    consecutiveDays: string;
    consecutiveDay: string;
    tip: string;
    questionsCount: string;
    week1Label: string;
    week1Desc: string;
    week2Label: string;
    week2Desc: string;
    week3Label: string;
    week3Desc: string;
    week4Label: string;
    week4Desc: string;
  };
  result: {
    reportTitle: string;
    passingScore: string;
    passed: string;
    didNotPass: string;
    congrats: string;
    tryAgain: string;
    drillIncorrect: string;
    retakeExam: string;
    filterAll: string;
    filterIncorrect: string;
    filterCorrect: string;
    filterUnanswered: string;
    filterMarked: string;
    scoreBreakdown: string;
    totalQuestions: string;
    correct: string;
    incorrect: string;
    unanswered: string;
    timeUsed: string;
    avgPerQuestion: string;
    breakdownTitle: string;
    yourAnswer: string;
    correctAnswer: string;
    noneAnswer: string;
  };
  notes: {
    title: string;
    saved: string;
    searchable: string;
    placeholder: string;
    editTab: string;
    previewTab: string;
    bold: string;
    italic: string;
    highlight: string;
    heading: string;
    bulletList: string;
    code: string;
    expand: string;
    collapse: string;
    delete: string;
    deleteConfirm: string;
    save: string;
    chars: string;
    lines: string;
    emptyPreview: string;
  };
}

export const TRANSLATIONS: Record<Language, Translations> = {
  en: {
    nav: {
      dashboard: 'Dashboard',
      study: 'Study',
      domains: 'Domains',
      weakness: 'Weakness',
      flashcards: 'Flashcards',
      architecture: 'Architecture',
      studyPlan: '30-Day Plan',
      examSimulator: 'Exam Simulator',
      search: 'Search',
      searchShortcut: 'Ctrl+K',
      shortcuts: 'Keyboard Shortcuts',
      themeLight: 'Light Mode',
      themeDark: 'Dark Mode',
      switchLang: 'Tiếng Việt',
      questionProgress: 'Question',
      timeRemaining: 'Time remaining',
      pauseTimer: 'Pause',
      resumeTimer: 'Resume',
    },
    badges: {
      examSimulation: 'Exam Simulation',
      studyMode: 'Study Mode',
      reviewMode: 'Review Mode',
      examReport: 'Exam Report',
      weaknessDrills: 'Weakness Drills',
      domainPractice: 'Domain Practice',
      flashcards: 'Flashcards',
      awsDirectory: 'AWS Directory',
      studyPlan30Day: '30-Day Plan',
    },
    question: {
      questionLabel: 'QUESTION',
      selectOne: 'Select 1 option',
      selectMultiple: 'Select {count} options',
      markForReview: 'Mark for Review',
      marked: 'Marked',
      bookmark: 'Bookmark',
      bookmarked: 'Bookmarked',
      examClues: 'Exam Clues',
      hideClues: 'Hide Clues',
      cluesFound: 'Decisive Architectural Clues Found',
      expandGuidance: 'Expand Guidance',
      collapseGuidance: 'Collapse',
      correctAnswer: 'Correct Answer',
      yourSelection: 'Your Selection',
      eliminateOption: 'Eliminate option',
      restoreOption: 'Restore option',
      submitAnswer: 'Check Answer',
      nextQuestion: 'Next',
      prevQuestion: 'Previous',
      resetAnswer: 'Retry Question',
      viewExplanation: 'Show Explanation',
      hideExplanation: 'Hide Explanation',
      awsDocs: 'AWS Documentation',
      communityConsensus: 'Community Consensus Votes',
      detailedExplanation: 'Detailed Repository Explanation',
      officialVerified: 'Official answer verified',
      coreRule: 'SAA-C03 Core Architectural Takeaway',
      vietnameseBreakdown: '🇻🇳 Vietnamese Architectural Breakdown',
      objective: 'Core Objective',
      whyCorrect: 'Why Answer is Correct',
      trapWarning: 'Exam Distractor / Trap Warning',
      whyWrong: 'Why Your Selected Answer is Incorrect',
      whyWrongDetail: 'Detailed Analysis of Why Your Choice is Wrong',
      distractorAnalysis: 'Distractor Analysis (Why Other Options Are Incorrect)',
      collapseDistractors: 'Collapse Wrong Answer Analysis',
      expandDistractors: 'View Detailed Analysis of Why Other Options Are Incorrect',
      yourWrongSelection: 'Your Selected Option (Incorrect)',
      contrastCorrect: 'Contrast with Correct Architecture',
      coreFlaw: 'Core Constraint Violated',
      technicalAnalysis: 'Detailed Technical Analysis',
      otherDistractors: 'Analysis of Other Incorrect Options',
    },
    exam: {
      title: 'AWS Certified Solutions Architect - Associate (SAA-C03)',
      standardSubtitle: 'Authentic 65-question timed simulation conforming to official AWS blueprints',
      questionsCount: '65 Questions',
      duration: '130 Minutes',
      passScore: 'Passing Score: 720 / 1000 (Scaled)',
      submitExam: 'Submit Exam',
      confirmSubmitTitle: 'Ready to Submit Your Exam?',
      confirmSubmitDesc: 'You are about to finish your examination session. Review your progress below before submitting.',
      answered: 'Answered',
      unanswered: 'Unanswered',
      flagged: 'Flagged for Review',
      reviewScreen: 'Review Screen',
      returnToExam: 'Return to Exam',
      finalSubmit: 'Confirm & Submit Exam',
      cancel: 'Cancel',
      timeWarning: 'Time is running low! Under 5 minutes remaining.',
      timeExpired: 'Time has expired. Your exam will be submitted automatically.',
      questionOf: 'Question {current} of {total}',
      helpGlossary: 'Help / Glossary',
      selectOneInstruction: 'Select ONE answer.',
      selectTwoInstruction: 'Select TWO answers.',
      selectThreeInstruction: 'Select THREE answers.',
      selectCountInstruction: 'Select {count} answers.',
      clearResponse: 'Clear Response',
      previous: 'Previous',
      next: 'Next',
      goToReviewScreen: 'Go to Review Screen',
      reviewAll: 'Review All ({count})',
      reviewIncomplete: 'Review Incomplete ({count})',
      reviewMarked: 'Review Marked ({count})',
      endExam: 'End Exam',
      returnToCurrentQuestion: 'Return to Current Question',
      timeRemainingLabel: 'Time Remaining:',
      incomplete: 'Incomplete',
      complete: 'Complete',
      questionStatusSummary: 'Question Status Summary',
      clickRowToView: 'Click any row to view question',
      unansweredRemaining: 'Unanswered Questions Remaining',
      submitGradeDesc: 'Once submitted, your answers will be graded and you will see your detailed score breakdown.',
      totalQuestions: 'Total Questions:',
      submitAndGrade: 'Submit and Grade Exam',
      unansweredWarning: 'You still have {count} unanswered questions. They will be counted as incorrect if you submit now.',
      helpTitle: 'Exam Reference & Guidelines',
      helpSubtitle: 'Authorized standard reference and navigation instructions',
      timingPacing: 'Timing & Pacing',
      timingPacingDesc: '130 minutes for 65 questions gives you exactly 2 minutes per question. Pace yourself accordingly.',
      markForReviewHelp: 'Mark for Review',
      markForReviewHelpDesc: 'Use the "Mark for Review" button to flag uncertain questions. You can revisit them from the Review Screen before finishing.',
      multiSelectHelp: 'Multi-Select',
      multiSelectHelpDesc: 'Pay attention to prompts stating "Select TWO" or "Select THREE". Square checkboxes indicate multiple selections.',
      glossaryTitle: 'Standard AWS Acronym Glossary',
    },
    home: {
      title: 'AWS Certified Solutions Architect - Associate',
      subtitle: 'Professional SAA-C03 simulator with 1,019 verified questions, spaced repetition flashcards, adaptive weakness diagnostics, and side-by-side architectural matrices.',
      readinessScore: 'Exam Readiness Score',
      readinessLabel: 'Readiness Index',
      streakDays: 'Day Study Streak',
      cardsReviewed: 'Flashcards Reviewed',
      questionsAttempted: 'Questions Practiced',
      passProbability: 'Estimated Pass Probability',
      dangerousMisconceptions: 'Dangerous Misconceptions',
      heroCtaExam: 'Start 65-Question Simulator',
      heroCtaStudy: 'Continue Study Mode',
      recentAttempts: 'Recent Simulator Attempts',
      noAttemptsYet: 'No exam attempts recorded yet. Start your first 65-question timed simulation!',
      viewAll: 'View All',
      cardDomainsTitle: 'Domain Practice Drills',
      cardDomainsDesc: 'Targeted practice aligned to official blueprint: Secure (30%), Resilient (26%), High-Performing (24%), Cost (20%).',
      cardDomainsBtn: 'Launch Domain Drills',
      cardWeaknessTitle: 'Weakness Analyzer & Drills',
      cardWeaknessDesc: 'Uncovers dangerous misconceptions (high confidence + wrong answer) and ranks weak AWS topics by error rate.',
      cardWeaknessBtn: 'Drill Weaknesses',
      cardFlashcardsTitle: 'Spaced Repetition Flashcards',
      cardFlashcardsDesc: 'Interactive memory decks covering Core Services, Exam Domains, Common Traps, and Architectural Comparisons.',
      cardFlashcardsBtn: 'Study Flashcards',
      cardArchitectureTitle: 'AWS Services & Comparisons',
      cardArchitectureDesc: 'Deep architectural comparison matrices (S3 vs EBS vs EFS, ALB vs NLB, SQS vs SNS) linked to practice questions.',
      cardArchitectureBtn: 'Explore Architecture',
      cardStudyPlanTitle: '30-Day SAA-C03 Study Plan',
      cardStudyPlanDesc: 'Structured day-by-day roadmap with weekly milestones, streak maintenance, and practice targets.',
      cardStudyPlanBtn: 'View Study Plan',
    },
    flashcards: {
      title: 'Spaced Repetition Flashcards',
      subtitle: 'Master AWS architectural trade-offs, service limits, and common exam traps using the Leitner 5-box system.',
      cardCount: 'Card {current} of {total}',
      flipCard: 'Click card to flip',
      pressSpace: 'Press Space to flip, 1-4 to rate',
      again: 'Again (1)',
      hard: 'Hard (2)',
      good: 'Good (3)',
      easy: 'Easy (4)',
      leitnerBox: 'Box {box}',
      deckAll: 'All Decks',
      deckServices: 'Core Services',
      deckDomains: 'Exam Domains',
      deckTraps: 'Exam Traps',
      deckComparisons: 'Comparisons',
      mastered: 'Mastered (Box 4-5)',
      learning: 'Learning (Box 2-3)',
      notStarted: 'New (Box 1)',
      rateRecall: 'Rate your recall to schedule next review:',
      advanceBox: 'Advance +1 Box',
      keepBox: 'Keep Box (1d)',
      resetBox: 'Reset to Box 1 (1d)',
      previousCard: 'Previous Card',
      nextCard: 'Next Card',
      noCards: 'No cards in this deck',
      reviewedTimes: 'Reviewed {count} time(s)',
    },
    architecture: {
      title: 'AWS Architecture & Service Directory',
      subtitle: 'Inspect deep architectural trade-offs, service comparisons, decision rules, and common distractor traps for SAA-C03.',
      tabServices: 'Service Directory',
      tabComparisons: 'Comparative Tables',
      searchPlaceholder: 'Search AWS services, acronyms, or comparisons...',
      allCategories: 'All Categories',
      matrixHeaderDimension: 'Architectural Dimension',
      matrixHeaderRule: 'How to Choose on Exam',
      matrixHeaderTraps: 'High-Frequency Exam Traps',
      filterByCategory: 'Filter by Category',
      viewMatrix: 'View Comparison Matrix',
    },
    study: {
      filter: 'Filter:',
      all: 'All',
      incorrect: 'Incorrect',
      bookmarked: 'Bookmarked',
      pastMistakes: 'Past Mistakes',
      navigator: 'Navigator',
      noQuestionsFound: 'No questions found under the current filter.',
      resetFilter: 'Reset Filter to All',
      confidenceSelf: 'Self-assessed confidence:',
      checkAnswer: 'Check Answer',
      retryQuestion: 'Retry Question',
      resetQuestion: 'Reset Question',
      resetAllQuestions: 'Reset All',
      resetAllConfirmTitle: 'Reset All Study Progress?',
      resetAllConfirmDesc: 'This will reset your selected answers, submission status, and correct/incorrect results for all questions in study mode so you can start over from scratch. Your personal notes and bookmarks will remain intact.',
      resetSuccess: 'Question reset successfully!',
      resetAllSuccess: 'All questions have been reset successfully!',
      clearSelection: 'Clear Selection',
      clearFilters: 'Clear All Filters',
      targetedReview: 'Targeted Review & Analysis',
      targetedReviewDesc: 'Review answers, explanations, and community consensus across the entire bank.',
      stepByStep: 'Step-by-Step',
      tableList: 'Table / List',
      reviewingCount: 'Reviewing {current} of {total} filtered',
      searchPlaceholder: 'Search keyword or question ID...',
      noMatch: 'No questions match your current filter and search criteria.',
      mastered: 'Mastered',
      missed: 'Missed',
    },
    domains: {
      title: 'SAA-C03 Domain-Specific Practice',
      subtitle: 'Official exam blueprint domains: Secure (30%), Resilient (26%), High-Performing (24%), Cost-Optimized (20%)',
      available: 'Available',
      accuracy: 'Accuracy',
      mastered: 'Mastered',
      testedObjectives: 'Tested Architecture Objectives:',
      attempted: '{count} attempted',
      start20: '20 Qs',
      start40: '40 Qs',
      percentOfExam: '% of Exam',
    },
    weakness: {
      title: 'Adaptive Weakness Analyzer & Drills',
      subtitle: 'Identifies high-risk misconceptions, guessing biases, and weak service topics',
      examReadiness: 'Exam Readiness',
      dangerousTitle: 'Dangerous Misconceptions',
      confidentWrong: 'Confident + Wrong',
      dangerousDesc: 'High risk of failing exam questions due to false confidence.',
      fragileTitle: 'Fragile Knowledge',
      guessedCorrect: 'Guessed + Correct',
      fragileDesc: 'Answered correctly by chance. Requires conceptual reinforcement.',
      zeroDangerous: 'Zero Dangerous Misconceptions!',
      zeroDangerousDesc: 'When you practice in Study Mode with High or Medium confidence and get an answer wrong, it will appear here for targeted review.',
      confidence: 'Confidence:',
      weakestServices: 'Weakest AWS Service Topics',
      rankedByError: 'Ranked by error rate',
      notEnoughData: 'Not Enough Practice Data Yet',
      notEnoughDataDesc: 'Attempt at least 2 questions per service tag in Study or Exam mode to generate error analytics.',
      errorRate: 'Error Rate',
      drill: 'Drill',
      drillFragile: 'Drill All Fragile Knowledge ({count})',
      drillDangerous: 'Drill ({count})',
    },
    studyPlan: {
      title: '30-Day SAA-C03 Structured Study Plan',
      subtitle: 'Systematic 4-week progression covering all 4 SAA-C03 domains, simulations, and trap drills',
      reset: 'Reset',
      resetConfirm: 'Reset study plan progress back to Day 1?',
      week: 'Week',
      day: 'Day',
      completed: 'Completed',
      markDone: 'Mark Done',
      practiceNow: 'Start Drill',
      overallProgress: 'Overall Roadmap Progress',
      daysCompleted: '{completed} of {total} Days Completed',
      milestone: 'Weekly Milestone',
      planCompletion: 'Plan Completion',
      pacing: 'Pacing: ~{minutes} mins/day • Started {startDate}',
      studyStreak: 'Study Streak',
      consecutiveDays: 'Consecutive Days',
      consecutiveDay: 'Consecutive Day',
      tip: "Tip: Pair each day's question practice with reviewing 10-15 Flashcards to maximize long-term spaced repetition retention.",
      questionsCount: 'Qs',
      week1Label: 'Week 1: Secure (Domain 1)',
      week1Desc: 'IAM, KMS, VPC Security',
      week2Label: 'Week 2: Resilient (Domain 2)',
      week2Desc: 'Multi-AZ, Decoupling, SQS',
      week3Label: 'Week 3: High-Performing (Domain 3)',
      week3Desc: 'Aurora, DAX, CloudFront',
      week4Label: 'Week 4: Cost & Simulations',
      week4Desc: 'Simulators, Traps & S3',
    },
    result: {
      reportTitle: 'Official Exam Simulation Report',
      passingScore: 'Passing Score: 720 / 1000 (72%)',
      passed: 'PASSED',
      didNotPass: 'DID NOT PASS',
      congrats: 'Congratulations! You achieved the required score threshold for the AWS Solutions Architect exam.',
      tryAgain: 'You scored below the 720 passing mark. Review your incorrect answers below to master weak domains.',
      drillIncorrect: 'Drill Incorrect ({count})',
      retakeExam: 'Retake Exam',
      filterAll: 'All Questions',
      filterIncorrect: 'Incorrect',
      filterCorrect: 'Correct',
      filterUnanswered: 'Unanswered',
      filterMarked: 'Marked',
      scoreBreakdown: 'Domain Score Breakdown',
      totalQuestions: 'Total Questions',
      correct: 'Correct',
      incorrect: 'Incorrect',
      unanswered: 'Unanswered',
      timeUsed: 'Time Used',
      avgPerQuestion: 'Avg / Q',
      breakdownTitle: 'Question-by-Question Breakdown',
      yourAnswer: 'Your:',
      correctAnswer: 'Correct:',
      noneAnswer: 'None',
    },
    notes: {
      title: 'Personal Notes & Insights',
      saved: 'Saved',
      searchable: 'Searchable via',
      placeholder: 'Jot down memory hooks, tricky distractors, why you eliminated choices B & D...',
      editTab: 'Editor',
      previewTab: 'Formatted Preview',
      bold: 'Bold (Ctrl+B)',
      italic: 'Italic (Ctrl+I)',
      highlight: 'Highlight (Ctrl+H)',
      heading: 'Heading (###)',
      bulletList: 'Bullet List (-)',
      code: 'AWS Code / Service (`...`)',
      expand: 'Expand Editor',
      collapse: 'Collapse',
      delete: 'Delete Note',
      deleteConfirm: 'Are you sure you want to delete this note?',
      save: 'Save Note',
      chars: 'characters',
      lines: 'lines',
      emptyPreview: 'No note content to preview yet. Switch to Editor to start writing.',
    },
  },
  vi: {
    nav: {
      dashboard: 'Trang chủ',
      study: 'Học tập',
      domains: 'Domain',
      weakness: 'Điểm yếu',
      flashcards: 'Flashcards',
      architecture: 'Kiến trúc',
      studyPlan: 'Lộ trình 30 ngày',
      examSimulator: 'Thi thử AWS',
      search: 'Tìm kiếm',
      searchShortcut: 'Ctrl+K',
      shortcuts: 'Phím tắt',
      themeLight: 'Giao diện Sáng',
      themeDark: 'Giao diện Tối',
      switchLang: 'English',
      questionProgress: 'Câu hỏi',
      timeRemaining: 'Thời gian còn lại',
      pauseTimer: 'Tạm dừng',
      resumeTimer: 'Tiếp tục',
    },
    badges: {
      examSimulation: 'Mô phỏng Thi thử',
      studyMode: 'Chế độ Học tập',
      reviewMode: 'Xem lại Câu hỏi',
      examReport: 'Kết quả Kỳ thi',
      weaknessDrills: 'Luyện Điểm yếu',
      domainPractice: 'Luyện theo Domain',
      flashcards: 'Thẻ ghi nhớ',
      awsDirectory: 'Danh mục AWS',
      studyPlan30Day: 'Lộ trình 30 ngày',
    },
    question: {
      questionLabel: 'CÂU HỎI',
      selectOne: 'Chọn 1 đáp án',
      selectMultiple: 'Chọn {count} đáp án',
      markForReview: 'Đánh dấu xem lại',
      marked: 'Đã đánh dấu',
      bookmark: 'Lưu câu hỏi',
      bookmarked: 'Đã lưu',
      examClues: 'Từ khóa then chốt',
      hideClues: 'Ẩn gợi ý',
      cluesFound: 'Phát hiện từ khóa quyết định kiến trúc',
      expandGuidance: 'Mở rộng phân tích',
      collapseGuidance: 'Thu gọn',
      correctAnswer: 'Đáp án đúng',
      yourSelection: 'Bạn đã chọn',
      eliminateOption: 'Gạch loại trừ',
      restoreOption: 'Khôi phục phương án',
      submitAnswer: 'Kiểm tra đáp án',
      nextQuestion: 'Câu tiếp theo',
      prevQuestion: 'Câu trước',
      resetAnswer: 'Làm lại câu này',
      viewExplanation: 'Xem giải thích',
      hideExplanation: 'Ẩn giải thích',
      awsDocs: 'Tài liệu AWS chính thức',
      communityConsensus: 'Bình chọn đồng thuận cộng đồng',
      detailedExplanation: 'Giải thích chi tiết từ kho đề',
      officialVerified: 'Đáp án chính thức đã xác thực',
      coreRule: 'Quy tắc thiết kế cốt lõi SAA-C03',
      vietnameseBreakdown: '🇻🇳 Tóm tắt & Phân tích Kiến trúc Tiếng Việt',
      objective: 'Mục tiêu bài toán',
      whyCorrect: 'Vì sao chọn đáp án này',
      trapWarning: 'Cảnh giác bẫy thi thường gặp',
      whyWrong: 'Vì sao lựa chọn của bạn chưa chính xác',
      whyWrongDetail: 'Phân tích chi tiết phương án sai đã chọn',
      distractorAnalysis: 'Phân tích chi tiết vì sao các đáp án khác sai (Distractor Analysis)',
      collapseDistractors: 'Thu gọn phân tích phương án sai',
      expandDistractors: 'Xem chi tiết vì sao các phương án khác sai',
      yourWrongSelection: 'Phương án bạn đã chọn (Chưa chính xác)',
      contrastCorrect: 'So sánh với kiến trúc đúng',
      coreFlaw: 'Điểm sai cốt lõi & Ràng buộc bị vi phạm',
      technicalAnalysis: 'Phân tích kỹ thuật chuyên sâu',
      otherDistractors: 'Phân tích các phương án còn lại',
    },
    exam: {
      title: 'AWS Certified Solutions Architect - Associate (SAA-C03)',
      standardSubtitle: 'Mô phỏng thi chuẩn 65 câu tính giờ đúng quy cách đề thi chính thức của AWS',
      questionsCount: '65 Câu hỏi',
      duration: '130 Phút',
      passScore: 'Điểm chuẩn đạt: 720 / 1000 (Điểm quy đổi)',
      submitExam: 'Nộp bài thi',
      confirmSubmitTitle: 'Bạn đã sẵn sàng nộp bài thi?',
      confirmSubmitDesc: 'Bạn sắp kết thúc phiên thi thử. Hãy kiểm tra lại tiến độ làm bài bên dưới trước khi xác nhận nộp.',
      answered: 'Đã trả lời',
      unanswered: 'Chưa trả lời',
      flagged: 'Đánh dấu xem lại',
      reviewScreen: 'Bảng xem lại câu hỏi',
      returnToExam: 'Quay lại làm bài',
      finalSubmit: 'Xác nhận Nộp bài',
      cancel: 'Hủy bỏ',
      timeWarning: 'Thời gian sắp hết! Còn dưới 5 phút.',
      timeExpired: 'Đã hết giờ làm bài! Bài thi sẽ tự động được nộp.',
      questionOf: 'Câu hỏi {current} / {total}',
      helpGlossary: 'Trợ giúp / Thuật ngữ',
      selectOneInstruction: 'Chọn MỘT đáp án.',
      selectTwoInstruction: 'Chọn HAI đáp án.',
      selectThreeInstruction: 'Chọn BA đáp án.',
      selectCountInstruction: 'Chọn {count} đáp án.',
      clearResponse: 'Xóa lựa chọn',
      previous: 'Câu trước',
      next: 'Câu tiếp',
      goToReviewScreen: 'Đến Bảng xem lại',
      reviewAll: 'Xem lại tất cả ({count})',
      reviewIncomplete: 'Xem lại câu chưa làm ({count})',
      reviewMarked: 'Xem lại câu đã đánh dấu ({count})',
      endExam: 'Kết thúc thi',
      returnToCurrentQuestion: 'Quay lại câu đang làm',
      timeRemainingLabel: 'Thời gian còn lại:',
      incomplete: 'Chưa trả lời',
      complete: 'Đã trả lời',
      questionStatusSummary: 'Tóm tắt trạng thái câu hỏi',
      clickRowToView: 'Nhấp vào dòng để xem câu hỏi',
      unansweredRemaining: 'Vẫn còn câu hỏi chưa trả lời',
      submitGradeDesc: 'Sau khi nộp, hệ thống sẽ chấm điểm và hiển thị phân tích chi tiết kết quả của bạn.',
      totalQuestions: 'Tổng số câu hỏi:',
      submitAndGrade: 'Nộp và chấm điểm bài thi',
      unansweredWarning: 'Bạn vẫn còn {count} câu hỏi chưa trả lời. Những câu này sẽ bị tính là sai nếu nộp ngay bây giờ.',
      helpTitle: 'Hướng dẫn & Tài liệu Tham khảo Chuẩn',
      helpSubtitle: 'Quy chuẩn hướng dẫn làm bài và nguyên tắc phân bổ thời gian',
      timingPacing: 'Phân bổ thời gian',
      timingPacingDesc: '130 phút cho 65 câu hỏi tương đương 2 phút/câu. Hãy phân bổ thời gian hợp lý.',
      markForReviewHelp: 'Đánh dấu xem lại',
      markForReviewHelpDesc: 'Dùng nút "Đánh dấu xem lại" cho câu chưa chắc chắn để quay lại kiểm tra trong Bảng xem lại trước khi nộp.',
      multiSelectHelp: 'Câu nhiều đáp án',
      multiSelectHelpDesc: 'Chú ý các câu có yêu cầu "Select TWO" hoặc "Select THREE". Hộp kiểm vuông biểu thị câu hỏi chọn nhiều đáp án.',
      glossaryTitle: 'Bảng thuật ngữ viết tắt AWS chuẩn',
    },
    home: {
      title: 'AWS Certified Solutions Architect - Associate',
      subtitle: 'Nền tảng luyện thi SAA-C03 chuyên nghiệp với 1,019 câu hỏi chuẩn xác, thẻ ghi nhớ lặp lại ngắt quãng Leitner, chẩn đoán điểm yếu thích ứng và bảng ma trận so sánh kiến trúc.',
      readinessScore: 'Chỉ số Sẵn sàng Thi',
      readinessLabel: 'Mức độ Tự tin',
      streakDays: 'Ngày học liên tiếp',
      cardsReviewed: 'Thẻ đã ôn tập',
      questionsAttempted: 'Câu hỏi đã luyện',
      passProbability: 'Tỉ lệ đỗ ước tính',
      dangerousMisconceptions: 'Sai lầm nghiêm trọng (Tự tin cao nhưng sai)',
      heroCtaExam: 'Bắt đầu Thi thử 65 Câu (130 Phút)',
      heroCtaStudy: 'Tiếp tục Chế độ Học tập',
      recentAttempts: 'Lịch sử Các Lần Thi Thử Gần Đây',
      noAttemptsYet: 'Chưa có lịch sử thi thử. Hãy bắt đầu lần thi 65 câu đầu tiên để đo lường năng lực!',
      viewAll: 'Xem tất cả',
      cardDomainsTitle: 'Luyện tập theo 4 Domain',
      cardDomainsDesc: 'Luyện tập bám sát tỷ trọng đề thi AWS: Bảo mật (30%), Độ bền vững (26%), Hiệu năng cao (24%), Chi phí (20%).',
      cardDomainsBtn: 'Bắt đầu Luyện Domain',
      cardWeaknessTitle: 'Chẩn đoán & Luyện Điểm yếu',
      cardWeaknessDesc: 'Phát hiện các điểm mù kiến trúc nguy hiểm và xếp hạng các dịch vụ AWS bạn hay trả lời sai nhất.',
      cardWeaknessBtn: 'Khắc phục Điểm yếu',
      cardFlashcardsTitle: 'Thẻ Ghi nhớ Flashcards Leitner',
      cardFlashcardsDesc: 'Hệ thống thẻ ôn tập thuật ngữ dịch vụ, bẫy thi, các cặp dịch vụ dễ nhầm lẫn theo phương pháp khoa học.',
      cardFlashcardsBtn: 'Học Flashcards',
      cardArchitectureTitle: 'Tra cứu & So sánh Kiến trúc',
      cardArchitectureDesc: 'Bảng ma trận so sánh chuyên sâu (S3 vs EBS vs EFS, ALB vs NLB, SQS vs SNS) kèm quy tắc chọn đáp án.',
      cardArchitectureBtn: 'Khám phá Kiến trúc',
      cardStudyPlanTitle: 'Lộ trình Ôn thi 30 Ngày',
      cardStudyPlanDesc: 'Kế hoạch học tập từng ngày khoa học, mục tiêu cột mốc hàng tuần và theo dõi tiến độ hoàn thành.',
      cardStudyPlanBtn: 'Xem Lộ trình Học',
    },
    flashcards: {
      title: 'Thẻ Ghi nhớ Spaced Repetition',
      subtitle: 'Nắm vững đặc tính kiến trúc, giới hạn dịch vụ và các bẫy đề thi SAA-C03 theo hệ thống Leitner 5 hộp.',
      cardCount: 'Thẻ {current} / {total}',
      flipCard: 'Nhấp vào thẻ để lật mặt sau',
      pressSpace: 'Bấm Phím cách để lật, 1-4 để đánh giá',
      again: 'Quên / Học lại (1)',
      hard: 'Khó nhớ (2)',
      good: 'Nhớ tốt (3)',
      easy: 'Rất dễ (4)',
      leitnerBox: 'Hộp Leitner {box}',
      deckAll: 'Tất cả bộ thẻ',
      deckServices: 'Dịch vụ Cốt lõi',
      deckDomains: '4 Domain Đề thi',
      deckTraps: 'Bẫy thi Thường gặp',
      deckComparisons: 'So sánh Kiến trúc',
      mastered: 'Đã thuộc làu (Hộp 4-5)',
      learning: 'Đang ghi nhớ (Hộp 2-3)',
      notStarted: 'Chưa học (Hộp 1)',
      rateRecall: 'Đánh giá mức độ nhớ để lên lịch ôn tiếp theo:',
      advanceBox: 'Lên +1 Hộp',
      keepBox: 'Giữ nguyên Hộp (1 ngày)',
      resetBox: 'Về Hộp 1 (1 ngày)',
      previousCard: 'Thẻ trước',
      nextCard: 'Thẻ tiếp theo',
      noCards: 'Không có thẻ nào trong bộ này',
      reviewedTimes: 'Đã ôn tập {count} lần',
    },
    architecture: {
      title: 'Danh mục Dịch vụ & Kiến trúc AWS',
      subtitle: 'Phân tích sâu các điểm đánh đổi kiến trúc, bảng ma trận so sánh, nguyên tắc quyết định và cảnh báo bẫy thi SAA-C03.',
      tabServices: 'Danh bạ Dịch vụ',
      tabComparisons: 'Bảng Ma trận So sánh',
      searchPlaceholder: 'Tìm kiếm dịch vụ AWS, từ viết tắt, hoặc bảng so sánh...',
      allCategories: 'Tất cả phân loại',
      matrixHeaderDimension: 'Tiêu chí Kiến trúc',
      matrixHeaderRule: 'Nguyên tắc Chọn trong Đề thi',
      matrixHeaderTraps: 'Bẫy thi Hay gặp',
      filterByCategory: 'Lọc theo nhóm dịch vụ',
      viewMatrix: 'Xem bảng so sánh',
    },
    study: {
      filter: 'Bộ lọc:',
      all: 'Tất cả',
      incorrect: 'Làm sai',
      bookmarked: 'Đã lưu',
      pastMistakes: 'Sai sót trước đây',
      navigator: 'Điều hướng',
      noQuestionsFound: 'Không tìm thấy câu hỏi nào trong bộ lọc hiện tại.',
      resetFilter: 'Đặt lại bộ lọc Tất cả',
      confidenceSelf: 'Độ tự tin tự đánh giá:',
      checkAnswer: 'Kiểm tra đáp án',
      retryQuestion: 'Làm lại câu này',
      resetQuestion: 'Reset câu này',
      resetAllQuestions: 'Reset toàn bộ',
      resetAllConfirmTitle: 'Reset toàn bộ trạng thái câu hỏi?',
      resetAllConfirmDesc: 'Thao tác này sẽ xóa toàn bộ đáp án đã chọn và kết quả của tất cả các câu hỏi trong phần học tập để bạn làm lại từ đầu. Các ghi chú cá nhân và câu hỏi đã lưu (Bookmarks) của bạn vẫn được giữ nguyên.',
      resetSuccess: 'Đã reset câu hỏi thành công!',
      resetAllSuccess: 'Đã reset toàn bộ câu hỏi thành công!',
      clearSelection: 'Xóa lựa chọn',
      clearFilters: 'Xóa tất cả bộ lọc',
      targetedReview: 'Xem lại & Phân tích Chuyên sâu',
      targetedReviewDesc: 'Tra cứu đáp án, giải thích chi tiết và đồng thuận cộng đồng trên toàn bộ kho đề.',
      stepByStep: 'Từng câu một',
      tableList: 'Dạng danh sách',
      reviewingCount: 'Đang xem câu {current} / {total} câu đã lọc',
      searchPlaceholder: 'Tìm từ khóa hoặc mã câu hỏi...',
      noMatch: 'Không có câu hỏi nào khớp với tiêu chí tìm kiếm và bộ lọc.',
      mastered: 'Thành thạo',
      missed: 'Chưa đúng',
    },
    domains: {
      title: 'Luyện tập Theo 4 Domain SAA-C03',
      subtitle: 'Tỷ trọng đề thi chuẩn AWS: Bảo mật (30%), Bền vững (26%), Hiệu năng cao (24%), Tối ưu chi phí (20%)',
      available: 'Hiện có',
      accuracy: 'Độ chính xác',
      mastered: 'Thành thạo',
      testedObjectives: 'Mục tiêu Kiến trúc Trọng tâm:',
      attempted: '{count} câu đã làm',
      start20: '20 Câu',
      start40: '40 Câu',
      percentOfExam: '% Đề thi',
    },
    weakness: {
      title: 'Chẩn đoán & Luyện Điểm yếu Thích ứng',
      subtitle: 'Phát hiện ngộ nhận rủi ro cao, thiên lệch đoán mò và các chủ đề dịch vụ còn yếu',
      examReadiness: 'Mức độ Sẵn sàng',
      dangerousTitle: 'Ngộ nhận Nguy hiểm',
      confidentWrong: 'Tự tin cao nhưng Trả lời sai',
      dangerousDesc: 'Rủi ro rớt kỳ thi rất cao do sự tự tin sai lệch.',
      fragileTitle: 'Kiến thức Chưa vững',
      guessedCorrect: 'Đoán mò nhưng May mắn đúng',
      fragileDesc: 'Đúng do may mắn. Cần củng cố lại nền tảng bản chất kiến trúc.',
      zeroDangerous: 'Tuyệt vời! Không có ngộ nhận nguy hiểm nào!',
      zeroDangerousDesc: 'Khi bạn luyện ở Chế độ Học tập với độ tự tin Cao hoặc Vừa mà trả lời sai, câu hỏi sẽ xuất hiện tại đây để khắc phục.',
      confidence: 'Độ tự tin:',
      weakestServices: 'Chủ đề Dịch vụ AWS Cần Cải thiện',
      rankedByError: 'Xếp hạng theo tỷ lệ trả lời sai',
      notEnoughData: 'Chưa đủ dữ liệu luyện tập',
      notEnoughDataDesc: 'Hãy luyện ít nhất 2 câu cho mỗi nhóm dịch vụ trong Chế độ Học hoặc Thi thử để phân tích.',
      errorRate: 'Tỉ lệ sai',
      drill: 'Luyện tập',
      drillFragile: 'Luyện tất cả câu Chưa vững ({count})',
      drillDangerous: 'Luyện ngay ({count})',
    },
    studyPlan: {
      title: 'Lộ trình Ôn thi SAA-C03 Chuẩn 30 Ngày',
      subtitle: 'Lộ trình khoa học 4 tuần bao quát 4 Domain SAA-C03, các đề thi thử và bộ bẫy thi',
      reset: 'Đặt lại',
      resetConfirm: 'Bạn có chắc chắn muốn đặt lại lộ trình học về Ngày 1?',
      week: 'Tuần',
      day: 'Ngày',
      completed: 'Hoàn thành',
      markDone: 'Đánh dấu xong',
      practiceNow: 'Luyện ngay',
      overallProgress: 'Tiến độ Toàn bộ Lộ trình',
      daysCompleted: 'Đã hoàn thành {completed} / {total} Ngày',
      milestone: 'Cột mốc Tuần',
      planCompletion: 'Tiến độ Kế hoạch',
      pacing: 'Nhịp học: ~{minutes} phút/ngày • Bắt đầu {startDate}',
      studyStreak: 'Chuỗi Ngày Học',
      consecutiveDays: 'Ngày liên tiếp',
      consecutiveDay: 'Ngày liên tiếp',
      tip: 'Mẹo: Kết hợp luyện câu hỏi hàng ngày với việc ôn 10-15 Flashcards để tối ưu khả năng ghi nhớ ngắt quãng (spaced repetition).',
      questionsCount: 'Câu',
      week1Label: 'Tuần 1: Bảo mật (Domain 1)',
      week1Desc: 'Bảo mật IAM, KMS, VPC',
      week2Label: 'Tuần 2: Độ bền (Domain 2)',
      week2Desc: 'Multi-AZ, Kiến trúc lỏng, SQS',
      week3Label: 'Tuần 3: Hiệu năng cao (Domain 3)',
      week3Desc: 'Aurora, DAX, CloudFront',
      week4Label: 'Tuần 4: Chi phí & Đề thi thử',
      week4Desc: 'Mô phỏng thi, Bẫy thi & Tối ưu S3',
    },
    result: {
      reportTitle: 'Báo cáo Kết quả Kỳ thi Thử',
      passingScore: 'Điểm chuẩn đỗ: 720 / 1000 (72%)',
      passed: 'ĐÃ ĐẠT (PASS)',
      didNotPass: 'CHƯA ĐẠT (FAIL)',
      congrats: 'Xin chúc mừng! Bạn đã vượt qua ngưỡng điểm yêu cầu cho kỳ thi AWS Solutions Architect.',
      tryAgain: 'Điểm số chưa đạt mốc chuẩn 720. Hãy xem lại các câu trả lời sai bên dưới để bù đắp kiến thức còn hổng.',
      drillIncorrect: 'Luyện lại câu sai ({count})',
      retakeExam: 'Thi lại lần nữa',
      filterAll: 'Tất cả câu hỏi',
      filterIncorrect: 'Câu sai',
      filterCorrect: 'Câu đúng',
      filterUnanswered: 'Chưa làm',
      filterMarked: 'Đã đánh dấu',
      scoreBreakdown: 'Phân tích Điểm theo Domain',
      totalQuestions: 'Tổng số câu',
      correct: 'Đúng',
      incorrect: 'Sai',
      unanswered: 'Chưa làm',
      timeUsed: 'Thời gian làm bài',
      avgPerQuestion: 'TB / Câu',
      breakdownTitle: 'Chi tiết Từng Câu hỏi',
      yourAnswer: 'Bạn chọn:',
      correctAnswer: 'Đáp án đúng:',
      noneAnswer: 'Chưa chọn',
    },
    notes: {
      title: 'Ghi chú & Phân tích Cá nhân',
      saved: 'Đã lưu',
      searchable: 'Tìm kiếm nhanh bằng',
      placeholder: 'Ghi chép mẹo nhớ, phân tích vì sao loại trừ đáp án, dịch vụ AWS then chốt...',
      editTab: 'Soạn thảo',
      previewTab: 'Xem trước Định dạng',
      bold: 'In đậm (Ctrl+B)',
      italic: 'In nghiêng (Ctrl+I)',
      highlight: 'Tô sáng / Highlight (Ctrl+H)',
      heading: 'Tiêu đề (###)',
      bulletList: 'Gạch đầu dòng (-)',
      code: 'Mã / Dịch vụ AWS (`...`)',
      expand: 'Mở rộng Trình soạn thảo',
      collapse: 'Thu nhỏ',
      delete: 'Xóa ghi chú',
      deleteConfirm: 'Bạn có chắc chắn muốn xóa ghi chú này?',
      save: 'Lưu ghi chú',
      chars: 'ký tự',
      lines: 'dòng',
      emptyPreview: 'Chưa có nội dung ghi chú. Chuyển sang tab Soạn thảo để bắt đầu viết.',
    },
  },
};
