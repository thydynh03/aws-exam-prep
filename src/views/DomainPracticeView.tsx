import React, { useMemo } from 'react';
import type { Question, AWSDomain } from '../core/types';
import { storage } from '../core/storage';
import { calculateDomainMastery } from '../core/learningEngine';
import { 
  ShieldCheck, 
  RefreshCw, 
  Zap, 
  DollarSign, 
  Play, 
  ArrowLeft, 
  BookOpen,
  CheckCircle2
} from 'lucide-react';
import { useLanguage } from '../context/useLanguage';

interface DomainPracticeViewProps {
  allQuestions: Question[];
  onBackToHome: () => void;
  onStartDomainPractice: (domain: AWSDomain, count: number) => void;
}

interface DomainMeta {
  domain: AWSDomain;
  weightPercent: number;
  icon: React.ComponentType<{ className?: string }>;
  accentColor: string;
  badgeBg: string;
  subtopics: string[];
}

const DOMAIN_METAS: DomainMeta[] = [
  {
    domain: 'Domain 1: Design Secure Architectures',
    weightPercent: 30,
    icon: ShieldCheck,
    accentColor: 'text-blue-600 dark:text-blue-400',
    badgeBg: 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300',
    subtopics: [
      'Design secure access to AWS resources (IAM least privilege, STS roles, Cognito)',
      'Design secure workloads and applications (Security Groups, NACLs, WAF, Shield)',
      'Determine appropriate data security controls (KMS envelope encryption, Secrets Manager, S3 bucket policies)',
    ],
  },
  {
    domain: 'Domain 2: Design Resilient Architectures',
    weightPercent: 26,
    icon: RefreshCw,
    accentColor: 'text-emerald-600 dark:text-emerald-400',
    badgeBg: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300',
    subtopics: [
      'Design scalable and loosely coupled architectures (SQS queues, SNS fanout, EventBridge)',
      'Design highly available and fault-tolerant architectures (Multi-AZ, Auto Scaling, Route 53 DNS)',
      'Determine disaster recovery strategies (Backup & Restore, Pilot Light, Warm Standby, Multi-Region Active-Active)',
    ],
  },
  {
    domain: 'Domain 3: Design High-Performing Architectures',
    weightPercent: 24,
    icon: Zap,
    accentColor: 'text-purple-600 dark:text-purple-400',
    badgeBg: 'bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300',
    subtopics: [
      'Determine high-performing elastic storage solutions (EBS gp3/io2, EFS, FSx Lustre/Windows)',
      'Design high-performing compute solutions (EC2 placement groups, Fargate, Lambda concurrency)',
      'Design high-performing database solutions (Aurora, DynamoDB + DAX, ElastiCache Redis/Memcached)',
      'Determine high-performing networking architectures (CloudFront, Global Accelerator, Direct Connect)',
    ],
  },
  {
    domain: 'Domain 4: Design Cost-Optimized Architectures',
    weightPercent: 20,
    icon: DollarSign,
    accentColor: 'text-amber-600 dark:text-amber-400',
    badgeBg: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300',
    subtopics: [
      'Design cost-optimized storage solutions (S3 Lifecycle, Intelligent-Tiering, Glacier Deep Archive)',
      'Design cost-optimized compute solutions (Spot instances, Savings Plans, Graviton processors)',
      'Design cost-optimized database solutions (Aurora Serverless, DynamoDB On-Demand vs Provisioned)',
      'Design cost-optimized network architectures (Gateway VPC Endpoints over NAT Gateways)',
    ],
  },
];

export const DomainPracticeView: React.FC<DomainPracticeViewProps> = ({
  allQuestions,
  onBackToHome,
  onStartDomainPractice,
}) => {
  const { t } = useLanguage();
  const studyProgress = useMemo(() => storage.getStudyProgress(), []);
  const domainStats = useMemo(
    () => calculateDomainMastery(allQuestions, studyProgress),
    [allQuestions, studyProgress]
  );

  const statsMap = useMemo(() => {
    const map = new Map<AWSDomain, (typeof domainStats)[0]>();
    for (const stat of domainStats) {
      map.set(stat.domain, stat);
    }
    return map;
  }, [domainStats]);

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
      {/* Header */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBackToHome}
            className="flex items-center justify-center gap-1.5 min-h-[38px] rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-xs hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800 transition-all active:scale-95 touch-manipulation"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>{t.nav.dashboard}</span>
          </button>
          <div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">
              {t.domains.title}
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {t.domains.subtitle}
            </p>
          </div>
        </div>
      </div>

      {/* Domain Cards Grid */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {DOMAIN_METAS.map((meta) => {
          const stat = statsMap.get(meta.domain);
          const Icon = meta.icon;
          const totalQ = stat?.totalQuestions || 0;
          const attempted = stat?.attemptedQuestions || 0;
          const accuracy = stat?.accuracyRate || 0;
          const mastered = stat?.masteredCount || 0;

          return (
            <div
              key={meta.domain}
              className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900"
            >
              <div>
                {/* Domain Header */}
                <div className="flex items-start justify-between gap-2 border-b border-slate-100 pb-4 dark:border-slate-800">
                  <div className="flex items-center gap-2.5">
                    <div className="rounded-xl bg-slate-100 p-2.5 dark:bg-slate-800">
                      <Icon className={`h-5 w-5 ${meta.accentColor}`} />
                    </div>
                    <div>
                      <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${meta.badgeBg}`}>
                        {meta.weightPercent}{t.domains.percentOfExam}
                      </span>
                      <h2 className="mt-1 text-base font-bold text-slate-900 dark:text-slate-100">
                        {meta.domain}
                      </h2>
                    </div>
                  </div>
                </div>

                {/* Progress Indicators */}
                <div className="mt-4 grid grid-cols-3 gap-2 rounded-xl bg-slate-50/70 p-3 text-center dark:bg-slate-800/40">
                  <div>
                    <span className="text-[10px] font-semibold text-slate-400 dark:text-slate-500">
                      {t.domains.available}
                    </span>
                    <p className="text-sm font-bold text-slate-800 dark:text-slate-200">
                      {totalQ} Qs
                    </p>
                  </div>
                  <div>
                    <span className="text-[10px] font-semibold text-slate-400 dark:text-slate-500">
                      {t.domains.accuracy}
                    </span>
                    <p className={`text-sm font-bold ${accuracy >= 72 ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-800 dark:text-slate-200'}`}>
                      {attempted > 0 ? `${accuracy}%` : '—'}
                    </p>
                  </div>
                  <div>
                    <span className="text-[10px] font-semibold text-slate-400 dark:text-slate-500">
                      {t.domains.mastered}
                    </span>
                    <p className="text-sm font-bold text-emerald-600 dark:text-emerald-400">
                      {mastered}
                    </p>
                  </div>
                </div>

                {/* Subtopics */}
                <div className="mt-4 space-y-1.5">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                    {t.domains.testedObjectives}
                  </span>
                  <ul className="space-y-1">
                    {meta.subtopics.map((st, i) => (
                      <li key={i} className="flex items-start gap-2 text-xs text-slate-600 dark:text-slate-300">
                        <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" />
                        <span>{st}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="mt-6 flex items-center justify-between gap-2 border-t border-slate-100 pt-4 dark:border-slate-800">
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  {t.domains.attempted.replace('{count}', String(attempted))}
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => onStartDomainPractice(meta.domain, 20)}
                    className="flex items-center justify-center gap-1 min-h-[38px] rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-xs hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800 transition-all active:scale-95 touch-manipulation"
                  >
                    <BookOpen className="h-3.5 w-3.5" />
                    <span>{t.domains.start20}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onStartDomainPractice(meta.domain, 40)}
                    className="flex items-center justify-center gap-1.5 min-h-[38px] rounded-lg bg-blue-600 px-3.5 py-2 text-xs font-semibold text-white shadow-xs hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 transition-all active:scale-95 touch-manipulation"
                  >
                    <Play className="h-3.5 w-3.5 fill-current" />
                    <span>{t.domains.start40}</span>
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

