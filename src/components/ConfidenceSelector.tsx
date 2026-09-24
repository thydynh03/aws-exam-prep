import React from 'react';
import type { ConfidenceLevel } from '../core/types';
import { HelpCircle, AlertTriangle, CheckCircle2, ShieldCheck } from 'lucide-react';

interface ConfidenceSelectorProps {
  value?: ConfidenceLevel;
  onChange: (level: ConfidenceLevel) => void;
  disabled?: boolean;
}

const CONFIDENCE_OPTIONS: {
  level: ConfidenceLevel;
  label: string;
  sublabel: string;
  icon: React.ComponentType<{ className?: string }>;
  colorActive: string;
  badgeBg: string;
}[] = [
  {
    level: 'guessing',
    label: 'Guessing',
    sublabel: 'Pure 50/50 or shot in the dark',
    icon: HelpCircle,
    colorActive: 'border-amber-500 bg-amber-50/70 text-amber-900 dark:border-amber-400 dark:bg-amber-950/40 dark:text-amber-200',
    badgeBg: 'bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-300',
  },
  {
    level: 'low',
    label: 'Low',
    sublabel: 'Uncertain, leaning towards this',
    icon: AlertTriangle,
    colorActive: 'border-yellow-500 bg-yellow-50/70 text-yellow-900 dark:border-yellow-400 dark:bg-yellow-950/40 dark:text-yellow-200',
    badgeBg: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/60 dark:text-yellow-300',
  },
  {
    level: 'medium',
    label: 'Medium',
    sublabel: 'Fairly confident, eliminated others',
    icon: CheckCircle2,
    colorActive: 'border-blue-500 bg-blue-50/70 text-blue-900 dark:border-blue-400 dark:bg-blue-950/40 dark:text-blue-200',
    badgeBg: 'bg-blue-100 text-blue-800 dark:bg-blue-900/60 dark:text-blue-300',
  },
  {
    level: 'high',
    label: 'High',
    sublabel: '100% sure of this architectural tenet',
    icon: ShieldCheck,
    colorActive: 'border-emerald-500 bg-emerald-50/70 text-emerald-900 dark:border-emerald-400 dark:bg-emerald-950/40 dark:text-emerald-200',
    badgeBg: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-300',
  },
];

export const ConfidenceSelector: React.FC<ConfidenceSelectorProps> = ({
  value,
  onChange,
  disabled = false,
}) => {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="mb-2 flex items-center justify-between">
        <label className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
          Confidence Level (Self-Assessment)
        </label>
        <span className="text-xs text-slate-600 dark:text-slate-400">
          Feeds Weakness Risk Matrix
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {CONFIDENCE_OPTIONS.map((opt) => {
          const isSelected = value === opt.level;
          const Icon = opt.icon;

          return (
            <button
              key={opt.level}
              type="button"
              disabled={disabled}
              onClick={() => onChange(opt.level)}
              className={`flex flex-col items-start rounded-lg border p-2.5 text-left transition-all ${
                isSelected
                  ? `${opt.colorActive} shadow-sm ring-1 ring-current`
                  : 'border-slate-200 bg-slate-50/50 text-slate-700 hover:border-slate-300 hover:bg-slate-100/60 dark:border-slate-800 dark:bg-slate-800/50 dark:text-slate-300 dark:hover:border-slate-700 dark:hover:bg-slate-800'
              } ${disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}`}
            >
              <div className="flex w-full items-center justify-between">
                <span className="flex items-center gap-1.5 text-xs font-bold">
                  <Icon className="h-3.5 w-3.5 shrink-0" />
                  {opt.label}
                </span>
                {isSelected && (
                  <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${opt.badgeBg}`}>
                    Active
                  </span>
                )}
              </div>
              <span className="mt-1 line-clamp-1 text-[11px] text-slate-600 dark:text-slate-400">
                {opt.sublabel}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
