/**
 * mermaidSanitizer.ts
 * Robust sanitizer and auto-healer for LLM-generated Mermaid diagrams.
 *
 * Solves common LLM Mermaid syntax issues:
 * 1. Subgraphs declared with quotes without ID (e.g. `subgraph "Châu Âu"`) -> `subgraph sg_1 ["Châu Âu"]`
 * 2. Subgraphs declared with spaces without ID (e.g. `subgraph AWS Global Network`) -> `subgraph sg_2 ["AWS Global Network"]`
 * 3. Unclosed `subgraph` blocks (missing `end` statements) -> auto-appends missing `end`s
 * 4. Node labels containing emojis, parentheses, spaces, colons without quotes -> wraps in `["..."]`
 * 5. Strips markdown fences, trailing comments, and invalid diagram prefixes
 * 6. Progressive fallback healing if complex subgraphs fail
 */

/**
 * Creates a clean alphanumeric slug from a string
 */
function slugify(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
    .toLowerCase() || 'box';
}

function escapeQuotes(text: string): string {
  return text.replace(/"/g, "'");
}

/**
 * Safely quote unquoted node labels:
 * Node[🏢 Site 1] -> Node["🏢 Site 1"]
 * Node(Web Server (Apache)) -> Node("Web Server (Apache)")
 */
function fixUnquotedNodeLabels(line: string): string {
  // If line is a directive, comment, style, or classDef, leave untouched
  if (/^\s*(?:subgraph|style|classDef|class|click|linkStyle|%%)/i.test(line.trim())) {
    return line;
  }

  // Fix square brackets: NodeId[Label text] -> NodeId["Label text"]
  // Ignore if already starts with quote: `["..."]`
  line = line.replace(/([a-zA-Z0-9_-]+)\[(?!")([^\]\n]+)\]/g, (_match, id, label) => {
    const trimmedLabel = label.trim();
    return `${id}["${escapeQuotes(trimmedLabel)}"]`;
  });

  // Fix circle brackets: NodeId(Label text) -> NodeId("Label text")
  // Only if label doesn't start with quote and contains special chars/spaces
  line = line.replace(/([a-zA-Z0-9_-]+)\((?!["(])([^)\n]+)\)/g, (match, id, label) => {
    const trimmedLabel = label.trim();
    if (/[\s():/\\&+\p{Extended_Pictographic}-]/u.test(trimmedLabel)) {
      return `${id}("${escapeQuotes(trimmedLabel)}")`;
    }
    return match;
  });

  return line;
}

/**
 * Main sanitizer function to fix common LLM Mermaid syntax issues.
 */
export function sanitizeMermaidCode(rawCode: string): string {
  if (!rawCode || !rawCode.trim()) return '';

  let code = rawCode
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .replace(/\u00A0/g, ' ')
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .trim();

  // 1. Strip markdown fences if present (```mermaid ... ``` or ``` ...)
  code = code.replace(/^```(?:mermaid)?\s*\n?/i, '');
  code = code.replace(/\n?```\s*$/i, '');
  code = code.trim();

  // 2. Remove leading 'mermaid' keyword if model outputted `mermaid graph TD`
  if (/^mermaid\s+/i.test(code)) {
    code = code.replace(/^mermaid\s+/i, '').trim();
  }

  // 3. Ensure a diagram header exists and is correctly cased for Mermaid Jison parser
  code = code
    .replace(/^[Ff]lowchart\b/, 'flowchart')
    .replace(/^[Gg]raph\b/, 'graph')
    .replace(/^[Ss]equence[Dd]iagram\b/, 'sequenceDiagram')
    .replace(/^[Cc]lass[Dd]iagram\b/, 'classDiagram')
    .replace(/^[Ss]tate[Dd]iagram(?:-v2)?\b/, 'stateDiagram-v2')
    .replace(/^[Ee]r[Dd]iagram\b/, 'erDiagram');

  const diagramKeywords = [
    'flowchart', 'graph', 'sequencediagram', 'classdiagram',
    'statediagram', 'erdiagram', 'pie', 'gantt', 'gitgraph',
    'journey', 'mindmap', 'quadrantchart', 'timeline', 'sankey', 'xychart', 'c4context'
  ];
  const firstLine = code.split('\n')[0].trim().toLowerCase();
  const hasValidHeader = diagramKeywords.some(kw => firstLine.startsWith(kw));

  if (!hasValidHeader) {
    code = `flowchart TD\n${code}`;
  }

  // 4. Process line by line
  const lines = code.split('\n');
  const processedLines: string[] = [];
  let subgraphCount = 0;
  let endCount = 0;
  let autoSgIndex = 1;

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];
    const trimmed = line.trim();

    if (!trimmed) {
      processedLines.push('');
      continue;
    }

    // Skip diagram header if encountered in body
    if (i > 0 && /^(?:flowchart|graph|sequencediagram|classdiagram)\s+[A-Za-z]+/i.test(trimmed)) {
      continue;
    }

    // Clean up dangling or truncated arrows at end of line (e.g. `B -- "3. Patch" -->` with no target)
    if (/(?:--.*?-->|-->|==>|-\.->)\s*$/.test(trimmed)) {
      continue;
    }

    // Standardize arrows with labels: `A -- label --> B` or `A -- "label" --> B` -> `A -->|"label"| B`
    line = line.replace(/--\s*"?([^"\n\->|]+?)"?\s*-->/g, '-->|"$1"|');

    // Replace unencoded ampersands in edge labels: `-->|"Foo & Bar"|` -> `-->|"Foo và Bar"|`
    line = line.replace(/(\|"[^"]*?)\s*&\s*([^"]*?"\|)/g, '$1 và $2');

    // Check for subgraph declarations
    // Case A: subgraph "Quoted Title" or subgraph 'Quoted Title' (NO ID!) -> FIX to subgraph sg_X ["Quoted Title"]
    const quotedSubgraphMatch = line.match(/^(\s*)subgraph\s+["']([^"']+)["']\s*$/i);
    if (quotedSubgraphMatch) {
      subgraphCount++;
      const indent = quotedSubgraphMatch[1];
      const title = quotedSubgraphMatch[2];
      const safeId = `sg_${autoSgIndex++}_${slugify(title)}`;
      processedLines.push(`${indent}subgraph ${safeId}["${escapeQuotes(title)}"]`);
      continue;
    }

    // Case B: subgraph Title With Spaces (NO quotes, NO ID, e.g. `subgraph Châu Âu` or `subgraph AWS Global Network`)
    // But exclude if it already has `ID [Title]` or `ID(Title)` or `ID{Title}`
    const spaceSubgraphMatch = line.match(/^(\s*)subgraph\s+([A-Za-z0-9_\u00C0-\u024F\u1EA0-\u1EF9]+(?:\s+[A-Za-z0-9_\u00C0-\u024F\u1EA0-\u1EF9]+)+)\s*$/i);
    if (spaceSubgraphMatch && !line.includes('[') && !line.includes('(') && !line.includes('{')) {
      subgraphCount++;
      const indent = spaceSubgraphMatch[1];
      const title = spaceSubgraphMatch[2].trim();
      const safeId = `sg_${autoSgIndex++}_${slugify(title)}`;
      processedLines.push(`${indent}subgraph ${safeId}["${escapeQuotes(title)}"]`);
      continue;
    }

    // Standard subgraph declaration (e.g. subgraph ID [Title] or subgraph ID)
    if (/^\s*subgraph\b/i.test(trimmed)) {
      subgraphCount++;
      // Remove whitespace between ID and bracket: `subgraph ID ["Title"]` -> `subgraph ID["Title"]`
      line = line.replace(/^(\s*subgraph\s+[A-Za-z0-9_-]+)\s+(\[)/i, '$1$2');
      // If it's `subgraph ID[Title]` but Title doesn't have quotes and has spaces/emojis:
      line = line.replace(/(\bsubgraph\s+[A-Za-z0-9_-]+\[)(?!")([^"\]\n]+)(\])/gi, (_m, p1, label, p3) => {
        return `${p1}"${escapeQuotes(label.trim())}"${p3}`;
      });
    }

    // Check for `end`
    if (/^\s*end\s*$/i.test(trimmed)) {
      endCount++;
    }

    // Node label quoting:
    line = fixUnquotedNodeLabels(line);

    processedLines.push(line);
  }

  // 5. Auto-close missing `end` statements
  while (subgraphCount > endCount) {
    processedLines.push('    end');
    endCount++;
  }

  // 6. Detect and resolve empty subgraphs (subgraphs with no nodes or statements inside)
  // An empty subgraph causes Mermaid syntax error: Expecting 'GRAPH', ... got 'end'.
  const cleanedLines: string[] = [];
  const contentLineCount = processedLines.filter((l) => {
    const t = l.trim();
    return (
      Boolean(t) &&
      !/^subgraph\b/i.test(t) &&
      !/^end\s*$/i.test(t) &&
      !/^(?:flowchart|graph)\s+/i.test(t)
    );
  }).length;

  for (let i = 0; i < processedLines.length; i++) {
    const curr = processedLines[i].trim();
    if (/^subgraph\b/i.test(curr)) {
      // Look ahead to find if next non-empty line is 'end'
      let nextIdx = i + 1;
      while (nextIdx < processedLines.length && !processedLines[nextIdx].trim()) {
        nextIdx++;
      }
      if (nextIdx < processedLines.length && /^end\s*$/i.test(processedLines[nextIdx].trim())) {
        // It's an empty subgraph!
        if (contentLineCount > 0) {
          // There are other content nodes in the diagram. Remove this empty subgraph to make diagram valid!
          i = nextIdx; // Skip both subgraph and end
          continue;
        } else {
          // No other content exists in the diagram. Insert a placeholder node so the subgraph is valid!
          const matchTitle = curr.match(/\["([^"]+)"\]/);
          const title = matchTitle ? matchTitle[1] : 'Component';
          cleanedLines.push(processedLines[i]);
          cleanedLines.push(`        node_${i}["${title}"]`);
          cleanedLines.push(processedLines[nextIdx]);
          i = nextIdx;
          continue;
        }
      }
    }
    cleanedLines.push(processedLines[i]);
  }

  return cleanedLines.join('\n');
}

/**
 * Aggressive fallback healer if standard sanitization still fails.
 * Flattens problematic subgraphs while keeping all nodes and connections intact.
 */
export function healMermaidFallback(code: string): string {
  const sanitized = sanitizeMermaidCode(code);
  const lines = sanitized.split('\n');
  const preservedLines: string[] = [];

  let header = 'flowchart TD';
  for (const line of lines) {
    const trimmed = line.trim();
    if (/^(?:flowchart|graph)\s+[A-Za-z]+/i.test(trimmed)) {
      header = trimmed.replace(/^[Ff]lowchart\b/, 'flowchart').replace(/^[Gg]raph\b/, 'graph');
      break;
    }
  }

  preservedLines.push(header);

  for (const line of lines) {
    const trimmed = line.trim();
    // Skip diagram header (already added)
    if (/^(?:flowchart|graph)\s+[A-Za-z]+/i.test(trimmed)) continue;
    // Skip subgraphs and end statements in fallback mode to avoid nesting errors
    if (/^\s*subgraph\b/i.test(trimmed)) continue;
    if (/^\s*end\s*$/i.test(trimmed)) continue;
    if (!trimmed) continue;
    // Skip dangling arrow lines without a destination
    if (/(?:--.*?-->|-->|==>|-\.->)\s*$/.test(trimmed)) continue;

    preservedLines.push(`    ${trimmed}`);
  }

  return preservedLines.join('\n');
}

/**
 * Ultra-safe progressive fallback healer (Pass 3).
 * Simplifies labels and edges to ensure guaranteed rendering even under severe syntax corruption.
 */
export function healMermaidUltraSafe(code: string): string {
  const sanitized = sanitizeMermaidCode(code);
  const lines = sanitized.split('\n');
  const safeLines: string[] = ['flowchart TD'];

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;
    if (/^(?:flowchart|graph)\b/i.test(line)) continue;
    if (/^\s*(?:subgraph|end)\b/i.test(line)) continue;
    if (/(?:--.*?-->|-->|==>|-\.->)\s*$/.test(line)) continue;

    // Simplify link arrows with labels
    let cleanedLine = line.replace(/\|"([^"]+)"\|/g, (_m, label) => {
      const cleanLabel = label.replace(/[^\w\s\u00C0-\u024F\u1EA0-\u1EF9.,/:-]/g, '').trim();
      return `|"${escapeQuotes(cleanLabel)}"|`;
    });

    // Simplify node labels:
    cleanedLine = cleanedLine.replace(/\["([^"]+)"\]/g, (_m, label) => {
      return `["${escapeQuotes(label.trim())}"]`;
    });

    safeLines.push(`    ${cleanedLine}`);
  }

  return safeLines.join('\n');
}

/**
 * Scans document.body and purges any stray error SVGs or DOM nodes injected by Mermaid 12.
 */
export function cleanupAnyRogueMermaidElements(): void {
  if (typeof document === 'undefined') return;
  try {
    // 1. Mermaid 12 injects error SVGs directly into document.body with id="dmermaid_..." or class="error-icon"
    const rogueSelectors = [
      'body > svg[id^="dmermaid"]',
      'body > div[id^="dmermaid"]',
      'body > svg[id^="mermaid"]',
      'body > div[id^="mermaid"]',
      'body > svg:has(.error-icon)',
      'body > svg:has(.error-text)',
      'body > [class*="error-icon"]',
    ];
    rogueSelectors.forEach((sel) => {
      document.querySelectorAll(sel).forEach((el) => {
        if (el?.parentNode) el.parentNode.removeChild(el);
      });
    });

    // 2. Comprehensive check on direct body SVGs/DIVs that contain "Syntax error in text mermaid"
    const directChildren = Array.from(document.body.children);
    for (const child of directChildren) {
      if (child.tagName.toLowerCase() === 'svg' || child.tagName.toLowerCase() === 'div') {
        const text = child.textContent || '';
        if (
          text.includes('Syntax error in text mermaid') ||
          text.includes('mermaid version') ||
          (child.id && (child.id.startsWith('dmermaid') || child.id.startsWith('mermaid_')))
        ) {
          if (child.id !== 'root' && child.parentNode) {
            child.parentNode.removeChild(child);
          }
        }
      }
    }
  } catch {
    // Ignore DOM cleanup errors
  }
}

