import React, { useState, useEffect, useCallback } from 'react';
import {
  Brain,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Trash2,
  Search,
  RefreshCw,
  BookOpen,
  Filter,
  Check,
  History,
  Zap,
  HelpCircle,
  Sparkles,
} from 'lucide-react';
import { adminApi } from '../../../core/api';

export const AIMemoryKnowledgeTab: React.FC = () => {
  const [activeSubTab, setActiveSubTab] = useState<'knowledge' | 'questions' | 'cache' | 'corrections'>('knowledge');
  const [loading, setLoading] = useState(true);
  const [knowledgeList, setKnowledgeList] = useState<any[]>([]);
  const [questionsList, setQuestionsList] = useState<any[]>([]);
  const [cacheList, setCacheList] = useState<any[]>([]);
  const [correctionsList, setCorrectionsList] = useState<any[]>([]);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [actionToast, setActionToast] = useState<string | null>(null);

  const fetchKnowledge = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminApi.getAIKnowledge({
        status: statusFilter,
        search: searchQuery,
      });
      setKnowledgeList(res.items || []);
    } catch (err: any) {
      console.warn('Lỗi tải tri thức:', err);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, searchQuery]);

  const fetchQuestions = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminApi.getAIQuestionMemory(searchQuery);
      setQuestionsList(res.questions || []);
    } catch (err: any) {
      console.warn('Lỗi tải bộ nhớ câu hỏi:', err);
    } finally {
      setLoading(false);
    }
  }, [searchQuery]);

  const fetchCache = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminApi.getAISemanticCache(searchQuery);
      setCacheList(res.cache || []);
    } catch (err: any) {
      console.warn('Lỗi tải semantic cache:', err);
    } finally {
      setLoading(false);
    }
  }, [searchQuery]);

  const fetchCorrections = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminApi.getAICorrections(searchQuery);
      setCorrectionsList(res.corrections || []);
    } catch (err: any) {
      console.warn('Lỗi tải lịch sử đính chính:', err);
    } finally {
      setLoading(false);
    }
  }, [searchQuery]);

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      try {
        if (activeSubTab === 'knowledge') {
          const res = await adminApi.getAIKnowledge({ status: statusFilter, search: searchQuery });
          if (active) setKnowledgeList(res.items || []);
        } else if (activeSubTab === 'questions') {
          const res = await adminApi.getAIQuestionMemory(searchQuery);
          if (active) setQuestionsList(res.questions || []);
        } else if (activeSubTab === 'cache') {
          const res = await adminApi.getAISemanticCache(searchQuery);
          if (active) setCacheList(res.cache || []);
        } else {
          const res = await adminApi.getAICorrections(searchQuery);
          if (active) setCorrectionsList(res.corrections || []);
        }
      } catch (err: any) {
        console.warn('Lỗi tải dữ liệu tab:', err);
      } finally {
        if (active) setLoading(false);
      }
    };
    void load();
    return () => {
      active = false;
    };
  }, [activeSubTab, statusFilter, searchQuery]);

  const handleUpdateStatus = async (id: string, update: { status?: string; possiblyOutdated?: boolean }) => {
    try {
      await adminApi.updateAIKnowledgeStatus(id, update);
      setActionToast('Đã cập nhật trạng thái tri thức thành công!');
      setTimeout(() => setActionToast(null), 3000);
      void fetchKnowledge();
    } catch (err: any) {
      alert(`Lỗi cập nhật: ${err.message}`);
    }
  };

  const handleSeedCanonical = async () => {
    try {
      setLoading(true);
      const res = await adminApi.seedCanonicalAIKnowledge();
      setActionToast(`Đã khởi tạo thành công ${res.seededCount} mục tri thức chuẩn AWS SAA-C03!`);
      setTimeout(() => setActionToast(null), 4000);
      void fetchKnowledge();
    } catch (err: any) {
      alert(`Lỗi khởi tạo: ${err.message}`);
      setLoading(false);
    }
  };

  const handleClearCache = async () => {
    if (!window.confirm('Bạn có chắc muốn làm trống toàn bộ Semantic Cache? Các câu hỏi tiếp theo sẽ được truy vấn lại từ RAG.')) return;
    try {
      const res = await adminApi.clearAICache();
      setActionToast(`Đã làm trống Semantic Cache (${res.invalidatedCount} mục đã xóa)!`);
      setTimeout(() => setActionToast(null), 3000);
      void fetchCache();
    } catch (err: any) {
      alert(`Lỗi xóa cache: ${err.message}`);
    }
  };

  const handleDeleteCacheItem = async (id: string) => {
    try {
      await adminApi.deleteAICacheItem(id);
      setActionToast('Đã xóa mục bộ nhớ đệm thành công!');
      setTimeout(() => setActionToast(null), 3000);
      void fetchCache();
    } catch (err: any) {
      alert(`Lỗi xóa: ${err.message}`);
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header & Main Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4 dark:border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Brain className="h-5 w-5 text-amber-500" />
              <span>Quản Lý Bộ Nhớ Tri Thức, Câu Hỏi & Sửa Sai (Memory & Knowledge)</span>
            </h3>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Duyệt tri thức đã xác thực & ứng viên tự động, theo dõi bộ nhớ câu hỏi học viên, kiểm soát Semantic Cache và lịch sử đính chính.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={handleSeedCanonical}
            className="inline-flex items-center gap-1.5 rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-2 text-xs font-semibold text-indigo-700 hover:bg-indigo-100 dark:border-indigo-900/50 dark:bg-indigo-950/30 dark:text-indigo-300 dark:hover:bg-indigo-950/60 transition-colors"
          >
            <Sparkles className="h-3.5 w-3.5" />
            <span>Nạp Tri Thức Chuẩn AWS</span>
          </button>

          {activeSubTab === 'cache' && (
            <button
              type="button"
              onClick={handleClearCache}
              className="inline-flex items-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-100 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-300 dark:hover:bg-rose-950/60 transition-colors"
            >
              <Trash2 className="h-3.5 w-3.5" />
              <span>Xóa Toàn Bộ Cache</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => {
              if (activeSubTab === 'knowledge') void fetchKnowledge();
              else if (activeSubTab === 'questions') void fetchQuestions();
              else if (activeSubTab === 'cache') void fetchCache();
              else void fetchCorrections();
            }}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 transition-colors"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Tải lại</span>
          </button>
        </div>
      </div>

      {actionToast && (
        <div className="flex items-center gap-2 rounded-xl bg-emerald-50 p-3 text-xs font-semibold text-emerald-800 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800">
          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
          <span>{actionToast}</span>
        </div>
      )}

      {/* 4 Sub-tab Navigation */}
      <div className="flex border-b border-slate-200 dark:border-slate-800 overflow-x-auto">
        <button
          type="button"
          onClick={() => setActiveSubTab('knowledge')}
          className={`pb-3 px-4 text-xs font-bold border-b-2 transition-colors flex items-center gap-2 whitespace-nowrap ${
            activeSubTab === 'knowledge'
              ? 'border-amber-500 text-amber-600 dark:text-amber-400'
              : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
          }`}
        >
          <BookOpen className="h-4 w-4" />
          <span>Tri Thức Đã Duyệt & Ứng Viên ({knowledgeList.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab('questions')}
          className={`pb-3 px-4 text-xs font-bold border-b-2 transition-colors flex items-center gap-2 whitespace-nowrap ${
            activeSubTab === 'questions'
              ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400'
              : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
          }`}
        >
          <HelpCircle className="h-4 w-4" />
          <span>Bộ Nhớ Câu Hỏi Học Viên ({questionsList.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab('cache')}
          className={`pb-3 px-4 text-xs font-bold border-b-2 transition-colors flex items-center gap-2 whitespace-nowrap ${
            activeSubTab === 'cache'
              ? 'border-purple-500 text-purple-600 dark:text-purple-400'
              : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
          }`}
        >
          <Zap className="h-4 w-4" />
          <span>Bộ Nhớ Đệm Ngữ Nghĩa ({cacheList.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab('corrections')}
          className={`pb-3 px-4 text-xs font-bold border-b-2 transition-colors flex items-center gap-2 whitespace-nowrap ${
            activeSubTab === 'corrections'
              ? 'border-rose-500 text-rose-600 dark:text-rose-400'
              : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
          }`}
        >
          <History className="h-4 w-4" />
          <span>Bộ Nhớ Sửa Sai ({correctionsList.length})</span>
        </button>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
          <input
            type="text"
            placeholder={
              activeSubTab === 'knowledge'
                ? 'Tìm kiếm tri thức hoặc câu hỏi...'
                : activeSubTab === 'questions'
                ? 'Tìm kiếm câu hỏi người học...'
                : activeSubTab === 'cache'
                ? 'Tìm kiếm trong cache...'
                : 'Tìm kiếm lịch sử sửa sai...'
            }
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-xl border border-slate-300 bg-slate-50 py-2 pl-9 pr-3 text-xs text-slate-900 focus:border-amber-500 focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
          />
        </div>

        {activeSubTab === 'knowledge' && (
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Filter className="h-3.5 w-3.5 text-slate-400" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="rounded-xl border border-slate-300 bg-slate-50 p-2 text-xs text-slate-900 focus:border-amber-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            >
              <option value="ALL">Mọi trạng thái xác thực</option>
              <option value="VERIFIED">Đã duyệt (VERIFIED)</option>
              <option value="CANDIDATE">Chờ duyệt (CANDIDATE)</option>
              <option value="OUTDATED">Đã cũ (OUTDATED)</option>
            </select>
          </div>
        )}
      </div>

      {/* Tab 1: Knowledge Items */}
      {activeSubTab === 'knowledge' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {knowledgeList.length === 0 ? (
            <div className="col-span-full rounded-2xl border border-slate-200 bg-white p-12 text-center text-slate-400 dark:border-slate-800 dark:bg-slate-900 space-y-3">
              <Brain className="mx-auto h-10 w-10 text-amber-500/50" />
              <div className="text-sm font-bold text-slate-700 dark:text-slate-300">
                Chưa có mục tri thức nào trong hệ thống.
              </div>
              <p className="text-xs max-w-md mx-auto">
                Khi người dùng hỏi câu hỏi và AI trả lời với độ tin cậy cao, hệ thống sẽ tự động thêm vào đây làm Ứng viên (CANDIDATE). Bạn cũng có thể bấm nút bên dưới để nạp ngay bộ tri thức chuẩn AWS.
              </p>
              <button
                type="button"
                onClick={handleSeedCanonical}
                className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white hover:bg-indigo-700 shadow-sm transition-colors"
              >
                <Sparkles className="h-3.5 w-3.5" />
                <span>Nạp Ngay Tri Thức Chuẩn AWS SAA-C03</span>
              </button>
            </div>
          ) : (
            knowledgeList.map((item) => (
              <div
                key={item.knowledgeId}
                className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <span className="font-bold text-xs text-slate-900 dark:text-white leading-snug line-clamp-2">
                      {item.question}
                    </span>
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold shrink-0 ${
                        item.verificationStatus === 'VERIFIED'
                          ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                          : item.verificationStatus === 'CANDIDATE'
                          ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 animate-pulse'
                          : 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300'
                      }`}
                    >
                      {item.verificationStatus === 'CANDIDATE' ? 'ỨNG VIÊN CHỜ DUYỆT' : item.verificationStatus}
                    </span>
                  </div>

                  <p className="text-xs text-slate-600 dark:text-slate-300 line-clamp-4 leading-relaxed mb-3">
                    {item.answer}
                  </p>

                  <div className="flex flex-wrap items-center gap-1.5 text-[10px] text-slate-400 mb-4">
                    <span className="rounded bg-slate-100 px-1.5 py-0.5 dark:bg-slate-800">
                      Chủ đề: {item.topic || 'Chung'}
                    </span>
                    <span className="rounded bg-slate-100 px-1.5 py-0.5 dark:bg-slate-800">
                      Lượt dùng: {item.usageCount || 0}
                    </span>
                    {item.verifiedBy && (
                      <span className="rounded bg-slate-100 px-1.5 py-0.5 dark:bg-slate-800">
                        Nguồn: {item.verifiedBy}
                      </span>
                    )}
                    {item.possiblyOutdated && (
                      <span className="rounded bg-rose-100 text-rose-700 px-1.5 py-0.5 dark:bg-rose-950/60 dark:text-rose-300 font-bold">
                        Đã đánh dấu lỗi thời
                      </span>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800 text-xs">
                  {item.verificationStatus !== 'VERIFIED' && (
                    <button
                      type="button"
                      onClick={() => handleUpdateStatus(item.knowledgeId, { status: 'VERIFIED' })}
                      className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-white hover:bg-emerald-700 font-bold shadow-xs transition-colors"
                    >
                      <Check className="h-3.5 w-3.5" />
                      <span>Duyệt Tri Thức</span>
                    </button>
                  )}

                  {!item.possiblyOutdated ? (
                    <button
                      type="button"
                      onClick={() => handleUpdateStatus(item.knowledgeId, { possiblyOutdated: true })}
                      className="inline-flex items-center gap-1 rounded-lg border border-amber-300 bg-amber-50 px-2.5 py-1 text-amber-800 hover:bg-amber-100 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-300"
                    >
                      <AlertTriangle className="h-3 w-3" />
                      <span>Báo Lỗi Thời</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleUpdateStatus(item.knowledgeId, { possiblyOutdated: false, status: 'VERIFIED' })}
                      className="inline-flex items-center gap-1 rounded-lg border border-emerald-300 bg-emerald-50 px-2.5 py-1 text-emerald-800 hover:bg-emerald-100 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-300"
                    >
                      <RotateCcw className="h-3 w-3" />
                      <span>Tái kích hoạt</span>
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Tab 2: Question Memory */}
      {activeSubTab === 'questions' && (
        <div className="space-y-3">
          {questionsList.length === 0 ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center text-slate-400 dark:border-slate-800 dark:bg-slate-900">
              <HelpCircle className="mx-auto h-8 w-8 text-indigo-400 mb-2" />
              Chưa có câu hỏi nào được lưu trong bộ nhớ câu hỏi học viên. Hãy hỏi một số câu hỏi qua Chatbox hoặc Playground để xem các câu hỏi xuất hiện tại đây.
            </div>
          ) : (
            questionsList.map((q) => (
              <div
                key={q.id}
                className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 space-y-2 text-xs"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="rounded-md bg-indigo-100 px-2 py-0.5 text-[10px] font-bold text-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-300">
                      Chủ đề: {q.topic || 'General'}
                    </span>
                    <span className="rounded-md bg-blue-100 px-2 py-0.5 text-[10px] font-bold text-blue-800 dark:bg-blue-950/60 dark:text-blue-300">
                      Ý định: {q.intent || 'EXPLAIN'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-[10px] text-slate-400 font-mono">
                    <span>Tần suất: <strong className="text-indigo-600 dark:text-indigo-400">{q.frequency} lần</strong></span>
                    <span>•</span>
                    <span>{new Date(q.lastAnsweredAt).toLocaleString('vi-VN')}</span>
                  </div>
                </div>

                <div className="font-bold text-slate-900 dark:text-white">
                  Câu hỏi gốc: <span className="font-normal">{q.originalQuestion}</span>
                </div>

                <div className="text-[11px] text-slate-500 dark:text-slate-400">
                  Câu hỏi đã chuẩn hóa: <span className="font-mono text-slate-700 dark:text-slate-300">{q.normalizedQuestion}</span>
                </div>

                {q.securityFlags && q.securityFlags.length > 0 && (
                  <div className="flex items-center gap-1 text-[10px] text-rose-600 dark:text-rose-400 font-semibold">
                    <AlertTriangle className="h-3 w-3" />
                    <span>Cờ an ninh: {q.securityFlags.join(', ')}</span>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {/* Tab 3: Semantic Cache */}
      {activeSubTab === 'cache' && (
        <div className="space-y-3">
          {cacheList.length === 0 ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center text-slate-400 dark:border-slate-800 dark:bg-slate-900">
              <Zap className="mx-auto h-8 w-8 text-purple-400 mb-2" />
              Bộ nhớ đệm ngữ nghĩa (Semantic Cache) đang trống. Khi các câu hỏi được trả lời với độ tin cậy cao, hệ thống sẽ tự động lưu vào cache để phản hồi 0ms.
            </div>
          ) : (
            cacheList.map((c) => (
              <div
                key={c.id}
                className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 space-y-2 text-xs flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <div className="flex items-center gap-2">
                      <span className="rounded-md bg-purple-100 px-2 py-0.5 text-[10px] font-bold text-purple-800 dark:bg-purple-950/60 dark:text-purple-300 flex items-center gap-1">
                        <Zap className="h-2.5 w-2.5" />
                        Đã tái sử dụng {c.hitCount} lượt
                      </span>
                      <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-600 dark:bg-slate-800 dark:text-slate-400 font-mono">
                        Model: {c.modelUsed}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleDeleteCacheItem(c.id)}
                      className="rounded-lg p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/40 dark:hover:text-rose-300 transition-colors"
                      title="Xóa mục cache này"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  <div className="font-bold text-slate-900 dark:text-white mb-1">
                    {c.queryText}
                  </div>

                  <p className="text-[11px] text-slate-600 dark:text-slate-300 line-clamp-3 leading-relaxed">
                    {c.responseContent}
                  </p>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800 text-[10px] text-slate-400">
                  <span>Tạo lúc: {new Date(c.createdAt).toLocaleString('vi-VN')}</span>
                  <span>Hết hạn: {new Date(c.expiresAt).toLocaleDateString('vi-VN')}</span>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Tab 4: Correction Items */}
      {activeSubTab === 'corrections' && (
        <div className="space-y-3">
          {correctionsList.length === 0 ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center text-slate-400 dark:border-slate-800 dark:bg-slate-900">
              <History className="mx-auto h-8 w-8 text-slate-400 mb-2" />
              Chưa có bản ghi đính chính sửa sai nào từ học viên hoặc quản trị viên.
            </div>
          ) : (
            correctionsList.map((c) => (
              <div
                key={c.id}
                className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 space-y-2 text-xs"
              >
                <div className="flex items-center justify-between">
                  <span className="rounded-md bg-rose-100 px-2 py-0.5 text-[10px] font-bold text-rose-800 dark:bg-rose-950/60 dark:text-rose-300">
                    Phân loại lỗi: {c.errorType}
                  </span>
                  <span className="text-[10px] text-slate-400">
                    {new Date(c.createdAt).toLocaleString('vi-VN')}
                  </span>
                </div>

                <div className="font-bold text-slate-900 dark:text-white">
                  Câu hỏi gốc: <span className="font-normal opacity-90">{c.originalQuestion || 'N/A'}</span>
                </div>

                {c.userCorrection && (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 p-2.5 text-amber-900 dark:border-amber-800/50 dark:bg-amber-950/30 dark:text-amber-200">
                    <span className="font-bold">Đính chính của học viên: </span>
                    <span>{c.userCorrection}</span>
                  </div>
                )}

                <div className="text-[11px] text-slate-500 dark:text-slate-400">
                  <span>Câu trả lời trước đó: </span>
                  <span className="line-clamp-2 italic">{c.originalAnswer || 'N/A'}</span>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};
