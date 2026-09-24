import React, { useState, useEffect, useCallback } from 'react';
import {
  ShieldAlert,
  ShieldCheck,
  AlertTriangle,
  Lock,
  EyeOff,
  Filter,
  RefreshCw,
  Search,
  ExternalLink,
} from 'lucide-react';
import { adminApi } from '../../../core/api';

export const AISecurityDashboardTab: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [severityFilter, setSeverityFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedEvent, setSelectedEvent] = useState<any>(null);

  const fetchSecurityMetrics = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminApi.getAISecurityMetrics();
      setData(res);
    } catch (err: any) {
      console.warn('Lỗi tải dữ liệu an ninh AI:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const res = await adminApi.getAISecurityMetrics();
        if (active) setData(res);
      } catch (err: any) {
        console.warn('Lỗi tải dữ liệu an ninh AI:', err);
      } finally {
        if (active) setLoading(false);
      }
    };
    void load();
    return () => {
      active = false;
    };
  }, []);

  const metrics = data?.metrics || {
    totalQueriesInspected: 0,
    injectionAttacksBlocked: 0,
    jailbreakAttempts: 0,
    sensitiveDataMasked: 0,
    rateLimitedCount: 0,
    attackBreakdown: {},
  };

  const rawEvents: any[] = data?.recentSecurityEvents || [];

  const filteredEvents = rawEvents.filter((ev) => {
    if (typeFilter !== 'ALL' && ev.attackType !== typeFilter) return false;
    if (severityFilter !== 'ALL' && ev.severity !== severityFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchIp = (ev.ipAddress || '').toLowerCase().includes(q);
      const matchUser = (ev.username || '').toLowerCase().includes(q);
      const matchQuery = (ev.querySnippet || '').toLowerCase().includes(q);
      if (!matchIp && !matchUser && !matchQuery) return false;
    }
    return true;
  });

  const getSeverityBadge = (severity: string) => {
    switch (severity) {
      case 'CRITICAL':
        return (
          <span className="rounded-md bg-rose-100 px-2 py-0.5 text-[10px] font-bold text-rose-800 dark:bg-rose-950/60 dark:text-rose-300">
            CRITICAL
          </span>
        );
      case 'HIGH':
        return (
          <span className="rounded-md bg-orange-100 px-2 py-0.5 text-[10px] font-bold text-orange-800 dark:bg-orange-950/60 dark:text-orange-300">
            HIGH
          </span>
        );
      case 'MEDIUM':
        return (
          <span className="rounded-md bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800 dark:bg-amber-950/60 dark:text-amber-300">
            MEDIUM
          </span>
        );
      default:
        return (
          <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-800 dark:bg-slate-800 dark:text-slate-300">
            LOW
          </span>
        );
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header & Refresh */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4 dark:border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-rose-600 dark:text-rose-400" />
              <span>Bảng Giám Sát An Ninh AI (Security Dashboard)</span>
            </h3>
            <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-bold text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 flex items-center gap-1">
              <ShieldCheck className="h-3.5 w-3.5" />
              Active Shielding
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Giám sát thời gian thực các nỗ lực Prompt Injection, bẻ khóa Jailbreak, che chắn rò rỉ bí mật PII/Secret và tấn công XSS.
          </p>
        </div>

        <button
          type="button"
          onClick={fetchSecurityMetrics}
          disabled={loading}
          className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 transition-colors self-start sm:self-auto"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin text-rose-600' : ''}`} />
          <span>Làm mới</span>
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mb-2">
            <span className="font-medium">Tổng Truy Vấn Giám Sát</span>
            <Lock className="h-4 w-4 text-blue-600 dark:text-blue-400" />
          </div>
          <div className="text-2xl font-black text-slate-900 dark:text-white">
            {metrics.totalQueriesInspected}
          </div>
          <div className="mt-2 text-[11px] text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1">
            <ShieldCheck className="h-3.5 w-3.5" />
            100% kiểm tra an ninh đầu vào & đầu ra
          </div>
        </div>

        <div className="rounded-2xl border border-rose-200 bg-rose-50/50 p-5 shadow-sm dark:border-rose-900/50 dark:bg-rose-950/20">
          <div className="flex items-center justify-between text-xs text-rose-700 dark:text-rose-300 mb-2 font-medium">
            <span>Prompt Injection Chặn Đứng</span>
            <AlertTriangle className="h-4 w-4 text-rose-600 dark:text-rose-400" />
          </div>
          <div className="text-2xl font-black text-rose-900 dark:text-rose-100">
            {metrics.injectionAttacksBlocked}
          </div>
          <div className="mt-2 text-[11px] text-rose-700 dark:text-rose-300">
            {metrics.jailbreakAttempts} trường hợp bẻ khóa Jailbreak
          </div>
        </div>

        <div className="rounded-2xl border border-amber-200 bg-amber-50/50 p-5 shadow-sm dark:border-amber-900/50 dark:bg-amber-950/20">
          <div className="flex items-center justify-between text-xs text-amber-700 dark:text-amber-300 mb-2 font-medium">
            <span>Che Giấu PII & Bí Mật</span>
            <EyeOff className="h-4 w-4 text-amber-600 dark:text-amber-400" />
          </div>
          <div className="text-2xl font-black text-amber-900 dark:text-amber-100">
            {metrics.sensitiveDataMasked}
          </div>
          <div className="mt-2 text-[11px] text-amber-700 dark:text-amber-300">
            Tự động làm mờ Email, SĐT, API Key
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mb-2 font-medium">
            <span>Giới Hạn Tốc Độ (Rate Limited)</span>
            <Filter className="h-4 w-4 text-purple-600 dark:text-purple-400" />
          </div>
          <div className="text-2xl font-black text-slate-900 dark:text-white">
            {metrics.rateLimitedCount}
          </div>
          <div className="mt-2 text-[11px] text-slate-500 dark:text-slate-400">
            Chống DoS & Lạm dụng Token
          </div>
        </div>
      </div>

      {/* Security Events Table with Filters */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900 overflow-hidden">
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <span>Nhật Ký Sự Kiện An Ninh (Live Security Events)</span>
              <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                {filteredEvents.length} sự kiện
              </span>
            </h4>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
              <input
                type="text"
                placeholder="Tìm IP, User, nội dung..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="rounded-xl border border-slate-300 bg-slate-50 py-1.5 pl-8 pr-3 text-xs text-slate-900 focus:border-rose-500 focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
            </div>

            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="rounded-xl border border-slate-300 bg-slate-50 p-1.5 text-xs text-slate-900 focus:border-rose-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            >
              <option value="ALL">Mọi loại tấn công</option>
              <option value="PROMPT_INJECTION">Prompt Injection</option>
              <option value="JAILBREAK">Jailbreak</option>
              <option value="SECRET_LEAKAGE">Secret Leakage</option>
              <option value="PII_LEAKAGE">PII Leakage</option>
              <option value="XSS">XSS Injection</option>
              <option value="RATE_LIMIT">Rate Limit</option>
            </select>

            <select
              value={severityFilter}
              onChange={(e) => setSeverityFilter(e.target.value)}
              className="rounded-xl border border-slate-300 bg-slate-50 p-1.5 text-xs text-slate-900 focus:border-rose-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            >
              <option value="ALL">Mọi mức độ</option>
              <option value="CRITICAL">CRITICAL</option>
              <option value="HIGH">HIGH</option>
              <option value="MEDIUM">MEDIUM</option>
              <option value="LOW">LOW</option>
            </select>
          </div>
        </div>

        {/* Events Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-700 dark:text-slate-300">
            <thead className="border-b border-slate-200 bg-slate-50 font-semibold text-slate-700 dark:border-slate-800 dark:bg-slate-800/50 dark:text-slate-200">
              <tr>
                <th className="px-4 py-3">Thời gian</th>
                <th className="px-4 py-3">Loại Tấn Công</th>
                <th className="px-4 py-3">Mức Độ</th>
                <th className="px-4 py-3">Học Viên / IP</th>
                <th className="px-4 py-3">Mẫu Lệnh Bị Chặn</th>
                <th className="px-4 py-3">Xử Lý</th>
                <th className="px-4 py-3 text-right">Chi tiết</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filteredEvents.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-slate-400">
                    <ShieldCheck className="mx-auto h-8 w-8 text-emerald-500/60 mb-2" />
                    Không phát hiện sự kiện an ninh nào phù hợp với bộ lọc. Hệ thống an toàn!
                  </td>
                </tr>
              ) : (
                filteredEvents.map((ev) => (
                  <tr key={ev.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors">
                    <td className="px-4 py-3 whitespace-nowrap text-slate-500 dark:text-slate-400 font-mono text-[11px]">
                      {new Date(ev.timestamp).toLocaleString('vi-VN')}
                    </td>
                    <td className="px-4 py-3 font-semibold text-slate-900 dark:text-white">
                      {ev.attackType}
                    </td>
                    <td className="px-4 py-3">{getSeverityBadge(ev.severity)}</td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-900 dark:text-white">{ev.username || 'Khách'}</div>
                      <div className="text-[10px] text-slate-400 font-mono">{ev.ipAddress || '127.0.0.1'}</div>
                    </td>
                    <td className="px-4 py-3 max-w-xs truncate font-mono text-[11px] text-slate-600 dark:text-slate-300">
                      {ev.querySnippet}
                    </td>
                    <td className="px-4 py-3">
                      <span className="rounded-md bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                        {ev.actionTaken || 'BLOCKED'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => setSelectedEvent(ev)}
                        className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
                      >
                        <span>Soi</span>
                        <ExternalLink className="h-3 w-3" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Event Detail Modal */}
      {selectedEvent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
          <div className="relative w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3.5 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/40">
              <div className="flex items-center gap-2 text-slate-800 dark:text-slate-200 font-bold text-xs">
                <ShieldAlert className="h-4 w-4 text-rose-500" />
                <span>Chi Tiết Sự Kiện An Ninh #{selectedEvent.id}</span>
              </div>
              <button
                type="button"
                onClick={() => setSelectedEvent(null)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800 text-xs"
              >
                Đóng
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <span className="block text-slate-400 text-[10px]">Loại tấn công</span>
                  <span className="font-bold text-slate-900 dark:text-white">{selectedEvent.attackType}</span>
                </div>
                <div>
                  <span className="block text-slate-400 text-[10px]">Mức độ nghiêm trọng</span>
                  <span>{getSeverityBadge(selectedEvent.severity)}</span>
                </div>
                <div>
                  <span className="block text-slate-400 text-[10px]">Thời gian</span>
                  <span className="font-mono text-slate-700 dark:text-slate-300">
                    {new Date(selectedEvent.timestamp).toLocaleString('vi-VN')}
                  </span>
                </div>
                <div>
                  <span className="block text-slate-400 text-[10px]">Hành động đã thi hành</span>
                  <span className="font-bold text-emerald-600 dark:text-emerald-400">
                    {selectedEvent.actionTaken || 'BLOCKED'}
                  </span>
                </div>
              </div>

              <div>
                <span className="block text-slate-400 text-[10px] mb-1">Mẫu regex / chữ ký an ninh đã khớp (Signature)</span>
                <div className="rounded-xl border border-rose-200 bg-rose-50 p-2.5 font-mono text-[11px] text-rose-800 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-300 break-all">
                  {selectedEvent.matchedPattern || 'Rule matched in Security Gateway'}
                </div>
              </div>

              <div>
                <span className="block text-slate-400 text-[10px] mb-1">Đoạn truy vấn của người dùng (Query Snippet)</span>
                <div className="rounded-xl border border-slate-300 bg-slate-50 p-2.5 font-mono text-[11px] text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white max-h-40 overflow-y-auto whitespace-pre-wrap">
                  {selectedEvent.querySnippet}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end p-4 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setSelectedEvent(null)}
                className="px-4 py-1.5 rounded-xl bg-slate-200 dark:bg-slate-800 text-xs font-semibold text-slate-800 dark:text-slate-200"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
