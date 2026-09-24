import React, { useState, useMemo } from 'react';
import type { StudyPlanConfig, StudyPlanDay, AWSDomain } from '../core/types';
import { storage } from '../core/storage';
import { useLanguage } from '../context/useLanguage';
import { 
  CheckCircle, 
  Flame, 
  ArrowLeft, 
  BookOpen, 
  RotateCcw,
  Sparkles
} from 'lucide-react';

interface StudyPlanViewProps {
  onBackToHome: () => void;
  onLaunchDayPractice: (domain: AWSDomain, count: number) => void;
}

const DEFAULT_30_DAYS: StudyPlanDay[] = [
  // Week 1: Domain 1 - Security (30%)
  { day: 1, week: 1, title: 'IAM Roles, Policies & Instance Profiles', focusDomain: 'Domain 1: Design Secure Architectures', targetServices: ['IAM', 'STS'], recommendedQuestionsCount: 20, completed: false },
  { day: 2, week: 1, title: 'KMS Key Policies & Envelope Encryption', focusDomain: 'Domain 1: Design Secure Architectures', targetServices: ['KMS', 'S3'], recommendedQuestionsCount: 20, completed: false },
  { day: 3, week: 1, title: 'Secrets Manager vs Parameter Store', focusDomain: 'Domain 1: Design Secure Architectures', targetServices: ['Secrets Manager', 'SSM'], recommendedQuestionsCount: 20, completed: false },
  { day: 4, week: 1, title: 'S3 Bucket Policies, ACLs & Block Public Access', focusDomain: 'Domain 1: Design Secure Architectures', targetServices: ['S3', 'CloudFront'], recommendedQuestionsCount: 25, completed: false },
  { day: 5, week: 1, title: 'Security Groups vs Network ACLs', focusDomain: 'Domain 1: Design Secure Architectures', targetServices: ['VPC', 'EC2'], recommendedQuestionsCount: 25, completed: false },
  { day: 6, week: 1, title: 'WAF, Shield, GuardDuty & Security Hub', focusDomain: 'Domain 1: Design Secure Architectures', targetServices: ['WAF', 'Shield', 'GuardDuty'], recommendedQuestionsCount: 20, completed: false },
  { day: 7, week: 1, title: 'Week 1 Review & Domain 1 Drill', focusDomain: 'Domain 1: Design Secure Architectures', targetServices: ['IAM', 'KMS', 'S3'], recommendedQuestionsCount: 30, completed: false },

  // Week 2: Domain 2 - Resilience (26%)
  { day: 8, week: 2, title: 'VPC Subnets, Route Tables & NAT Gateways', focusDomain: 'Domain 2: Design Resilient Architectures', targetServices: ['VPC'], recommendedQuestionsCount: 25, completed: false },
  { day: 9, week: 2, title: 'Multi-AZ Deployments (RDS, Aurora, Auto Scaling)', focusDomain: 'Domain 2: Design Resilient Architectures', targetServices: ['RDS', 'Aurora', 'Auto Scaling'], recommendedQuestionsCount: 25, completed: false },
  { day: 10, week: 2, title: 'Decoupling with SQS (Standard vs FIFO, DLQ)', focusDomain: 'Domain 2: Design Resilient Architectures', targetServices: ['SQS'], recommendedQuestionsCount: 25, completed: false },
  { day: 11, week: 2, title: 'SNS Pub/Sub Fanout & EventBridge Event Buses', focusDomain: 'Domain 2: Design Resilient Architectures', targetServices: ['SNS', 'EventBridge'], recommendedQuestionsCount: 20, completed: false },
  { day: 12, week: 2, title: 'Route 53 Routing Policies & Health Checks', focusDomain: 'Domain 2: Design Resilient Architectures', targetServices: ['Route 53'], recommendedQuestionsCount: 20, completed: false },
  { day: 13, week: 2, title: 'Disaster Recovery Strategies (Pilot Light to Active-Active)', focusDomain: 'Domain 2: Design Resilient Architectures', targetServices: ['RDS', 'S3', 'Route 53'], recommendedQuestionsCount: 25, completed: false },
  { day: 14, week: 2, title: 'Week 2 Review: First 65Q Timed Simulation #1', focusDomain: 'Domain 2: Design Resilient Architectures', targetServices: ['VPC', 'RDS', 'SQS'], recommendedQuestionsCount: 65, completed: false },

  // Week 3: Domain 3 - High Performance (24%)
  { day: 15, week: 3, title: 'Storage Performance: EBS (gp3/io2) vs EFS vs FSx', focusDomain: 'Domain 3: Design High-Performing Architectures', targetServices: ['EBS', 'EFS', 'FSx'], recommendedQuestionsCount: 25, completed: false },
  { day: 16, week: 3, title: 'Compute Scaling: EC2 Placement Groups & Fargate', focusDomain: 'Domain 3: Design High-Performing Architectures', targetServices: ['EC2', 'ECS', 'Fargate'], recommendedQuestionsCount: 20, completed: false },
  { day: 17, week: 3, title: 'Database Scaling: Aurora vs DynamoDB + DAX', focusDomain: 'Domain 3: Design High-Performing Architectures', targetServices: ['Aurora', 'DynamoDB'], recommendedQuestionsCount: 25, completed: false },
  { day: 18, week: 3, title: 'In-Memory Caching: ElastiCache Redis vs Memcached', focusDomain: 'Domain 3: Design High-Performing Architectures', targetServices: ['ElastiCache'], recommendedQuestionsCount: 20, completed: false },
  { day: 19, week: 3, title: 'Load Balancing: ALB (Layer 7) vs NLB (Layer 4)', focusDomain: 'Domain 3: Design High-Performing Architectures', targetServices: ['ALB', 'NLB'], recommendedQuestionsCount: 25, completed: false },
  { day: 20, week: 3, title: 'Content Delivery: CloudFront Caching & OAC', focusDomain: 'Domain 3: Design High-Performing Architectures', targetServices: ['CloudFront', 'S3'], recommendedQuestionsCount: 25, completed: false },
  { day: 21, week: 3, title: 'Week 3 Review & Domain 3 Drill', focusDomain: 'Domain 3: Design High-Performing Architectures', targetServices: ['Aurora', 'CloudFront', 'EBS'], recommendedQuestionsCount: 30, completed: false },

  // Week 4: Domain 4 - Cost Optimization (20%) & Exam Polish
  { day: 22, week: 4, title: 'Compute Cost: Spot, Reserved & Savings Plans', focusDomain: 'Domain 4: Design Cost-Optimized Architectures', targetServices: ['EC2', 'Lambda'], recommendedQuestionsCount: 20, completed: false },
  { day: 23, week: 4, title: 'Storage Cost: S3 Lifecycle & Intelligent-Tiering', focusDomain: 'Domain 4: Design Cost-Optimized Architectures', targetServices: ['S3', 'Glacier'], recommendedQuestionsCount: 20, completed: false },
  { day: 24, week: 4, title: 'Network Cost: VPC Gateway Endpoints vs NAT Gateways', focusDomain: 'Domain 4: Design Cost-Optimized Architectures', targetServices: ['VPC', 'S3'], recommendedQuestionsCount: 20, completed: false },
  { day: 25, week: 4, title: 'High-Frequency Exam Traps Flashcards Drill', focusDomain: 'Domain 1: Design Secure Architectures', targetServices: ['Traps'], recommendedQuestionsCount: 25, completed: false },
  { day: 26, week: 4, title: 'Targeted Weakness Drill: Dangerous Misconceptions', focusDomain: 'Domain 2: Design Resilient Architectures', targetServices: ['Weaknesses'], recommendedQuestionsCount: 30, completed: false },
  { day: 27, week: 4, title: 'Full 65Q Timed Simulation #2 (Benchmark)', focusDomain: 'Domain 3: Design High-Performing Architectures', targetServices: ['All'], recommendedQuestionsCount: 65, completed: false },
  { day: 28, week: 4, title: 'Deep Review of Incorrect Simulator Answers', focusDomain: 'Domain 4: Design Cost-Optimized Architectures', targetServices: ['All'], recommendedQuestionsCount: 30, completed: false },
  { day: 29, week: 4, title: 'Final 65Q Timed Simulation #3 (Target 850+)', focusDomain: 'Domain 1: Design Secure Architectures', targetServices: ['All'], recommendedQuestionsCount: 65, completed: false },
  { day: 30, week: 4, title: 'Exam Day Readiness Review & Cheat Sheet', focusDomain: 'Domain 2: Design Resilient Architectures', targetServices: ['All'], recommendedQuestionsCount: 20, completed: false },
];

export const StudyPlanView: React.FC<StudyPlanViewProps> = ({
  onBackToHome,
  onLaunchDayPractice,
}) => {
  const { t } = useLanguage();
  const [planConfig, setPlanConfig] = useState<StudyPlanConfig>(() => {
    const saved = storage.getStudyPlan();
    if (saved) return saved;
    return {
      targetDays: 30,
      dailyMinutes: 45,
      startDate: new Date().toISOString().slice(0, 10),
      days: DEFAULT_30_DAYS,
    };
  });

  const [selectedWeek, setSelectedWeek] = useState<number>(1);
  const profile = useMemo(() => storage.getLearningProfile(), []);

  const completedDaysCount = useMemo(
    () => planConfig.days.filter((d) => d.completed).length,
    [planConfig.days]
  );

  const progressPercent = Math.round((completedDaysCount / planConfig.days.length) * 100);

  const toggleDayCompletion = (dayNumber: number) => {
    const updatedDays = planConfig.days.map((d) =>
      d.day === dayNumber ? { ...d, completed: !d.completed } : d
    );
    const updatedConfig = { ...planConfig, days: updatedDays };
    setPlanConfig(updatedConfig);
    storage.saveStudyPlan(updatedConfig);
    storage.incrementDailyActivity(1);
  };

  const handleResetPlan = () => {
    if (window.confirm(t.studyPlan.resetConfirm)) {
      const resetConfig: StudyPlanConfig = {
        ...planConfig,
        days: DEFAULT_30_DAYS.map((d) => ({ ...d, completed: false })),
      };
      setPlanConfig(resetConfig);
      storage.saveStudyPlan(resetConfig);
    }
  };

  const currentWeekDays = useMemo(
    () => planConfig.days.filter((d) => d.week === selectedWeek),
    [planConfig.days, selectedWeek]
  );

  const weekTabs = [
    { week: 1, label: t.studyPlan.week1Label, desc: t.studyPlan.week1Desc },
    { week: 2, label: t.studyPlan.week2Label, desc: t.studyPlan.week2Desc },
    { week: 3, label: t.studyPlan.week3Label, desc: t.studyPlan.week3Desc },
    { week: 4, label: t.studyPlan.week4Label, desc: t.studyPlan.week4Desc },
  ];

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
      {/* Header */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBackToHome}
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-xs hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>{t.nav.dashboard}</span>
          </button>
          <div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">
              {t.studyPlan.title}
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {t.studyPlan.subtitle}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleResetPlan}
          className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-500 hover:text-slate-800 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400 dark:hover:text-slate-200"
        >
          <RotateCcw className="h-3 w-3" />
          <span>{t.studyPlan.reset}</span>
        </button>
      </div>

      {/* Progress & Streak Banner */}
      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
        {/* Progress */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:col-span-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              {t.studyPlan.planCompletion}
            </span>
            <span className="text-xs font-semibold text-blue-600 dark:text-blue-400">
              {t.studyPlan.daysCompleted.replace('{completed}', String(completedDaysCount)).replace('{total}', String(planConfig.days.length))} ({progressPercent}%)
            </span>
          </div>
          <div className="mt-3 h-2.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
            <div
              className="h-full bg-blue-600 transition-all duration-500 dark:bg-blue-500"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <p className="mt-2 text-[11px] text-slate-500 dark:text-slate-400">
            {t.studyPlan.pacing.replace('{minutes}', String(planConfig.dailyMinutes)).replace('{startDate}', planConfig.startDate)}
          </p>
        </div>

        {/* Streak */}
        <div className="flex flex-col justify-center rounded-2xl border border-amber-200 bg-amber-50/40 p-5 shadow-sm dark:border-amber-950 dark:bg-amber-950/20">
          <div className="flex items-center gap-2">
            <Flame className="h-5 w-5 fill-amber-500 text-amber-500" />
            <span className="text-xs font-bold uppercase tracking-wider text-amber-900 dark:text-amber-300">
              {t.studyPlan.studyStreak}
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-black text-amber-900 dark:text-amber-100">
              {profile.streakDays}
            </span>
            <span className="text-xs font-semibold text-amber-700 dark:text-amber-300">
              {profile.streakDays === 1 ? t.studyPlan.consecutiveDay : t.studyPlan.consecutiveDays}
            </span>
          </div>
        </div>
      </div>

      {/* Week Selector Tabs */}
      <div className="mb-6 flex overflow-x-auto no-scrollbar rounded-xl border border-slate-200 bg-slate-100 p-1 dark:border-slate-800 dark:bg-slate-900 scroll-touch">
        {weekTabs.map((w) => {
          const isSelected = selectedWeek === w.week;
          const weekDays = planConfig.days.filter((d) => d.week === w.week);
          const weekDone = weekDays.filter((d) => d.completed).length;

          return (
            <button
              key={w.week}
              type="button"
              onClick={() => setSelectedWeek(w.week)}
              className={`flex-shrink-0 sm:flex-1 min-w-[170px] sm:min-w-[200px] rounded-lg p-2.5 text-left transition-all ${
                isSelected
                  ? 'bg-white shadow-xs dark:bg-slate-800'
                  : 'hover:bg-slate-200/50 dark:hover:bg-slate-800/40'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className={`text-xs font-bold ${isSelected ? 'text-blue-600 dark:text-blue-400' : 'text-slate-700 dark:text-slate-300'}`}>
                  {w.label}
                </span>
                <span className="rounded-full bg-slate-200/60 px-1.5 py-0.2 text-[10px] font-semibold text-slate-600 dark:bg-slate-700 dark:text-slate-300">
                  {weekDone}/7
                </span>
              </div>
              <p className="mt-0.5 line-clamp-1 text-[11px] text-slate-500 dark:text-slate-400">
                {w.desc}
              </p>
            </button>
          );
        })}
      </div>

      {/* Daily Milestones List */}
      <div className="space-y-3">
        {currentWeekDays.map((day) => (
          <div
            key={day.day}
            className={`flex flex-col gap-3 rounded-2xl border p-4 transition-all sm:flex-row sm:items-center sm:justify-between ${
              day.completed
                ? 'border-emerald-200 bg-emerald-50/40 dark:border-emerald-950 dark:bg-emerald-950/20'
                : 'border-slate-200 bg-white hover:border-slate-300 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-slate-700'
            }`}
          >
            {/* Left Info */}
            <div className="flex items-start gap-3">
              <button
                type="button"
                onClick={() => toggleDayCompletion(day.day)}
                aria-label={day.completed ? `Đánh dấu chưa hoàn thành ngày ${day.day}` : `Đánh dấu hoàn thành ngày ${day.day}`}
                className="flex items-center justify-center min-w-[40px] min-h-[40px] -ml-2 -mt-1.5 shrink-0 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors touch-manipulation active:scale-90"
              >
                <div
                  className={`flex h-5 w-5 items-center justify-center rounded-full border transition-colors ${
                    day.completed
                      ? 'border-emerald-500 bg-emerald-500 text-white'
                      : 'border-slate-300 hover:border-blue-500 dark:border-slate-600'
                  }`}
                >
                  {day.completed && <CheckCircle className="h-4 w-4" />}
                </div>
              </button>

              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-black uppercase text-blue-600 dark:text-blue-400">
                    {t.studyPlan.day} {day.day}
                  </span>
                  <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                    {day.focusDomain.split(':')[0]}
                  </span>
                  {day.targetServices.map((svc) => (
                    <span
                      key={svc}
                      className="rounded bg-blue-50 px-1.5 py-0.5 text-[10px] font-medium text-blue-700 dark:bg-blue-950 dark:text-blue-300"
                    >
                      {svc}
                    </span>
                  ))}
                </div>

                <h3 className={`mt-1 text-sm font-bold ${day.completed ? 'line-through text-slate-400 dark:text-slate-500' : 'text-slate-900 dark:text-slate-100'}`}>
                  {day.title}
                </h3>
              </div>
            </div>

            {/* Right Action */}
            <div className="flex items-center gap-3 self-end sm:self-auto">
              <span className="text-xs text-slate-500 dark:text-slate-400">
                {day.recommendedQuestionsCount} {t.studyPlan.questionsCount}
              </span>
              <button
                type="button"
                onClick={() => onLaunchDayPractice(day.focusDomain, day.recommendedQuestionsCount)}
                className="flex items-center justify-center gap-1.5 min-h-[38px] rounded-lg bg-blue-600 px-3.5 py-2 text-xs font-semibold text-white shadow-xs hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 active:scale-95 touch-manipulation transition-transform"
              >
                <BookOpen className="h-3.5 w-3.5" />
                <span>{t.studyPlan.practiceNow}</span>
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Footer Tip */}
      <div className="mt-8 flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs text-slate-600 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-400">
        <Sparkles className="h-4 w-4 text-amber-500 shrink-0" />
        <span>
          {t.studyPlan.tip}
        </span>
      </div>
    </div>
  );
};
