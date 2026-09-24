import React, { useState, useEffect } from 'react';
import { PlusCircle, X, Check, Eye, HelpCircle, AlertCircle, FileText, CheckCircle2, Clock } from 'lucide-react';
import { questionsApi } from '../core/api';

interface QuestionSubmitModalProps {
  isOpen: boolean;
  onClose: () => void;
  onQuestionSubmitted?: () => void;
}

export const QuestionSubmitModal: React.FC<QuestionSubmitModalProps> = ({
  isOpen,
  onClose,
  onQuestionSubmitted,
}) => {
  const [activeTab, setActiveTab] = useState<'edit' | 'preview' | 'my-submissions'>('edit');
  const [text, setText] = useState('');
  const [choices, setChoices] = useState<Record<string, string>>({
    A: '',
    B: '',
    C: '',
    D: '',
  });
  const [selectedAnswers, setSelectedAnswers] = useState<string[]>(['A']);
  const [explanation, setExplanation] = useState('');
  const [domain, setDomain] = useState('Domain 1: Design Secure Architectures');
  const [difficulty, setDifficulty] = useState<'Easy' | 'Medium' | 'Hard'>('Medium');
  const [topic, setTopic] = useState('Storage');
  const [serviceTags, setServiceTags] = useState('S3, IAM');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Submissions state
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [loadingSubmissions, setLoadingSubmissions] = useState(false);

  const fetchMySubmissions = async () => {
    setLoadingSubmissions(true);
    try {
      const res = await questionsApi.getMySubmissions();
      setSubmissions(res.submissions || []);
    } catch {
      // Ignore
    } finally {
      setLoadingSubmissions(false);
    }
  };

  useEffect(() => {
    let active = true;
    if (isOpen && activeTab === 'my-submissions') {
      const load = async () => {
        setLoadingSubmissions(true);
        try {
          const res = await questionsApi.getMySubmissions();
          if (active) setSubmissions(res.submissions || []);
        } catch {
          // Ignore
        } finally {
          if (active) setLoadingSubmissions(false);
        }
      };
      void load();
    }
    return () => {
      active = false;
    };
  }, [isOpen, activeTab]);

  if (!isOpen) return null;

  const handleChoiceChange = (key: string, val: string) => {
    setChoices(prev => ({ ...prev, [key]: val }));
  };

  const toggleAnswer = (key: string) => {
    if (selectedAnswers.includes(key)) {
      if (selectedAnswers.length > 1) {
        setSelectedAnswers(selectedAnswers.filter(k => k !== key));
      }
    } else {
      setSelectedAnswers([...selectedAnswers, key].sort());
    }
  };

  const addChoice = () => {
    const keys = ['A', 'B', 'C', 'D', 'E', 'F'];
    const currentKeys = Object.keys(choices);
    const nextKey = keys.find(k => !currentKeys.includes(k));
    if (nextKey) {
      setChoices(prev => ({ ...prev, [nextKey]: '' }));
    }
  };

  const removeChoice = (keyToRemove: string) => {
    if (Object.keys(choices).length <= 2) return;
    const newChoices = { ...choices };
    delete newChoices[keyToRemove];
    setChoices(newChoices);
    setSelectedAnswers(selectedAnswers.filter(k => k !== keyToRemove));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatusMessage(null);

    const trimmedText = text.trim();
    if (trimmedText.length < 15) {
      setStatusMessage({ type: 'error', text: 'Nội dung câu hỏi quá ngắn (tối thiểu 15 ký tự).' });
      return;
    }

    const choiceKeys = Object.keys(choices).sort();
    for (const k of choiceKeys) {
      if (!choices[k].trim()) {
        setStatusMessage({ type: 'error', text: `Nội dung lựa chọn [${k}] không được để trống.` });
        return;
      }
    }

    if (selectedAnswers.length === 0) {
      setStatusMessage({ type: 'error', text: 'Vui lòng chọn ít nhất 1 đáp án đúng.' });
      return;
    }

    const tags = serviceTags
      .split(',')
      .map(s => s.trim())
      .filter(Boolean);

    setIsSubmitting(true);
    try {
      const res = await questionsApi.submitQuestion({
        text: trimmedText,
        choices,
        answer: selectedAnswers.join(''),
        explanation: explanation.trim(),
        domain,
        difficulty,
        topic: topic.trim() || 'Custom',
        serviceTags: tags.length > 0 ? tags : ['AWS General'],
      });

      setStatusMessage({
        type: 'success',
        text: res.message || 'Đã gửi câu hỏi thành công!',
      });

      // Clear fields
      setText('');
      setChoices({ A: '', B: '', C: '', D: '' });
      setSelectedAnswers(['A']);
      setExplanation('');

      if (onQuestionSubmitted) onQuestionSubmitted();

      setTimeout(() => {
        setActiveTab('my-submissions');
        fetchMySubmissions();
      }, 1200);
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message || 'Gửi câu hỏi thất bại.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
      <div className="relative flex flex-col w-full max-w-3xl max-h-[92vh] overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-100 text-blue-600 dark:bg-blue-950/60 dark:text-blue-400">
              <PlusCircle className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">Đóng Góp Câu Hỏi Mới</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Câu hỏi sẽ qua quy trình duyệt trước khi đưa vào ngân hàng đề thi chung
              </p>
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
            onClick={() => setActiveTab('edit')}
            className={`py-3 text-sm font-semibold border-b-2 transition-all mr-6 flex items-center gap-1.5 ${
              activeTab === 'edit'
                ? 'border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white'
            }`}
          >
            <FileText className="h-4 w-4" /> Soạn thảo
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('preview')}
            className={`py-3 text-sm font-semibold border-b-2 transition-all mr-6 flex items-center gap-1.5 ${
              activeTab === 'preview'
                ? 'border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white'
            }`}
          >
            <Eye className="h-4 w-4" /> Xem trước
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('my-submissions')}
            className={`py-3 text-sm font-semibold border-b-2 transition-all flex items-center gap-1.5 ${
              activeTab === 'my-submissions'
                ? 'border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white'
            }`}
          >
            <Clock className="h-4 w-4" /> Câu hỏi của tôi ({submissions.length})
          </button>
        </div>

        {/* Content area */}
        <div className="overflow-y-auto p-6 flex-1">
          {statusMessage && (
            <div
              className={`mb-4 flex items-start gap-2.5 rounded-xl p-3.5 text-sm ${
                statusMessage.type === 'success'
                  ? 'border border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-300'
                  : 'border border-red-200 bg-red-50 text-red-800 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-300'
              }`}
            >
              {statusMessage.type === 'success' ? (
                <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-500" />
              ) : (
                <AlertCircle className="h-5 w-5 shrink-0 text-red-500" />
              )}
              <span>{statusMessage.text}</span>
            </div>
          )}

          {activeTab === 'edit' && (
            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Question Text */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
                  Nội dung câu hỏi (Scenario / Question Text)
                </label>
                <textarea
                  rows={3}
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder="Ví dụ: Một công ty cần triển khai cơ sở dữ liệu quan hệ có tính sẵn sàng cao trên AWS qua nhiều Availability Zone..."
                  required
                  className="w-full rounded-xl border border-slate-300 bg-white p-3 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>

              {/* Choices */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                    Các lựa chọn (Tích chọn để đánh dấu đáp án đúng)
                  </label>
                  {Object.keys(choices).length < 6 && (
                    <button
                      type="button"
                      onClick={addChoice}
                      className="text-xs font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400"
                    >
                      + Thêm lựa chọn
                    </button>
                  )}
                </div>

                <div className="space-y-2.5">
                  {Object.entries(choices).map(([key, val]) => {
                    const isSelected = selectedAnswers.includes(key);
                    return (
                      <div key={key} className="flex items-center gap-2.5">
                        <button
                          type="button"
                          onClick={() => toggleAnswer(key)}
                          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg font-bold text-sm transition-all ${
                            isSelected
                              ? 'bg-emerald-600 text-white shadow-sm ring-2 ring-emerald-500/40'
                              : 'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300'
                          }`}
                          title={isSelected ? 'Đáp án đúng (Click để bỏ chọn)' : 'Click để chọn làm đáp án đúng'}
                        >
                          {isSelected ? <Check className="h-4 w-4" /> : key}
                        </button>
                        <input
                          type="text"
                          value={val}
                          onChange={(e) => handleChoiceChange(key, e.target.value)}
                          placeholder={`Nội dung lựa chọn ${key}...`}
                          required
                          className="flex-1 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                        />
                        {Object.keys(choices).length > 2 && (
                          <button
                            type="button"
                            onClick={() => removeChoice(key)}
                            className="p-1.5 text-slate-400 hover:text-red-500 transition-colors"
                            title="Xóa lựa chọn này"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
                <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                  Đáp án đang chọn: <span className="font-bold text-emerald-600 dark:text-emerald-400">{selectedAnswers.join(', ')}</span>
                </p>
              </div>

              {/* Explanation */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
                  Giải thích đáp án bằng tiếng Việt chi tiết (Vì sao đúng / Vì sao các lựa chọn khác sai)
                </label>
                <textarea
                  rows={4}
                  value={explanation}
                  onChange={(e) => setExplanation(e.target.value)}
                  placeholder="Giải thích nguyên lý kiến trúc, vì sao đáp án đúng là tối ưu, và phân tích vì sao các phương án khác chưa phù hợp..."
                  className="w-full rounded-xl border border-slate-300 bg-white p-3 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>

              {/* Metadata row */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Domain AWS
                  </label>
                  <select
                    value={domain}
                    onChange={(e) => setDomain(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  >
                    <option value="Domain 1: Design Secure Architectures">Domain 1: Secure Architectures</option>
                    <option value="Domain 2: Design Resilient Architectures">Domain 2: Resilient Architectures</option>
                    <option value="Domain 3: Design High-Performing Architectures">Domain 3: High-Performing</option>
                    <option value="Domain 4: Design Cost-Optimized Architectures">Domain 4: Cost-Optimized</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Độ khó
                  </label>
                  <select
                    value={difficulty}
                    onChange={(e) => setDifficulty(e.target.value as any)}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  >
                    <option value="Easy">Dễ (Easy)</option>
                    <option value="Medium">Trung bình (Medium)</option>
                    <option value="Hard">Khó (Hard)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Chủ đề (Topic)
                  </label>
                  <input
                    type="text"
                    value={topic}
                    onChange={(e) => setTopic(e.target.value)}
                    placeholder="Storage, Compute, Security..."
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Dịch vụ AWS (Tags)
                  </label>
                  <input
                    type="text"
                    value={serviceTags}
                    onChange={(e) => setServiceTags(e.target.value)}
                    placeholder="S3, IAM, VPC..."
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                </div>
              </div>

              {/* Action buttons */}
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
                  className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-6 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 active:scale-[0.98] transition-all disabled:opacity-50"
                >
                  {isSubmitting ? 'Đang lưu...' : 'Gửi Phê Duyệt'}
                </button>
              </div>
            </form>
          )}

          {activeTab === 'preview' && (
            <div className="space-y-4 rounded-xl border border-slate-200 bg-slate-50/50 p-5 dark:border-slate-800 dark:bg-slate-800/30">
              <div className="flex items-center gap-2 text-xs">
                <span className="rounded-md bg-blue-100 px-2 py-0.5 font-semibold text-blue-700 dark:bg-blue-900/50 dark:text-blue-300">
                  {domain}
                </span>
                <span className="rounded-md bg-amber-100 px-2 py-0.5 font-semibold text-amber-700 dark:bg-amber-900/50 dark:text-amber-300">
                  {difficulty}
                </span>
              </div>

              <h4 className="text-base font-semibold text-slate-900 dark:text-white whitespace-pre-wrap">
                {text || '(Chưa nhập nội dung câu hỏi)'}
              </h4>

              <div className="space-y-2 pt-2">
                {Object.entries(choices).map(([key, val]) => (
                  <div
                    key={key}
                    className={`flex items-start gap-3 rounded-xl border p-3 text-sm transition-all ${
                      selectedAnswers.includes(key)
                        ? 'border-emerald-500 bg-emerald-50/60 dark:border-emerald-500/40 dark:bg-emerald-950/20'
                        : 'border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800'
                    }`}
                  >
                    <span
                      className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-xs font-bold ${
                        selectedAnswers.includes(key)
                          ? 'bg-emerald-600 text-white'
                          : 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300'
                      }`}
                    >
                      {key}
                    </span>
                    <span className="text-slate-800 dark:text-slate-200">{val || '(Chưa điền lựa chọn)'}</span>
                  </div>
                ))}
              </div>

              {explanation && (
                <div className="mt-4 rounded-xl border border-blue-200 bg-blue-50/60 p-4 text-xs dark:border-blue-900/40 dark:bg-blue-950/20">
                  <span className="font-bold text-blue-800 dark:text-blue-300 block mb-1">
                    Giải thích chi tiết:
                  </span>
                  <p className="text-blue-950 dark:text-blue-200 whitespace-pre-wrap">{explanation}</p>
                </div>
              )}
            </div>
          )}

          {activeTab === 'my-submissions' && (
            <div className="space-y-3">
              {loadingSubmissions ? (
                <div className="py-8 text-center text-sm text-slate-500 dark:text-slate-400">
                  Đang tải danh sách câu hỏi đã gửi...
                </div>
              ) : submissions.length === 0 ? (
                <div className="py-12 text-center text-slate-500 dark:text-slate-400">
                  <HelpCircle className="mx-auto mb-2 h-10 w-10 text-slate-300 dark:text-slate-600" />
                  <p className="text-sm font-medium">Bạn chưa đóng góp câu hỏi nào.</p>
                </div>
              ) : (
                submissions.map((sub) => (
                  <div
                    key={sub.id}
                    className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 dark:border-slate-800 dark:bg-slate-800/30"
                  >
                    <div className="flex items-center justify-between gap-3 mb-2">
                      <div className="flex items-center gap-2">
                        {sub.status === 'APPROVED' && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
                            <CheckCircle2 className="h-3 w-3" /> Đã duyệt (Public)
                          </span>
                        )}
                        {sub.status === 'PENDING_REVIEW' && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
                            <Clock className="h-3 w-3" /> Chờ duyệt (Private)
                          </span>
                        )}
                        {sub.status === 'REJECTED' && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700 dark:bg-red-900/40 dark:text-red-300">
                            <AlertCircle className="h-3 w-3" /> Từ chối
                          </span>
                        )}
                        <span className="text-xs text-slate-400">
                          {new Date(sub.created_at).toLocaleDateString('vi-VN')}
                        </span>
                      </div>
                      <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                        Đáp án: <strong className="text-slate-900 dark:text-white">{sub.answer}</strong>
                      </span>
                    </div>

                    <h4 className="text-sm font-semibold text-slate-900 dark:text-white mb-1.5">{sub.text}</h4>

                    {sub.rejection_reason && (
                      <div className="mt-2 rounded-lg bg-red-50 p-2.5 text-xs text-red-700 dark:bg-red-950/40 dark:text-red-300">
                        <strong>Lý do từ chối:</strong> {sub.rejection_reason}
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
