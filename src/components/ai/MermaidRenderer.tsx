import React, { useState, useEffect, useRef, useId, useContext } from 'react';
import { Maximize2, Copy, Check, Download, AlertTriangle, Code2, RefreshCw } from 'lucide-react';
import { ImageLightboxModal } from './ImageLightboxModal';
import { sanitizeMermaidCode, healMermaidFallback, healMermaidUltraSafe, cleanupAnyRogueMermaidElements } from './mermaidSanitizer';
import { ThemeContext } from '../../context/themeContextDef';

interface MermaidRendererProps {
  code: string;
}

// Module-level cache for mermaid instance
let mermaidInstancePromise: Promise<any> | null = null;
function getMermaid() {
  if (!mermaidInstancePromise) {
    mermaidInstancePromise = import('mermaid').then((m) => {
      m.default.initialize({
        startOnLoad: false,
        securityLevel: 'loose',
        suppressErrorRendering: true,
      });
      return m.default;
    });
  }
  return mermaidInstancePromise;
}

function cleanupMermaidErrorElements(idPrefix: string) {
  if (typeof document === 'undefined') return;
  try {
    const el1 = document.getElementById(idPrefix);
    if (el1?.parentNode) el1.parentNode.removeChild(el1);
    const el2 = document.getElementById(`d${idPrefix}`);
    if (el2?.parentNode) el2.parentNode.removeChild(el2);
    const queryMatches = document.querySelectorAll(`[id*="${idPrefix}"]`);
    queryMatches.forEach((el) => {
      if (el?.parentNode) el.parentNode.removeChild(el);
    });
  } catch {
    // Ignore DOM cleanup errors
  }
}

const MermaidRendererComponent: React.FC<MermaidRendererProps> = ({ code }) => {
  const [svgHtml, setSvgHtml] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isCopied, setIsCopied] = useState(false);
  const [showRawCode, setShowRawCode] = useState(false);
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);
  const [retryCount, setRetryCount] = useState(0);

  const containerRef = useRef<HTMLDivElement>(null);
  const rawId = useId();
  const diagramId = `mermaid_${rawId.replace(/[^a-zA-Z0-9]/g, '_')}`;

  // Check dark mode reactively via context and class
  const themeContext = useContext(ThemeContext);
  const isDarkMode = themeContext?.theme === 'dark' || (typeof document !== 'undefined' && document.documentElement.classList.contains('dark'));

  // Initial cleanup of any stray elements
  useEffect(() => {
    cleanupAnyRogueMermaidElements();
  }, []);

  useEffect(() => {
    let isMounted = true;

    const renderDiagram = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const mermaid = await getMermaid();

        // Re-initialize with correct theme for this render
        mermaid.initialize({
          startOnLoad: false,
          securityLevel: 'loose',
          suppressErrorRendering: true,
          theme: isDarkMode ? 'dark' : 'default',
          themeVariables: isDarkMode
            ? {
                darkMode: true,
                background: '#0f172a',
                primaryColor: '#1e3a8a',
                primaryTextColor: '#f8fafc',
                primaryBorderColor: '#60a5fa',
                lineColor: '#94a3b8',
                secondaryColor: '#1e293b',
                tertiaryColor: '#0f172a',
                fontFamily: 'ui-sans-serif, system-ui, sans-serif',
              }
            : {
                darkMode: false,
                background: '#f8fafc',
                primaryColor: '#eff6ff',
                primaryTextColor: '#0f172a',
                primaryBorderColor: '#3b82f6',
                lineColor: '#64748b',
                fontFamily: 'ui-sans-serif, system-ui, sans-serif',
              },
        });

        // Pass 1: Standard sanitized and auto-healed code
        const sanitized = sanitizeMermaidCode(code);
        const pass1Id = `${diagramId}_p1_${Date.now()}`;

        try {
          const { svg } = await mermaid.render(pass1Id, sanitized);
          if (isMounted) {
            setSvgHtml(svg);
            setIsLoading(false);
            setError(null);
          }
          return;
        } catch (firstErr: any) {
          console.warn('[MermaidRenderer] Pass 1 render failed, trying Pass 2 fallback healer:', firstErr?.message);
          cleanupMermaidErrorElements(pass1Id);
        }

        // Pass 2: Progressive fallback (flattens problematic subgraphs while keeping all nodes and connections)
        const fallback = healMermaidFallback(code);
        const pass2Id = `${diagramId}_p2_${Date.now()}`;

        try {
          const { svg } = await mermaid.render(pass2Id, fallback);
          if (isMounted) {
            setSvgHtml(svg);
            setIsLoading(false);
            setError(null);
          }
          return;
        } catch (secondErr: any) {
          console.warn('[MermaidRenderer] Pass 2 render failed, trying Pass 3 ultra-safe healer:', secondErr?.message);
          cleanupMermaidErrorElements(pass2Id);
        }

        // Pass 3: Ultra-safe progressive fallback (simplifies labels to guarantee rendering)
        const ultraSafe = healMermaidUltraSafe(code);
        const pass3Id = `${diagramId}_p3_${Date.now()}`;

        try {
          const { svg } = await mermaid.render(pass3Id, ultraSafe);
          if (isMounted) {
            setSvgHtml(svg);
            setIsLoading(false);
            setError(null);
          }
          return;
        } catch (thirdErr: any) {
          console.warn('[MermaidRenderer] Pass 3 render failed:', thirdErr?.message);
          cleanupMermaidErrorElements(pass3Id);
          if (isMounted) {
            setError(thirdErr?.message || 'Cú pháp sơ đồ cần được điều chỉnh');
            setIsLoading(false);
          }
        }
      } catch (err: any) {
        if (isMounted) {
          console.warn('[MermaidRenderer] General rendering failure:', err);
          setError(err?.message || 'Không thể hiển thị sơ đồ này');
          setIsLoading(false);
        }
      }
    };

    renderDiagram();

    return () => {
      isMounted = false;
    };
  }, [code, diagramId, isDarkMode, retryCount]);

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    } catch {
      // Ignore clipboard failure
    }
  };

  const handleExportPng = () => {
    if (!containerRef.current) return;
    const svgElement = containerRef.current.querySelector('svg');
    if (!svgElement) return;

    try {
      const svgString = new XMLSerializer().serializeToString(svgElement);
      const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
      const url = URL.createObjectURL(svgBlob);
      const img = new Image();

      img.onload = () => {
        const canvas = document.createElement('canvas');
        const scale = 2; // 2x Retina resolution
        const width = (svgElement.clientWidth || 800);
        const height = (svgElement.clientHeight || 500);
        canvas.width = width * scale;
        canvas.height = height * scale;
        const ctx = canvas.getContext('2d');

        if (ctx) {
          ctx.scale(scale, scale);
          // Background fill
          ctx.fillStyle = isDarkMode ? '#0f172a' : '#ffffff';
          ctx.fillRect(0, 0, width, height);
          ctx.drawImage(img, 0, 0, width, height);

          const pngUrl = canvas.toDataURL('image/png');
          const downloadLink = document.createElement('a');
          downloadLink.href = pngUrl;
          downloadLink.download = `aws-architecture-${Date.now()}.png`;
          document.body.appendChild(downloadLink);
          downloadLink.click();
          document.body.removeChild(downloadLink);
        }
        URL.revokeObjectURL(url);
      };

      img.src = url;
    } catch (err) {
      console.error('Export PNG failed:', err);
    }
  };

  return (
    <div className="my-3 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900/90 transition-all">
      {/* Header Toolbar */}
      <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/90 px-3 py-1.5 text-xs dark:border-slate-800/80 dark:bg-slate-800/60">
        <div className="flex items-center gap-1.5 font-medium text-slate-700 dark:text-slate-200">
          <span className="flex h-2 w-2 rounded-full bg-blue-500"></span>
          <span className="font-semibold text-[11px] tracking-wide uppercase">Sơ đồ kiến trúc AWS (Mermaid)</span>
        </div>

        <div className="flex items-center gap-1">
          {/* Toggle Raw Code */}
          <button
            type="button"
            onClick={() => setShowRawCode((prev) => !prev)}
            title={showRawCode ? 'Xem hình vẽ sơ đồ' : 'Xem mã nguồn Mermaid'}
            className="flex items-center gap-1 rounded-md px-2 py-1 text-[11px] text-slate-600 hover:bg-slate-200/70 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-700/60 dark:hover:text-slate-100 transition-colors"
          >
            <Code2 className="h-3 w-3" />
            <span>{showRawCode ? 'Sơ đồ' : 'Mã'}</span>
          </button>

          {/* Copy Mermaid Code */}
          <button
            type="button"
            onClick={handleCopyCode}
            title="Sao chép cú pháp Mermaid"
            className="flex items-center gap-1 rounded-md px-2 py-1 text-[11px] text-slate-600 hover:bg-slate-200/70 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-700/60 dark:hover:text-slate-100 transition-colors"
          >
            {isCopied ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
            <span>{isCopied ? 'Đã chép' : 'Chép'}</span>
          </button>

          {/* Download / Export PNG Image */}
          <button
            type="button"
            onClick={handleExportPng}
            disabled={Boolean(error) || isLoading}
            title="Lưu / Tải sơ đồ thành ảnh PNG sắc nét (2x Retina)"
            className="flex items-center gap-1 rounded-md bg-blue-50 px-2 py-1 text-[11px] font-semibold text-blue-700 hover:bg-blue-100 dark:bg-blue-950/60 dark:text-blue-300 dark:hover:bg-blue-900/60 transition-colors disabled:opacity-40"
          >
            <Download className="h-3 w-3" />
            <span>Lưu ảnh</span>
          </button>

          {/* Fullscreen Lightbox */}
          <button
            type="button"
            onClick={() => setIsLightboxOpen(true)}
            disabled={Boolean(error) || isLoading}
            title="Phóng to toàn màn hình để xem chi tiết sơ đồ"
            className="flex items-center gap-1 rounded-md px-2 py-1 text-[11px] text-slate-600 hover:bg-slate-200/70 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-700/60 dark:hover:text-slate-100 transition-colors disabled:opacity-40"
          >
            <Maximize2 className="h-3 w-3" />
            <span>Phóng to</span>
          </button>
        </div>
      </div>

      {/* Main Diagram Area */}
      <div className="p-3">
        {showRawCode ? (
          <pre className="overflow-x-auto rounded-lg bg-slate-950 p-3 font-mono text-[11px] text-emerald-400 leading-relaxed">
            <code>{code}</code>
          </pre>
        ) : error ? (
          <div className="rounded-lg border border-amber-200 bg-amber-50/80 p-3 text-xs dark:border-amber-900/50 dark:bg-amber-950/30">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 font-semibold text-amber-800 dark:text-amber-300">
                <AlertTriangle className="h-4 w-4 shrink-0 text-amber-500" />
                <span>Chưa thể hiển thị đồ họa cho cú pháp này</span>
              </div>
              <button
                type="button"
                onClick={() => setRetryCount((prev) => prev + 1)}
                className="flex items-center gap-1 px-2 py-1 rounded bg-amber-200/60 hover:bg-amber-300/60 dark:bg-amber-900/60 dark:hover:bg-amber-800/60 text-amber-900 dark:text-amber-200 text-[11px] font-medium transition-colors cursor-pointer"
              >
                <RefreshCw className="w-3 h-3" />
                <span>Thử lại</span>
              </button>
            </div>
            <p className="mt-1 text-[11px] text-amber-700/90 dark:text-amber-400/90">
              Bạn có thể bấm nút &quot;Mã&quot; ở góc trên để xem cú pháp text sơ đồ.
            </p>
            <pre className="mt-2 overflow-x-auto rounded bg-slate-100 p-2 font-mono text-[11px] text-slate-800 dark:bg-slate-900 dark:text-slate-300 border border-slate-200 dark:border-slate-800">
              {code}
            </pre>
          </div>
        ) : isLoading ? (
          <div className="flex h-36 items-center justify-center gap-2 text-xs text-slate-400">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-blue-500 border-t-transparent"></div>
            <span>Đang kết xuất sơ đồ kiến trúc...</span>
          </div>
        ) : (
          <div
            ref={containerRef}
            className="w-full overflow-x-auto flex justify-center py-2 [&>svg]:max-w-full [&>svg]:h-auto transition-all"
            dangerouslySetInnerHTML={{ __html: svgHtml }}
          />
        )}
      </div>

      {/* Lightbox Modal */}
      <ImageLightboxModal
        isOpen={isLightboxOpen}
        onClose={() => setIsLightboxOpen(false)}
        title="Sơ đồ kiến trúc AWS"
        svgContent={svgHtml}
        onDownload={handleExportPng}
      />
    </div>
  );
};

export const MermaidRenderer = React.memo(MermaidRendererComponent);

