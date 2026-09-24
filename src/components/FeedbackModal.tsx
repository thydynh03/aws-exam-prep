import React, { useState, useEffect } from 'react';
import { MessageSquare, X, Send, Clock, CheckCircle2, AlertTriangle, HelpCircle } from 'lucide-react';
import { feedbackApi } from '../core/api';

interface FeedbackModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const FeedbackModal: React.FC<FeedbackModalProps> = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState<'create' | 'history'>('create');
  const [type, setType] = useState<'bug' | 'question_error' | 'ui_ux' | 'feature_request' | 'general'>('question_error');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [priority, setPriority] = useState<'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT'>('MEDIUM');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // History state
  const [historyItems, setHistoryItems] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const fetchHistory = async () => {
    setLoadingHistory(true);
    try {
      const res = await feedbackApi.getMyFeedbacks();
      setHistoryItems(res.items || res.feedbacks || []);
    } catch {
      // Ignore
    } finally {
      setLoadingHistory(false);
    }
  };

  useEffect(() => {
    let active = true;
    if (isOpen && activeTab === 'history') {
      const load = async () => {
        setLoadingHistory(true);
        try {
          const res = await feedbackApi.getMyFeedbacks();
          if (active) setHistoryItems(res.items || res.feedbacks || []);
        } catch {
          // Ignore
        } finally {
          if (active) setLoadingHistory(false);
        }
      };
      void load();
    }
    return () => {
      active = false;
    };
  }, [isOpen, activeTab]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);

    if (!title.trim() || !content.trim()) {
      setMessage({ type: 'error', text: 'Vui lòng điền đầy đủ tiêu đề và nội dung phản hồi.' });
      return;
    }

    setIsSubmitting(true);
    try {
      await feedbackApi.submitFeedback({
        type,
        title: title.trim(),
        content: content.trim(),
        priority,
      });

      setMessage({ type: 'success', text: 'Cảm ơn bạn! Phản hồi đã được gửi đến ban quản trị.' });
      setTitle('');
      setContent('');
      setTimeout(() => {
        setActiveTab('history');
        fetchHistory();
      }, 1000);
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Gửi phản hồi thất bại.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'NEW':
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2 py-0.5 text-xs font-semibold text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
            <Clock className="h-3 w-3" /> Mới tiếp nhận
          </span>
        );
      case 'IN_REVIEW':
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
            <AlertTriangle className="h-3 w-3" /> Đang xử lý
          </span>
        );
      case 'RESOLVED':
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
            <CheckCircle2 className="h-3 w-3" /> Đã giải quyết
          </span>
        );
      case 'REJECTED':
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-300">
            Từ chối
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
      <div className="relative flex flex-col w-full max-w-2xl max-h-[90vh] overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-100 text-blue-600 dark:bg-blue-950/60 dark:text-blue-400">
              <MessageSquare className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">Góp Ý & Báo Cáo Phản Hồi</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">Ý kiến của bạn giúp hệ thống ngày càng chuẩn xác</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Tab switch */}
        <div className="flex border-b border-slate-200 bg-slate-50 px-6 dark:border-slate-800 dark:bg-slate-900/50">
          <button
            type="button"
            onClick={() => setActiveTab('create')}
            className={`py-3 text-sm font-semibold border-b-2 transition-all mr-6 ${
              activeTab === 'create'
                ? 'border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white'
            }`}
          >
            Gửi phản hồi mới
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('history')}
            className={`py-3 text-sm font-semibold border-b-2 transition-all ${
              activeTab === 'history'
                ? 'border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white'
            }`}
          >
            Lịch sử phản hồi ({historyItems.length})
          </button>
        </div>

        {/* Content area */}
        <div className="overflow-y-auto p-6 flex-1">
          {message && (
            <div
              className={`mb-4 flex items-start gap-2.5 rounded-xl p-3.5 text-sm ${
                message.type === 'success'
                  ? 'border border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-300'
                  : 'border border-red-200 bg-red-50 text-red-800 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-300'
              }`}
            >
              {message.type === 'success' ? (
                <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-500" />
              ) : (
                <AlertTriangle className="h-5 w-5 shrink-0 text-red-500" />
              )}
              <span>{message.text}</span>
            </div>
          )}

          {activeTab === 'create' ? (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Loại phản hồi
                  </label>
                  <select
                    value={type}
                    onChange={(e) => setType(e.target.value as any)}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  >
                    <option value="question_error">Lỗi nội dung / đáp án câu hỏi</option>
                    <option value="bug">Lỗi chức năng website (Bug)</option>
                    <option value="ui_ux">Giao diện & trải nghiệm (UI/UX)</option>
                    <option value="feature_request">Đề xuất tính năng mới</option>
                    <option value="general">Góp ý chung</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Mức độ ưu tiên
                  </label>
                  <select
                    value={priority}
                    onChange={(e) => setPriority(e.target.value as any)}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  >
                    <option value="LOW">Thấp (Có thể xem xét sau)</option>
                    <option value="MEDIUM">Bình thường</option>
                    <option value="HIGH">Cao (Ảnh hưởng kết quả học tập)</option>
                    <option value="URGENT">Khẩn cấp</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Tiêu đề tóm tắt
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Ví dụ: Câu 142 giải thích đáp án B chưa đúng với tài liệu AWS mới..."
                  required
                  className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Nội dung chi tiết
                </label>
                <textarea
                  rows={4}
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="Mô tả cụ thể vấn đề hoặc trích dẫn câu hỏi, dẫn chứng tài liệu AWS Whitepaper/Docs nếu có..."
                  required
                  className="w-full rounded-xl border border-slate-300 bg-white p-3 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800 transition-colors"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 active:scale-[0.98] transition-all disabled:opacity-50"
                >
                  {isSubmitting ? (
                    'Đang gửi...'
                  ) : (
                    <>
                      <Send className="h-4 w-4" />
                      <span>Gửi Phản Hồi</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          ) : (
            <div className="space-y-4">
              {loadingHistory ? (
                <div className="py-8 text-center text-sm text-slate-500 dark:text-slate-400">
                  Đang tải danh sách phản hồi...
                </div>
              ) : historyItems.length === 0 ? (
                <div className="py-12 text-center text-slate-500 dark:text-slate-400">
                  <HelpCircle className="mx-auto mb-2 h-10 w-10 text-slate-300 dark:text-slate-600" />
                  <p className="text-sm font-medium">Bạn chưa gửi phản hồi nào.</p>
                </div>
              ) : (
                historyItems.map((item) => (
                  <div
                    key={item.id}
                    className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 transition-all dark:border-slate-800 dark:bg-slate-800/30"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          {getStatusBadge(item.status)}
                          <span className="text-xs text-slate-400">
                            {new Date(item.createdAt || item.created_at).toLocaleDateString('vi-VN')}
                          </span>
                        </div>
                        <h4 className="font-semibold text-slate-900 dark:text-white text-sm">{item.title}</h4>
                      </div>
                    </div>
                    <p className="mt-2 text-xs text-slate-600 dark:text-slate-300 whitespace-pre-wrap">{item.content}</p>

                    {item.adminResponse && (
                      <div className="mt-3 rounded-lg border border-blue-200 bg-blue-50/80 p-3 text-xs dark:border-blue-900/50 dark:bg-blue-950/40">
                        <div className="font-semibold text-blue-800 dark:text-blue-300 flex items-center gap-1.5 mb-1">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          <span>Phản hồi từ Quản trị viên:</span>
                        </div>
                        <p className="text-blue-900 dark:text-blue-200 whitespace-pre-wrap">{item.adminResponse}</p>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
