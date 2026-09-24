import React, { useState, useEffect, useCallback } from 'react';
import {
  Users,
  CheckCircle,
  XCircle,
  AlertTriangle,
  TrendingUp,
  FileText,
  Upload,
  MessageSquare,
  Shield,
  Search,
  CheckCircle2,
  RefreshCw,
  BookOpen,
  Laptop,
  Smartphone,
  Flame,
  Lightbulb,
  FileCheck,
  Clock,
  Bot,
  ThumbsUp,
  Globe,
  Monitor,
  BarChart3,
  Activity,
  Target,
  Eye,
  Sun,
  Moon,
  Sliders,
  Brain,
  Terminal,
} from 'lucide-react';
import { useTheme } from '../context/useTheme';
import { adminApi, aiApi, getLocalRegisteredLearners, syncLocalProgressToServer } from '../core/api';
import { realtimeManager } from '../core/realtime';
import { exportLocalConversationsAsQueries } from '../core/aiConversationStorage';
import { MODE_METADATA } from '../core/aiConfigStorage';
import { AIInspectQueryModal } from '../components/ai/AIInspectQueryModal';
import { UltraViewScreenViewerModal } from '../components/admin/UltraViewScreenViewerModal';
import { AIConfigCenterTab } from '../components/admin/ai/AIConfigCenterTab';
import { AISecurityDashboardTab } from '../components/admin/ai/AISecurityDashboardTab';
import { AIQualityCostTab } from '../components/admin/ai/AIQualityCostTab';
import { AIMemoryKnowledgeTab } from '../components/admin/ai/AIMemoryKnowledgeTab';
import { AIPlaygroundLabTab } from '../components/admin/ai/AIPlaygroundLabTab';

function formatTimeAgo(timestamp: number): string {
  if (!timestamp) return 'Chưa rõ';
  const diffSec = Math.max(0, Math.floor((Date.now() - timestamp) / 1000));
  if (diffSec < 15) return 'Vừa xong';
  if (diffSec < 60) return `${diffSec} giây trước`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin} phút trước`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour} giờ trước`;
  return new Date(timestamp).toLocaleDateString('vi-VN');
}

interface AdminDashboardViewProps {
  onBackToApp: () => void;
}

export const AdminDashboardView: React.FC<AdminDashboardViewProps> = ({ onBackToApp }) => {
  const { theme, toggleTheme } = useTheme();
  const [activeTab, setActiveTab] = useState<
    'overview' | 'learners' | 'moderation' | 'sources' | 'feedback' | 'ai' | 'audit'
  >('overview');

  // Overview Data
  const [overview, setOverview] = useState<any>(null);
  const [loadingOverview, setLoadingOverview] = useState(false);

  // Learners Data
  const [usersList, setUsersList] = useState<any[]>([]);
  const [usersTotal, setUsersTotal] = useState(0);
  const [userSearch, setUserSearch] = useState('');
  const [userRoleFilter, setUserRoleFilter] = useState('ALL');
  const [selectedLearnerDetail, setSelectedLearnerDetail] = useState<any>(null);
  const [loadingLearners, setLoadingLearners] = useState(false);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // Realtime Live Sessions & Telemetry Data
  const [liveSessions, setLiveSessions] = useState<any[]>([]);
  const [liveSessionsActiveCount, setLiveSessionsActiveCount] = useState(0);
  const [liveSessionsOnlineCount, setLiveSessionsOnlineCount] = useState(0);
  const [isSilentRefreshing, setIsSilentRefreshing] = useState(false);
  const [viewingUltraViewSession, setViewingUltraViewSession] = useState<any>(null);
  const [lastRefreshedAt, setLastRefreshedAt] = useState<number>(() => Date.now());

  // Moderation Queue Data
  const [pendingQuestions, setPendingQuestions] = useState<any[]>([]);
  const [loadingModeration, setLoadingModeration] = useState(false);
  const [rejectModalQuestion, setRejectModalQuestion] = useState<any>(null);
  const [rejectionReason, setRejectionReason] = useState('');

  // Question Sources & Importer Data
  const [sources, setSources] = useState<any[]>([]);
  const [jsonImportText, setJsonImportText] = useState('');
  const [importSourceName, setImportSourceName] = useState('Đề Thi Bổ Sung 2026');
  const [importStatus, setImportStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [isImporting, setIsImporting] = useState(false);

  // Feedback Inbox Data
  const [feedbacks, setFeedbacks] = useState<any[]>([]);
  const [feedbackStatusFilter, setFeedbackStatusFilter] = useState('ALL');
  const [loadingFeedback, setLoadingFeedback] = useState(false);
  const [replyingFeedback, setReplyingFeedback] = useState<any>(null);
  const [adminReplyText, setAdminReplyText] = useState('');
  const [adminReplyStatus, setAdminReplyStatus] = useState<'IN_REVIEW' | 'RESOLVED' | 'REJECTED'>('RESOLVED');

  // Audit Logs Data
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [loadingAudit, setLoadingAudit] = useState(false);

  // AI Tutor & Knowledge Base Data
  const [aiMetrics, setAiMetrics] = useState<any>(null);
  const [loadingAI, setLoadingAI] = useState(false);

  // Learning Behavior Analytics Data
  const [learningBehavior, setLearningBehavior] = useState<any>(null);
  const [loadingLearningBehavior, setLoadingLearningBehavior] = useState(false);
  const [selectedBehaviorLearnerId, setSelectedBehaviorLearnerId] = useState<string>('ALL');

  // AI User Queries Log Data
  const [aiQueriesList, setAiQueriesList] = useState<any[]>([]);
  const [aiQueriesTotal, setAiQueriesTotal] = useState(0);
  const [aiQuerySearch, setAiQuerySearch] = useState('');
  const [aiQueryModeFilter, setAiQueryModeFilter] = useState('ALL');
  const [loadingAiQueries, setLoadingAiQueries] = useState(false);
  const [isRealtimeConnected, setIsRealtimeConnected] = useState<boolean>(() => realtimeManager.isConnected());
  const [selectedAIQueryDetail, setSelectedAIQueryDetail] = useState<any>(null);
  const [highlightedQueryId, setHighlightedQueryId] = useState<string | null>(null);
  const [aiSubTab, setAiSubTab] = useState<'overview' | 'config' | 'security' | 'quality' | 'memory' | 'playground'>('overview');

  // Sync client-side registered learners to backend
  const syncLocalLearners = useCallback(async () => {
    try {
      await syncLocalProgressToServer();
      const localLearners = Object.values(getLocalRegisteredLearners());
      if (localLearners.length > 0) {
        await adminApi.syncLearners(localLearners);
      }
    } catch {
      // Ignore sync error and continue
    }
  }, []);

  // Fetch Live Sessions Realtime
  const fetchLiveSessions = useCallback(async () => {
    try {
      const res = await adminApi.getLiveSessions(15);
      const sessions = res.sessions || [];
      setLiveSessions(sessions);
      setLiveSessionsActiveCount(res.activeCount || 0);
      setLiveSessionsOnlineCount(res.onlineCount || 0);

      // Instantly ensure any online learner from live sessions is reflected in usersList
      if (sessions.length > 0) {
        setUsersList((prev) => {
          const currentKeys = new Set(prev.map((u) => u.username?.toLowerCase()));
          let updated = false;
          const nextList = prev.map((u) => {
            const match = sessions.find((s: any) => s.username?.toLowerCase() === u.username?.toLowerCase());
            if (match) {
              const questionsAttempted = Math.max(u.questionsAttempted || 0, match.questionsAttempted || 0);
              const accuracyPercent = questionsAttempted > 0 && typeof match.accuracyPercent === 'number'
                ? match.accuracyPercent
                : (u.accuracyPercent || 0);
              return {
                ...u,
                questionsAttempted,
                accuracyPercent,
                ipAddress: match.ipAddress || u.ipAddress,
                deviceType: match.deviceType || u.deviceType,
                os: match.os || u.os,
                browser: match.browser || u.browser,
                currentScreen: match.currentScreen || u.currentScreen,
                currentAction: match.currentAction || u.currentAction,
                lastActiveAt: Math.max(u.lastActiveAt || 0, match.lastActiveAt || 0),
                isOnline: match.isOnline,
              };
            }
            return u;
          });

          for (const s of sessions) {
            if (!s.username || s.username.startsWith('Khách #') || s.username.toLowerCase() === 'admin') continue;
            const key = s.username.toLowerCase();
            if (!currentKeys.has(key)) {
              currentKeys.add(key);
              updated = true;
              nextList.unshift({
                id: s.userId || `usr_${key}`,
                username: s.username,
                role: 'LEARNER',
                createdAt: s.startedAt || Date.now(),
                lastActiveAt: s.lastActiveAt || Date.now(),
                questionsAttempted: s.questionsAttempted || 0,
                correctCount: Math.round((s.questionsAttempted || 0) * (s.accuracyPercent || 0) / 100),
                accuracyPercent: s.accuracyPercent || 0,
                notesCount: 0,
                examsTaken: 0,
                ipAddress: s.ipAddress,
                deviceType: s.deviceType,
                os: s.os,
                browser: s.browser,
                currentScreen: s.currentScreen,
                currentAction: s.currentAction,
                isOnline: true,
              });
            }
          }
          return updated ? [...nextList] : nextList;
        });
      }
    } catch (err) {
      console.error('Lỗi tải live sessions:', err);
    }
  }, []);

  // Fetch Overview
  const fetchOverview = useCallback(async (options?: { silent?: boolean }) => {
    if (!options?.silent) setLoadingOverview(true);
    try {
      await syncLocalLearners();
      const data = await adminApi.getOverview();
      setOverview(data);
    } catch (err) {
      console.error('Lỗi tải overview:', err);
    } finally {
      if (!options?.silent) setLoadingOverview(false);
    }
  }, [syncLocalLearners]);

  // Fetch Learners
  const fetchLearners = useCallback(async (options?: { silent?: boolean }) => {
    if (!options?.silent) {
      setLoadingLearners(true);
    } else {
      setIsSilentRefreshing(true);
    }
    try {
      await syncLocalLearners();
      const res = await adminApi.getUsers({
        search: userSearch,
        role: userRoleFilter,
        page: 1,
        limit: 50,
      });
      const serverUsers = res.users || [];

      // Combine with any online active learners from liveSessions state to ensure instant consistency
      setUsersList((prev) => {
        const existingKeys = new Set(serverUsers.map((u: any) => u.username.toLowerCase()));
        const missingActive: any[] = [];
        for (const u of prev) {
          if (!u.username || u.username.startsWith('Khách #') || u.username.toLowerCase() === 'admin') continue;
          const key = u.username.toLowerCase();
          if (!existingKeys.has(key)) {
            existingKeys.add(key);
            missingActive.push(u);
          }
        }
        return missingActive.length > 0 ? [...missingActive, ...serverUsers] : serverUsers;
      });
      setUsersTotal(Math.max(res.total || 0, (res.users || []).length));
      setLastRefreshedAt(Date.now());
    } catch (err) {
      console.error('Lỗi tải danh sách người học:', err);
    } finally {
      setLoadingLearners(false);
      setIsSilentRefreshing(false);
    }
  }, [userSearch, userRoleFilter, syncLocalLearners]);

  // Fetch Moderation Queue
  const fetchModerationQueue = useCallback(async () => {
    setLoadingModeration(true);
    try {
      const res = await adminApi.getReviewQueue();
      setPendingQuestions(res.pendingQuestions || []);
    } catch (err) {
      console.error('Lỗi tải hàng đợi duyệt câu hỏi:', err);
    } finally {
      setLoadingModeration(false);
    }
  }, []);

  // Fetch Sources
  const fetchSources = useCallback(async () => {
    try {
      const res = await adminApi.getSources();
      setSources(res.sources || []);
    } catch (err) {
      console.error('Lỗi tải nguồn câu hỏi:', err);
    }
  }, []);

  // Fetch Feedbacks
  const fetchFeedbacks = useCallback(async () => {
    setLoadingFeedback(true);
    try {
      const res = await adminApi.getFeedbacks({
        status: feedbackStatusFilter,
        limit: 50,
      });
      setFeedbacks(res.items || []);
    } catch (err) {
      console.error('Lỗi tải phản hồi:', err);
    } finally {
      setLoadingFeedback(false);
    }
  }, [feedbackStatusFilter]);

  // Fetch Audit Logs
  const fetchAuditLogs = useCallback(async () => {
    setLoadingAudit(true);
    try {
      const res = await adminApi.getAuditLogs();
      setAuditLogs(res.logs || []);
    } catch (err) {
      console.error('Lỗi tải audit log:', err);
    } finally {
      setLoadingAudit(false);
    }
  }, []);

  // AI Tutor & Knowledge Base Analytics Fetch
  const fetchAIAnalytics = useCallback(async () => {
    setLoadingAI(true);
    try {
      const data = await adminApi.getAIAnalytics();
      setAiMetrics(data);
    } catch (err) {
      console.error('Lỗi tải thống kê AI:', err);
    } finally {
      setLoadingAI(false);
    }
  }, []);

  // Learning Behavior Analytics Fetch
  const fetchLearningBehavior = useCallback(async (targetUserId?: string) => {
    setLoadingLearningBehavior(true);
    try {
      const idToQuery = targetUserId !== undefined ? targetUserId : selectedBehaviorLearnerId;
      const data = await adminApi.getLearningBehavior(idToQuery !== 'ALL' ? idToQuery : undefined);
      setLearningBehavior(data);
    } catch (err) {
      console.error('Lỗi tải thống kê hành vi học tập:', err);
    } finally {
      setLoadingLearningBehavior(false);
    }
  }, [selectedBehaviorLearnerId]);

  const handleSelectBehaviorLearner = useCallback((userId: string) => {
    setSelectedBehaviorLearnerId(userId);
    void fetchLearningBehavior(userId);
  }, [fetchLearningBehavior]);

  // AI Queries Log Fetch with Local Storage Conversations Merge
  const fetchAIQueries = useCallback(async (search = '', mode = 'ALL') => {
    setLoadingAiQueries(true);
    try {
      const res = await adminApi.getAIQueries({
        limit: 50,
        search: search.trim() || undefined,
        mode: mode !== 'ALL' ? mode : undefined,
      });

      const serverQueries = res.queries || [];
      const localQueries = exportLocalConversationsAsQueries();

      // If server has no queries or few queries, sync local queries to server
      if (serverQueries.length === 0 && localQueries.length > 0) {
        void aiApi.syncBatchQueries(localQueries).catch(() => {});
      }

      // Merge server queries with local queries so user never sees empty data
      const existingIds = new Set(serverQueries.map(q => q.id));
      const merged = [...serverQueries];
      for (const lq of localQueries) {
        if (!existingIds.has(lq.id)) {
          // Check search term filter
          const term = search.trim().toLowerCase();
          const matchesSearch = !term || (
            lq.prompt.toLowerCase().includes(term) ||
            lq.username.toLowerCase().includes(term) ||
            (lq.response && lq.response.toLowerCase().includes(term))
          );
          const matchesMode = mode === 'ALL' || lq.mode === mode;
          if (matchesSearch && matchesMode) {
            merged.push({
              ...lq,
              ipAddress: lq.ipAddress ?? null,
            });
            existingIds.add(lq.id);
          }
        }
      }

      merged.sort((a, b) => b.createdAt - a.createdAt);

      setAiQueriesList(merged);
      setAiQueriesTotal(Math.max(res.total || 0, merged.length));
    } catch (err) {
      console.error('Lỗi tải nhật ký câu hỏi AI:', err);
      // Fallback directly to local queries
      const localQueries = exportLocalConversationsAsQueries();
      setAiQueriesList(localQueries.map(lq => ({ ...lq, ipAddress: lq.ipAddress ?? null })));
      setAiQueriesTotal(localQueries.length);
    } finally {
      setLoadingAiQueries(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    const loadTab = async () => {
      if (!active) return;
      if (activeTab === 'overview') {
        await fetchOverview();
        await fetchLiveSessions();
      } else if (activeTab === 'learners') {
        await fetchLearners();
        await fetchLiveSessions();
        await fetchLearningBehavior();
      } else if (activeTab === 'moderation') {
        await fetchModerationQueue();
      } else if (activeTab === 'sources') {
        await fetchSources();
      } else if (activeTab === 'feedback') {
        await fetchFeedbacks();
      } else if (activeTab === 'ai') {
        await fetchAIAnalytics();
        await fetchAIQueries(aiQuerySearch, aiQueryModeFilter);
      } else if (activeTab === 'audit') {
        await fetchAuditLogs();
      }
    };
    void loadTab();
    return () => {
      active = false;
    };
  }, [
    activeTab,
    fetchOverview,
    fetchLiveSessions,
    fetchLearners,
    fetchLearningBehavior,
    fetchModerationQueue,
    fetchSources,
    fetchFeedbacks,
    fetchAIAnalytics,
    fetchAIQueries,
    aiQuerySearch,
    aiQueryModeFilter,
    fetchAuditLogs,
  ]);

  // Real-time Socket Subscriptions (No polling, zero screen reloads)
  useEffect(() => {
    // 1. Connection status change
    const unsubStatus = realtimeManager.onStatusChange((connected) => {
      setIsRealtimeConnected(connected);
    });

    // 2. Incoming AI queries & answers in realtime
    const unsubAIQuery = realtimeManager.subscribe('ai_query', (newRecord: any) => {
      if (!newRecord) return;
      setAiQueriesList((prev) => {
        const filtered = prev.filter((q) => q.id !== newRecord.id);
        return [newRecord, ...filtered];
      });
      setAiQueriesTotal((prev) => prev + 1);
      setHighlightedQueryId(newRecord.id);
      setTimeout(() => setHighlightedQueryId(null), 4000);

      // Also update metrics total queries
      setAiMetrics((prev: any) => {
        if (!prev) return prev;
        const currentQueries = prev.queriesAnalytics?.totalQueries ?? 0;
        return {
          ...prev,
          queriesAnalytics: {
            ...prev.queriesAnalytics,
            totalQueries: currentQueries + 1,
            recentQueries: [newRecord, ...(prev.queriesAnalytics?.recentQueries || []).slice(0, 24)],
          },
        };
      });
    });

    // 3. Batch sync events
    const unsubSync = realtimeManager.subscribe('ai_queries_synced', () => {
      void fetchAIQueries(aiQuerySearch, aiQueryModeFilter);
      void fetchAIAnalytics();
    });

    // 4. Realtime feedback
    const unsubFeedback = realtimeManager.subscribe('ai_feedback', () => {
      void fetchAIAnalytics();
    });

    // 5. Live session heartbeats
    const unsubSession = realtimeManager.subscribe('session_heartbeat', (data: any) => {
      void fetchLiveSessions();
      if (data?.session?.username && !data.session.username.startsWith('Khách #') && data.session.username.toLowerCase() !== 'admin') {
        void fetchLearners({ silent: true });
      }
    });

    // 6. Realtime new learner registration
    const unsubLearnerRegistered = realtimeManager.subscribe('learner_registered', (data: any) => {
      const newLearner = data?.learner;
      if (!newLearner || !newLearner.username || newLearner.username.toLowerCase() === 'admin') return;

      setUsersList((prev) => {
        const key = newLearner.username.toLowerCase();
        const exists = prev.some((u) => u.username.toLowerCase() === key);
        if (exists) {
          return prev.map((u) => u.username.toLowerCase() === key
            ? { ...u, lastActiveAt: newLearner.lastActiveAt || Date.now() }
            : u
          );
        }
        return [{
          id: newLearner.id,
          username: newLearner.username,
          role: 'LEARNER',
          createdAt: newLearner.createdAt || Date.now(),
          lastActiveAt: newLearner.lastActiveAt || Date.now(),
          questionsAttempted: newLearner.questionsAttempted || 0,
          correctCount: newLearner.correctCount || 0,
          accuracyPercent: newLearner.accuracyPercent || 0,
          notesCount: 0,
          examsTaken: 0,
        }, ...prev];
      });
      setUsersTotal((prev) => prev + 1);
      void fetchOverview({ silent: true });
    });

    return () => {
      unsubStatus();
      unsubAIQuery();
      unsubSync();
      unsubFeedback();
      unsubSession();
      unsubLearnerRegistered();
    };
  }, [fetchAIQueries, fetchAIAnalytics, fetchLiveSessions, fetchLearners, fetchOverview, aiQuerySearch, aiQueryModeFilter]);

  // Inspect Learner Detail
  const handleInspectLearner = async (userId: string) => {
    setLoadingDetail(true);
    try {
      const detail = await adminApi.getUserAnalytics(userId);
      setSelectedLearnerDetail(detail);
    } catch (err: any) {
      alert('Không thể tải phân tích chi tiết: ' + err.message);
    } finally {
      setLoadingDetail(false);
    }
  };

  // Moderation: Approve
  const handleApproveQuestion = async (id: number) => {
    if (!confirm('Bạn có chắc chắn muốn phê duyệt câu hỏi này vào ngân hàng câu hỏi công khai?')) return;
    try {
      await adminApi.approveQuestion(id);
      fetchModerationQueue();
      fetchOverview();
    } catch (err: any) {
      alert('Lỗi phê duyệt: ' + err.message);
    }
  };

  // Moderation: Reject
  const handleConfirmReject = async () => {
    if (!rejectModalQuestion) return;
    try {
      await adminApi.rejectQuestion(rejectModalQuestion.id, rejectionReason.trim());
      setRejectModalQuestion(null);
      setRejectionReason('');
      fetchModerationQueue();
      fetchOverview();
    } catch (err: any) {
      alert('Lỗi từ chối: ' + err.message);
    }
  };

  // Feedback: Reply & Status
  const handleSendFeedbackReply = async () => {
    if (!replyingFeedback) return;
    try {
      await adminApi.updateFeedback(replyingFeedback.id, {
        status: adminReplyStatus,
        adminResponse: adminReplyText.trim(),
      });
      setReplyingFeedback(null);
      setAdminReplyText('');
      fetchFeedbacks();
      fetchOverview();
    } catch (err: any) {
      alert('Lỗi cập nhật phản hồi: ' + err.message);
    }
  };

  // JSON Importer
  const handleImportJson = async () => {
    setImportStatus(null);
    if (!jsonImportText.trim()) {
      setImportStatus({ type: 'error', message: 'Vui lòng dán dữ liệu JSON câu hỏi.' });
      return;
    }

    try {
      const parsed = JSON.parse(jsonImportText);
      setIsImporting(true);
      const res = await adminApi.importQuestions(importSourceName.trim() || 'JSON Import', parsed);
      setImportStatus({
        type: 'success',
        message: `Đã nhập thành công ${res.importedCount} câu hỏi mới!`,
      });
      setJsonImportText('');
      fetchSources();
      fetchOverview();
    } catch (err: any) {
      setImportStatus({
        type: 'error',
        message: `Lỗi định dạng JSON hoặc dữ liệu không hợp lệ: ${err.message}`,
      });
    } finally {
      setIsImporting(false);
    }
  };

  const loadSampleJson = () => {
    const sample = [
      {
        text: 'Một công ty cần thiết kế giải pháp phân tích dữ liệu gần thời gian thực với Amazon Kinesis Data Streams. Dịch vụ nào nên được dùng để xử lý dữ liệu với SQL chuẩn?',
        choices: {
          A: 'Amazon Managed Service for Apache Flink',
          B: 'Amazon QuickSight',
          C: 'AWS Glue DataBrew',
          D: 'Amazon OpenSearch Serverless',
        },
        answer: 'A',
        explanation: 'Amazon Managed Service for Apache Flink cho phép xử lý và phân tích dữ liệu streaming trực tiếp với SQL chuẩn.',
        domain: 'Domain 3: Design High-Performing Architectures',
        difficulty: 'Medium',
        topic: 'Analytics',
        serviceTags: ['Kinesis', 'Apache Flink'],
      },
    ];
    setJsonImportText(JSON.stringify(sample, null, 2));
  };

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 dark:bg-slate-950 dark:text-slate-100 transition-colors">
      {/* Top Banner */}
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur-md dark:border-slate-800 dark:bg-slate-900/95">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-amber-500 to-orange-600 text-white shadow-md">
              <Shield className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-lg font-black tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
                Bảng Quản Trị Hệ Thống <span className="rounded-md bg-amber-500/10 px-2 py-0.5 text-xs font-bold text-amber-600 dark:text-amber-400">ADMIN PORTAL</span>
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Theo dõi người học, hành vi, kiểm duyệt câu hỏi & phản hồi
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className={`hidden sm:inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold shadow-2xs border ${
              isRealtimeConnected
                ? 'border-emerald-500/40 bg-emerald-50 text-emerald-700 dark:border-emerald-800/60 dark:bg-emerald-950/40 dark:text-emerald-300'
                : 'border-amber-500/40 bg-amber-50 text-amber-700 dark:border-amber-800/60 dark:bg-amber-950/40 dark:text-amber-300'
            }`}>
              <span className="relative flex h-2 w-2">
                {isRealtimeConnected && (
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                )}
                <span className={`relative inline-flex rounded-full h-2 w-2 ${isRealtimeConnected ? 'bg-emerald-500' : 'bg-amber-500'}`}></span>
              </span>
              <span>{isRealtimeConnected ? 'Socket Realtime (Trực tiếp)' : 'Socket (Đang kết nối lại)'}</span>
            </div>

            {/* Theme Switcher */}
            <button
              type="button"
              onClick={toggleTheme}
              title={theme === 'dark' ? 'Chuyển sang giao diện Sáng' : 'Chuyển sang giao diện Tối'}
              aria-label={theme === 'dark' ? 'Chuyển sang giao diện Sáng' : 'Chuyển sang giao diện Tối'}
              className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-300 bg-white text-slate-700 shadow-2xs hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 transition-colors"
            >
              {theme === 'dark' ? <Sun className="h-4 w-4 text-amber-400" /> : <Moon className="h-4 w-4 text-indigo-600" />}
            </button>

            <button
              type="button"
              onClick={onBackToApp}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-bold text-slate-700 shadow-sm hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 transition-all"
            >
              <BookOpen className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              <span>Quay Lại Ôn Thi</span>
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="mx-auto flex max-w-7xl overflow-x-auto px-4 sm:px-6 border-t border-slate-100 dark:border-slate-800/80">
          {[
            { id: 'overview', label: 'Tổng Quan', icon: TrendingUp, badge: null },
            { id: 'learners', label: 'Người Học & Thói Quen', icon: Users, badge: usersTotal || null },
            {
              id: 'moderation',
              label: 'Duyệt Câu Hỏi',
              icon: FileCheck,
              badge: pendingQuestions.length || null,
              badgeColor: 'bg-amber-500 text-white',
            },
            { id: 'sources', label: 'Nguồn & Nhập JSON', icon: Upload, badge: null },
            {
              id: 'feedback',
              label: 'Hộp Thư Góp Ý',
              icon: MessageSquare,
              badge: overview?.pendingFeedback || null,
              badgeColor: 'bg-blue-600 text-white',
            },
            {
              id: 'ai',
              label: 'AI Tutor & Tri Thức',
              icon: Bot,
              badge: aiMetrics?.totalFeedback || null,
              badgeColor: 'bg-purple-600 text-white',
            },
            { id: 'audit', label: 'Nhật Ký Hoạt Động', icon: Shield, badge: null },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-2 whitespace-nowrap border-b-2 px-4 py-3 text-xs font-bold transition-all ${
                  isActive
                    ? 'border-amber-500 text-amber-600 dark:border-amber-400 dark:text-amber-400'
                    : 'border-transparent text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
                }`}
              >
                <Icon className="h-4 w-4" />
                <span>{tab.label}</span>
                {tab.badge !== null && tab.badge > 0 && (
                  <span
                    className={`rounded-full px-1.5 py-0.2 text-[10px] font-bold ${
                      tab.badgeColor || 'bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                    }`}
                  >
                    {tab.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
        {/* =========================================================================
            TAB 1: TỔNG QUAN (OVERVIEW)
            ========================================================================= */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">Chỉ Số Tổng Quan Hệ Thống</h2>
              <button
                type="button"
                onClick={() => {
                  void fetchOverview();
                  void fetchLiveSessions();
                }}
                disabled={loadingOverview}
                className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-200 dark:text-slate-400 dark:hover:bg-slate-800 transition-colors"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${loadingOverview ? 'animate-spin' : ''}`} />
                <span>Làm mới</span>
              </button>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Tổng Học Viên</span>
                <p className="mt-2 text-3xl font-black text-slate-900 dark:text-white">
                  {overview?.totalLearners ?? 0}
                </p>
                <span className="mt-1 block text-[11px] text-emerald-600 dark:text-emerald-400">
                  +{overview?.newLearners ?? 0} mới trong 30 ngày
                </span>
              </div>

              <div className="rounded-2xl border border-emerald-200 bg-emerald-50/40 p-5 shadow-sm dark:border-emerald-900/50 dark:bg-emerald-950/20">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-300">Đang Online Realtime</span>
                  <span className="relative flex h-2.5 w-2.5">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
                  </span>
                </div>
                <p className="mt-2 text-3xl font-black text-emerald-600 dark:text-emerald-400">
                  {overview?.onlineLearners ?? liveSessionsOnlineCount}
                </p>
                <span className="mt-1 block text-[11px] font-medium text-emerald-700 dark:text-emerald-300">
                  {overview?.liveSessionsCount ?? liveSessionsActiveCount} phiên đang theo dõi
                </span>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Đang Hoạt Động (7 ngày)</span>
                <p className="mt-2 text-3xl font-black text-blue-600 dark:text-blue-400">
                  {overview?.activeLearners ?? 0}
                </p>
                <span className="mt-1 block text-[11px] text-slate-500 dark:text-slate-400">
                  {overview?.totalSessions ?? 0} lượt truy cập phiên
                </span>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Lượt Làm Câu Hỏi</span>
                <p className="mt-2 text-3xl font-black text-slate-900 dark:text-white">
                  {overview?.totalAttempts ?? 0}
                </p>
                <span className="mt-1 block text-[11px] text-slate-500 dark:text-slate-400">
                  Tỷ lệ đúng: <strong className="text-emerald-600 dark:text-emerald-400">{overview?.accuracyRate ?? 0}%</strong>
                </span>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 col-span-2 sm:col-span-1">
                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Chờ Quản Trị Xử Lý</span>
                <p className="mt-2 text-3xl font-black text-amber-600 dark:text-amber-400">
                  {(overview?.pendingQuestions ?? 0) + (overview?.pendingFeedback ?? 0)}
                </p>
                <span className="mt-1 block text-[11px] text-slate-500 dark:text-slate-400">
                  {overview?.pendingQuestions ?? 0} câu hỏi &bull; {overview?.pendingFeedback ?? 0} phản hồi
                </span>
              </div>
            </div>

            {/* Performance analysis & Weak topics */}
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                <h3 className="text-base font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                  <Flame className="h-5 w-5 text-orange-500" />
                  <span>Chủ Đề Còn Yếu Của Học Viên</span>
                </h3>
                <div className="space-y-4">
                  {(overview?.weakTopics || []).map((topicItem: any, idx: number) => (
                    <div key={idx} className="space-y-1.5">
                      <div className="flex justify-between text-xs font-semibold">
                        <span className="text-slate-700 dark:text-slate-300">{topicItem.topic}</span>
                        <span className="text-slate-500 dark:text-slate-400">
                          {topicItem.accuracyPercent}% đúng ({topicItem.attempts} lượt)
                        </span>
                      </div>
                      <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                        <div
                          className={`h-full rounded-full ${
                            topicItem.accuracyPercent < 50
                              ? 'bg-red-500'
                              : topicItem.accuracyPercent < 65
                              ? 'bg-amber-500'
                              : 'bg-emerald-500'
                          }`}
                          style={{ width: `${topicItem.accuracyPercent}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                <h3 className="text-base font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-red-500" />
                  <span>Các Câu Hỏi Bị Sai Nhiều Nhất</span>
                </h3>
                <div className="space-y-3">
                  {(overview?.topIncorrectQuestions || []).length === 0 ? (
                    <p className="text-xs text-slate-500 dark:text-slate-400 italic">
                      Chưa có đủ dữ liệu câu hỏi sai.
                    </p>
                  ) : (
                    (overview?.topIncorrectQuestions || []).map((item: any, idx: number) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50 p-3 text-xs dark:border-slate-800 dark:bg-slate-800/40"
                      >
                        <div className="flex items-center gap-2.5">
                          <span className="flex h-6 w-6 items-center justify-center rounded-md bg-red-100 font-bold text-red-700 dark:bg-red-950/60 dark:text-red-300">
                            #{item.questionId}
                          </span>
                          <span className="font-medium text-slate-800 dark:text-slate-200">
                            Câu hỏi #{item.questionId}
                          </span>
                        </div>
                        <div className="text-right">
                          <span className="font-bold text-red-600 dark:text-red-400">{item.errorCount} lần sai</span>
                          <span className="block text-[10px] text-slate-400">
                            {item.accuracyPercent}% chính xác
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            {/* Recent Active Learners Section (Live Overview) */}
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Users className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    Học Viên Hoạt Động & Làm Bài Gần Đây
                  </h3>
                  <span className="flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    Trực tiếp
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveTab('learners')}
                  className="text-xs font-semibold text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 transition-colors"
                >
                  Xem toàn bộ học viên ({overview?.totalLearners ?? 0}) →
                </button>
              </div>

              {(overview?.recentLearners || []).length === 0 ? (
                <p className="text-xs text-slate-500 dark:text-slate-400 italic">
                  Chưa có học viên nào hoạt động gần đây.
                </p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {(overview?.recentLearners || []).map((learner: any) => (
                    <div
                      key={learner.id}
                      className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50/70 p-3.5 dark:border-slate-800 dark:bg-slate-800/40 hover:border-blue-300 dark:hover:border-blue-700 transition-all"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-xs font-black text-white uppercase shadow-sm">
                          {learner.username[0]}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="truncate text-xs font-bold text-slate-900 dark:text-white">
                              {learner.username}
                            </span>
                            <span className="rounded bg-blue-100 px-1.5 py-0.2 text-[9px] font-bold text-blue-800 dark:bg-blue-950/60 dark:text-blue-300">
                              Học viên
                            </span>
                          </div>
                          <div className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
                            {learner.questionsAttempted} câu ({learner.accuracyPercent}% đúng) &bull; {learner.notesCount} ghi chú
                          </div>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleInspectLearner(learner.id)}
                        disabled={loadingDetail}
                        className="shrink-0 rounded-lg bg-blue-50 px-2 py-1 text-[11px] font-semibold text-blue-600 hover:bg-blue-100 dark:bg-blue-950/60 dark:text-blue-400 dark:hover:bg-blue-900/60 transition-colors disabled:opacity-50"
                      >
                        Chi tiết →
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* =========================================================================
            TAB 2: NGƯỜI HỌC & THÓI QUEN (LEARNERS & ANALYTICS DEEP DIVE)
            ========================================================================= */}
        {activeTab === 'learners' && (
          <div className="space-y-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <span>Quản Lý & Phân Tích Người Học</span>
                  {isSilentRefreshing && (
                    <span className="flex items-center gap-1 rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-semibold text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 animate-pulse">
                      <RefreshCw className="h-2.5 w-2.5 animate-spin" />
                      Đang đồng bộ ngầm...
                    </span>
                  )}
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Theo dõi IP, thiết bị truy cập, hành động realtime trên màn hình và thói quen học tập
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                <div className="relative">
                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                  <input
                    type="text"
                    value={userSearch}
                    onChange={(e) => setUserSearch(e.target.value)}
                    placeholder="Tìm theo tên học viên..."
                    className="rounded-xl border border-slate-300 bg-white py-2 pl-9 pr-4 text-xs text-slate-900 focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                  />
                </div>

                <select
                  value={userRoleFilter}
                  onChange={(e) => setUserRoleFilter(e.target.value)}
                  className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                >
                  <option value="ALL">Tất cả vai trò</option>
                  <option value="LEARNER">Học viên (Learner)</option>
                  <option value="ADMIN">Quản trị (Admin)</option>
                </select>

                <button
                  type="button"
                  title="Làm mới danh sách học viên & phiên trực tiếp"
                  onClick={() => {
                    void fetchLearners({ silent: false });
                    void fetchLiveSessions();
                  }}
                  disabled={loadingLearners || isSilentRefreshing}
                  className="flex items-center gap-1.5 rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-700 hover:bg-blue-100 active:scale-95 transition-all dark:border-blue-900/50 dark:bg-blue-950/50 dark:text-blue-300 dark:hover:bg-blue-900/70 disabled:opacity-50"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${loadingLearners || isSilentRefreshing ? 'animate-spin' : ''}`} />
                  <span>Làm mới</span>
                </button>

                <button
                  type="button"
                  title="Đồng bộ tài khoản học viên từ trình duyệt"
                  onClick={async () => {
                    setLoadingLearners(true);
                    try {
                      await syncLocalLearners();
                      await fetchLearners();
                      await fetchLiveSessions();
                    } finally {
                      setLoadingLearners(false);
                    }
                  }}
                  className="flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 active:scale-95 transition-all dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Đồng bộ học viên</span>
                </button>
              </div>
            </div>

            {/* =========================================================================
                REALTIME TRACKER: PHIÊN HOẠT ĐỘNG TRỰC TIẾP & THIẾT BỊ HỌC VIÊN / KHÁCH
                ========================================================================= */}
            <div className="rounded-2xl border border-blue-200 bg-linear-to-br from-blue-50/70 via-white to-indigo-50/40 p-5 shadow-xs dark:border-blue-900/50 dark:from-slate-900 dark:via-slate-900 dark:to-blue-950/20">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
                <div className="flex items-center gap-2.5">
                  <div className="relative flex h-3 w-3 items-center justify-center">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                      <span>Theo Dõi Màn Hình & Thiết Bị Realtime</span>
                      <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-[11px] font-bold text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                        {liveSessionsOnlineCount} người đang Online
                      </span>
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Ghi nhận địa chỉ IP, hệ điều hành, trình duyệt và hành động thời gian thực trên màn hình học viên & khách
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-slate-500 dark:text-slate-400">
                    Cập nhật lúc: {new Date(lastRefreshedAt).toLocaleTimeString('vi-VN')}
                  </span>
                </div>
              </div>

              {/* Live Sessions Cards */}
              {liveSessions.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-300 bg-white/60 p-6 text-center text-xs text-slate-500 dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-400">
                  Chưa có phiên học trực tiếp nào được ghi nhận trong 15 phút qua. Khi có người học truy cập và làm câu hỏi, thông tin IP, máy và hành động realtime sẽ xuất hiện ngay tại đây.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {liveSessions.map((s) => (
                    <div
                      key={s.sessionId}
                      className={`relative rounded-xl border p-3.5 transition-all shadow-xs ${
                        s.isOnline
                          ? 'border-emerald-300/80 bg-white dark:border-emerald-700/60 dark:bg-slate-900'
                          : 'border-slate-200 bg-slate-50/80 dark:border-slate-800 dark:bg-slate-900/40'
                      }`}
                    >
                      {/* Header with Username & Online Pulse */}
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <span
                            className={`inline-block h-2.5 w-2.5 rounded-full shrink-0 ${
                              s.isOnline
                                ? 'bg-emerald-500 ring-2 ring-emerald-300 dark:ring-emerald-800 animate-pulse'
                                : 'bg-slate-400'
                            }`}
                          />
                          <span className="font-bold text-xs text-slate-900 dark:text-white truncate">
                            {s.username}
                          </span>
                          {s.username.toLowerCase() === 'admin' || (s as any).role === 'ADMIN' ? (
                            <span className="rounded bg-purple-100 px-1.5 py-0.2 text-[9px] font-bold text-purple-700 dark:bg-purple-950/80 dark:text-purple-300 border border-purple-200 dark:border-purple-800/60 shrink-0 flex items-center gap-0.5">
                              🛡️ Quản trị viên
                            </span>
                          ) : s.userId ? (
                            <span className="rounded bg-blue-100 px-1.5 py-0.2 text-[9px] font-semibold text-blue-700 dark:bg-blue-950/80 dark:text-blue-300 shrink-0">
                              Học viên
                            </span>
                          ) : (
                            <span className="rounded bg-slate-100 px-1.5 py-0.2 text-[9px] font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-400 shrink-0">
                              Khách vãng lai
                            </span>
                          )}
                        </div>

                        <span className="text-[10px] font-medium text-slate-400 shrink-0">
                          {formatTimeAgo(s.lastActiveAt)}
                        </span>
                      </div>

                      {/* Realtime Screen & Action */}
                      <div className="rounded-lg bg-blue-50/70 border border-blue-100 px-2.5 py-2 mb-2.5 dark:bg-blue-950/30 dark:border-blue-900/40">
                        <div className="text-[10px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider mb-0.5 flex items-center gap-1">
                          <Monitor className="h-3 w-3" />
                          <span>{s.currentScreen}</span>
                        </div>
                        <div className="text-xs font-semibold text-slate-800 dark:text-slate-200 break-words">
                          {s.currentAction}
                        </div>
                      </div>

                      {/* Machine & IP Details */}
                      <div className="space-y-1.5 text-[11px] text-slate-600 dark:text-slate-300">
                        <div className="flex items-center justify-between">
                          <span className="text-slate-400 flex items-center gap-1">
                            <Globe className="h-3 w-3 text-slate-400" />
                            <span>Địa chỉ IP:</span>
                          </span>
                          <code className="font-mono font-bold text-slate-800 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded text-[10px]">
                            {s.ipAddress}
                          </code>
                        </div>

                        <div className="flex items-center justify-between">
                          <span className="text-slate-400 flex items-center gap-1">
                            {s.deviceType === 'Mobile' ? (
                              <Smartphone className="h-3 w-3" />
                            ) : (
                              <Laptop className="h-3 w-3" />
                            )}
                            <span>Thiết bị máy:</span>
                          </span>
                          <span className="font-medium text-slate-800 dark:text-slate-200">
                            {s.os} &bull; {s.browser}
                          </span>
                        </div>

                        {s.username.toLowerCase() === 'admin' || (s as any).role === 'ADMIN' ? (
                          <div className="flex items-center justify-between pt-1 border-t border-slate-100 dark:border-slate-800 text-[10px]">
                            <span className="text-slate-400">Trạng thái:</span>
                            <span className="font-bold text-purple-600 dark:text-purple-400">
                              Quản Trị Hệ Thống
                            </span>
                          </div>
                        ) : s.questionsAttempted > 0 ? (
                          <div className="flex items-center justify-between pt-1 border-t border-slate-100 dark:border-slate-800">
                            <span className="text-slate-400">Tiến độ hiện tại:</span>
                            <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                              {s.questionsAttempted} câu ({s.accuracyPercent}% đúng)
                            </span>
                          </div>
                        ) : null}

                        {/* UltraView Live Screen Mirror Button */}
                        <button
                          type="button"
                          onClick={() => setViewingUltraViewSession(s)}
                          className="mt-2.5 flex items-center justify-center gap-1.5 w-full rounded-lg border border-blue-300/80 bg-blue-50/80 px-2.5 py-1.5 text-xs font-bold text-blue-700 hover:bg-blue-100 dark:border-blue-800 dark:bg-blue-950/60 dark:text-blue-300 dark:hover:bg-blue-900/80 transition-all shadow-xs active:scale-98"
                        >
                          <Monitor className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                          <span>Xem Màn Hình (UltraView)</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* =========================================================================
                PHÂN TÍCH CHUYÊN SÂU HÀNH VI HỌC TẬP (LEARNING BEHAVIOR ANALYTICS)
                ========================================================================= */}
            <div id="learning-behavior-section" className="scroll-mt-20 rounded-2xl border border-slate-200 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900 space-y-5">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 border-b border-slate-100 pb-4 dark:border-slate-800">
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <Activity className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                    <span>Phân Tích Chuyên Sâu Hành Vi Học Tập & Thói Quen</span>
                    <span className="rounded-full bg-indigo-50 px-2.5 py-0.5 text-[11px] font-bold text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300">
                      Telemetry AI
                    </span>
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Thống kê thời gian tập trung làm bài, ma trận tự tin vs chính xác, đánh giá chuẩn bị 4 Domain SAA-C03 và thiết bị học
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <div className="relative">
                    <select
                      value={selectedBehaviorLearnerId}
                      onChange={(e) => handleSelectBehaviorLearner(e.target.value)}
                      className="h-8 rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs font-semibold text-slate-800 shadow-2xs hover:border-slate-400 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 cursor-pointer focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    >
                      <option value="ALL">🌐 Toàn Hệ Thống (Tất cả học viên)</option>
                      {usersList.map((u) => (
                        <option key={u.id} value={u.id}>
                          👤 {u.username} ({u.questionsAttempted} câu - {u.accuracyPercent}%)
                        </option>
                      ))}
                    </select>
                  </div>

                  {selectedBehaviorLearnerId !== 'ALL' && (
                    <button
                      type="button"
                      onClick={() => handleSelectBehaviorLearner('ALL')}
                      className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-100 px-2 py-1 text-[11px] font-semibold text-slate-600 hover:bg-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 transition-colors"
                      title="Quay lại phân tích toàn bộ học viên"
                    >
                      ✕ Xem toàn hệ thống
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => void fetchLearningBehavior()}
                    disabled={loadingLearningBehavior}
                    className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 transition-colors"
                  >
                    <RefreshCw className={`h-3.5 w-3.5 ${loadingLearningBehavior ? 'animate-spin' : ''}`} />
                    <span className="hidden sm:inline">Làm mới</span>
                  </button>
                </div>
              </div>

              {/* Personal Learner Active Filter Banner */}
              {selectedBehaviorLearnerId !== 'ALL' && learningBehavior?.learner && (
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-indigo-200/80 bg-indigo-50/70 p-3.5 dark:border-indigo-900/60 dark:bg-indigo-950/30">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-600 text-white font-bold text-sm shadow-xs">
                      {learningBehavior.learner.username[0]?.toUpperCase() || 'U'}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-slate-900 dark:text-white">
                          Đang phân tích cá nhân: {learningBehavior.learner.username}
                        </span>
                        <span className="rounded bg-indigo-100 px-1.5 py-0.5 text-[10px] font-semibold text-indigo-700 dark:bg-indigo-900/60 dark:text-indigo-300">
                          {learningBehavior.learner.role}
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5">
                        Tổng câu đã làm: <strong className="font-semibold text-slate-900 dark:text-white">{learningBehavior.learner.questionsAttempted} câu</strong> • Tỷ lệ đúng: <strong className="font-semibold text-emerald-600 dark:text-emerald-400">{learningBehavior.learner.accuracyPercent}% đúng</strong>
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleSelectBehaviorLearner('ALL')}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-300 bg-white px-3 py-1 text-xs font-semibold text-indigo-700 shadow-2xs hover:bg-indigo-50 dark:border-indigo-800 dark:bg-slate-800 dark:text-indigo-300 dark:hover:bg-slate-700 transition-colors"
                  >
                    <span>Quay về toàn hệ thống</span>
                  </button>
                </div>
              )}

              {loadingLearningBehavior && !learningBehavior ? (
                <div className="py-8 text-center text-xs text-slate-400">
                  <div className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent mb-2" />
                  <p>Đang tổng hợp dữ liệu hành vi người dùng...</p>
                </div>
              ) : learningBehavior ? (
                <div className="space-y-5">
                  {/* Grid 1: Study Time & Confidence Matrix */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                    {/* Card 1: Khung Giờ Học Tập & 24h Distribution */}
                    <div className="rounded-xl border border-slate-200/80 bg-slate-50/80 p-4 dark:border-slate-800/80 dark:bg-slate-800/40">
                      <div className="flex items-center justify-between mb-3">
                        <span className="font-bold text-xs uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                          <Clock className="h-4 w-4 text-amber-500" />
                          <span>Khung Giờ Học Tập Phổ Biến</span>
                        </span>
                        <span className="text-[11px] text-slate-400">24 Giờ</span>
                      </div>

                      {/* 4 Time Buckets */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
                        <div className="rounded-lg bg-white p-2.5 shadow-2xs dark:bg-slate-900 border border-slate-200/70 dark:border-slate-800">
                          <span className="text-[11px] text-slate-500 dark:text-slate-400 block">🌅 Sáng (6h-12h)</span>
                          <span className="text-base font-extrabold text-slate-900 dark:text-white mt-0.5 block">
                            {learningBehavior.studyTimeDistribution?.morning || 0}
                          </span>
                          <span className="text-[10px] text-slate-400">lượt làm bài</span>
                        </div>
                        <div className="rounded-lg bg-white p-2.5 shadow-2xs dark:bg-slate-900 border border-slate-200/70 dark:border-slate-800">
                          <span className="text-[11px] text-slate-500 dark:text-slate-400 block">☀️ Chiều (12h-18h)</span>
                          <span className="text-base font-extrabold text-slate-900 dark:text-white mt-0.5 block">
                            {learningBehavior.studyTimeDistribution?.afternoon || 0}
                          </span>
                          <span className="text-[10px] text-slate-400">lượt làm bài</span>
                        </div>
                        <div className="rounded-lg bg-white p-2.5 shadow-2xs dark:bg-slate-900 border border-slate-200/70 dark:border-slate-800">
                          <span className="text-[11px] text-slate-500 dark:text-slate-400 block">🌙 Tối (18h-24h)</span>
                          <span className="text-base font-extrabold text-indigo-600 dark:text-indigo-400 mt-0.5 block">
                            {learningBehavior.studyTimeDistribution?.evening || 0}
                          </span>
                          <span className="text-[10px] text-indigo-500/80 font-medium">Giờ cao điểm</span>
                        </div>
                        <div className="rounded-lg bg-white p-2.5 shadow-2xs dark:bg-slate-900 border border-slate-200/70 dark:border-slate-800">
                          <span className="text-[11px] text-slate-500 dark:text-slate-400 block">🦉 Đêm (0h-6h)</span>
                          <span className="text-base font-extrabold text-slate-900 dark:text-white mt-0.5 block">
                            {learningBehavior.studyTimeDistribution?.night || 0}
                          </span>
                          <span className="text-[10px] text-slate-400">luyện thi khuya</span>
                        </div>
                      </div>

                      {/* 24h Hourly Histogram */}
                      <div>
                        <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 mb-1.5">
                          <span>Mật độ luyện thi theo từng giờ (0h - 23h):</span>
                          <span>Đơn vị: lượt tương tác</span>
                        </div>
                        <div className="flex items-end gap-1 h-14 pt-2 px-1 rounded-lg bg-white dark:bg-slate-900 border border-slate-200/70 dark:border-slate-800">
                          {(() => {
                            const hourly = learningBehavior.studyTimeDistribution?.hourlyDistribution || new Array(24).fill(0);
                            const maxVal = Math.max(...hourly, 1);
                            return hourly.map((cnt: number, h: number) => {
                              const heightPct = Math.max(8, Math.round((cnt / maxVal) * 100));
                              const isPeak = cnt === maxVal && cnt > 0;
                              return (
                                <div
                                  key={h}
                                  className="flex-1 flex flex-col items-center group relative h-full justify-end"
                                  title={`Lúc ${h}h: ${cnt} lượt`}
                                >
                                  <div
                                    style={{ height: `${heightPct}%` }}
                                    className={`w-full rounded-t-xs transition-all ${
                                      isPeak
                                        ? 'bg-indigo-600 dark:bg-indigo-400'
                                        : cnt > 0
                                        ? 'bg-blue-400/80 dark:bg-blue-500/70 hover:bg-blue-500'
                                        : 'bg-slate-200 dark:bg-slate-800'
                                    }`}
                                  />
                                  {/* Tooltip on hover */}
                                  <div className="absolute -top-7 hidden group-hover:flex px-1.5 py-0.5 rounded bg-slate-900 text-[9px] text-white whitespace-nowrap z-20 shadow-md">
                                    {h}h: {cnt}
                                  </div>
                                </div>
                              );
                            });
                          })()}
                        </div>
                        <div className="flex justify-between text-[9px] text-slate-400 mt-1 px-1">
                          <span>0h</span>
                          <span>4h</span>
                          <span>8h</span>
                          <span>12h</span>
                          <span>16h</span>
                          <span>20h</span>
                          <span>23h</span>
                        </div>
                      </div>
                    </div>

                    {/* Card 2: Ma Trận Tự Tin vs Độ Chính Xác */}
                    <div className="rounded-xl border border-slate-200/80 bg-slate-50/80 p-4 dark:border-slate-800/80 dark:bg-slate-800/40 flex flex-col justify-between">
                      <div>
                        <div className="flex items-center justify-between mb-3">
                          <span className="font-bold text-xs uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                            <Target className="h-4 w-4 text-emerald-500" />
                            <span>Ma Trận Tự Tin & Điểm Mù Nguy Hiểm</span>
                          </span>
                          <span className="text-[11px] text-slate-400">Tương quan</span>
                        </div>

                        {/* Dangerous Misconceptions Alert */}
                        {learningBehavior.confidenceAnalysis?.dangerousMisconceptionsCount > 0 && (
                          <div className="mb-3 rounded-lg border border-red-200 bg-red-50/80 p-2.5 text-xs text-red-900 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-300 flex items-start gap-2">
                            <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
                            <div>
                              <span className="font-bold">
                                🚨 {learningBehavior.confidenceAnalysis.dangerousMisconceptionsCount} Sai sót nguy hiểm (Dangerous Misconceptions)
                              </span>
                              <p className="text-[11px] text-red-700 dark:text-red-300 mt-0.5">
                                Học viên chọn độ tự tin CAO nhưng lại trả lời SAI. Đây là các điểm mù kiến trúc cực kỳ dễ mất điểm trong kỳ thi thật.
                              </p>
                            </div>
                          </div>
                        )}

                        {/* Confidence Tiers Breakdown */}
                        <div className="space-y-2 text-xs">
                          {/* High */}
                          {(() => {
                            const highCorrect = learningBehavior.confidenceAnalysis?.highCorrect || 0;
                            const highIncorrect = learningBehavior.confidenceAnalysis?.highIncorrect || 0;
                            const highTotal = highCorrect + highIncorrect;
                            const highAcc = highTotal > 0 ? Math.round((highCorrect / highTotal) * 100) : 0;
                            return (
                              <div className="rounded-lg bg-white p-2.5 shadow-2xs dark:bg-slate-900 border border-slate-200/70 dark:border-slate-800">
                                <div className="flex items-center justify-between font-semibold mb-1 text-slate-800 dark:text-slate-200">
                                  <span className="flex items-center gap-1.5">
                                    <span className="h-2 w-2 rounded-full bg-emerald-500" />
                                    Tự Tin Cao (High Confidence)
                                  </span>
                                  <span className="text-emerald-600 dark:text-emerald-400 font-bold">{highAcc}% Đúng ({highCorrect}/{highTotal})</span>
                                </div>
                                <div className="h-1.5 w-full rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden flex">
                                  <div style={{ width: `${highAcc}%` }} className="bg-emerald-500 h-full" />
                                  <div style={{ width: `${100 - highAcc}%` }} className="bg-red-400 h-full" />
                                </div>
                              </div>
                            );
                          })()}

                          {/* Med */}
                          {(() => {
                            const medCorrect = learningBehavior.confidenceAnalysis?.medCorrect || 0;
                            const medIncorrect = learningBehavior.confidenceAnalysis?.medIncorrect || 0;
                            const medTotal = medCorrect + medIncorrect;
                            const medAcc = medTotal > 0 ? Math.round((medCorrect / medTotal) * 100) : 0;
                            return (
                              <div className="rounded-lg bg-white p-2.5 shadow-2xs dark:bg-slate-900 border border-slate-200/70 dark:border-slate-800">
                                <div className="flex items-center justify-between font-semibold mb-1 text-slate-800 dark:text-slate-200">
                                  <span className="flex items-center gap-1.5">
                                    <span className="h-2 w-2 rounded-full bg-amber-500" />
                                    Tự Tin Vừa (Medium Confidence)
                                  </span>
                                  <span className="text-amber-600 dark:text-amber-400 font-bold">{medAcc}% Đúng ({medCorrect}/{medTotal})</span>
                                </div>
                                <div className="h-1.5 w-full rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden flex">
                                  <div style={{ width: `${medAcc}%` }} className="bg-amber-500 h-full" />
                                  <div style={{ width: `${100 - medAcc}%` }} className="bg-slate-300 dark:bg-slate-700 h-full" />
                                </div>
                              </div>
                            );
                          })()}

                          {/* Low */}
                          {(() => {
                            const lowCorrect = learningBehavior.confidenceAnalysis?.lowCorrect || 0;
                            const lowIncorrect = learningBehavior.confidenceAnalysis?.lowIncorrect || 0;
                            const lowTotal = lowCorrect + lowIncorrect;
                            const lowAcc = lowTotal > 0 ? Math.round((lowCorrect / lowTotal) * 100) : 0;
                            return (
                              <div className="rounded-lg bg-white p-2.5 shadow-2xs dark:bg-slate-900 border border-slate-200/70 dark:border-slate-800">
                                <div className="flex items-center justify-between font-semibold mb-1 text-slate-800 dark:text-slate-200">
                                  <span className="flex items-center gap-1.5">
                                    <span className="h-2 w-2 rounded-full bg-slate-400" />
                                    Tự Tin Thấp / Chưa Chắc Chắn (Low Confidence)
                                  </span>
                                  <span className="text-slate-600 dark:text-slate-400 font-bold">{lowAcc}% Đúng ({lowCorrect}/{lowTotal})</span>
                                </div>
                                <div className="h-1.5 w-full rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden flex">
                                  <div style={{ width: `${lowAcc}%` }} className="bg-slate-400 h-full" />
                                  <div style={{ width: `${100 - lowAcc}%` }} className="bg-slate-300 dark:bg-slate-700 h-full" />
                                </div>
                              </div>
                            );
                          })()}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Grid 2: 4 Domains Breakdown & Device/Platform Habits */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                    {/* Card 3: 4 Domains AWS SAA-C03 Performance */}
                    <div className="rounded-xl border border-slate-200/80 bg-slate-50/80 p-4 dark:border-slate-800/80 dark:bg-slate-800/40">
                      <div className="flex items-center justify-between mb-3">
                        <span className="font-bold text-xs uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                          <BarChart3 className="h-4 w-4 text-blue-500" />
                          <span>Độ Chuẩn Bị 4 Domain AWS SAA-C03</span>
                        </span>
                        <span className="text-[11px] text-slate-400">Trọng số đề thi</span>
                      </div>

                      <div className="space-y-3">
                        {(learningBehavior.domainBreakdown || []).map((dom: any) => {
                          const isWeak = dom.accuracyPercent < 70;
                          return (
                            <div key={dom.domainId} className="rounded-lg bg-white p-3 shadow-2xs dark:bg-slate-900 border border-slate-200/70 dark:border-slate-800">
                              <div className="flex items-center justify-between text-xs mb-1">
                                <div className="flex items-center gap-1.5">
                                  <span className="font-bold text-slate-900 dark:text-white">
                                    [{dom.domainId}] {dom.domainName.split(':')[1] || dom.domainName}
                                  </span>
                                  <span className="rounded bg-slate-100 px-1.5 py-0.2 text-[10px] text-slate-600 dark:bg-slate-800 dark:text-slate-400 font-medium">
                                    {dom.weight}
                                  </span>
                                  {isWeak && (
                                    <span className="rounded bg-red-100 px-1.5 py-0.2 text-[9px] font-bold text-red-700 dark:bg-red-950/80 dark:text-red-300">
                                      Cần ôn thêm
                                    </span>
                                  )}
                                </div>
                                <span className={`font-bold ${isWeak ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                                  {dom.accuracyPercent}%
                                </span>
                              </div>
                              <div className="h-2 w-full rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                                <div
                                  style={{ width: `${dom.accuracyPercent}%` }}
                                  className={`h-full rounded-full transition-all ${
                                    isWeak ? 'bg-amber-500' : 'bg-emerald-500'
                                  }`}
                                />
                              </div>
                              <div className="mt-1 flex items-center justify-between text-[10px] text-slate-400">
                                <span>Lượt làm bài: {dom.attempts} câu</span>
                                <span>Chỉ tiêu kỳ thi: ≥ 72%</span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Card 4: Device Platform Habits & Engagement Metrics */}
                    <div className="rounded-xl border border-slate-200/80 bg-slate-50/80 p-4 dark:border-slate-800/80 dark:bg-slate-800/40">
                      <div className="flex items-center justify-between mb-3">
                        <span className="font-bold text-xs uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                          <Laptop className="h-4 w-4 text-purple-500" />
                          <span>Thói Quen Thiết Bị & Mức Độ Gắn Kết</span>
                        </span>
                        <span className="text-[11px] text-slate-400">Nền tảng</span>
                      </div>

                      {/* Device Split */}
                      <div className="grid grid-cols-3 gap-2 mb-4">
                        {(() => {
                          const d = learningBehavior.deviceHabits || {};
                          const total = (d.desktopCount || 0) + (d.mobileCount || 0) + (d.tabletCount || 0) + (d.otherCount || 0) || 1;
                          const dtPct = Math.round(((d.desktopCount || 0) / total) * 100);
                          const mbPct = Math.round(((d.mobileCount || 0) / total) * 100);
                          const tbPct = Math.round(((d.tabletCount || 0) / total) * 100);
                          return (
                            <>
                              <div className="rounded-lg bg-white p-2.5 text-center shadow-2xs dark:bg-slate-900 border border-slate-200/70 dark:border-slate-800">
                                <Laptop className="h-4 w-4 mx-auto text-blue-500 mb-1" />
                                <span className="text-[11px] text-slate-500 dark:text-slate-400 block font-medium">Máy tính (Desktop)</span>
                                <span className="text-base font-black text-slate-900 dark:text-white">{dtPct}%</span>
                                <span className="text-[10px] text-slate-400 block">{d.desktopCount || 0} phiên</span>
                              </div>
                              <div className="rounded-lg bg-white p-2.5 text-center shadow-2xs dark:bg-slate-900 border border-slate-200/70 dark:border-slate-800">
                                <Smartphone className="h-4 w-4 mx-auto text-emerald-500 mb-1" />
                                <span className="text-[11px] text-slate-500 dark:text-slate-400 block font-medium">Điện thoại (Mobile)</span>
                                <span className="text-base font-black text-slate-900 dark:text-white">{mbPct}%</span>
                                <span className="text-[10px] text-slate-400 block">{d.mobileCount || 0} phiên</span>
                              </div>
                              <div className="rounded-lg bg-white p-2.5 text-center shadow-2xs dark:bg-slate-900 border border-slate-200/70 dark:border-slate-800">
                                <Monitor className="h-4 w-4 mx-auto text-amber-500 mb-1" />
                                <span className="text-[11px] text-slate-500 dark:text-slate-400 block font-medium">Máy tính bảng / Khác</span>
                                <span className="text-base font-black text-slate-900 dark:text-white">{tbPct}%</span>
                                <span className="text-[10px] text-slate-400 block">{d.tabletCount || 0} phiên</span>
                              </div>
                            </>
                          );
                        })()}
                      </div>

                      {/* Engagement Metrics */}
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div className="rounded-lg bg-white p-2.5 shadow-2xs dark:bg-slate-900 border border-slate-200/70 dark:border-slate-800">
                          <span className="text-[11px] text-slate-500 dark:text-slate-400 block">
                            {selectedBehaviorLearnerId !== 'ALL' ? 'Tổng câu học viên đã làm:' : 'Số câu trung bình / học viên:'}
                          </span>
                          <span className="text-base font-bold text-slate-900 dark:text-white mt-0.5 block">
                            {learningBehavior.studyEngagementMetrics?.avgQuestionsPerLearner || 0} câu
                          </span>
                        </div>
                        <div className="rounded-lg bg-white p-2.5 shadow-2xs dark:bg-slate-900 border border-slate-200/70 dark:border-slate-800">
                          <span className="text-[11px] text-slate-500 dark:text-slate-400 block">
                            {selectedBehaviorLearnerId !== 'ALL' ? 'Tỷ lệ đỗ của học viên:' : 'Tỷ lệ đỗ kỳ thi mô phỏng:'}
                          </span>
                          <span className="text-base font-bold text-emerald-600 dark:text-emerald-400 mt-0.5 block">
                            {learningBehavior.studyEngagementMetrics?.passRate || 0}% ({learningBehavior.studyEngagementMetrics?.totalExams || 0} bài thi)
                          </span>
                        </div>
                        <div className="rounded-lg bg-white p-2.5 shadow-2xs dark:bg-slate-900 border border-slate-200/70 dark:border-slate-800">
                          <span className="text-[11px] text-slate-500 dark:text-slate-400 block">
                            {selectedBehaviorLearnerId !== 'ALL' ? 'Tổng học viên trong hệ thống:' : 'Học viên tích cực (7 ngày qua):'}
                          </span>
                          <span className="text-base font-bold text-indigo-600 dark:text-indigo-400 mt-0.5 block">
                            {learningBehavior.studyEngagementMetrics?.activeLearners7d || 0} / {learningBehavior.studyEngagementMetrics?.totalLearners || 0}
                          </span>
                        </div>
                        <div className="rounded-lg bg-white p-2.5 shadow-2xs dark:bg-slate-900 border border-slate-200/70 dark:border-slate-800">
                          <span className="text-[11px] text-slate-500 dark:text-slate-400 block">
                            {selectedBehaviorLearnerId !== 'ALL' ? 'Ghi chú học viên đã lưu:' : 'Ghi chú cá nhân đã tạo:'}
                          </span>
                          <span className="text-base font-bold text-slate-900 dark:text-white mt-0.5 block">
                            {learningBehavior.studyEngagementMetrics?.totalNotes || 0} ghi chú
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ) : null}
            </div>

            {/* Users Table */}
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[850px] text-left text-xs">
                <thead className="border-b border-slate-200 bg-slate-50 font-bold uppercase tracking-wider text-slate-500 dark:border-slate-800 dark:bg-slate-800/50 dark:text-slate-400">
                  <tr>
                    <th className="px-4 py-3.5">Học viên</th>
                    <th className="px-4 py-3.5">IP & Thiết bị</th>
                    <th className="px-4 py-3.5">Hành động Realtime</th>
                    <th className="px-4 py-3.5">Trạng thái</th>
                    <th className="px-4 py-3.5">Câu đã làm</th>
                    <th className="px-4 py-3.5">Ghi chú</th>
                    <th className="px-4 py-3.5">Lần cuối học</th>
                    <th className="px-4 py-3.5 text-right">Hành động</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 text-slate-700 dark:text-slate-300">
                  {loadingLearners && usersList.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-slate-400">
                        Đang tải danh sách học viên...
                      </td>
                    </tr>
                  ) : usersList.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-slate-400">
                        <div className="flex flex-col items-center justify-center gap-3">
                          <Users className="h-10 w-10 text-slate-300 dark:text-slate-600" />
                          <p className="text-sm font-medium text-slate-600 dark:text-slate-300">Không tìm thấy học viên nào.</p>
                          <p className="text-xs text-slate-400 max-w-sm">Hệ thống chưa ghi nhận học viên hoặc máy chủ không trạng thái vừa khởi động lại.</p>
                          <button
                            type="button"
                            onClick={async () => {
                              setLoadingLearners(true);
                              try {
                                await syncLocalLearners();
                                await fetchLearners();
                                await fetchLiveSessions();
                              } finally {
                                setLoadingLearners(false);
                              }
                            }}
                            className="mt-2 flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700 active:scale-95 transition-all shadow-sm"
                          >
                            <RefreshCw className="h-3.5 w-3.5" />
                            Khôi phục & Đồng bộ học viên ngay
                          </button>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    usersList.map((u) => (
                      <tr key={u.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/30 transition-colors">
                        <td className="px-4 py-3.5 font-semibold text-slate-900 dark:text-white">
                          <div className="flex items-center gap-1.5">
                            <span>{u.username}</span>
                            <span
                              className={`rounded-full px-1.5 py-0.2 text-[9px] font-bold ${
                                u.role === 'ADMIN'
                                  ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                                  : 'bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300'
                              }`}
                            >
                              {u.role}
                            </span>
                          </div>
                        </td>

                        <td className="px-4 py-3.5">
                          {u.ipAddress ? (
                            <div className="space-y-0.5">
                              <code className="font-mono text-[11px] font-bold text-slate-700 dark:text-slate-300">
                                {u.ipAddress}
                              </code>
                              <div className="text-[10px] text-slate-400">
                                {u.os || 'HĐH khác'} &bull; {u.browser || 'Trình duyệt'}
                              </div>
                            </div>
                          ) : (
                            <span className="text-slate-400 italic">Chưa ghi nhận</span>
                          )}
                        </td>

                        <td className="px-4 py-3.5 max-w-[220px]">
                          {u.currentAction ? (
                            <div className="space-y-0.5">
                              {u.currentScreen && (
                                <span className="inline-block rounded bg-blue-50 px-1.5 py-0.2 text-[9px] font-bold text-blue-700 dark:bg-blue-950/60 dark:text-blue-300">
                                  {u.currentScreen}
                                </span>
                              )}
                              <div className="truncate font-medium text-slate-800 dark:text-slate-200" title={u.currentAction}>
                                {u.currentAction}
                              </div>
                            </div>
                          ) : (
                            <span className="text-slate-400 italic">Không có phiên gần đây</span>
                          )}
                        </td>

                        <td className="px-4 py-3.5">
                          {u.isOnline ? (
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                              Online
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                              Offline
                            </span>
                          )}
                        </td>

                        <td className="px-4 py-3.5">
                          <div className="font-medium text-slate-900 dark:text-white">
                            {u.questionsAttempted} câu
                          </div>
                          <span
                            className={`text-[11px] font-bold ${
                              u.accuracyPercent >= 70
                                ? 'text-emerald-600 dark:text-emerald-400'
                                : u.accuracyPercent >= 50
                                ? 'text-amber-600 dark:text-amber-400'
                                : 'text-slate-500 dark:text-slate-400'
                            }`}
                          >
                            {u.accuracyPercent}% đúng
                          </span>
                        </td>

                        <td className="px-4 py-3.5">{u.notesCount} ghi chú</td>

                        <td className="px-4 py-3.5 text-slate-400">
                          {new Date(u.lastActiveAt).toLocaleString('vi-VN')}
                        </td>

                        <td className="px-4 py-3.5 text-right whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => {
                              handleSelectBehaviorLearner(u.id);
                              document.getElementById('learning-behavior-section')?.scrollIntoView({ behavior: 'smooth' });
                            }}
                            title="Xem phân tích thói quen & hành vi học tập của học viên này"
                            className="mr-2 inline-flex items-center gap-1 rounded-lg bg-indigo-50 px-2.5 py-1 text-xs font-semibold text-indigo-700 hover:bg-indigo-100 dark:bg-indigo-950/60 dark:text-indigo-300 dark:hover:bg-indigo-900/60 transition-colors"
                          >
                            <span>📊 Thói quen</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              const foundSession = liveSessions.find(s => s.userId === u.id || s.username.toLowerCase() === u.username.toLowerCase());
                              setViewingUltraViewSession(foundSession || {
                                sessionId: `sess_${u.id}`,
                                userId: u.id,
                                username: u.username,
                                role: u.role,
                                ipAddress: u.ipAddress || 'Chưa ghi nhận',
                                deviceType: u.deviceType || 'Desktop',
                                os: u.os || 'Windows',
                                browser: u.browser || 'Google Chrome',
                                screenResolution: '1920x1080',
                                currentScreen: u.currentScreen || 'Trang chủ & Tổng quan',
                                currentAction: u.currentAction || 'Đang hoạt động',
                                questionId: null,
                                questionsAttempted: u.questionsAttempted || 0,
                                accuracyPercent: u.accuracyPercent || 0,
                                startedAt: u.lastActiveAt,
                                lastActiveAt: u.lastActiveAt,
                                isOnline: Boolean(u.isOnline),
                              });
                            }}
                            title="Xem trực tiếp màn hình học viên này qua UltraView"
                            className="mr-2 inline-flex items-center gap-1 rounded-lg bg-blue-50 px-2.5 py-1 text-xs font-bold text-blue-700 hover:bg-blue-100 dark:bg-blue-950/60 dark:text-blue-300 dark:hover:bg-blue-900/60 transition-colors"
                          >
                            <Monitor className="h-3 w-3" />
                            <span>UltraView</span>
                          </button>
                          <button
                            type="button"
                            disabled={loadingDetail}
                            onClick={() => handleInspectLearner(u.id)}
                            className="inline-flex items-center rounded-lg bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-600 hover:bg-blue-100 dark:bg-blue-950/60 dark:text-blue-400 dark:hover:bg-blue-900/60 transition-colors disabled:opacity-50"
                          >
                            {loadingDetail ? 'Đang tải...' : 'Chi tiết hồ sơ →'}
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
              </div>
            </div>

            {/* Learner Deep Dive Drawer/Modal */}
            {selectedLearnerDetail && (
              <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
                <div className="relative flex flex-col w-full max-w-4xl max-h-[92vh] overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                  <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4 dark:border-slate-800">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-100 text-blue-600 dark:bg-blue-950/60 dark:text-blue-400 font-bold">
                        {selectedLearnerDetail.profile?.username?.[0]?.toUpperCase() || 'U'}
                      </div>
                      <div>
                        <h3 className="text-base font-bold text-slate-900 dark:text-white">
                          Hồ Sơ & Thói Quen Học Tập: <span className="text-blue-600 dark:text-blue-400">{selectedLearnerDetail.profile?.username}</span>
                        </h3>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          ID: {selectedLearnerDetail.profile?.id} &bull; Tham gia từ {new Date(selectedLearnerDetail.profile?.createdAt).toLocaleDateString('vi-VN')}
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelectedLearnerDetail(null)}
                      className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                    >
                      <XCircle className="h-5 w-5" />
                    </button>
                  </div>

                  <div className="overflow-y-auto p-6 space-y-6 flex-1 text-xs">
                    {/* Realtime Live Session Details if currently or recently active */}
                    {selectedLearnerDetail.liveSession && (
                      <div className="rounded-2xl border border-emerald-200 bg-emerald-50/50 p-4 dark:border-emerald-900/50 dark:bg-emerald-950/20 shadow-xs">
                        <div className="flex items-center justify-between mb-3">
                          <h4 className="font-bold text-emerald-800 dark:text-emerald-300 uppercase tracking-wider text-xs flex items-center gap-2">
                            <span className="relative flex h-2.5 w-2.5">
                              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
                            </span>
                            <span>Phiên Hoạt Động Trực Tiếp & IP Máy</span>
                          </h4>
                          <span className="text-[11px] text-emerald-700 dark:text-emerald-400 font-medium">
                            Lần cuối: {formatTimeAgo(selectedLearnerDetail.liveSession.lastActiveAt)}
                          </span>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                          <div className="rounded-xl bg-white/90 p-3 dark:bg-slate-900/90 border border-emerald-100 dark:border-emerald-900/40">
                            <span className="text-slate-400 block text-[10px] uppercase font-bold">Địa chỉ IP Máy:</span>
                            <code className="mt-1 inline-block font-mono font-bold text-slate-800 dark:text-slate-200 text-xs bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded">
                              {selectedLearnerDetail.liveSession.ipAddress}
                            </code>
                          </div>

                          <div className="rounded-xl bg-white/90 p-3 dark:bg-slate-900/90 border border-emerald-100 dark:border-emerald-900/40">
                            <span className="text-slate-400 block text-[10px] uppercase font-bold">Màn hình & Hành động:</span>
                            <div className="mt-0.5 font-bold text-slate-800 dark:text-slate-200 truncate">
                              {selectedLearnerDetail.liveSession.currentScreen}
                            </div>
                            <div className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400 truncate">
                              {selectedLearnerDetail.liveSession.currentAction}
                            </div>
                          </div>

                          <div className="rounded-xl bg-white/90 p-3 dark:bg-slate-900/90 border border-emerald-100 dark:border-emerald-900/40">
                            <span className="text-slate-400 block text-[10px] uppercase font-bold">Thiết bị & Trình duyệt:</span>
                            <div className="mt-0.5 font-semibold text-slate-800 dark:text-slate-200">
                              {selectedLearnerDetail.liveSession.os} &bull; {selectedLearnerDetail.liveSession.browser}
                            </div>
                            <div className="text-[10px] text-slate-400">
                              {selectedLearnerDetail.liveSession.deviceType} ({selectedLearnerDetail.liveSession.screenResolution})
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Devices & Sessions */}
                    <div>
                      <h4 className="font-bold text-slate-900 dark:text-white uppercase tracking-wider text-xs mb-3 flex items-center gap-2">
                        <Laptop className="h-4 w-4 text-indigo-500" />
                        <span>Thiết Bị & Nền Tảng Truy Cập</span>
                      </h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                        {(selectedLearnerDetail.devices || []).map((dev: any, idx: number) => (
                          <div key={idx} className="rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-800/40">
                            <div className="flex items-center justify-between mb-1.5">
                              <span className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                                {dev.device_type === 'Mobile' ? <Smartphone className="h-3.5 w-3.5" /> : <Laptop className="h-3.5 w-3.5" />}
                                {dev.device_type}
                              </span>
                              <span className="rounded bg-blue-100 px-1.5 py-0.2 text-[10px] font-bold text-blue-700 dark:bg-blue-900/50 dark:text-blue-300">
                                {dev.session_count} phiên
                              </span>
                            </div>
                            <div className="text-slate-500 dark:text-slate-400 space-y-0.5 text-[11px]">
                              <div>HĐH: <strong>{dev.os}</strong></div>
                              <div>Trình duyệt: <strong>{dev.browser}</strong></div>
                              <div>Lần cuối: {new Date(dev.last_active_at).toLocaleString('vi-VN')}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Study Habits */}
                    <div>
                      <h4 className="font-bold text-slate-900 dark:text-white uppercase tracking-wider text-xs mb-3 flex items-center gap-2">
                        <Clock className="h-4 w-4 text-amber-500" />
                        <span>Thói Quen & Khung Giờ Học Tập</span>
                      </h4>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        <div className="rounded-xl border border-slate-200 p-3 dark:border-slate-800">
                          <span className="text-slate-500 dark:text-slate-400 block">Khung giờ ưa thích:</span>
                          <strong className="text-sm font-bold text-amber-600 dark:text-amber-400 mt-0.5 block">
                            {selectedLearnerDetail.learningHabits?.preferredTime || 'Đa dạng'}
                          </strong>
                        </div>
                        <div className="rounded-xl border border-slate-200 p-3 dark:border-slate-800">
                          <span className="text-slate-500 dark:text-slate-400 block">Trung bình / phiên:</span>
                          <strong className="text-sm font-bold text-slate-900 dark:text-white mt-0.5 block">
                            {selectedLearnerDetail.learningHabits?.averageQuestionsPerSession || 0} câu
                          </strong>
                        </div>
                        <div className="rounded-xl border border-slate-200 p-3 dark:border-slate-800">
                          <span className="text-slate-500 dark:text-slate-400 block">Độ chính xác chung:</span>
                          <strong className="text-sm font-bold text-emerald-600 dark:text-emerald-400 mt-0.5 block">
                            {selectedLearnerDetail.learningProgress?.overallAccuracy || 0}%
                          </strong>
                        </div>
                        <div className="rounded-xl border border-slate-200 p-3 dark:border-slate-800">
                          <span className="text-slate-500 dark:text-slate-400 block">Số đề thi đã nộp:</span>
                          <strong className="text-sm font-bold text-slate-900 dark:text-white mt-0.5 block">
                            {selectedLearnerDetail.learningProgress?.examsTaken || 0} bài thi
                          </strong>
                        </div>
                      </div>
                    </div>

                    {/* Dangerous Misconceptions / Repeated Mistakes */}
                    <div>
                      <h4 className="font-bold text-slate-900 dark:text-white uppercase tracking-wider text-xs mb-3 flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4 text-red-500" />
                        <span>Lỗ Hổng Kiến Trúc & Sai Lầm Lặp Lại</span>
                      </h4>
                      {(selectedLearnerDetail.learningProgress?.repeatedMistakes || []).length === 0 &&
                      (selectedLearnerDetail.learningProgress?.dangerousMisconceptions || []).length === 0 ? (
                        <p className="text-slate-500 dark:text-slate-400 italic">Học viên chưa có sai lầm lặp lại nào nghiêm trọng.</p>
                      ) : (
                        <div className="space-y-2">
                          {(selectedLearnerDetail.learningProgress?.dangerousMisconceptions || []).map((m: any, idx: number) => (
                            <div key={idx} className="rounded-lg border border-red-200 bg-red-50/70 p-3 text-red-800 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300">
                              <span className="font-bold">⚠️ Tự tin cao nhưng làm sai:</span> Câu #{m.question_id} (Đã làm {m.attempts_count} lần)
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Learner Notes */}
                    <div>
                      <h4 className="font-bold text-slate-900 dark:text-white uppercase tracking-wider text-xs mb-3 flex items-center gap-2">
                        <FileText className="h-4 w-4 text-blue-500" />
                        <span>Ghi Chú Cá Nhân ({selectedLearnerDetail.notes?.length || 0})</span>
                      </h4>
                      {(selectedLearnerDetail.notes || []).length === 0 ? (
                        <p className="text-slate-500 dark:text-slate-400 italic">Học viên chưa tạo ghi chú nào.</p>
                      ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {selectedLearnerDetail.notes.map((n: any, idx: number) => (
                            <div key={idx} className="rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-800/40">
                              <div className="font-bold text-slate-800 dark:text-slate-200 mb-1">
                                Câu hỏi #{n.question_id}
                              </div>
                              <p className="text-slate-600 dark:text-slate-300 whitespace-pre-wrap">{n.note_text}</p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Automated Recommendations */}
                    <div>
                      <h4 className="font-bold text-slate-900 dark:text-white uppercase tracking-wider text-xs mb-3 flex items-center gap-2">
                        <Lightbulb className="h-4 w-4 text-emerald-500" />
                        <span>Đề Xuất Lộ Trình & Khuyến Nghị Dành Cho Học Viên Này</span>
                      </h4>
                      <div className="space-y-2.5">
                        {(selectedLearnerDetail.insights || []).map((ins: any, idx: number) => (
                          <div key={idx} className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-3.5 dark:border-emerald-900/40 dark:bg-emerald-950/20">
                            <h5 className="font-bold text-emerald-900 dark:text-emerald-300">{ins.title}</h5>
                            <p className="mt-1 text-slate-700 dark:text-slate-300">{ins.description}</p>
                            <p className="mt-1 font-semibold text-emerald-700 dark:text-emerald-400">👉 {ins.actionableAdvice}</p>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* AI Tutor Query History */}
                    <div>
                      <h4 className="font-bold text-slate-900 dark:text-white uppercase tracking-wider text-xs mb-3 flex items-center gap-2">
                        <Bot className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                        <span>Lịch Sử Hỏi AI Tutor Của Học Viên ({selectedLearnerDetail.aiQueries?.length || 0})</span>
                      </h4>
                      {(!selectedLearnerDetail.aiQueries || selectedLearnerDetail.aiQueries.length === 0) ? (
                        <p className="text-slate-400 italic text-xs">Học viên chưa gửi câu hỏi nào tới AI Tutor.</p>
                      ) : (
                        <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                          {selectedLearnerDetail.aiQueries.map((q: any) => (
                            <div key={q.id} className="rounded-xl border border-purple-100 bg-purple-50/40 p-3 dark:border-purple-900/40 dark:bg-purple-950/20">
                              <div className="flex items-center justify-between text-[11px] mb-1">
                                <span className="font-bold text-purple-700 dark:text-purple-300">
                                  {q.question_id ? `Câu hỏi #${q.question_id}` : 'Hỏi tự do'}
                                </span>
                                <span className="text-slate-400">
                                  {new Date(q.created_at).toLocaleString('vi-VN')}
                                </span>
                              </div>
                              <p className="text-xs text-slate-800 dark:text-slate-200 font-medium whitespace-pre-wrap">
                                "{q.prompt}"
                              </p>
                              <div className="mt-1 flex items-center gap-2 text-[10px] text-slate-400">
                                <span className="rounded bg-slate-200/60 px-1.5 py-0.5 dark:bg-slate-800">
                                  Mode: {q.mode || 'explain'}
                                </span>
                                <span className="rounded bg-slate-200/60 px-1.5 py-0.5 dark:bg-slate-800">
                                  {q.provider || 'local_rag'}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* =========================================================================
            TAB 3: KIỂM DUYỆT CÂU HỎI (QUESTION MODERATION QUEUE)
            ========================================================================= */}
        {activeTab === 'moderation' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                  Hàng Đợi Kiểm Duyệt Câu Hỏi ({pendingQuestions.length})
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Câu hỏi do người học gửi lên được cách ly (Private). Chỉ sau khi Admin duyệt mới hòa vào ngân hàng đề thi chung.
                </p>
              </div>

              <button
                type="button"
                onClick={fetchModerationQueue}
                className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-200 dark:text-slate-400 dark:hover:bg-slate-800 transition-colors"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                <span>Làm mới</span>
              </button>
            </div>

            {loadingModeration ? (
              <div className="py-12 text-center text-sm text-slate-500 dark:text-slate-400">
                Đang tải danh sách chờ duyệt...
              </div>
            ) : pendingQuestions.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-300 p-12 text-center dark:border-slate-800">
                <CheckCircle className="mx-auto mb-2 h-10 w-10 text-emerald-500" />
                <h3 className="font-bold text-slate-900 dark:text-white">Không có câu hỏi nào đang chờ duyệt</h3>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  Tất cả các đóng góp từ học viên đã được kiểm tra và xử lý xong.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {pendingQuestions.map((q) => {
                  let choices: Record<string, string> = {};
                  try {
                    choices = JSON.parse(q.choices_json);
                  } catch {
                    choices = {};
                  }

                  return (
                    <div
                      key={q.id}
                      className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-3 mb-3 text-xs">
                        <div className="flex items-center gap-2">
                          <span className="rounded-md bg-amber-100 px-2 py-0.5 font-bold text-amber-800 dark:bg-amber-950/60 dark:text-amber-300">
                            Chờ duyệt
                          </span>
                          <span className="text-slate-500 dark:text-slate-400">
                            Người gửi: <strong className="text-slate-900 dark:text-white">{q.creator_username}</strong>
                          </span>
                          <span className="text-slate-400">&bull;</span>
                          <span className="text-slate-400">{new Date(q.created_at).toLocaleString('vi-VN')}</span>
                        </div>

                        <div className="flex items-center gap-2">
                          <span className="rounded bg-slate-100 px-2 py-0.5 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                            {q.domain}
                          </span>
                          <span className="rounded bg-slate-100 px-2 py-0.5 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                            {q.difficulty}
                          </span>
                        </div>
                      </div>

                      <h4 className="text-sm font-bold text-slate-900 dark:text-white mb-3">{q.text}</h4>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-4 text-xs">
                        {Object.entries(choices).map(([key, val]) => (
                          <div
                            key={key}
                            className={`flex items-start gap-2.5 rounded-xl border p-2.5 ${
                              q.answer.includes(key)
                                ? 'border-emerald-500 bg-emerald-50/60 font-semibold text-emerald-900 dark:border-emerald-500/50 dark:bg-emerald-950/30 dark:text-emerald-300'
                                : 'border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-800/40 text-slate-700 dark:text-slate-300'
                            }`}
                          >
                            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-black/5 dark:bg-white/10 font-bold">
                              {key}
                            </span>
                            <span>{val}</span>
                          </div>
                        ))}
                      </div>

                      {q.explanation_json && (
                        <div className="rounded-xl bg-blue-50/60 p-3 text-xs text-blue-950 dark:bg-blue-950/30 dark:text-blue-200 mb-4">
                          <span className="font-bold block mb-1">Giải thích đính kèm:</span>
                          <p className="whitespace-pre-wrap">{q.explanation_json}</p>
                        </div>
                      )}

                      <div className="flex justify-end gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
                        <button
                          type="button"
                          onClick={() => setRejectModalQuestion(q)}
                          className="inline-flex items-center gap-1.5 rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-xs font-bold text-red-700 hover:bg-red-100 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300 transition-colors"
                        >
                          <XCircle className="h-4 w-4" />
                          <span>Từ Chối</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleApproveQuestion(q.id)}
                          className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-emerald-700 transition-colors"
                        >
                          <CheckCircle2 className="h-4 w-4" />
                          <span>Phê Duyệt & Công Bố</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Rejection Modal */}
            {rejectModalQuestion && (
              <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
                <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                  <h3 className="text-base font-bold text-slate-900 dark:text-white mb-2">
                    Từ chối câu hỏi #{rejectModalQuestion.id}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
                    Nhập lý do từ chối để thông báo cho học viên <strong>{rejectModalQuestion.creator_username}</strong>:
                  </p>
                  <textarea
                    rows={3}
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                    placeholder="Ví dụ: Nội dung câu hỏi chưa rõ ràng hoặc đáp án chưa chính xác..."
                    className="w-full rounded-xl border border-slate-300 p-2.5 text-xs text-slate-900 focus:border-red-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                  <div className="flex justify-end gap-2 mt-4">
                    <button
                      type="button"
                      onClick={() => setRejectModalQuestion(null)}
                      className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 dark:border-slate-700 dark:text-slate-300"
                    >
                      Hủy
                    </button>
                    <button
                      type="button"
                      onClick={handleConfirmReject}
                      className="rounded-lg bg-red-600 px-4 py-1.5 text-xs font-bold text-white shadow hover:bg-red-700"
                    >
                      Xác Nhận Từ Chối
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* =========================================================================
            TAB 4: NGUỒN CÂU HỎI & NHẬP JSON (SOURCES & JSON IMPORTER)
            ========================================================================= */}
        {activeTab === 'sources' && (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">Quản Lý Nguồn & Nhập Câu Hỏi Hàng Loạt</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Nhập danh sách câu hỏi qua định dạng JSON để mở rộng ngân hàng câu hỏi lập tức
              </p>
            </div>

            {/* Sources List */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
                <span className="text-xs text-slate-400 uppercase font-semibold">Đề Chuẩn Canonical</span>
                <p className="text-2xl font-black text-slate-900 dark:text-white mt-1">1019 câu</p>
                <span className="text-[11px] text-emerald-600 dark:text-emerald-400">Sẵn sàng trong bộ nhớ</span>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
                <span className="text-xs text-slate-400 uppercase font-semibold">Nguồn Nhập Ngoài (Custom DB)</span>
                <p className="text-2xl font-black text-blue-600 dark:text-blue-400 mt-1">
                  {sources.reduce((sum, s) => sum + (s.question_count || 0), 0)} câu
                </p>
                <span className="text-[11px] text-slate-500 dark:text-slate-400">{sources.length} đợt nhập</span>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
                <span className="text-xs text-slate-400 uppercase font-semibold">Học Viên Đóng Góp</span>
                <p className="text-2xl font-black text-amber-600 dark:text-amber-400 mt-1">
                  {overview?.pendingQuestions ?? 0} đang chờ
                </p>
                <span className="text-[11px] text-slate-500 dark:text-slate-400">Quy trình kiểm duyệt 3 bước</span>
              </div>
            </div>

            {/* Importer Section */}
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Upload className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                  <span>Trình Nhập Dữ Liệu JSON (Bulk Importer)</span>
                </h3>
                <button
                  type="button"
                  onClick={loadSampleJson}
                  className="text-xs font-semibold text-blue-600 hover:text-blue-700 dark:text-blue-400"
                >
                  Dán mẫu JSON thử nghiệm
                </button>
              </div>

              {importStatus && (
                <div
                  className={`mb-4 flex items-center gap-2 rounded-xl p-3 text-xs ${
                    importStatus.type === 'success'
                      ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300'
                      : 'bg-red-50 text-red-800 dark:bg-red-950/40 dark:text-red-300'
                  }`}
                >
                  {importStatus.type === 'success' ? <CheckCircle2 className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
                  <span>{importStatus.message}</span>
                </div>
              )}

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Tên gói đề thi / Nguồn nhập
                  </label>
                  <input
                    type="text"
                    value={importSourceName}
                    onChange={(e) => setImportSourceName(e.target.value)}
                    placeholder="Ví dụ: Đề Thi Thử SAA-C03 Tháng 9/2026..."
                    className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs text-slate-900 focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Nội dung JSON (Array of questions)
                  </label>
                  <textarea
                    rows={8}
                    value={jsonImportText}
                    onChange={(e) => setJsonImportText(e.target.value)}
                    placeholder='[&#10;  {&#10;    "text": "Câu hỏi...",&#10;    "choices": { "A": "...", "B": "..." },&#10;    "answer": "A",&#10;    "explanation": "..."&#10;  }&#10;]'
                    className="font-mono w-full rounded-xl border border-slate-300 bg-white p-3 text-xs text-slate-900 focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                </div>

                <div className="flex justify-end">
                  <button
                    type="button"
                    disabled={isImporting}
                    onClick={handleImportJson}
                    className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-blue-700 transition-colors disabled:opacity-50"
                  >
                    <Upload className="h-4 w-4" />
                    <span>{isImporting ? 'Đang phân tích & nhập...' : 'Xác Nhận Nhập Dữ Liệu'}</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* =========================================================================
            TAB 5: HỘP THƯ GÓP Ý (FEEDBACK INBOX)
            ========================================================================= */}
        {activeTab === 'feedback' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold text-slate-900 dark:text-white">Hộp Thư Góp Ý & Báo Lỗi ({feedbacks.length})</h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Phản hồi từ học viên giúp ban quản trị cập nhật giải thích và sửa lỗi kịp thời
                </p>
              </div>

              <div className="flex items-center gap-3">
                <select
                  value={feedbackStatusFilter}
                  onChange={(e) => setFeedbackStatusFilter(e.target.value)}
                  className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                >
                  <option value="ALL">Tất cả trạng thái</option>
                  <option value="NEW">Mới gửi (NEW)</option>
                  <option value="IN_REVIEW">Đang xử lý (IN_REVIEW)</option>
                  <option value="RESOLVED">Đã giải quyết (RESOLVED)</option>
                  <option value="REJECTED">Từ chối (REJECTED)</option>
                </select>
                <button
                  type="button"
                  onClick={fetchFeedbacks}
                  className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-200 dark:text-slate-400 dark:hover:bg-slate-800 transition-colors"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  <span>Làm mới</span>
                </button>
              </div>
            </div>

            {loadingFeedback ? (
              <div className="py-12 text-center text-xs text-slate-400">Đang tải phản hồi...</div>
            ) : feedbacks.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-300 p-12 text-center dark:border-slate-800">
                <MessageSquare className="mx-auto mb-2 h-10 w-10 text-slate-400" />
                <h3 className="font-bold text-slate-900 dark:text-white">Không có phản hồi nào phù hợp</h3>
              </div>
            ) : (
              <div className="space-y-4">
                {feedbacks.map((fb) => (
                  <div
                    key={fb.id}
                    className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900"
                  >
                    <div className="flex items-center justify-between gap-3 mb-2 text-xs">
                      <div className="flex items-center gap-2">
                        <span
                          className={`rounded-full px-2 py-0.5 font-bold ${
                            fb.status === 'NEW'
                              ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300'
                              : fb.status === 'RESOLVED'
                              ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300'
                              : 'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300'
                          }`}
                        >
                          {fb.status}
                        </span>
                        <span className="font-semibold text-slate-800 dark:text-slate-200">
                          {fb.username || 'Học viên'}
                        </span>
                        <span className="text-slate-400">&bull;</span>
                        <span className="text-slate-400">{new Date(fb.createdAt).toLocaleString('vi-VN')}</span>
                      </div>

                      <span
                        className={`font-bold ${
                          fb.priority === 'HIGH' || fb.priority === 'URGENT'
                            ? 'text-red-500'
                            : 'text-slate-500'
                        }`}
                      >
                        Ưu tiên: {fb.priority}
                      </span>
                    </div>

                    <h4 className="text-sm font-bold text-slate-900 dark:text-white mb-1.5">{fb.title}</h4>
                    <p className="text-xs text-slate-600 dark:text-slate-300 whitespace-pre-wrap mb-3">{fb.content}</p>

                    {fb.adminResponse && (
                      <div className="mb-3 rounded-xl border border-blue-200 bg-blue-50/70 p-3 text-xs dark:border-blue-900/50 dark:bg-blue-950/30">
                        <span className="font-bold text-blue-800 dark:text-blue-300 block mb-1">
                          Phản hồi của Admin:
                        </span>
                        <p className="text-blue-900 dark:text-blue-200 whitespace-pre-wrap">{fb.adminResponse}</p>
                      </div>
                    )}

                    <div className="flex justify-end">
                      <button
                        type="button"
                        onClick={() => {
                          setReplyingFeedback(fb);
                          setAdminReplyText(fb.adminResponse || '');
                          setAdminReplyStatus(fb.status === 'NEW' ? 'RESOLVED' : fb.status);
                        }}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 transition-colors"
                      >
                        <MessageSquare className="h-3.5 w-3.5" />
                        <span>{fb.adminResponse ? 'Sửa câu trả lời' : 'Trả lời & Xử lý'}</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Reply Modal */}
            {replyingFeedback && (
              <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
                <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                  <h3 className="text-base font-bold text-slate-900 dark:text-white mb-2">
                    Xử lý phản hồi: {replyingFeedback.title}
                  </h3>
                  <div className="space-y-3 text-xs">
                    <div>
                      <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Cập nhật trạng thái
                      </label>
                      <select
                        value={adminReplyStatus}
                        onChange={(e) => setAdminReplyStatus(e.target.value as any)}
                        className="w-full rounded-xl border border-slate-300 p-2 text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                      >
                        <option value="IN_REVIEW">Đang xử lý (IN_REVIEW)</option>
                        <option value="RESOLVED">Đã giải quyết (RESOLVED)</option>
                        <option value="REJECTED">Từ chối (REJECTED)</option>
                      </select>
                    </div>

                    <div>
                      <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Nội dung phản hồi tới học viên
                      </label>
                      <textarea
                        rows={4}
                        value={adminReplyText}
                        onChange={(e) => setAdminReplyText(e.target.value)}
                        placeholder="Cảm ơn bạn đã đóng góp, chúng tôi đã kiểm tra và cập nhật giải thích câu hỏi..."
                        className="w-full rounded-xl border border-slate-300 p-2 text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                      />
                    </div>
                  </div>

                  <div className="flex justify-end gap-2 mt-4">
                    <button
                      type="button"
                      onClick={() => setReplyingFeedback(null)}
                      className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 dark:border-slate-700 dark:text-slate-300"
                    >
                      Hủy
                    </button>
                    <button
                      type="button"
                      onClick={handleSendFeedbackReply}
                      className="rounded-lg bg-blue-600 px-4 py-1.5 text-xs font-bold text-white shadow hover:bg-blue-700"
                    >
                      Lưu & Phản Hồi
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* =========================================================================
            TAB: AI TUTOR & TRI THỨC (AI KNOWLEDGE BASE & TELEMETRY)
            ========================================================================= */}
        {activeTab === 'ai' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <span>AI Tutor & Tri Thức AWS</span>
                  <span className="rounded-md bg-purple-500/10 px-2 py-0.5 text-xs font-bold text-purple-600 dark:text-purple-400">
                    RAG KNOWLEDGE ENGINE
                  </span>
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Thống kê tương tác, độ hữu ích (👍/👎), các câu hỏi học viên cần hỗ trợ nhiều nhất và tình trạng Knowledge Base
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={fetchAIAnalytics}
                  className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-200 dark:text-slate-400 dark:hover:bg-slate-800 transition-colors"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  <span>Làm mới</span>
                </button>
              </div>
            </div>

            {/* Enterprise AI Sub-Navigation Bar */}
            <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 pb-3 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setAiSubTab('overview')}
                className={`flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-bold transition-colors ${
                  aiSubTab === 'overview'
                    ? 'bg-purple-600 text-white shadow-sm'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'
                }`}
              >
                <MessageSquare className="h-4 w-4" />
                <span>Tổng Quan & Lịch Sử</span>
              </button>

              <button
                type="button"
                onClick={() => setAiSubTab('config')}
                className={`flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-bold transition-colors ${
                  aiSubTab === 'config'
                    ? 'bg-purple-600 text-white shadow-sm'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'
                }`}
              >
                <Sliders className="h-4 w-4" />
                <span>Cấu Hình AI (Config Center)</span>
              </button>

              <button
                type="button"
                onClick={() => setAiSubTab('security')}
                className={`flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-bold transition-colors ${
                  aiSubTab === 'security'
                    ? 'bg-purple-600 text-white shadow-sm'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'
                }`}
              >
                <Shield className="h-4 w-4" />
                <span>An Ninh AI (Security Dashboard)</span>
              </button>

              <button
                type="button"
                onClick={() => setAiSubTab('quality')}
                className={`flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-bold transition-colors ${
                  aiSubTab === 'quality'
                    ? 'bg-purple-600 text-white shadow-sm'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'
                }`}
              >
                <BarChart3 className="h-4 w-4" />
                <span>Chất Lượng & Chi Phí</span>
              </button>

              <button
                type="button"
                onClick={() => setAiSubTab('memory')}
                className={`flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-bold transition-colors ${
                  aiSubTab === 'memory'
                    ? 'bg-purple-600 text-white shadow-sm'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'
                }`}
              >
                <Brain className="h-4 w-4" />
                <span>Bộ Nhớ & Tri Thức</span>
              </button>

              <button
                type="button"
                onClick={() => setAiSubTab('playground')}
                className={`flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-bold transition-colors ${
                  aiSubTab === 'playground'
                    ? 'bg-purple-600 text-white shadow-sm'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'
                }`}
              >
                <Terminal className="h-4 w-4" />
                <span>Playground & Test Lab</span>
              </button>
            </div>

            {aiSubTab === 'config' && <AIConfigCenterTab />}
            {aiSubTab === 'security' && <AISecurityDashboardTab />}
            {aiSubTab === 'quality' && <AIQualityCostTab />}
            {aiSubTab === 'memory' && <AIMemoryKnowledgeTab />}
            {aiSubTab === 'playground' && <AIPlaygroundLabTab />}

            {aiSubTab === 'overview' && (
              <>
                {/* Privacy & Transparent Logging Banner */}
                <div className="rounded-2xl border border-emerald-500/30 bg-emerald-50/50 p-4 dark:border-emerald-500/20 dark:bg-emerald-950/20">
                  <div className="flex items-start gap-3">
                <Shield className="h-5 w-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                <div className="text-xs text-slate-700 dark:text-slate-300 space-y-1">
                  <div className="font-bold text-emerald-800 dark:text-emerald-300">
                    Bảo Mật API Key Cục Bộ & Phân Tích Câu Hỏi Học Tập Thông Minh
                  </div>
                  <p>
                    API Key cá nhân của học viên chỉ lưu trữ tại Trình duyệt cục bộ (Local Storage), tuyệt đối an toàn. Hệ thống ghi nhận câu hỏi học viên hỏi AI Tutor (hỗ trợ cả tài khoản học viên và khách vãng lai) để quản trị viên phân tích các chủ đề kiến trúc người học còn băn khoăn, từ đó cập nhật giải thích và hoàn thiện ngân hàng đề thi AWS SAA-C03.
                  </p>
                </div>
              </div>
            </div>

            {/* Metric KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
              <div className="rounded-2xl border border-purple-200 bg-purple-50/50 p-5 shadow-sm dark:border-purple-900/50 dark:bg-purple-950/20">
                <div className="flex items-center justify-between text-xs text-purple-700 dark:text-purple-300 mb-2 font-medium">
                  <span>Lượt Hỏi AI Tutor</span>
                  <MessageSquare className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                </div>
                <div className="text-2xl font-black text-slate-900 dark:text-white">
                  {loadingAiQueries ? '...' : (aiMetrics?.queriesAnalytics?.totalQueries ?? aiQueriesTotal)}
                </div>
                <div className="mt-2 text-[11px] text-purple-600 dark:text-purple-400 font-medium">
                  {aiQueriesTotal} câu hỏi được ghi nhận
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mb-2">
                  <span className="font-medium">Tổng Đánh Giá / Phản Hồi</span>
                  <Bot className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                </div>
                <div className="text-2xl font-black text-slate-900 dark:text-white">
                  {loadingAI ? '...' : (aiMetrics?.totalFeedback || 0)}
                </div>
                <div className="mt-2 text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                  <span className="text-emerald-600 dark:text-emerald-400 font-bold">
                    👍 {aiMetrics?.upCount || 0}
                  </span>
                  <span>•</span>
                  <span className="text-rose-600 dark:text-rose-400 font-bold">
                    👎 {aiMetrics?.downCount || 0}
                  </span>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mb-2">
                  <span className="font-medium">Tỷ Lệ Hài Lòng (Satisfaction)</span>
                  <ThumbsUp className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div className="text-2xl font-black text-slate-900 dark:text-white">
                  {loadingAI ? '...' : `${aiMetrics?.satisfactionRate ?? 100}%`}
                </div>
                <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                  <div
                    className="h-full bg-emerald-500 transition-all duration-500"
                    style={{ width: `${aiMetrics?.satisfactionRate ?? 100}%` }}
                  />
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mb-2">
                  <span className="font-medium">Kho Tri Thức Đề Thi</span>
                  <FileText className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                </div>
                <div className="text-2xl font-black text-slate-900 dark:text-white">
                  1,019
                </div>
                <div className="mt-2 text-[11px] text-slate-500 dark:text-slate-400">
                  Câu hỏi SAA-C03 chuẩn hóa đã index RAG
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mb-2">
                  <span className="font-medium">AWS Directory Index</span>
                  <Lightbulb className="h-4 w-4 text-amber-500" />
                </div>
                <div className="text-2xl font-black text-slate-900 dark:text-white">
                  42
                </div>
                <div className="mt-2 text-[11px] text-slate-500 dark:text-slate-400">
                  Dịch vụ AWS & So sánh cốt lõi
                </div>
              </div>
            </div>

            {/* Content Columns: Top Questions & Weak Topics / Reasons */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Top Questions Queried */}
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-3 flex items-center gap-2">
                  <Flame className="h-4 w-4 text-amber-500" />
                  <span>Các Câu Hỏi Được Tra Cứu & Đánh Giá Nhiều Nhất</span>
                </h3>
                {(!aiMetrics?.topQuestions || aiMetrics.topQuestions.length === 0) ? (
                  <p className="text-xs text-slate-400 py-6 text-center">Chưa có câu hỏi nào được phản hồi.</p>
                ) : (
                  <div className="space-y-2">
                    {aiMetrics.topQuestions.map((q: any) => (
                      <div
                        key={q.questionId}
                        className="flex items-center justify-between rounded-xl bg-slate-50 p-3 text-xs dark:bg-slate-800/60"
                      >
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-900 dark:text-white">
                            Câu #{q.questionId}
                          </span>
                          <span className="text-slate-500 dark:text-slate-400">
                            (AWS SAA-C03)
                          </span>
                        </div>
                        <span className="rounded-md bg-purple-500/10 px-2 py-0.5 text-xs font-bold text-purple-600 dark:text-purple-400">
                          {q.count} lượt
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Top Reasons for Discontent / Confusion */}
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-3 flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-rose-500" />
                  <span>Các Vấn Đề Người Học Thường Gặp Khi Hỏi AI</span>
                </h3>
                {(!aiMetrics?.topReasons || aiMetrics.topReasons.length === 0) ? (
                  <p className="text-xs text-slate-400 py-6 text-center">Chưa có phản ánh khó khăn nào.</p>
                ) : (
                  <div className="space-y-2">
                    {aiMetrics.topReasons.map((r: any) => (
                      <div
                        key={r.tag}
                        className="flex items-center justify-between rounded-xl bg-slate-50 p-3 text-xs dark:bg-slate-800/60"
                      >
                        <span className="font-medium text-slate-800 dark:text-slate-200">
                          {r.tag}
                        </span>
                        <span className="rounded-md bg-rose-500/10 px-2 py-0.5 text-xs font-bold text-rose-600 dark:text-rose-400">
                          {r.count} phản ánh
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Top Queried AWS Keywords & Services */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Flame className="h-4 w-4 text-orange-500" />
                  <span>Dịch Vụ & Chủ Đề AWS Người Học Tra Cứu / Hỏi AI Nhiều Nhất</span>
                </h3>
                <span className="text-[11px] text-slate-400">Trích xuất tự động từ câu hỏi</span>
              </div>

              {(!aiMetrics?.queriesAnalytics?.topKeywords || aiMetrics.queriesAnalytics.topKeywords.length === 0) ? (
                <p className="text-xs text-slate-400 py-4 text-center">Chưa ghi nhận từ khóa dịch vụ nào từ câu hỏi của người học.</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {aiMetrics.queriesAnalytics.topKeywords.map((kw: any) => (
                    <span
                      key={kw.keyword}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-purple-200 bg-purple-50/70 px-3 py-1.5 text-xs font-semibold text-purple-800 dark:border-purple-800/60 dark:bg-purple-950/40 dark:text-purple-300 shadow-2xs"
                    >
                      <span className="font-bold">{kw.keyword}</span>
                      <span className="rounded-full bg-purple-200/70 px-1.5 py-0.2 text-[10px] font-extrabold text-purple-900 dark:bg-purple-900/60 dark:text-purple-200">
                        {kw.count} lượt
                      </span>
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* LIVE LOG: NHẬT KÝ CÂU HỎI NGƯỜI DÙNG HỎI AI */}
            <div className="rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900 overflow-hidden">
              <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <MessageSquare className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                    <span>Nhật Ký Chi Tiết Câu Hỏi Người Dùng Gửi Tới AI Tutor</span>
                    <span className="rounded-full bg-purple-100 px-2.5 py-0.5 text-[11px] font-bold text-purple-700 dark:bg-purple-950/60 dark:text-purple-300">
                      {aiQueriesTotal} câu hỏi
                    </span>
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Toàn văn câu hỏi của học viên và khách vãng lai để ban quản trị phát hiện các phần bài khó hiểu cần bổ sung giải thích
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2.5">
                  <div className="relative">
                    <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Tìm nội dung hỏi, người hỏi, IP..."
                      value={aiQuerySearch}
                      onChange={(e) => {
                        const val = e.target.value;
                        setAiQuerySearch(val);
                        void fetchAIQueries(val, aiQueryModeFilter);
                      }}
                      className="rounded-xl border border-slate-300 bg-white py-1.5 pl-8 pr-3 text-xs text-slate-900 focus:border-purple-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white w-56 sm:w-64"
                    />
                  </div>

                  <select
                    value={aiQueryModeFilter}
                    onChange={(e) => {
                      const mode = e.target.value;
                      setAiQueryModeFilter(mode);
                      void fetchAIQueries(aiQuerySearch, mode);
                    }}
                    className="rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-900 focus:border-purple-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  >
                    <option value="ALL">Tất cả chế độ</option>
                    <option value="explain">Giải thích (Explain)</option>
                    <option value="deep_think">Đào sâu (Deep Think)</option>
                    <option value="mermaid">Vẽ sơ đồ (Mermaid)</option>
                    <option value="quick_quiz">Đố vui (Quiz)</option>
                    <option value="chat">Chat tự do</option>
                  </select>

                  <button
                    type="button"
                    onClick={() => {
                      void fetchAIQueries(aiQuerySearch, aiQueryModeFilter);
                      void fetchAIAnalytics();
                    }}
                    disabled={loadingAiQueries}
                    className="flex items-center gap-1.5 rounded-xl border border-purple-200 bg-purple-50 px-3 py-1.5 text-xs font-semibold text-purple-700 hover:bg-purple-100 dark:border-purple-900/50 dark:bg-purple-950/50 dark:text-purple-300 dark:hover:bg-purple-900/70 transition-colors disabled:opacity-50"
                  >
                    <RefreshCw className={`h-3.5 w-3.5 ${loadingAiQueries ? 'animate-spin' : ''}`} />
                    <span>Làm mới</span>
                  </button>
                </div>
              </div>

              {/* Queries Table with Prompt and AI Output Inspection */}
              <div className="overflow-x-auto">
                <table className="w-full min-w-[850px] text-left text-xs">
                  <thead className="border-b border-slate-200 bg-slate-50 font-bold uppercase tracking-wider text-slate-500 dark:border-slate-800 dark:bg-slate-800/50 dark:text-slate-400">
                    <tr>
                      <th className="px-4 py-3">Thời gian</th>
                      <th className="px-4 py-3">Người hỏi & IP</th>
                      <th className="px-4 py-3">Ngữ cảnh / Chế độ</th>
                      <th className="px-4 py-3">Câu hỏi (Prompt)</th>
                      <th className="px-4 py-3">Câu trả lời của AI (Output)</th>
                      <th className="px-4 py-3 text-right">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
                    {loadingAiQueries && aiQueriesList.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-8 text-center text-slate-400">
                          Đang tải nhật ký câu hỏi AI...
                        </td>
                      </tr>
                    ) : aiQueriesList.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-8 text-center text-slate-400">
                          Chưa có câu hỏi nào phù hợp với bộ lọc tìm kiếm.
                        </td>
                      </tr>
                    ) : (
                      aiQueriesList.map((q) => {
                        const isHighlighted = highlightedQueryId === q.id;
                        const hasResponse = Boolean(q.response);
                        return (
                          <tr
                            key={q.id}
                            className={`transition-colors ${
                              isHighlighted
                                ? 'bg-purple-100/80 dark:bg-purple-950/70 animate-pulse'
                                : 'hover:bg-slate-50/80 dark:hover:bg-slate-800/50'
                            }`}
                          >
                            {/* 1. Time */}
                            <td className="px-4 py-3 whitespace-nowrap text-slate-400">
                              <div className="font-semibold text-slate-800 dark:text-slate-200">
                                {formatTimeAgo(q.createdAt)}
                              </div>
                              <div className="text-[10px] text-slate-400">
                                {new Date(q.createdAt).toLocaleTimeString('vi-VN')}
                              </div>
                            </td>

                            {/* 2. User & IP */}
                            <td className="px-4 py-3 whitespace-nowrap">
                              <div className="flex items-center gap-2">
                                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-purple-100 text-purple-700 dark:bg-purple-950/70 dark:text-purple-300 font-bold text-xs shrink-0">
                                  {(q.username || 'U').charAt(0).toUpperCase()}
                                </div>
                                <div className="min-w-0">
                                  <div className="font-bold text-slate-900 dark:text-white truncate max-w-[130px]" title={q.username}>
                                    {q.username}
                                  </div>
                                  <div className="text-[10px] text-slate-400 font-mono truncate max-w-[130px]">
                                    {q.ipAddress ? `IP: ${q.ipAddress}` : (q.userId ? `ID: ${q.userId}` : 'Trình duyệt')}
                                  </div>
                                </div>
                              </div>
                            </td>

                            {/* 3. Context & Mode */}
                            <td className="px-4 py-3 whitespace-nowrap">
                              {q.questionId ? (
                                <span className="inline-flex items-center gap-1 rounded-md bg-blue-50 px-2 py-0.5 text-xs font-bold text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-200 dark:border-blue-900/50">
                                  Câu #{q.questionId}
                                </span>
                              ) : (
                                <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                                  Hỏi tự do
                                </span>
                              )}
                              <div className="text-[10px] text-purple-600 dark:text-purple-400 font-semibold mt-0.5">
                                {(MODE_METADATA as any)[q.mode || '']?.shortLabel || q.mode || 'explain'}
                              </div>
                            </td>

                            {/* 4. Prompt Input */}
                            <td className="px-4 py-3">
                              <div
                                onClick={() => setSelectedAIQueryDetail(q)}
                                className="max-w-xs md:max-w-sm line-clamp-2 text-xs text-slate-800 dark:text-slate-200 font-medium whitespace-pre-wrap rounded-lg bg-slate-50 p-2 border border-slate-200/70 dark:border-slate-800 dark:bg-slate-800/60 cursor-pointer hover:border-purple-300 dark:hover:border-purple-700 transition-colors"
                                title="Bấm để xem chi tiết đầy đủ"
                              >
                                "{q.prompt}"
                              </div>
                            </td>

                            {/* 5. AI Output Response */}
                            <td className="px-4 py-3">
                              {hasResponse ? (
                                <div
                                  onClick={() => setSelectedAIQueryDetail(q)}
                                  className="max-w-xs md:max-w-sm line-clamp-2 text-xs text-emerald-900 dark:text-emerald-200 rounded-lg bg-emerald-50/70 p-2 border border-emerald-200 dark:border-emerald-900/40 dark:bg-emerald-950/30 font-sans cursor-pointer hover:border-emerald-400 dark:hover:border-emerald-600 transition-colors"
                                  title="Bấm để xem câu trả lời Markdown & sơ đồ Mermaid đầy đủ"
                                >
                                  {q.response}
                                </div>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-[11px] text-amber-600 dark:text-amber-400 italic">
                                  <Clock className="h-3 w-3" />
                                  <span>Đang xử lý / Không có output</span>
                                </span>
                              )}
                            </td>

                            {/* 6. Action: Inspect Modal */}
                            <td className="px-4 py-3 text-right whitespace-nowrap">
                              <button
                                type="button"
                                onClick={() => setSelectedAIQueryDetail(q)}
                                className="inline-flex items-center gap-1.5 rounded-lg bg-purple-50 hover:bg-purple-100 dark:bg-purple-950/60 dark:hover:bg-purple-900/60 px-2.5 py-1.5 text-xs font-bold text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800/60 transition-colors shadow-2xs cursor-pointer"
                                title="Soi toàn văn câu hỏi và câu trả lời AI"
                              >
                                <Eye className="h-3.5 w-3.5" />
                                <span>Soi chi tiết</span>
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Recent Anonymous AI Feedback Activity */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-3">
                Nhật Ký Đánh Giá Ẩn Danh Gần Đây
              </h3>
              {(!aiMetrics?.recentFeedback || aiMetrics.recentFeedback.length === 0) ? (
                <p className="text-xs text-slate-400 py-6 text-center">Chưa có đánh giá nào gần đây.</p>
              ) : (
                <div className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                  {aiMetrics.recentFeedback.map((fb: any) => (
                    <div key={fb.id} className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="flex items-center gap-2.5">
                        <span className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-bold ${
                          fb.rating === 'up'
                            ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                            : 'bg-rose-500/10 text-rose-600 dark:text-rose-400'
                        }`}>
                          {fb.rating === 'up' ? '👍 Hài lòng' : '👎 Cần cải thiện'}
                        </span>
                        {fb.questionId && (
                          <span className="font-bold text-slate-900 dark:text-white">
                            Câu #{fb.questionId}
                          </span>
                        )}
                        {fb.mode && (
                          <span className="text-slate-400">
                            [{fb.mode}]
                          </span>
                        )}
                        {fb.reasonTags && fb.reasonTags.length > 0 && (
                          <div className="flex gap-1">
                            {fb.reasonTags.map((tag: string) => (
                              <span key={tag} className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                                {tag}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="text-slate-400 text-[11px]">
                        {new Date(fb.createdAt).toLocaleString('vi-VN')}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
              </>
            )}
          </div>
        )}

        {/* =========================================================================
            TAB 6: NHẬT KÝ HOẠT ĐỘNG (AUDIT LOGS)
            ========================================================================= */}
        {activeTab === 'audit' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-slate-900 dark:text-white">Nhật Ký Thao Tác Quản Trị (Audit Logs)</h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Lưu vết toàn bộ hành động duyệt, từ chối câu hỏi, phản hồi người học và nạp đề thi
                </p>
              </div>

              <button
                type="button"
                onClick={fetchAuditLogs}
                className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-200 dark:text-slate-400 dark:hover:bg-slate-800 transition-colors"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                <span>Làm mới</span>
              </button>
            </div>

            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] text-left text-xs">
                <thead className="border-b border-slate-200 bg-slate-50 font-bold uppercase tracking-wider text-slate-500 dark:border-slate-800 dark:bg-slate-800/50 dark:text-slate-400">
                  <tr>
                    <th className="px-4 py-3.5">Thời gian</th>
                    <th className="px-4 py-3.5">Admin thực hiện</th>
                    <th className="px-4 py-3.5">Hành động</th>
                    <th className="px-4 py-3.5">Đối tượng</th>
                    <th className="px-4 py-3.5">Chi tiết</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 text-slate-700 dark:text-slate-300">
                  {loadingAudit ? (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-slate-400">Đang tải nhật ký...</td>
                    </tr>
                  ) : auditLogs.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-slate-400">Chưa có bản ghi nhật ký nào.</td>
                    </tr>
                  ) : (
                    auditLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/30">
                        <td className="px-4 py-3 text-slate-400">{new Date(log.created_at).toLocaleString('vi-VN')}</td>
                        <td className="px-4 py-3 font-semibold text-slate-900 dark:text-white">{log.admin_username || log.admin_id}</td>
                        <td className="px-4 py-3">
                          <span className="rounded bg-slate-100 px-2 py-0.5 font-mono text-[11px] font-bold text-slate-800 dark:bg-slate-800 dark:text-slate-200">
                            {log.action}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-mono text-slate-500 dark:text-slate-400">{log.target_type}: {log.target_id}</td>
                        <td className="px-4 py-3 font-mono text-[11px] text-slate-500 dark:text-slate-400 truncate max-w-xs">{log.metadata_json}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* AI Inspect Query Modal */}
      <AIInspectQueryModal
        isOpen={Boolean(selectedAIQueryDetail)}
        onClose={() => setSelectedAIQueryDetail(null)}
        query={selectedAIQueryDetail}
      />

      {/* UltraView Live Screen Remote Desktop Viewer Modal */}
      {viewingUltraViewSession && (
        <UltraViewScreenViewerModal
          session={viewingUltraViewSession}
          onClose={() => setViewingUltraViewSession(null)}
        />
      )}
    </div>
  );
};
