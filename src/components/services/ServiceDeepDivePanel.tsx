import React, { useState } from 'react';
import {
  Cpu,
  CheckCircle2,
  XCircle,
  Gauge,
  DollarSign,
  GitCompareArrows,
  AlertTriangle,
  Workflow,
  Link2,
  BookOpen,
  ShieldCheck,
  HeartPulse,
  ChevronDown,
} from 'lucide-react';
import type { ServiceDeepDive } from '../../core/types';
import { getServiceDeepDive } from '../../core/serviceDeepDives';
import serviceQuestionIndex from '../../data/serviceQuestionIndex.json';

interface ServiceQuestionIndexEntry {
  id: string;
  name: string;
  category: string;
  tier: string;
  count: number;
  questionIds: number[];
}

const QUESTION_INDEX = serviceQuestionIndex as ServiceQuestionIndexEntry[];

type SectionId =
  | 'mechanism'
  | 'choose'
  | 'limits'
  | 'cost'
  | 'contrasts'
  | 'traps'
  | 'architectures'
  | 'integrations'
  | 'security'
  | 'resilience';

const SECTION_META: Record<SectionId, { label: string; icon: React.ElementType; accent: string }> = {
  mechanism: { label: 'Cơ chế hoạt động', icon: Cpu, accent: 'text-indigo-500' },
  choose: { label: 'Nên dùng / Không nên dùng', icon: CheckCircle2, accent: 'text-emerald-500' },
  limits: { label: 'Giới hạn kỹ thuật', icon: Gauge, accent: 'text-sky-500' },
  cost: { label: 'Mô hình chi phí', icon: DollarSign, accent: 'text-amber-500' },
  contrasts: { label: 'So sánh service tương tự', icon: GitCompareArrows, accent: 'text-violet-500' },
  traps: { label: 'Bẫy đề thi', icon: AlertTriangle, accent: 'text-rose-500' },
  architectures: { label: 'Kiến trúc thực tế', icon: Workflow, accent: 'text-cyan-500' },
  integrations: { label: 'Đi kèm service nào', icon: Link2, accent: 'text-teal-500' },
  security: { label: 'Bảo mật', icon: ShieldCheck, accent: 'text-emerald-600' },
  resilience: { label: 'Chịu lỗi & DR', icon: HeartPulse, accent: 'text-orange-500' },
};

/** Khối gập mở dùng chung cho mọi mục. */
const Section: React.FC<{
  id: SectionId;
  count?: number;
  openIds: Set<SectionId>;
  onToggle: (id: SectionId) => void;
  children: React.ReactNode;
}> = ({ id, count, openIds, onToggle, children }) => {
  const meta = SECTION_META[id];
  const Icon = meta.icon;
  const isOpen = openIds.has(id);

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800">
      <button
        type="button"
        onClick={() => onToggle(id)}
        aria-expanded={isOpen}
        className="flex w-full items-center justify-between gap-3 bg-slate-50 px-4 py-3 text-left transition-colors hover:bg-slate-100 dark:bg-slate-900/60 dark:hover:bg-slate-800/60"
      >
        <span className="flex items-center gap-2 text-sm font-bold text-slate-800 dark:text-slate-100">
          <Icon className={`h-4 w-4 ${meta.accent}`} />
          {meta.label}
          {typeof count === 'number' && (
            <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-bold text-slate-600 dark:bg-slate-700 dark:text-slate-300">
              {count}
            </span>
          )}
        </span>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>
      {isOpen && <div className="space-y-3 bg-white px-4 py-4 dark:bg-slate-900">{children}</div>}
    </div>
  );
};

interface ServiceDeepDivePanelProps {
  serviceId: string;
  /** Gọi khi người học bấm luyện câu hỏi liên quan */
  onPracticeService?: (keyword: string) => void;
}

export const ServiceDeepDivePanel: React.FC<ServiceDeepDivePanelProps> = ({
  serviceId,
  onPracticeService,
}) => {
  const deepDive: ServiceDeepDive | undefined = getServiceDeepDive(serviceId);
  const indexEntry = QUESTION_INDEX.find((e) => e.id === serviceId);

  // Mặc định mở 2 mục quan trọng nhất, phần còn lại gập cho gọn
  const [openIds, setOpenIds] = useState<Set<SectionId>>(new Set(['mechanism', 'choose']));
  const toggle = (id: SectionId) =>
    setOpenIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  // Chưa soạn nội dung: chỉ hiện số câu hỏi liên quan nếu có
  if (!deepDive) {
    if (!indexEntry) return null;
    return (
      <div className="mt-6 rounded-xl border border-dashed border-slate-300 bg-slate-50/60 p-4 text-center dark:border-slate-700 dark:bg-slate-900/40">
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Nội dung học sâu cho service này đang được biên soạn.
        </p>
        <p className="mt-1 text-xs font-semibold text-slate-700 dark:text-slate-300">
          Hiện có {indexEntry.count} câu trong bộ đề nhắc tới {indexEntry.name}.
        </p>
      </div>
    );
  }

  return (
    <div className="mt-8 border-t border-slate-200 pt-6 dark:border-slate-800">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h3 className="flex items-center gap-2 text-sm font-black uppercase tracking-wider text-slate-800 dark:text-slate-100">
          <BookOpen className="h-4 w-4 text-blue-500" />
          Học sâu
        </h3>
        {indexEntry && (
          <button
            type="button"
            onClick={() => onPracticeService?.(indexEntry.name)}
            className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white shadow-xs transition-colors hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600"
          >
            Luyện {indexEntry.count} câu liên quan
          </button>
        )}
      </div>

      {deepDive.whyItExists && (
        <p className="mb-4 rounded-xl border border-blue-100 bg-blue-50/60 p-4 text-sm leading-relaxed text-blue-950 dark:border-blue-950 dark:bg-blue-950/30 dark:text-blue-100">
          {deepDive.whyItExists}
        </p>
      )}

      <div className="space-y-2.5">
        {deepDive.howItWorks?.length ? (
          <Section id="mechanism" count={deepDive.howItWorks.length} openIds={openIds} onToggle={toggle}>
            {deepDive.howItWorks.map((m, i) => (
              <div key={i} className="rounded-lg bg-slate-50 p-3 dark:bg-slate-800/50">
                <p className="text-sm font-bold text-slate-800 dark:text-slate-100">{m.title}</p>
                <p className="mt-1 text-xs leading-relaxed text-slate-600 dark:text-slate-300">
                  {m.explanation}
                </p>
                {m.soWhat && (
                  <p className="mt-2 border-l-2 border-indigo-400 pl-2.5 text-xs leading-relaxed font-medium text-indigo-800 dark:text-indigo-300">
                    Hệ quả: {m.soWhat}
                  </p>
                )}
              </div>
            ))}
          </Section>
        ) : null}

        {(deepDive.chooseWhen?.length || deepDive.avoidWhen?.length) && (
          <Section
            id="choose"
            count={(deepDive.chooseWhen?.length ?? 0) + (deepDive.avoidWhen?.length ?? 0)}
            openIds={openIds}
            onToggle={toggle}
          >
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-2">
                <p className="flex items-center gap-1.5 text-xs font-bold uppercase text-emerald-700 dark:text-emerald-400">
                  <CheckCircle2 className="h-3.5 w-3.5" /> Nên dùng khi
                </p>
                {deepDive.chooseWhen?.map((c, i) => (
                  <div
                    key={i}
                    className="rounded-lg border border-emerald-100 bg-emerald-50/60 p-2.5 dark:border-emerald-950 dark:bg-emerald-950/25"
                  >
                    <p className="text-xs font-semibold text-emerald-900 dark:text-emerald-200">
                      {c.condition}
                    </p>
                    <p className="mt-1 text-[11px] leading-relaxed text-emerald-800/90 dark:text-emerald-300/90">
                      {c.reason}
                    </p>
                  </div>
                ))}
              </div>
              <div className="space-y-2">
                <p className="flex items-center gap-1.5 text-xs font-bold uppercase text-rose-700 dark:text-rose-400">
                  <XCircle className="h-3.5 w-3.5" /> Không nên dùng khi
                </p>
                {deepDive.avoidWhen?.map((c, i) => (
                  <div
                    key={i}
                    className="rounded-lg border border-rose-100 bg-rose-50/60 p-2.5 dark:border-rose-950 dark:bg-rose-950/25"
                  >
                    <p className="text-xs font-semibold text-rose-900 dark:text-rose-200">
                      {c.condition}
                    </p>
                    <p className="mt-1 text-[11px] leading-relaxed text-rose-800/90 dark:text-rose-300/90">
                      {c.reason}
                    </p>
                    {c.useInstead && (
                      <p className="mt-1.5 text-[11px] font-bold text-rose-900 dark:text-rose-200">
                        → Dùng thay thế: {c.useInstead}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </Section>
        )}

        {deepDive.examTraps?.length ? (
          <Section id="traps" count={deepDive.examTraps.length} openIds={openIds} onToggle={toggle}>
            {deepDive.examTraps.map((t, i) => (
              <div
                key={i}
                className="rounded-lg border border-rose-100 bg-rose-50/50 p-3 dark:border-rose-950 dark:bg-rose-950/25"
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="text-xs font-bold text-rose-900 dark:text-rose-200">
                    {t.distractorPattern}
                  </p>
                  {t.severity && (
                    <span className="shrink-0 rounded px-1.5 py-0.5 text-[9px] font-bold uppercase text-white"
                      style={{
                        backgroundColor:
                          t.severity === 'high' ? '#e11d48' : t.severity === 'medium' ? '#f59e0b' : '#64748b',
                      }}
                    >
                      {t.severity}
                    </span>
                  )}
                </div>
                <p className="mt-1.5 text-[11px] leading-relaxed text-slate-700 dark:text-slate-300">
                  <span className="font-bold text-rose-700 dark:text-rose-400">Vì sao sai: </span>
                  {t.whyWrong}
                </p>
                <p className="mt-1 text-[11px] leading-relaxed text-slate-700 dark:text-slate-300">
                  <span className="font-bold text-emerald-700 dark:text-emerald-400">Đáp án đúng: </span>
                  {t.correctAnswer}
                </p>
                {t.signalKeywords?.length ? (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {t.signalKeywords.map((k, ki) => (
                      <span
                        key={ki}
                        className="rounded bg-slate-200 px-1.5 py-0.5 font-mono text-[9.5px] text-slate-700 dark:bg-slate-700 dark:text-slate-200"
                      >
                        {k}
                      </span>
                    ))}
                  </div>
                ) : null}
              </div>
            ))}
          </Section>
        ) : null}

        {deepDive.contrasts?.length ? (
          <Section id="contrasts" count={deepDive.contrasts.length} openIds={openIds} onToggle={toggle}>
            {deepDive.contrasts.map((c, i) => (
              <div key={i} className="rounded-lg border border-slate-200 p-3 dark:border-slate-700">
                <p className="text-sm font-bold text-slate-800 dark:text-slate-100">
                  So với {c.againstServiceName}
                </p>
                <p className="mt-1 text-xs font-medium text-violet-800 dark:text-violet-300">
                  {c.coreDifference}
                </p>
                {c.mechanismDifference && (
                  <p className="mt-1 text-[11px] leading-relaxed text-slate-600 dark:text-slate-400">
                    {c.mechanismDifference}
                  </p>
                )}
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  <div>
                    <p className="text-[10px] font-bold uppercase text-emerald-700 dark:text-emerald-400">
                      Chọn service này khi
                    </p>
                    <ul className="mt-1 space-y-0.5">
                      {c.chooseThisWhen.map((x, xi) => (
                        <li key={xi} className="text-[11px] text-slate-700 dark:text-slate-300">
                          • {x}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase text-sky-700 dark:text-sky-400">
                      Chọn {c.againstServiceName} khi
                    </p>
                    <ul className="mt-1 space-y-0.5">
                      {c.chooseOtherWhen.map((x, xi) => (
                        <li key={xi} className="text-[11px] text-slate-700 dark:text-slate-300">
                          • {x}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            ))}
          </Section>
        ) : null}

        {deepDive.architectures?.length ? (
          <Section
            id="architectures"
            count={deepDive.architectures.length}
            openIds={openIds}
            onToggle={toggle}
          >
            {deepDive.architectures.map((a) => (
              <div key={a.id} className="rounded-lg border border-cyan-100 bg-cyan-50/40 p-3 dark:border-cyan-950 dark:bg-cyan-950/20">
                <p className="text-sm font-bold text-cyan-900 dark:text-cyan-200">{a.title}</p>
                <p className="mt-1 text-[11px] leading-relaxed text-slate-700 dark:text-slate-300">
                  {a.scenario}
                </p>
                <ol className="mt-2.5 space-y-1.5">
                  {a.steps.map((s) => (
                    <li key={s.order} className="flex gap-2">
                      <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-cyan-600 text-[9px] font-bold text-white">
                        {s.order}
                      </span>
                      <span className="text-[11px] leading-relaxed text-slate-700 dark:text-slate-300">
                        <span className="font-bold text-slate-900 dark:text-slate-100">
                          {s.component}:
                        </span>{' '}
                        {s.action}
                        {s.whyThisChoice && (
                          <span className="block text-slate-500 dark:text-slate-400">
                            Vì sao chọn: {s.whyThisChoice}
                          </span>
                        )}
                      </span>
                    </li>
                  ))}
                </ol>
                {a.rejectedAlternatives?.length ? (
                  <div className="mt-2.5 border-t border-cyan-200/60 pt-2 dark:border-cyan-900">
                    <p className="text-[10px] font-bold uppercase text-slate-500 dark:text-slate-400">
                      Phương án đã loại
                    </p>
                    {a.rejectedAlternatives.map((r, ri) => (
                      <p key={ri} className="mt-1 text-[11px] text-slate-600 dark:text-slate-400">
                        <span className="font-semibold line-through">{r.option}</span> — {r.whyRejected}
                      </p>
                    ))}
                  </div>
                ) : null}
                {a.tradeoffs?.length ? (
                  <div className="mt-2 rounded bg-amber-100/70 p-2 dark:bg-amber-950/30">
                    <p className="text-[10px] font-bold uppercase text-amber-800 dark:text-amber-300">
                      Đánh đổi
                    </p>
                    {a.tradeoffs.map((t, ti) => (
                      <p key={ti} className="text-[11px] text-amber-900 dark:text-amber-200">
                        • {t}
                      </p>
                    ))}
                  </div>
                ) : null}
              </div>
            ))}
          </Section>
        ) : null}

        {deepDive.limits?.length ? (
          <Section id="limits" count={deepDive.limits.length} openIds={openIds} onToggle={toggle}>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-[11px]">
                <thead>
                  <tr className="border-b border-slate-200 text-[10px] uppercase text-slate-500 dark:border-slate-700 dark:text-slate-400">
                    <th className="pb-1.5 pr-3 font-bold">Giới hạn</th>
                    <th className="pb-1.5 pr-3 font-bold">Giá trị</th>
                    <th className="pb-1.5 font-bold">Hệ quả kiến trúc</th>
                  </tr>
                </thead>
                <tbody>
                  {deepDive.limits.map((l, i) => (
                    <tr key={i} className="border-b border-slate-100 last:border-0 dark:border-slate-800">
                      <td className="py-1.5 pr-3 font-semibold text-slate-800 dark:text-slate-200">
                        {l.name}
                        {l.adjustable && (
                          <span className="ml-1 rounded bg-sky-100 px-1 text-[9px] font-bold text-sky-700 dark:bg-sky-950 dark:text-sky-300">
                            xin tăng được
                          </span>
                        )}
                      </td>
                      <td className="py-1.5 pr-3 font-mono text-slate-900 dark:text-slate-100">
                        {l.value}
                      </td>
                      <td className="py-1.5 text-slate-600 dark:text-slate-400">{l.implication}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Section>
        ) : null}

        {deepDive.cost && (
          <Section id="cost" openIds={openIds} onToggle={toggle}>
            <div>
              <p className="text-[10px] font-bold uppercase text-slate-500 dark:text-slate-400">
                Tính tiền theo
              </p>
              <ul className="mt-1 space-y-0.5">
                {deepDive.cost.billingDimensions.map((d, i) => (
                  <li key={i} className="text-[11px] text-slate-700 dark:text-slate-300">
                    • {d}
                  </li>
                ))}
              </ul>
            </div>
            {deepDive.cost.hiddenCosts?.length ? (
              <div className="rounded-lg border border-amber-100 bg-amber-50/60 p-2.5 dark:border-amber-950 dark:bg-amber-950/25">
                <p className="text-[10px] font-bold uppercase text-amber-800 dark:text-amber-300">
                  Chi phí ẩn hay bị quên
                </p>
                <ul className="mt-1 space-y-1">
                  {deepDive.cost.hiddenCosts.map((c, i) => (
                    <li key={i} className="text-[11px] leading-relaxed text-amber-900 dark:text-amber-200">
                      • {c}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            {deepDive.cost.optimizationLevers?.length ? (
              <div className="rounded-lg border border-emerald-100 bg-emerald-50/60 p-2.5 dark:border-emerald-950 dark:bg-emerald-950/25">
                <p className="text-[10px] font-bold uppercase text-emerald-800 dark:text-emerald-300">
                  Đòn bẩy tối ưu chi phí
                </p>
                <ul className="mt-1 space-y-1">
                  {deepDive.cost.optimizationLevers.map((c, i) => (
                    <li key={i} className="text-[11px] leading-relaxed text-emerald-900 dark:text-emerald-200">
                      • {c}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </Section>
        )}

        {deepDive.security && (
          <Section id="security" openIds={openIds} onToggle={toggle}>
            {deepDive.security.encryptionAtRest?.length ? (
              <div>
                <p className="text-[10px] font-bold uppercase text-slate-500 dark:text-slate-400">
                  Mã hóa khi lưu
                </p>
                <ul className="mt-1 space-y-1">
                  {deepDive.security.encryptionAtRest.map((x, i) => (
                    <li key={i} className="text-[11px] leading-relaxed text-slate-700 dark:text-slate-300">
                      • {x}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            {deepDive.security.encryptionInTransit && (
              <p className="text-[11px] leading-relaxed text-slate-700 dark:text-slate-300">
                <span className="font-bold">Mã hóa trên đường truyền: </span>
                {deepDive.security.encryptionInTransit}
              </p>
            )}
            {deepDive.security.accessControl?.length ? (
              <div>
                <p className="text-[10px] font-bold uppercase text-slate-500 dark:text-slate-400">
                  Kiểm soát truy cập
                </p>
                <ul className="mt-1 space-y-1">
                  {deepDive.security.accessControl.map((x, i) => (
                    <li key={i} className="text-[11px] leading-relaxed text-slate-700 dark:text-slate-300">
                      • {x}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            {deepDive.security.defaultPosture && (
              <p className="rounded-lg border border-emerald-100 bg-emerald-50/60 p-2.5 text-[11px] leading-relaxed text-emerald-900 dark:border-emerald-950 dark:bg-emerald-950/25 dark:text-emerald-200">
                <span className="font-bold">Trạng thái mặc định: </span>
                {deepDive.security.defaultPosture}
              </p>
            )}
          </Section>
        )}

        {deepDive.resilience && (
          <Section id="resilience" openIds={openIds} onToggle={toggle}>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[10px] font-bold uppercase text-slate-500 dark:text-slate-400">
                Ranh giới sự cố
              </span>
              <span className="rounded-full bg-orange-100 px-2 py-0.5 text-[10px] font-black text-orange-800 dark:bg-orange-950 dark:text-orange-300">
                {deepDive.resilience.failureScope}
              </span>
            </div>
            <p className="text-[11px] leading-relaxed text-slate-700 dark:text-slate-300">
              <span className="font-bold">Sẵn sàng có sẵn: </span>
              {deepDive.resilience.builtInHA}
            </p>
            {deepDive.resilience.crossRegionStory && (
              <p className="text-[11px] leading-relaxed text-slate-700 dark:text-slate-300">
                <span className="font-bold">Liên Region: </span>
                {deepDive.resilience.crossRegionStory}
              </p>
            )}
            {deepDive.resilience.backupRestore && (
              <p className="text-[11px] leading-relaxed text-slate-700 dark:text-slate-300">
                <span className="font-bold">Sao lưu & khôi phục: </span>
                {deepDive.resilience.backupRestore}
              </p>
            )}
          </Section>
        )}

        {deepDive.integrationNotes?.length ? (
          <Section
            id="integrations"
            count={deepDive.integrationNotes.length}
            openIds={openIds}
            onToggle={toggle}
          >
            {deepDive.integrationNotes.map((n, i) => (
              <p key={i} className="text-[11px] leading-relaxed text-slate-700 dark:text-slate-300">
                <span className="font-bold text-teal-700 dark:text-teal-400">{n.withServiceName}</span>
                {' — '}
                {n.relationship}
              </p>
            ))}
          </Section>
        ) : null}
      </div>

      {deepDive.deepLinks?.length ? (
        <div className="mt-4 flex flex-wrap gap-2">
          {deepDive.deepLinks.map((l, i) => (
            <a
              key={i}
              href={l.url}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-lg border border-slate-200 px-2.5 py-1 text-[11px] font-medium text-slate-600 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800"
            >
              {l.label}
            </a>
          ))}
        </div>
      ) : null}
    </div>
  );
};
