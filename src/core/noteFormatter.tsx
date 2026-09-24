import React from 'react';

/**
 * Parses inline formatting:
 * - ==highlight== => <mark>
 * - **bold**      => <strong>
 * - *italic*      => <em>
 * - `code`        => <code>
 */
export const renderInlineFormattedText = (text: string): React.ReactNode[] => {
  const regex = /(==[^=\n]+?==|\*\*[^*\n]+?\*\*|\*[^*\n]+?\*|`[^`\n]+?`)/g;
  const parts = text.split(regex);

  return parts.map((part, index) => {
    if (!part) return null;

    if (part.startsWith('==') && part.endsWith('==') && part.length >= 4) {
      return (
        <mark
          key={index}
          className="mx-0.5 rounded px-1.5 py-0.5 font-semibold border bg-amber-200/90 text-amber-950 border-amber-300 dark:bg-amber-500/30 dark:text-amber-200 dark:border-amber-600/60 shadow-2xs"
        >
          {part.slice(2, -2)}
        </mark>
      );
    }

    if (part.startsWith('**') && part.endsWith('**') && part.length >= 4) {
      return (
        <strong key={index} className="font-bold text-slate-950 dark:text-white">
          {part.slice(2, -2)}
        </strong>
      );
    }

    if (part.startsWith('*') && part.endsWith('*') && part.length >= 2) {
      return (
        <em key={index} className="italic text-slate-800 dark:text-slate-200">
          {part.slice(1, -1)}
        </em>
      );
    }

    if (part.startsWith('`') && part.endsWith('`') && part.length >= 2) {
      return (
        <code
          key={index}
          className="mx-0.5 rounded border border-slate-200 bg-slate-100 px-1.5 py-0.5 font-mono text-xs font-bold text-blue-700 dark:border-slate-700 dark:bg-slate-800 dark:text-blue-300"
        >
          {part.slice(1, -1)}
        </code>
      );
    }

    return <span key={index}>{part}</span>;
  });
};

/**
 * Format inline tokens in a single string for contentEditable rich text display.
 */
const formatInlineTokens = (text: string): string => {
  return text
    // Replace ==highlight== with <mark>
    .replace(
      /==([^=\n]+?)==/g,
      '<mark class="note-highlight rounded px-1.5 py-0.5 font-semibold border bg-amber-200/90 text-amber-950 border-amber-300 dark:bg-amber-500/30 dark:text-amber-200 dark:border-amber-600/60 shadow-2xs">$1</mark>'
    )
    // Replace **bold** with <strong>
    .replace(/\*\*([^*\n]+?)\*\*/g, '<strong class="font-bold text-slate-950 dark:text-white">$1</strong>')
    // Replace *italic* with <em>
    .replace(/\*([^*\n]+?)\*/g, '<em class="italic text-slate-800 dark:text-slate-200">$1</em>')
    // Replace `code` with <code>
    .replace(
      /`([^`\n]+?)`/g,
      '<code class="mx-0.5 rounded border border-slate-200 bg-slate-100 px-1.5 py-0.5 font-mono text-xs font-bold text-blue-700 dark:border-slate-700 dark:bg-slate-800 dark:text-blue-300">$1</code>'
    );
};

/**
 * Converts stored note markdown to formatted HTML for single-surface contentEditable editing.
 */
export const markdownToNoteHtml = (markdown: string): string => {
  if (!markdown || !markdown.trim()) return '';

  // If already full HTML, return as-is
  const isHtml = /<(?:div|p|span|mark|strong|b|em|i|ul|li|h[1-6]|br)[^>]*>/i.test(markdown);
  if (isHtml) {
    return markdown;
  }

  const lines = markdown.split('\n');
  const resultLines: string[] = [];
  let inList = false;

  for (const line of lines) {
    const trimmed = line.trim();

    if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
      if (!inList) {
        resultLines.push('<ul class="list-disc pl-5 my-1 space-y-1">');
        inList = true;
      }
      const itemText = formatInlineTokens(trimmed.slice(2));
      resultLines.push(`<li>${itemText}</li>`);
    } else {
      if (inList) {
        resultLines.push('</ul>');
        inList = false;
      }

      if (trimmed.startsWith('### ')) {
        const headingText = formatInlineTokens(trimmed.slice(4));
        resultLines.push(`<h3 class="text-base font-bold text-slate-900 dark:text-white mt-3 mb-1">${headingText}</h3>`);
      } else if (trimmed.startsWith('## ')) {
        const headingText = formatInlineTokens(trimmed.slice(3));
        resultLines.push(`<h2 class="text-lg font-bold text-slate-900 dark:text-white mt-4 mb-1.5">${headingText}</h2>`);
      } else if (trimmed.startsWith('# ')) {
        const headingText = formatInlineTokens(trimmed.slice(2));
        resultLines.push(`<h1 class="text-xl font-black text-slate-900 dark:text-white mt-4 mb-2">${headingText}</h1>`);
      } else if (trimmed === '---') {
        resultLines.push('<hr class="my-3 border-slate-200 dark:border-slate-800" />');
      } else if (trimmed.length === 0) {
        resultLines.push('<div><br></div>');
      } else {
        const pText = formatInlineTokens(line);
        resultLines.push(`<div>${pText}</div>`);
      }
    }
  }

  if (inList) {
    resultLines.push('</ul>');
  }

  return resultLines.join('');
};

/**
 * Converts rich contentEditable HTML back into clean, persistent Markdown string.
 */
export const noteHtmlToMarkdown = (html: string): string => {
  if (!html || !html.trim()) return '';

  let md = html;

  // Replace <mark ...>...</mark> with ==...==
  md = md.replace(/<mark[^>]*>([\s\S]*?)<\/mark>/gi, '==$1==');
  // Replace <strong> or <b> with **...**
  md = md.replace(/<(?:strong|b)[^>]*>([\s\S]*?)<\/(?:strong|b)>/gi, '**$1**');
  // Replace <em> or <i> with *...*
  md = md.replace(/<(?:em|i)[^>]*>([\s\S]*?)<\/(?:em|i)>/gi, '*$1*');
  // Replace <code ...>...</code> with `...`
  md = md.replace(/<code[^>]*>([\s\S]*?)<\/code>/gi, '`$1`');
  // Replace headings <h1-6> with ###
  md = md.replace(/<h[1-6][^>]*>([\s\S]*?)<\/h[1-6]>/gi, '\n### $1\n');
  // Replace <li> with -
  md = md.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, '- $1\n');
  // Strip list containers
  md = md.replace(/<\/(?:ul|ol)>/gi, '\n');
  md = md.replace(/<(?:ul|ol)[^>]*>/gi, '');
  // Replace empty lines
  md = md.replace(/<div>\s*<br\s*\/?>\s*<\/div>/gi, '\n');
  md = md.replace(/<br\s*\/?>/gi, '\n');
  // Replace paragraph and div ends
  md = md.replace(/<\/p>/gi, '\n\n');
  md = md.replace(/<\/div>/gi, '\n');
  md = md.replace(/<(?:p|div)[^>]*>/gi, '');
  // Clean up remaining HTML tags
  md = md.replace(/<[^>]+>/g, '');
  // Decode HTML entities
  md = md
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");

  // Normalize duplicate empty lines
  md = md.replace(/\n{3,}/g, '\n\n');

  return md.trim();
};

/**
 * Detects whether an event or active target is currently focused within
 * an input, textarea, contentEditable surface, or custom text editing widget.
 * Used to safely suppress global keyboard shortcuts from interfering with typing.
 */
export function isTypingInInput(target: EventTarget | null): boolean {
  if (!target) return false;
  if (typeof HTMLElement !== 'undefined' && !(target instanceof HTMLElement)) return false;

  const el = target as HTMLElement;
  const tagName = typeof el.tagName === 'string' ? el.tagName.toUpperCase() : '';
  if (['INPUT', 'TEXTAREA', 'SELECT'].includes(tagName)) return true;
  if (el.isContentEditable) return true;

  if (typeof el.closest === 'function') {
    if (el.closest('[contenteditable="true"]')) return true;
    if (el.closest('[role="textbox"]')) return true;
    if (el.closest('.note-editor-surface')) return true;
  }

  return false;
}

