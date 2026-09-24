import type { Diagram, DiagramWorkbook } from './diagramTypes';
import { syncCloudWorkbook } from '../api';

const STORAGE_KEY_WORKBOOK = 'xbrain_aws_diagram_workbook_v1';

const STORAGE_KEY_DIAGRAMS = 'xbrain_aws_diagrams_v1';
const STORAGE_KEY_ACTIVE_ID = 'xbrain_aws_active_diagram_id_v1';

export interface DiagramSummary {
  id: string;
  name: string;
  description?: string;
  nodeCount: number;
  edgeCount: number;
  updatedAt: number;
  createdAt: number;
}

/**
 * Generate unique ID for nodes, edges, or diagrams
 */
export function generateId(prefix = 'el'): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 7)}`;
}

/**
 * Creates an empty default diagram
 */
export function createEmptyDiagram(name = 'Untitled Architecture'): Diagram {
  const now = Date.now();
  return {
    id: generateId('diag'),
    name,
    description: 'Cloud Architecture & System Design',
    nodes: [],
    edges: [],
    frames: [],
    viewport: { x: 400, y: 300, zoom: 1 },
    background: 'grid',
    showGrid: true,
    snapToGrid: true,
    presentationSteps: [],
    createdAt: now,
    updatedAt: now,
  };
}

const memoryStore = new Map<string, string>();

function safeGetItem(key: string): string | null {
  try {
    if (typeof localStorage !== 'undefined') {
      return localStorage.getItem(key);
    }
  } catch {
    // fallback
  }
  return memoryStore.get(key) || null;
}

function safeSetItem(key: string, value: string): void {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(key, value);
      return;
    }
  } catch {
    // fallback
  }
  memoryStore.set(key, value);
}

function safeRemoveItem(key: string): void {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(key);
      return;
    }
  } catch {
    // fallback
  }
  memoryStore.delete(key);
}

/**
 * Load all saved diagram summaries from localStorage
 */
export function listDiagrams(): DiagramSummary[] {
  try {
    const raw = safeGetItem(STORAGE_KEY_DIAGRAMS);
    if (!raw) return [];
    const map = JSON.parse(raw) as Record<string, Diagram>;
    return Object.values(map)
      .map((d) => ({
        id: d.id,
        name: d.name || 'Untitled Diagram',
        description: d.description,
        nodeCount: d.nodes?.length || 0,
        edgeCount: d.edges?.length || 0,
        updatedAt: d.updatedAt || d.createdAt || Date.now(),
        createdAt: d.createdAt || Date.now(),
      }))
      .sort((a, b) => b.updatedAt - a.updatedAt);
  } catch (e) {
    console.error('Failed to list diagrams:', e);
    return [];
  }
}

/**
 * Get active diagram ID or fallback
 */
export function getActiveDiagramId(): string | null {
  try {
    return safeGetItem(STORAGE_KEY_ACTIVE_ID);
  } catch {
    return null;
  }
}

/**
 * Set active diagram ID
 */
export function setActiveDiagramId(id: string): void {
  try {
    safeSetItem(STORAGE_KEY_ACTIVE_ID, id);
  } catch (e) {
    console.error('Failed to save active diagram ID:', e);
  }
}

/**
 * Load a single diagram by ID
 */
export function loadDiagram(id: string): Diagram | null {
  try {
    const raw = safeGetItem(STORAGE_KEY_DIAGRAMS);
    if (!raw) return null;
    const map = JSON.parse(raw) as Record<string, Diagram>;
    return map[id] || null;
  } catch (e) {
    console.error('Failed to load diagram:', e);
    return null;
  }
}

/**
 * Save a diagram to localStorage
 */
export function saveDiagram(diagram: Diagram): void {
  try {
    const raw = safeGetItem(STORAGE_KEY_DIAGRAMS);
    const map: Record<string, Diagram> = raw ? JSON.parse(raw) : {};
    diagram.updatedAt = Date.now();
    map[diagram.id] = diagram;
    safeSetItem(STORAGE_KEY_DIAGRAMS, JSON.stringify(map));
    setActiveDiagramId(diagram.id);
  } catch (e) {
    console.error('Failed to save diagram:', e);
  }
}

/**
 * Delete a diagram by ID
 */
export function deleteDiagram(id: string): void {
  try {
    const raw = safeGetItem(STORAGE_KEY_DIAGRAMS);
    if (!raw) return;
    const map = JSON.parse(raw) as Record<string, Diagram>;
    delete map[id];
    safeSetItem(STORAGE_KEY_DIAGRAMS, JSON.stringify(map));
    if (getActiveDiagramId() === id) {
      const remaining = Object.keys(map);
      if (remaining.length > 0) {
        setActiveDiagramId(remaining[0]);
      } else {
        safeRemoveItem(STORAGE_KEY_ACTIVE_ID);
      }
    }
  } catch (e) {
    console.error('Failed to delete diagram:', e);
  }
}

/**
 * Duplicate a diagram
 */
export function duplicateDiagram(id: string): Diagram | null {
  const original = loadDiagram(id);
  if (!original) return null;
  const now = Date.now();
  const copy: Diagram = {
    ...JSON.parse(JSON.stringify(original)),
    id: generateId('diag'),
    name: `${original.name} (Copy)`,
    createdAt: now,
    updatedAt: now,
  };
  saveDiagram(copy);
  return copy;
}

/**
 * Export diagram as JSON file download
 */
export function exportDiagramAsJSON(diagram: Diagram): void {
  const data = JSON.stringify(diagram, null, 2);
  const blob = new Blob([data], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${diagram.name.replace(/[^a-z0-9_-]/gi, '_') || 'diagram'}.json`;
  link.click();
  URL.revokeObjectURL(url);
}

/**
 * Export diagram as SVG file download
 */
export function exportDiagramAsSVG(svgElement: SVGSVGElement, filename = 'diagram'): void {
  const clone = svgElement.cloneNode(true) as SVGSVGElement;
  // Remove selection handles and interactive markers before exporting
  const handles = clone.querySelectorAll('.no-export');
  handles.forEach((h) => h.remove());

  const svgData = new XMLSerializer().serializeToString(clone);
  const blob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${filename.replace(/[^a-z0-9_-]/gi, '_')}.svg`;
  link.click();
  URL.revokeObjectURL(url);
}

/**
 * Export diagram as PNG file download
 */
export function exportDiagramAsPNG(
  svgElement: SVGSVGElement,
  filename = 'diagram',
  scale = 2
): Promise<void> {
  return new Promise((resolve, reject) => {
    try {
      const clone = svgElement.cloneNode(true) as SVGSVGElement;
      const handles = clone.querySelectorAll('.no-export');
      handles.forEach((h) => h.remove());

      const svgData = new XMLSerializer().serializeToString(clone);
      const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
      const url = URL.createObjectURL(svgBlob);

      const img = new Image();
      img.onload = () => {
        const bbox = svgElement.getBoundingClientRect();
        const width = bbox.width || 1200;
        const height = bbox.height || 800;

        const canvas = document.createElement('canvas');
        canvas.width = width * scale;
        canvas.height = height * scale;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          URL.revokeObjectURL(url);
          reject(new Error('Canvas context not available'));
          return;
        }

        ctx.scale(scale, scale);
        // Clean dark canvas background for export
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);

        canvas.toBlob((blob) => {
          URL.revokeObjectURL(url);
          if (!blob) {
            reject(new Error('Failed to create PNG blob'));
            return;
          }
          const downloadUrl = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = downloadUrl;
          link.download = `${filename.replace(/[^a-z0-9_-]/gi, '_')}.png`;
          link.click();
          URL.revokeObjectURL(downloadUrl);
          resolve();
        }, 'image/png');
      };
      img.onerror = (e) => {
        URL.revokeObjectURL(url);
        reject(e);
      };
      img.src = url;
    } catch (e) {
      reject(e);
    }
  });
}

/**
 * Parse uploaded JSON file into Diagram
 */
export function importDiagramFromJSON(file: File): Promise<Diagram> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const content = event.target?.result as string;
        const parsed = JSON.parse(content) as Diagram;
        if (!parsed.id || !Array.isArray(parsed.nodes) || !Array.isArray(parsed.edges)) {
          throw new Error('Invalid diagram JSON structure');
        }
        // Generate a new ID on import to prevent collision with existing diagrams
        parsed.id = generateId('diag');
        parsed.updatedAt = Date.now();
        resolve(parsed);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = (err) => reject(err);
    reader.readAsText(file);
  });
}

/**
 * Creates an empty default workbook with an initial sheet
 */
export function createEmptyWorkbook(name = 'AWS Architecture Workspace'): DiagramWorkbook {
  const initialSheet = createEmptyDiagram('AWS VPC Architecture');
  const now = Date.now();
  return {
    id: generateId('wb'),
    name,
    activeSheetId: initialSheet.id,
    sheets: [initialSheet],
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Load saved workbook from localStorage, with automatic migration from legacy single diagrams
 */
export function loadWorkbook(): DiagramWorkbook {
  try {
    const raw = safeGetItem(STORAGE_KEY_WORKBOOK);
    if (raw) {
      const parsed = JSON.parse(raw) as DiagramWorkbook;
      if (parsed.sheets && parsed.sheets.length > 0) {
        // Ensure activeSheetId is valid
        if (!parsed.sheets.some((s) => s.id === parsed.activeSheetId)) {
          parsed.activeSheetId = parsed.sheets[0].id;
        }
        return parsed;
      }
    }

    // Fallback: migrate legacy diagrams if present
    const legacyRaw = safeGetItem(STORAGE_KEY_DIAGRAMS);
    if (legacyRaw) {
      const legacyMap = JSON.parse(legacyRaw) as Record<string, Diagram>;
      const legacyList = Object.values(legacyMap);
      if (legacyList.length > 0) {
        const migrated: DiagramWorkbook = {
          id: generateId('wb'),
          name: 'My Cloud Architectures',
          activeSheetId: legacyList[0].id,
          sheets: legacyList,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };
        saveWorkbook(migrated);
        return migrated;
      }
    }
  } catch (e) {
    console.error('Failed to load workbook, returning fresh:', e);
  }

  const fresh = createEmptyWorkbook();
  saveWorkbook(fresh);
  return fresh;
}

let cloudSyncTimer: ReturnType<typeof setTimeout> | null = null;

export function syncWorkbookWithDebounce(workbook: DiagramWorkbook): void {
  if (typeof window === 'undefined') return;
  if (cloudSyncTimer) {
    clearTimeout(cloudSyncTimer);
  }
  cloudSyncTimer = setTimeout(() => {
    syncCloudWorkbook(workbook).catch(() => {});
  }, 1000);
}

/**
 * Persist workbook to localStorage and Supabase PostgreSQL
 */
export function saveWorkbook(workbook: DiagramWorkbook): void {
  try {
    workbook.updatedAt = Date.now();
    safeSetItem(STORAGE_KEY_WORKBOOK, JSON.stringify(workbook));
    syncWorkbookWithDebounce(workbook);
  } catch (e) {
    console.error('Failed to save workbook:', e);
  }
}

/**
 * Add a new sheet to workbook
 */
export function addSheetToWorkbook(
  workbook: DiagramWorkbook,
  title?: string
): { workbook: DiagramWorkbook; newSheet: Diagram } {
  const sheetNumber = workbook.sheets.length + 1;
  const sheetTitle = title || `Sheet ${sheetNumber}`;
  const newSheet = createEmptyDiagram(sheetTitle);

  const updated: DiagramWorkbook = {
    ...workbook,
    activeSheetId: newSheet.id,
    sheets: [...workbook.sheets, newSheet],
    updatedAt: Date.now(),
  };
  saveWorkbook(updated);
  return { workbook: updated, newSheet };
}

/**
 * Rename a sheet in workbook
 */
export function renameSheetInWorkbook(
  workbook: DiagramWorkbook,
  sheetId: string,
  newTitle: string
): DiagramWorkbook {
  const updated: DiagramWorkbook = {
    ...workbook,
    sheets: workbook.sheets.map((s) => (s.id === sheetId ? { ...s, name: newTitle.trim() || s.name } : s)),
    updatedAt: Date.now(),
  };
  saveWorkbook(updated);
  return updated;
}

/**
 * Duplicate a sheet in workbook
 */
export function duplicateSheetInWorkbook(
  workbook: DiagramWorkbook,
  sheetId: string
): { workbook: DiagramWorkbook; copySheet: Diagram } {
  const original = workbook.sheets.find((s) => s.id === sheetId);
  const now = Date.now();
  const copySheet: Diagram = original
    ? {
        ...JSON.parse(JSON.stringify(original)),
        id: generateId('diag'),
        name: `${original.name} (Copy)`,
        createdAt: now,
        updatedAt: now,
      }
    : createEmptyDiagram('New Sheet Copy');

  const updated: DiagramWorkbook = {
    ...workbook,
    activeSheetId: copySheet.id,
    sheets: [...workbook.sheets, copySheet],
    updatedAt: now,
  };
  saveWorkbook(updated);
  return { workbook: updated, copySheet };
}

/**
 * Delete a sheet from workbook (guarantees at least 1 sheet remains)
 */
export function deleteSheetFromWorkbook(workbook: DiagramWorkbook, sheetId: string): DiagramWorkbook {
  if (workbook.sheets.length <= 1) {
    return workbook; // Cannot delete last remaining sheet
  }

  const remaining = workbook.sheets.filter((s) => s.id !== sheetId);
  let nextActiveId = workbook.activeSheetId;
  if (nextActiveId === sheetId) {
    nextActiveId = remaining[0].id;
  }

  const updated: DiagramWorkbook = {
    ...workbook,
    activeSheetId: nextActiveId,
    sheets: remaining,
    updatedAt: Date.now(),
  };
  saveWorkbook(updated);
  return updated;
}

/**
 * Switch active sheet
 */
export function switchSheetInWorkbook(workbook: DiagramWorkbook, targetSheetId: string): DiagramWorkbook {
  if (workbook.sheets.some((s) => s.id === targetSheetId)) {
    const updated: DiagramWorkbook = {
      ...workbook,
      activeSheetId: targetSheetId,
      updatedAt: Date.now(),
    };
    saveWorkbook(updated);
    return updated;
  }
  return workbook;
}

/**
 * Update active or specific sheet in workbook
 */
export function updateSheetInWorkbook(workbook: DiagramWorkbook, updatedSheet: Diagram): DiagramWorkbook {
  const updated: DiagramWorkbook = {
    ...workbook,
    sheets: workbook.sheets.map((s) => (s.id === updatedSheet.id ? updatedSheet : s)),
    updatedAt: Date.now(),
  };
  saveWorkbook(updated);
  return updated;
}

