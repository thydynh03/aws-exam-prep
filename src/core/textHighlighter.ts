/**
 * Non-destructive, zero-duplication text segmentation and highlighting utility.
 * Slices text by match intervals without regex split capturing-group duplication bugs.
 */

export interface HighlightRule<T = Record<string, unknown>> {
  pattern: RegExp;
  data: T;
}

export type TextSegment<T = Record<string, unknown>> =
  | { type: 'text'; text: string }
  | { type: 'highlight'; text: string; data: T };

export function segmentTextByMatches<T = Record<string, unknown>>(
  text: string,
  rules: HighlightRule<T>[]
): TextSegment<T>[] {
  if (!text) return [];
  if (!rules || rules.length === 0) return [{ type: 'text', text }];

  interface RawMatch {
    start: number;
    end: number;
    data: T;
  }

  const matches: RawMatch[] = [];

  for (const rule of rules) {
    // Force global flag and preserve case-insensitivity
    const flags = rule.pattern.flags.includes('i') ? 'gi' : 'g';
    const regex = new RegExp(rule.pattern.source, flags);
    let m: RegExpExecArray | null;

    while ((m = regex.exec(text)) !== null) {
      if (m[0].length === 0) {
        regex.lastIndex++;
        continue;
      }
      matches.push({
        start: m.index,
        end: m.index + m[0].length,
        data: rule.data,
      });
    }
  }

  if (matches.length === 0) {
    return [{ type: 'text', text }];
  }

  // Sort by start position ascending; if starts are equal, longer match takes priority
  matches.sort((a, b) => a.start - b.start || (b.end - b.start) - (a.end - a.start));

  // Filter overlapping matches
  const nonOverlapping: RawMatch[] = [];
  let lastEnd = 0;
  for (const match of matches) {
    if (match.start >= lastEnd) {
      nonOverlapping.push(match);
      lastEnd = match.end;
    }
  }

  // Contiguously build segments ensuring every character is visited exactly once
  const segments: TextSegment<T>[] = [];
  let cursor = 0;

  for (const match of nonOverlapping) {
    if (match.start > cursor) {
      segments.push({
        type: 'text',
        text: text.slice(cursor, match.start),
      });
    }
    segments.push({
      type: 'highlight',
      text: text.slice(match.start, match.end),
      data: match.data,
    });
    cursor = match.end;
  }

  if (cursor < text.length) {
    segments.push({
      type: 'text',
      text: text.slice(cursor),
    });
  }

  return segments;
}
