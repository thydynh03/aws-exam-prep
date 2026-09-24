import React, { useState, useEffect } from 'react';
import {
  X,
  Monitor,
  Maximize2,
  Minimize2,
  Camera,
  Activity,
  MousePointer,
  Clock,
  Sparkles,
  RotateCw,
  SplitSquareVertical,
} from 'lucide-react';
import { realtimeManager } from '../../core/realtime';
import type { LiveSessionRecord } from '../../server/trackerService';
import type { ScreenTelemetryFrame } from '../../core/screenTelemetry';

interface UltraViewScreenViewerModalProps {
  session: LiveSessionRecord;
  onClose: () => void;
}

export const UltraViewScreenViewerModal: React.FC<UltraViewScreenViewerModalProps> = ({
  session,
  onClose,
}) => {
  const [frame, setFrame] = useState<ScreenTelemetryFrame | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [viewScale, setViewScale] = useState<'fit' | 'actual'>('fit');
  const [layoutMode, setLayoutMode] = useState<'split' | 'screen_only' | 'logs_only'>('split');
  const [latencyMs, setLatencyMs] = useState(38);
  const [clickRipple, setClickRipple] = useState<{ x: number; y: number; text: string; id: number } | null>(null);

  // Fetch initial frame & listen to live SSE / WebSocket stream
  useEffect(() => {
    let isMounted = true;

    // 1. Initial snapshot fetch
    const fetchInitial = async () => {
      try {
        const token = localStorage.getItem('aws_prep_auth_token');
        const res = await fetch(`/api/tracker/screen-stream/${encodeURIComponent(session.sessionId)}`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (res.ok) {
          const data = await res.json();
          if (isMounted && data.frame) {
            setFrame(data.frame);
          }
        }
      } catch {
        // Fallback gracefully
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };
    void fetchInitial();

    // 2. Realtime subscription to learner_screen_mirror
    const unsubscribe = realtimeManager.subscribe('learner_screen_mirror', (newFrame: ScreenTelemetryFrame) => {
      if (!newFrame) return;
      if (
        newFrame.sessionId === session.sessionId ||
        (newFrame.username && newFrame.username.toLowerCase() === session.username.toLowerCase())
      ) {
        setFrame((prev) => ({
          ...prev,
          ...newFrame,
          screenImage: newFrame.screenImage || prev?.screenImage,
        }));
        setIsLoading(false);

        // Ping calculation
        const now = Date.now();
        const diff = Math.max(12, Math.min(180, now - (newFrame.updatedAt || now)));
        setLatencyMs(diff);

        // Show click ripple
        if (newFrame.click && now - newFrame.click.timestamp < 2500) {
          setClickRipple({
            x: newFrame.click.xPercent,
            y: newFrame.click.yPercent,
            text: newFrame.click.targetDescription,
            id: newFrame.click.timestamp,
          });
        }
      }
    });

    // 3. Announce active viewing session so learner only captures and streams while watched
    const announceViewing = (active: boolean) => {
      realtimeManager.broadcast('ultraview_session_viewing', {
        sessionId: session.sessionId,
        username: session.username,
        active,
      });
    };
    announceViewing(true);
    realtimeManager.broadcast('request_screen_snapshot', {
      sessionId: session.sessionId,
      username: session.username,
    });

    const keepAliveTimer = setInterval(() => {
      announceViewing(true);
    }, 6000);

    // Close on Escape key
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      isMounted = false;
      clearInterval(keepAliveTimer);
      announceViewing(false);
      unsubscribe();
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [session.sessionId, session.username, onClose]);

  // Request immediate screenshot capture from learner
  const handleRequestSnapshot = () => {
    setIsRefreshing(true);
    realtimeManager.broadcast('request_screen_snapshot', {
      sessionId: session.sessionId,
      username: session.username,
    });
    setTimeout(() => setIsRefreshing(false), 1200);
  };

  // Download evidence screenshot
  const handleDownloadEvidence = () => {
    if (frame?.screenImage) {
      const a = document.createElement('a');
      a.href = frame.screenImage;
      a.download = `ultraview_${session.username}_${new Date().toISOString().replace(/[:.]/g, '-')}.jpg`;
      a.click();
    } else {
      alert(`Đang chờ ảnh chụp màn hình thực tế từ học viên ${session.username}...`);
    }
  };

  // Derived effective data
  const effectiveScreen = frame?.screen || session.currentScreen || 'Trang chủ & Tổng quan';
  const effectiveAction = frame?.action || session.currentAction || 'Đang duyệt trang';
  const activeQuestion = frame?.activeQuestion;
  const cursor = frame?.cursor || { xPercent: 50, yPercent: 45 };
  const recentLogs = frame?.recentLogs || [];

  return (
    <div
      data-ultraview-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-2 sm:p-4 animate-in fade-in duration-200"
    >
      <div className="flex h-[94vh] w-full max-w-7xl flex-col rounded-2xl border border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-950 shadow-2xl overflow-hidden text-slate-800 dark:text-slate-100">
        
        {/* =========================================================================
            ULTRAVIEW TITLEBAR (Authentic Remote Desktop Styled Header)
            ========================================================================= */}
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-950 px-4 py-2.5 shrink-0 select-none">
          <div className="flex items-center gap-3 min-w-0">
            {/* UltraView Brand & Icon */}
            <div className="flex items-center gap-2">
              <div className="relative flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-tr from-blue-600 to-indigo-600 text-white shadow-md">
                <Monitor className="h-4 w-4" />
                <span className="absolute -top-0.5 -right-0.5 flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
                </span>
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">
                    UltraView Web Live
                  </span>
                  <span className="rounded bg-emerald-100 dark:bg-emerald-950/80 border border-emerald-300 dark:border-emerald-700/60 px-1.5 py-0.2 text-[10px] font-bold text-emerald-700 dark:text-emerald-300 animate-pulse flex items-center gap-1">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                    MÀN HÌNH THẬT
                  </span>
                </div>
                <h2 className="text-sm font-bold text-slate-900 dark:text-white truncate max-w-[280px] sm:max-w-md">
                  {session.username}{' '}
                  <span className="font-normal text-slate-500 dark:text-slate-400 text-xs">
                    ({session.os} &bull; {session.browser})
                  </span>
                </h2>
              </div>
            </div>

            {/* Connection Metrics Pill */}
            <div className="hidden md:flex items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400 border-l border-slate-300 dark:border-slate-800 pl-3">
              <span className="flex items-center gap-1">
                <Activity className="h-3 w-3 text-emerald-500" />
                <span>{latencyMs}ms</span>
              </span>
              <span>&bull;</span>
              <span>60 FPS</span>
              <span>&bull;</span>
              <span className="font-mono text-slate-700 dark:text-slate-300">
                {frame?.viewport ? `${frame.viewport.width}x${frame.viewport.height}` : session.screenResolution}
              </span>
              <span>&bull;</span>
              <span className="text-slate-500 dark:text-slate-400">IP: {session.ipAddress}</span>
            </div>
          </div>

          {/* Action Tools & Window Controls */}
          <div className="flex items-center gap-1.5">
            {/* Refresh / Snapshot button */}
            <button
              type="button"
              onClick={handleRequestSnapshot}
              disabled={isRefreshing}
              title="Yêu cầu chụp và làm mới màn hình ngay"
              className="flex items-center gap-1 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800/80 px-2.5 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors disabled:opacity-50 shadow-xs"
            >
              <RotateCw className={`h-3.5 w-3.5 ${isRefreshing ? 'animate-spin text-blue-500' : ''}`} />
              <span className="hidden sm:inline">{isRefreshing ? 'Đang chụp...' : 'Chụp Mới'}</span>
            </button>

            {/* Layout Mode Toggle */}
            <button
              type="button"
              onClick={() => setLayoutMode(prev => prev === 'split' ? 'screen_only' : 'split')}
              title="Chuyển chế độ xem chia đôi / toàn màn hình"
              className="hidden sm:flex items-center gap-1 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800/80 px-2.5 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors shadow-xs"
            >
              <SplitSquareVertical className="h-3.5 w-3.5" />
              <span>{layoutMode === 'split' ? 'Chỉ Màn Hình' : 'Chia Đôi'}</span>
            </button>

            {/* Scale Toggle */}
            <button
              type="button"
              onClick={() => setViewScale(prev => prev === 'fit' ? 'actual' : 'fit')}
              title={viewScale === 'fit' ? 'Xem kích thước gốc 100%' : 'Tự co giãn vừa màn hình'}
              className="flex items-center gap-1 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800/80 px-2.5 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors shadow-xs"
            >
              {viewScale === 'fit' ? <Maximize2 className="h-3.5 w-3.5" /> : <Minimize2 className="h-3.5 w-3.5" />}
              <span className="hidden sm:inline">{viewScale === 'fit' ? 'Tỷ Lệ 100%' : 'Co Vừa Khung'}</span>
            </button>

            {/* Screenshot evidence button */}
            <button
              type="button"
              onClick={handleDownloadEvidence}
              title="Tải ảnh bằng chứng thao tác màn hình"
              className="flex items-center gap-1 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800/80 px-2.5 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors shadow-xs"
            >
              <Camera className="h-3.5 w-3.5 text-amber-500" />
              <span className="hidden sm:inline">Lưu Bằng Chứng</span>
            </button>

            {/* Close button */}
            <button
              type="button"
              onClick={onClose}
              title="Đóng cửa sổ UltraView (ESC)"
              className="rounded-lg border border-slate-300 dark:border-slate-700 bg-red-50 dark:bg-red-950/40 p-1.5 text-red-600 dark:text-red-300 hover:bg-red-100 dark:hover:bg-red-900/60 transition-colors ml-1"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* =========================================================================
            MAIN WORKSPACE: REAL SCREEN VIEWPORT + LIVE BEHAVIOR LOGS
            ========================================================================= */}
        <div className="flex flex-1 min-h-0 overflow-hidden">
          
          {/* LEFT: REAL SCREEN VIEWPORT */}
          {layoutMode !== 'logs_only' && (
            <div className="flex-1 flex flex-col min-w-0 bg-slate-200 dark:bg-slate-950 relative overflow-hidden">
              
              {/* Browser Address & Status Bar */}
              <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800/80 bg-white dark:bg-slate-900/90 px-3 py-1.5 text-[11px] text-slate-600 dark:text-slate-400 shrink-0">
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <div className="flex items-center gap-1 rounded-md bg-slate-100 dark:bg-slate-950 px-2 py-0.5 font-mono text-[10px] text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-800 truncate max-w-sm">
                    <span className="text-emerald-600 dark:text-emerald-400">https://</span>
                    <span>aws-exam-prep.app/</span>
                    <span className="text-blue-600 dark:text-blue-400 font-bold">
                      {activeQuestion ? `practice#q=${activeQuestion.id}` : 'overview'}
                    </span>
                  </div>
                  <span className="text-slate-400 hidden sm:inline">&bull;</span>
                  <div className="truncate font-semibold text-slate-800 dark:text-slate-200">
                    <span className="text-blue-600 dark:text-blue-400 uppercase tracking-wider text-[10px] mr-1.5 font-bold">
                      [{effectiveScreen}]
                    </span>
                    <span>{effectiveAction}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-[10px] text-slate-500 dark:text-slate-400">
                    Cuộn: {frame?.scroll?.scrollPercent ?? 0}%
                  </span>
                </div>
              </div>

              {/* Viewport Content Area (ACTUAL Real Screen Canvas) */}
              <div className="flex-1 overflow-auto p-3 sm:p-5 relative bg-slate-200 dark:bg-slate-900/60 flex items-start justify-center">
                
                {isLoading && !frame ? (
                  <div className="flex flex-col items-center justify-center h-full text-slate-500 dark:text-slate-400 gap-3 py-20">
                    <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
                    <p className="text-xs font-medium">Đang kết nối luồng hình ảnh UltraView đến máy học viên...</p>
                  </div>
                ) : frame?.screenImage ? (
                  /* =================================================================
                     MÀN HÌNH CHÍNH THỰC TẾ (REAL SCREEN DISPLAY)
                     ================================================================= */
                  <div
                    className={`relative transition-all rounded-xl border border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-950 shadow-2xl overflow-hidden ${
                      viewScale === 'actual' ? 'w-auto max-w-none' : 'w-full max-w-5xl'
                    }`}
                  >
                    {/* Real Screen Header Bar */}
                    <div className="border-b border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-950 px-4 py-2 flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1.5">
                          <div className="h-2.5 w-2.5 rounded-full bg-red-500/80" />
                          <div className="h-2.5 w-2.5 rounded-full bg-amber-500/80" />
                          <div className="h-2.5 w-2.5 rounded-full bg-emerald-500/80" />
                        </div>
                        <span className="font-bold text-slate-800 dark:text-slate-200 ml-1">
                          Màn hình trực tiếp của {session.username}
                        </span>
                        <span className="rounded bg-emerald-100 dark:bg-emerald-950/80 border border-emerald-300 dark:border-emerald-700/60 px-1.5 py-0.2 text-[10px] font-bold text-emerald-700 dark:text-emerald-300 flex items-center gap-1">
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                          MÀN HÌNH THẬT
                        </span>
                      </div>

                      <div className="flex items-center gap-3 text-[11px] text-slate-500 dark:text-slate-400">
                        <span>{frame.viewport?.width || 1280}x{frame.viewport?.height || 720}</span>
                        <span>&bull;</span>
                        <span>Cập nhật: {frame.updatedAt ? new Date(frame.updatedAt).toLocaleTimeString('vi-VN') : 'Vừa xong'}</span>
                      </div>
                    </div>

                    {/* Actual Screen Image Frame with Overlay Controls */}
                    <div className="relative overflow-hidden bg-slate-950 flex items-center justify-center">
                      <img
                        src={frame.screenImage}
                        alt={`Màn hình thực tế của ${session.username}`}
                        className={`block w-full h-auto object-contain select-none pointer-events-none ${
                          viewScale === 'actual' ? 'max-w-none' : 'max-h-[74vh]'
                        }`}
                      />

                      {/* Live Action Overlay Banner */}
                      <div className="absolute top-3 left-3 z-30 flex items-center gap-2 rounded-lg bg-black/80 px-3 py-1.5 text-xs font-semibold text-white backdrop-blur-md border border-white/10 shadow-lg pointer-events-none">
                        <div className="h-2 w-2 rounded-full bg-emerald-400 animate-ping" />
                        <span className="text-emerald-300 font-bold">[{effectiveScreen}]</span>
                        <span className="text-slate-400">|</span>
                        <span className="text-slate-200">{effectiveAction}</span>
                      </div>

                      {/* =====================================================================
                          LIVE REMOTE MOUSE CURSOR (Overlayed on real screen)
                          ===================================================================== */}
                      <div
                        className="pointer-events-none absolute z-40 transition-all duration-100 ease-out"
                        style={{
                          left: `${cursor.xPercent}%`,
                          top: `${cursor.yPercent}%`,
                        }}
                      >
                        <div className="relative -top-1 -left-1">
                          <MousePointer className="h-6 w-6 text-red-500 fill-red-500 drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)] transform -rotate-12 animate-pulse" />
                          <div className="absolute top-4 left-4 whitespace-nowrap rounded-md bg-red-600 px-2 py-0.5 text-[10px] font-bold text-white shadow-xl flex items-center gap-1 border border-white/20">
                            <span>{session.username} 🖱️</span>
                            <span className="opacity-80 text-[9px]">
                              ({Math.round(cursor.xPercent)}%, {Math.round(cursor.yPercent)}%)
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* =====================================================================
                          CLICK RIPPLE (Overlayed on real screen)
                          ===================================================================== */}
                      {clickRipple && (
                        <div
                          key={clickRipple.id}
                          className="pointer-events-none absolute z-30 transform -translate-x-1/2 -translate-y-1/2"
                          style={{
                            left: `${clickRipple.x}%`,
                            top: `${clickRipple.y}%`,
                          }}
                        >
                          <span className="absolute -top-4 -left-4 h-12 w-12 rounded-full bg-red-400/80 animate-ping" />
                          <span className="relative inline-flex h-4 w-4 rounded-full bg-red-500 shadow-lg ring-4 ring-red-300/60" />
                          <div className="absolute top-5 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-md bg-black/90 border border-slate-700 px-2 py-0.5 text-[10px] font-bold text-amber-300 shadow-xl backdrop-blur-sm">
                            {clickRipple.text}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  /* Waiting for initial real screen snapshot */
                  <div className="flex flex-col items-center justify-center py-20 text-center gap-4 max-w-md bg-white dark:bg-slate-900 rounded-2xl p-8 border border-slate-300 dark:border-slate-800 shadow-xl">
                    <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-500/10 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400 shadow-inner">
                      <Monitor className="h-8 w-8 animate-pulse" />
                      <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
                        <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-blue-500" />
                      </span>
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-slate-800 dark:text-slate-100">
                        Đang đồng bộ màn hình thực tế từ {session.username}
                      </h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                        Hệ thống đang kết nối luồng hình ảnh màn hình của học viên. Vị trí hiện tại: <strong className="text-slate-700 dark:text-slate-200">[{effectiveScreen}]</strong> &bull; {effectiveAction}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={handleRequestSnapshot}
                      disabled={isRefreshing}
                      className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white shadow hover:bg-blue-700 transition-colors disabled:opacity-50"
                    >
                      <RotateCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                      <span>{isRefreshing ? 'Đang Chụp Màn Hình...' : 'Yêu Cầu Chụp Màn Hình Ngay'}</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* RIGHT: LIVE ACTION & BEHAVIORAL LOGS TIMELINE */}
          {layoutMode !== 'screen_only' && (
            <div className="w-full sm:w-80 lg:w-96 border-l border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 flex flex-col shrink-0">
              
              <div className="border-b border-slate-200 dark:border-slate-800 px-4 py-3 bg-white dark:bg-slate-900/60 flex items-center justify-between">
                <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                  <Activity className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                  <span>Nhật Ký Hành Vi Live</span>
                </h3>
                <span className="rounded-full bg-blue-100 dark:bg-blue-950 border border-blue-300 dark:border-blue-800 px-2 py-0.5 text-[10px] font-bold text-blue-700 dark:text-blue-300">
                  {recentLogs.length} sự kiện
                </span>
              </div>

              {/* Logs Stream */}
              <div className="flex-1 overflow-y-auto p-3 space-y-2">
                {recentLogs.length === 0 ? (
                  <div className="text-center py-12 text-slate-400 text-xs">
                    <Clock className="h-6 w-6 mx-auto mb-2 opacity-50" />
                    Chưa có nhật ký hành vi nào. Các thao tác rê chuột, click và chọn đáp án sẽ hiển thị ngay tại đây.
                  </div>
                ) : (
                  recentLogs.map((log) => (
                    <div
                      key={log.id}
                      className="rounded-xl border border-slate-200 dark:border-slate-800/80 bg-white dark:bg-slate-900/80 p-2.5 transition-all text-xs hover:border-slate-300 dark:hover:border-slate-700 shadow-xs"
                    >
                      <div className="flex items-center justify-between gap-1 mb-1">
                        <span className="text-[10px] font-mono text-slate-400">
                          {new Date(log.timestamp).toLocaleTimeString('vi-VN')}
                        </span>
                        {log.badge && (
                          <span className="rounded bg-slate-100 dark:bg-slate-800 px-1.5 py-0.2 text-[9px] font-semibold text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                            {log.badge}
                          </span>
                        )}
                      </div>
                      <p className="text-slate-800 dark:text-slate-200 text-[11px] leading-relaxed break-words font-medium">
                        {log.text}
                      </p>
                    </div>
                  ))
                )}
              </div>

              {/* Realtime Telemetry Summary Footer */}
              <div className="border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/90 p-3 space-y-2 text-[11px]">
                <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
                  <span className="flex items-center gap-1">
                    <Sparkles className="h-3.5 w-3.5 text-amber-500" />
                    <span>Hành vi học tập:</span>
                  </span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">
                    {activeQuestion?.selectedAnswer ? 'Đang phân tích đáp án' : 'Đang thao tác trên hệ thống'}
                  </span>
                </div>
                <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
                  <span className="flex items-center gap-1">
                    <Monitor className="h-3.5 w-3.5 text-blue-500" />
                    <span>Thiết bị học viên:</span>
                  </span>
                  <span className="font-medium text-slate-700 dark:text-slate-300">
                    {session.deviceType} &bull; {session.os}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
