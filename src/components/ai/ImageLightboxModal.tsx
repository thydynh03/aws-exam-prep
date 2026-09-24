import React, { useState, useEffect } from 'react';
import { X, ZoomIn, ZoomOut, RotateCcw, Download } from 'lucide-react';

interface ImageLightboxModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  imageSrc?: string;
  svgContent?: string;
  onDownload?: () => void;
}

export const ImageLightboxModal: React.FC<ImageLightboxModalProps> = ({
  isOpen,
  onClose,
  title = 'Xem hình ảnh / Sơ đồ kiến trúc',
  imageSrc,
  svgContent,
  onDownload,
}) => {
  const [scale, setScale] = useState(1);

  const handleClose = () => {
    setScale(1);
    onClose();
  };

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setScale(1);
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleZoomIn = () => setScale((prev) => Math.min(prev + 0.25, 3));
  const handleZoomOut = () => setScale((prev) => Math.max(prev - 0.25, 0.5));
  const handleReset = () => setScale(1);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-slate-950/85 backdrop-blur-md p-4 transition-opacity animate-in fade-in duration-200"
      onClick={handleClose}
    >
      {/* Top Header Bar */}
      <div
        className="w-full max-w-5xl mb-3 flex items-center justify-between px-4 py-2 rounded-xl bg-slate-900/90 border border-slate-800 text-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-slate-200 truncate max-w-md">{title}</span>
          <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-400">
            {Math.round(scale * 100)}%
          </span>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={handleZoomOut}
            title="Thu nhỏ"
            className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-300 hover:text-white transition-colors"
          >
            <ZoomOut className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={handleReset}
            title="Đặt lại kích thước 100%"
            className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-300 hover:text-white transition-colors"
          >
            <RotateCcw className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={handleZoomIn}
            title="Phóng to"
            className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-300 hover:text-white transition-colors"
          >
            <ZoomIn className="h-4 w-4" />
          </button>

          {onDownload && (
            <button
              type="button"
              onClick={onDownload}
              title="Tải ảnh PNG"
              className="flex items-center gap-1 ml-2 px-2.5 py-1 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium transition-colors shadow"
            >
              <Download className="h-3.5 w-3.5" />
              <span>Tải ảnh</span>
            </button>
          )}

          <button
            type="button"
            onClick={handleClose}
            title="Đóng (Esc)"
            className="ml-2 p-1.5 rounded-lg hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Main View Area */}
      <div
        className="relative w-full max-w-5xl h-[80vh] flex items-center justify-center overflow-auto rounded-2xl bg-white/95 dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 shadow-2xl p-6 select-none"
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            transform: `scale(${scale})`,
            transformOrigin: 'center center',
            transition: 'transform 0.15s ease-out',
          }}
          className="flex items-center justify-center max-w-full max-h-full"
        >
          {svgContent ? (
            <div
              className="w-full flex justify-center [&>svg]:max-w-full [&>svg]:h-auto"
              dangerouslySetInnerHTML={{ __html: svgContent }}
            />
          ) : imageSrc ? (
            <img
              src={imageSrc}
              alt={title}
              className="max-w-full max-h-[70vh] object-contain rounded-lg shadow"
            />
          ) : null}
        </div>
      </div>
    </div>
  );
};
