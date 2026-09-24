import React from 'react';
import { X, HelpCircle, BookOpen, Clock, CheckSquare } from 'lucide-react';
import { useLanguage } from '../context/useLanguage';

interface ExamHelpModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const AWS_ACRONYMS = [
  { term: 'ALB', full: 'Application Load Balancer', desc: 'Layer 7 load balancer with path/host routing and SSL termination.' },
  { term: 'NLB', full: 'Network Load Balancer', desc: 'Layer 4 ultra-low latency load balancer supporting TCP/UDP and static IPs.' },
  { term: 'IGW', full: 'Internet Gateway', desc: 'Horizontally scaled, redundant VPC component that enables communication with the internet.' },
  { term: 'VGW', full: 'Virtual Private Gateway', desc: 'The VPN concentrator on the Amazon VPC side of a Site-to-Site VPN connection.' },
  { term: 'NAT GW', full: 'Network Address Translation Gateway', desc: 'Managed gateway enabling instances in private subnets to connect to the internet.' },
  { term: 'EBS', full: 'Elastic Block Store', desc: 'High-performance block storage volumes for EC2 instances (single AZ bound).' },
  { term: 'EFS', full: 'Elastic File System', desc: 'Fully managed POSIX-compliant shared file system across multiple AZs for Linux.' },
  { term: 'KMS', full: 'Key Management Service', desc: 'Managed service to create and control cryptographic keys for data encryption.' },
  { term: 'SCP', full: 'Service Control Policy', desc: 'Organization-level guardrails that specify the maximum permissions for member accounts.' },
  { term: 'DAX', full: 'DynamoDB Accelerator', desc: 'Fully managed, in-memory cache for DynamoDB delivering microsecond read response.' },
  { term: 'OAC', full: 'Origin Access Control', desc: 'Recommended method for securing Amazon S3 origins behind Amazon CloudFront.' },
  { term: 'STS', full: 'Security Token Service', desc: 'Web service providing temporary, limited-privilege credentials for IAM users or federated identities.' },
];

export const ExamHelpModal: React.FC<ExamHelpModalProps> = ({ isOpen, onClose }) => {
  const { t } = useLanguage();
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl transition-all dark:border-slate-800 dark:bg-slate-900"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="rounded-lg bg-blue-100 p-2 text-blue-700 dark:bg-blue-950/80 dark:text-blue-300">
              <HelpCircle className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
                {t.exam.helpTitle}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {t.exam.helpSubtitle}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Instructions */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5 dark:border-slate-800 dark:bg-slate-800/40">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-800 dark:text-slate-200">
                <Clock className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                <span>{t.exam.timingPacing}</span>
              </div>
              <p className="mt-1.5 text-xs text-slate-600 dark:text-slate-400">
                {t.exam.timingPacingDesc}
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5 dark:border-slate-800 dark:bg-slate-800/40">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-800 dark:text-slate-200">
                <CheckSquare className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                <span>{t.exam.markForReviewHelp}</span>
              </div>
              <p className="mt-1.5 text-xs text-slate-600 dark:text-slate-400">
                {t.exam.markForReviewHelpDesc}
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5 dark:border-slate-800 dark:bg-slate-800/40">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-800 dark:text-slate-200">
                <BookOpen className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                <span>{t.exam.multiSelectHelp}</span>
              </div>
              <p className="mt-1.5 text-xs text-slate-600 dark:text-slate-400">
                {t.exam.multiSelectHelpDesc}
              </p>
            </div>
          </div>

          {/* Acronyms glossary */}
          <div>
            <h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              {t.exam.glossaryTitle}
            </h3>
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              {AWS_ACRONYMS.map((item) => (
                <div
                  key={item.term}
                  className="rounded-lg border border-slate-200 bg-white p-3 text-left dark:border-slate-800 dark:bg-slate-900"
                >
                  <div className="flex items-baseline gap-2">
                    <span className="font-mono text-xs font-bold text-blue-600 dark:text-blue-400">
                      {item.term}
                    </span>
                    <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                      {item.full}
                    </span>
                  </div>
                  <p className="mt-1 text-[11px] leading-relaxed text-slate-600 dark:text-slate-400">
                    {item.desc}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end border-t border-slate-200 bg-slate-50 px-6 py-3 dark:border-slate-800 dark:bg-slate-950">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600"
          >
            {t.exam.returnToExam}
          </button>
        </div>
      </div>
    </div>
  );
};
