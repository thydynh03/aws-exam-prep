import React, { useState } from 'react';
import { ThumbsDown, X, Check, MessageSquare, Edit3, Lightbulb } from 'lucide-react';

export interface AIFeedbackSubmitData {
  messageId: string;
  errorType: string;
  userCorrection?: string;
  comment?: string;
}

interface AIFeedbackModalProps {
  isOpen: boolean;
  onClose: () => void;
  messageId: string;
  questionId?: number;
  providerUsed?: string;
  isCorrectionMode?: boolean;
  onSubmit: (data: AIFeedbackSubmitData) => void;
}

const ERROR_TAXONOMY = [
  { id: 'factual_error', label: 'Sai kiến thức AWS / dịch vụ / kiến trúc' },
  { id: 'hallucination', label: 'Bịa đặt thông tin / dịch vụ hoặc thông số không có thực' },
  { id: 'outdated_information', label: 'Thông tin cũ / dịch vụ đã đổi tên / tính năng thay đổi' },
  { id: 'anti_pattern', label: 'Khuyên dùng phương án vi phạm Well-Architected Framework' },
  { id: 'not_relevant', label: 'Không bám sát trọng tâm câu hỏi hoặc bài thi SAA-C03' },
  { id: 'unhelpful', label: 'Giải thích sơ sài, khó hiểu hoặc lan man' },
  { id: 'other', label: 'Lý do khác' },
];

export const AIFeedbackModal: React.FC<AIFeedbackModalProps> = ({
  isOpen,
  onClose,
  messageId,
  isCorrectionMode = false,
  onSubmit,
}) => {
  const [selectedErrorType, setSelectedErrorType] = useState('factual_error');
  const [userCorrection, setUserCorrection] = useState('');
  const [comment, setComment] = useState('');
  const [submitted, setSubmitted] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      messageId,
      errorType: selectedErrorType,
      userCorrection: userCorrection.trim() || undefined,
      comment: comment.trim() || undefined,
    });
    setSubmitted(true);
    setTimeout(() => {
      setSubmitted(false);
      onClose();
    }, 1200);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
      <div className="relative w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3.5 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/40">
          <div className="flex items-center gap-2 text-slate-800 dark:text-slate-200 font-bold text-xs">
            {isCorrectionMode ? (
              <Edit3 className="h-4 w-4 text-amber-500" />
            ) : (
              <ThumbsDown className="h-4 w-4 text-rose-500" />
            )}
            <span>{isCorrectionMode ? 'Đóng Góp Sửa Câu Trả Lời (AI Correction)' : 'Báo Lỗi & Phản Hồi Chất Lượng AI'}</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {submitted ? (
          <div className="p-8 text-center space-y-2">
            <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400">
              <Check className="h-5 w-5" />
            </div>
            <p className="font-bold text-xs text-slate-900 dark:text-white">Cảm ơn bạn đã đóng góp!</p>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Phản hồi đã được ghi nhận vào bộ nhớ sửa sai và cải thiện tri thức của hệ thống AI.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-5 space-y-4 text-xs">
            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-2">
                Phân loại lỗi phát hiện (Error Taxonomy):
              </label>
              <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                {ERROR_TAXONOMY.map((r) => (
                  <label
                    key={r.id}
                    className={`flex items-center gap-2.5 p-2 rounded-xl border cursor-pointer transition-colors ${
                      selectedErrorType === r.id
                        ? 'border-rose-500 bg-rose-50/60 dark:border-rose-500/80 dark:bg-rose-950/30'
                        : 'border-slate-200 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/50'
                    }`}
                  >
                    <input
                      type="radio"
                      name="errorType"
                      value={r.id}
                      checked={selectedErrorType === r.id}
                      onChange={() => setSelectedErrorType(r.id)}
                      className="text-rose-600 focus:ring-rose-500"
                    />
                    <span className="text-slate-800 dark:text-slate-200 font-medium">{r.label}</span>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1.5">
                <Lightbulb className="h-3.5 w-3.5 text-amber-500" />
                <span>Nội dung đính chính / Câu trả lời chuẩn xác (Tùy chọn):</span>
              </label>
              <textarea
                value={userCorrection}
                onChange={(e) => setUserCorrection(e.target.value)}
                rows={3}
                placeholder="Ví dụ: Để đạt RPO = 0 cho RDS, phải dùng Multi-AZ Synchronous Replication chứ không dùng Read Replica..."
                className="w-full rounded-xl border border-slate-300 p-2.5 text-xs text-slate-900 focus:border-amber-500 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-white"
              />
              <p className="mt-1 text-[10px] text-slate-400">
                Nội dung đính chính sẽ được thêm vào Correction Memory để AI không lặp lại sai lầm.
              </p>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Ghi chú thêm:
              </label>
              <input
                type="text"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Ghi chú ngắn gọn cho đội ngũ quản trị..."
                className="w-full rounded-xl border border-slate-300 p-2 text-xs text-slate-900 focus:border-rose-500 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-white"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={onClose}
                className="px-3 py-1.5 text-xs font-semibold text-slate-500 hover:bg-slate-100 rounded-lg dark:hover:bg-slate-800 dark:text-slate-400"
              >
                Hủy
              </button>
              <button
                type="submit"
                className="flex items-center gap-1.5 rounded-xl bg-rose-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-rose-700 shadow-sm"
              >
                <MessageSquare className="h-3.5 w-3.5" />
                <span>Gửi phản hồi</span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
