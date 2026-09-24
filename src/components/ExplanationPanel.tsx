import React from 'react';
import type { Question } from '../core/types';
import { useLanguage } from '../context/useLanguage';
import { getCuratedExplanation } from '../core/curatedExplanations';
import { 
  CheckCircle2, 
  Users, 
  ExternalLink, 
  Info, 
  Sparkles, 
  Bot,
  AlertTriangle
} from 'lucide-react';

interface ExplanationPanelProps {
  question: Question;
  isCorrect?: boolean;
  userAnswer?: string;
}

export const ExplanationPanel: React.FC<ExplanationPanelProps> = ({ 
  question, 
  isCorrect, 
  userAnswer = '' 
}) => {
  const { language, t } = useLanguage();
  const primaryService = question.serviceTags[0] || 'AWS';
  const awsDocsUrl = `https://docs.aws.amazon.com/search/doc-search.html?searchQuery=${encodeURIComponent(
    primaryService + ' ' + question.text.slice(0, 80)
  )}`;

  // Human-curated explanation if exists
  const curated = getCuratedExplanation(question.id);
  const detailedText = question.answerDescription || curated?.solutionVi || '';

  return (
    <div className="mt-6 border border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50/60 dark:bg-slate-900/50 p-4 sm:p-5 space-y-4 shadow-xs">
      {/* Header: Correct/Incorrect status + Official Answer */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 dark:border-slate-800 pb-3">
        <div className="flex items-center gap-2 flex-wrap">
          {isCorrect !== undefined && (
            <span
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-bold ${
                isCorrect
                  ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30'
                  : 'bg-red-500/15 text-red-700 dark:text-red-400 border border-red-500/30'
              }`}
            >
              {isCorrect ? (language === 'vi' ? 'Chính xác!' : 'Correct!') : (language === 'vi' ? 'Chưa chính xác' : 'Incorrect')}
            </span>
          )}
          <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">
            {t.question.correctAnswer}: <span className="font-mono text-[#EC7211] dark:text-[#FF9900] font-bold text-base">{question.answer}</span>
          </span>
          {userAnswer && !isCorrect && (
            <span className="text-xs text-slate-500 dark:text-slate-400 font-mono">
              ({t.question.yourSelection}: <strong className="text-red-600 dark:text-red-400 font-bold">{userAnswer}</strong>)
            </span>
          )}
        </div>

        <a
          href={awsDocsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition-colors"
        >
          <span>{t.question.awsDocs}: {primaryService}</span>
          <ExternalLink className="w-3 h-3" />
        </a>
      </div>

      {/* Primary Technical Rationale / Explanation */}
      {detailedText ? (
        <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 text-xs sm:text-sm text-slate-700 dark:text-slate-300 leading-relaxed shadow-2xs space-y-2">
          <div className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5 text-xs uppercase tracking-wider">
            <Info className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
            <span>{t.question.detailedExplanation}</span>
          </div>
          <div className="text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-line">
            {detailedText}
          </div>
          {curated?.trapWarningVi && (
            <div className="pt-2 text-amber-800 dark:text-amber-300 border-t border-slate-100 dark:border-slate-800 flex items-start gap-1.5 text-xs">
              <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0 text-amber-600 dark:text-amber-400" />
              <span><strong>Lưu ý bẫy thi:</strong> {curated.trapWarningVi}</span>
            </div>
          )}
        </div>
      ) : (
        <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3 text-xs text-slate-600 dark:text-slate-400 leading-relaxed shadow-2xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
          <span>
            {t.question.officialVerified}: <strong className="text-slate-900 dark:text-white font-mono">{question.answer}</strong>.
            {question.communityVotes.length > 0 && ` (${question.communityVotes[0]?.raw || 'Đồng thuận cộng đồng'})`}
          </span>
        </div>
      )}

      {/* Interactive AI Tutor Deep Analysis Trigger */}
      <div className="rounded-xl border border-indigo-200/80 dark:border-indigo-900/60 bg-gradient-to-r from-indigo-50/70 via-purple-50/50 to-white dark:from-indigo-950/30 dark:via-purple-950/20 dark:bg-slate-900/40 p-3.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-indigo-600/10 dark:bg-indigo-500/20 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shrink-0">
            <Bot className="w-4 h-4" />
          </div>
          <div>
            <h5 className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
              <span>{language === 'vi' ? 'Cần giải thích sâu hơn hoặc vẽ sơ đồ?' : 'Need deeper analysis or architecture diagram?'}</span>
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
            </h5>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              {language === 'vi' 
                ? 'Hỏi trực tiếp AWS AI Tutor để được phân tích từng dịch vụ và vẽ sơ đồ kiến trúc.'
                : 'Ask the AWS AI Tutor directly to inspect edge cases, trade-offs, and diagrams.'}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => {
            const prompt = `Phân tích chuyên sâu kiến trúc cho Câu #${question.id}:
"${question.text}"

Đáp án đúng là ${question.answer}: "${question.choices[question.answer]}".
${userAnswer && userAnswer !== question.answer ? `Tôi đã chọn nhầm ${userAnswer}: "${question.choices[userAnswer]}".\n` : ''}
Hãy giải thích cặn kẽ vì sao phương án ${question.answer} tối ưu nhất và vì sao các phương án còn lại là bẫy thi của AWS.`;
            window.dispatchEvent(
              new CustomEvent('aws_open_ai_tutor', {
                detail: {
                  question,
                  selectedAnswer: userAnswer,
                  isCorrect,
                  isSubmitted: true,
                  initialPrompt: prompt,
                },
              })
            );
          }}
          className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-bold bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white dark:bg-indigo-500 dark:hover:bg-indigo-600 dark:active:bg-indigo-700 transition-all shadow-xs cursor-pointer shrink-0"
        >
          <Bot className="w-3.5 h-3.5" />
          <span>{language === 'vi' ? 'Hỏi AI Tutor câu này' : 'Ask AI Tutor'}</span>
        </button>
      </div>

      {/* Community Consensus Breakdown */}
      {question.communityVotes.length > 0 && (
        <div className="space-y-2 pt-1 border-t border-slate-200/60 dark:border-slate-800/60">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 dark:text-slate-400">
            <Users className="w-3.5 h-3.5 text-slate-500" />
            <span>{t.question.communityConsensus}:</span>
          </div>

          <div className="space-y-1.5">
            {question.communityVotes.map((vote, idx) => (
              <div key={idx} className="flex items-center gap-2 text-xs">
                <span className="w-12 font-mono font-medium text-slate-700 dark:text-slate-300">
                  {vote.choice}
                </span>
                <div className="flex-1 h-2 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-300 ${
                      vote.choice === question.answer
                        ? 'bg-emerald-500'
                        : 'bg-[#FF9900]/70 dark:bg-[#FF9900]/80'
                    }`}
                    style={{ width: `${Math.min(100, Math.max(0, vote.percentage))}%` }}
                  />
                </div>
                <span className="w-12 text-right font-mono text-slate-600 dark:text-slate-400">
                  {vote.percentage > 0 ? `${vote.percentage}%` : vote.raw}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
