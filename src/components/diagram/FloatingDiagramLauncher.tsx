import React, { useState, useEffect, useRef } from 'react';
import { Network, Sparkles } from 'lucide-react';

const ICON_SIZE = 54;
const STORAGE_KEY_POS = 'xbrain_diagram_launcher_pos_v1';

interface IconPosition {
  x: number;
  y: number;
}

function clampPosition(x: number, y: number, size = ICON_SIZE): IconPosition {
  if (typeof window === 'undefined') return { x, y };
  const pad = 16;
  const maxX = Math.max(pad, window.innerWidth - size - pad);
  const maxY = Math.max(pad, window.innerHeight - size - (window.innerWidth < 640 ? 140 : 80));
  return {
    x: Math.min(maxX, Math.max(pad, x)),
    y: Math.min(maxY, Math.max(pad, y)),
  };
}

function getDefaultPosition(size = ICON_SIZE): IconPosition {
  if (typeof window === 'undefined') return { x: 100, y: 100 };
  const isMobile = window.innerWidth < 640;
  // Position above the AI Tutor button (e.g. 70px above it)
  return clampPosition(
    window.innerWidth - size - 16,
    window.innerHeight - (isMobile ? 190 : 144),
    size
  );
}

interface FloatingDiagramLauncherProps {
  isOpen: boolean;
  isMinimized: boolean;
  onOpen: () => void;
}

export const FloatingDiagramLauncher: React.FC<FloatingDiagramLauncherProps> = ({
  isOpen,
  isMinimized,
  onOpen,
}) => {
  const [position, setPosition] = useState<IconPosition>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_POS);
      if (saved) {
        const parsed = JSON.parse(saved) as IconPosition;
        return clampPosition(parsed.x, parsed.y);
      }
    } catch {
      // Fallback
    }
    return getDefaultPosition();
  });

  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef<{ clientX: number; clientY: number; posX: number; posY: number } | null>(null);
  const hasMovedRef = useRef(false);

  // Resize listener to keep icon within screen
  useEffect(() => {
    const handleResize = () => {
      setPosition((prev) => clampPosition(prev.x, prev.y));
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handlePointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (e.button !== 0) return;
    dragStartRef.current = {
      clientX: e.clientX,
      clientY: e.clientY,
      posX: position.x,
      posY: position.y,
    };
    hasMovedRef.current = false;
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (!dragStartRef.current) return;
    const dx = e.clientX - dragStartRef.current.clientX;
    const dy = e.clientY - dragStartRef.current.clientY;
    if (!hasMovedRef.current && Math.hypot(dx, dy) > 4) {
      hasMovedRef.current = true;
      setIsDragging(true);
    }
    if (hasMovedRef.current) {
      const nextPos = clampPosition(dragStartRef.current.posX + dx, dragStartRef.current.posY + dy);
      setPosition(nextPos);
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (!dragStartRef.current) return;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    const moved = hasMovedRef.current;
    dragStartRef.current = null;
    setIsDragging(false);

    if (moved) {
      try {
        localStorage.setItem(STORAGE_KEY_POS, JSON.stringify(position));
      } catch {
        // Fallback
      }
    } else {
      // Clean click
      onOpen();
    }
  };

  // Only render launcher if workspace is closed or minimized
  if (isOpen && !isMinimized) return null;

  return (
    <button
      type="button"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      style={{ left: `${position.x}px`, top: `${position.y}px` }}
      title={isMinimized ? 'Mở lại AI Diagram (Kéo thả)' : 'AI Diagram & Brainstorming Workspace (Kéo thả)'}
      aria-label="AI Diagram & Brainstorming Workspace"
      className={`fixed z-40 flex h-12 w-12 sm:h-13 sm:w-13 items-center justify-center rounded-2xl shadow-xl transition-transform active:scale-95 group touch-none cursor-grab active:cursor-grabbing border ${
        isDragging
          ? 'scale-105 shadow-2xl opacity-90'
          : 'hover:scale-105'
      } bg-linear-to-tr from-purple-600 via-indigo-600 to-blue-500 border-purple-300/40 dark:border-purple-500/40 text-white`}
    >
      {/* Pulse sparkle indicator */}
      <span className="pointer-events-none absolute -top-1 -right-1 flex h-3.5 w-3.5">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-purple-400 opacity-75" />
        <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-purple-400 border-2 border-white dark:border-slate-900" />
      </span>

      {/* Network / Diagram Icon */}
      <Network className="h-5 w-5 sm:h-6 sm:w-6 text-white drop-shadow-xs pointer-events-none" />

      {/* Minimized / Active Badge */}
      {isMinimized ? (
        <span className="pointer-events-none absolute -bottom-1.5 inset-x-0 mx-auto w-max px-1.5 py-0.5 rounded-full bg-purple-950 text-purple-200 text-[8px] font-bold border border-purple-400/40 shadow-xs leading-none">
          Thu nhỏ
        </span>
      ) : (
        <span className="pointer-events-none absolute -bottom-1.5 inset-x-0 mx-auto w-max px-1.5 py-0.5 rounded-full bg-slate-900/90 dark:bg-slate-950 text-amber-300 text-[8px] font-bold border border-white/20 shadow-xs leading-none flex items-center gap-0.5">
          <Sparkles className="w-2 h-2 text-amber-300" />
          <span>Diagram</span>
        </span>
      )}

      {/* Hover Tooltip on desktop */}
      {!isDragging && (
        <span className="pointer-events-none absolute -top-8 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-md bg-slate-900/95 px-2 py-1 text-[10px] font-medium text-white opacity-0 group-hover:opacity-100 transition-opacity shadow-md dark:bg-slate-800 border border-slate-700">
          {isMinimized ? 'Mở lại AI Diagram (Kéo thả)' : 'AI Diagram & Brainstorming (Kéo thả)'}
        </span>
      )}
    </button>
  );
};
