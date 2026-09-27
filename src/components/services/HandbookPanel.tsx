import React, { useState } from 'react';
import { BookMarked, ChevronDown } from 'lucide-react';
import {
  getHandbookSectionsForExplorerId,
  formatHandbookPages,
  HANDBOOK_TITLE,
  type HandbookSection,
} from '../../core/saaHandbook';

const SectionBlock: React.FC<{ section: HandbookSection }> = ({ section }) => {
  const [openHeading, setOpenHeading] = useState<string | null>(null);
  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-800">
      <div className="border-b border-slate-100 px-4 py-3 dark:border-slate-800">
        <p className="text-sm font-bold text-slate-800 dark:text-slate-100">
          {section.name}{' '}
          <span className="text-xs font-normal text-slate-500">({formatHandbookPages(section.printedPages)})</span>
        </p>
        {section.summary && (
          <p className="mt-1 text-xs leading-relaxed text-slate-600 dark:text-slate-400">{section.summary}</p>
        )}
      </div>
      {section.subsections.map((sub, i) => {
        const key = `${i}-${sub.heading}`;
        const isOpen = openHeading === key;
        return (
          <div key={key} className="border-b border-slate-100 last:border-b-0 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setOpenHeading(isOpen ? null : key)}
              className="flex w-full items-center justify-between gap-2 px-4 py-2 text-left text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800/60"
              aria-expanded={isOpen}
            >
              <span>{sub.heading}</span>
              <ChevronDown className={`h-3.5 w-3.5 shrink-0 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </button>
            {isOpen && (
              <ul className="space-y-1 px-6 pb-3 text-xs leading-relaxed text-slate-600 dark:text-slate-400">
                {sub.items.map((item, j) => (
                  <li key={j} className="list-disc">{item}</li>
                ))}
              </ul>
            )}
          </div>
        );
      })}
    </div>
  );
};

/** Trích đoạn "AWS SAA-C03 Handbook" cho service đang xem trong Service Explorer. */
export const HandbookPanel: React.FC<{ serviceId: string }> = ({ serviceId }) => {
  const sections = getHandbookSectionsForExplorerId(serviceId);
  if (!sections.length) return null;
  return (
    <div className="mt-8 border-t border-slate-200 pt-6 dark:border-slate-800">
      <h3 className="mb-1 flex items-center gap-2 text-sm font-black uppercase tracking-wider text-slate-800 dark:text-slate-100">
        <BookMarked className="h-4 w-4 text-emerald-500" />
        SAA-C03 Handbook
      </h3>
      <p className="mb-3 text-[11px] text-slate-500 dark:text-slate-400">
        Trích từ {HANDBOOK_TITLE}. Văn bản được OCR từ ảnh nên có thể lẫn lỗi nhận dạng nhỏ.
      </p>
      <div className="space-y-3">
        {sections.map((s) => (
          <SectionBlock key={s.id} section={s} />
        ))}
      </div>
    </div>
  );
};
