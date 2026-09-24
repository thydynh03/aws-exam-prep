import React, { useState, useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { MermaidRenderer } from './MermaidRenderer';
import { ImageLightboxModal } from './ImageLightboxModal';
import { autoHealMarkdown } from '../../core/markdownHealer';
import {
  Copy,
  Check,
  ExternalLink,
  Info,
  AlertTriangle,
  Lightbulb,
  ShieldCheck,
} from 'lucide-react';

interface AIMarkdownRendererProps {
  content: string;
  isAssistant?: boolean;
}

// Code block with Copy button
const CodeBlock: React.FC<{ language?: string; value: string }> = ({ language, value }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Ignore
    }
  };

  return (
    <div className="my-2.5 overflow-hidden rounded-xl border border-slate-200 bg-slate-950 text-slate-100 shadow-sm dark:border-slate-800">
      <div className="flex items-center justify-between border-b border-slate-800/80 bg-slate-900 px-3 py-1 text-[11px] text-slate-400 font-mono">
        <span>{language || 'text'}</span>
        <button
          type="button"
          onClick={handleCopy}
          className="flex items-center gap-1 rounded px-1.5 py-0.5 hover:bg-slate-800 hover:text-slate-200 transition-colors"
        >
          {copied ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
          <span>{copied ? 'Đã sao chép' : 'Sao chép'}</span>
        </button>
      </div>
      <pre className="overflow-x-auto p-3 text-[11px] leading-relaxed font-mono text-emerald-400">
        <code>{value}</code>
      </pre>
    </div>
  );
};

// Helper to strip markdown alert headers like [!TIP] or [!WARNING] from rendered children
function stripAlertTag(node: any): any {
  if (typeof node === 'string') {
    return node.replace(/^\s*\[!(?:TIP|WARNING|CAUTION|IMPORTANT)\]\s*/i, '');
  }
  if (Array.isArray(node)) {
    return node.map(stripAlertTag);
  }
  if (React.isValidElement(node) && (node.props as any)?.children) {
    return React.cloneElement(node, {
      ...(node.props as any),
      children: stripAlertTag((node.props as any).children),
    });
  }
  return node;
}

const AIMarkdownRendererComponent: React.FC<AIMarkdownRendererProps> = ({
  content,
  isAssistant = true,
}) => {
  const [previewImage, setPreviewImage] = useState<{ src: string; alt?: string } | null>(null);
  const healedContent = useMemo(() => autoHealMarkdown(content), [content]);

  const markdownComponents = useMemo(() => ({
    // Headings
    h1: ({ children }: any) => (
      <h1 className="mt-3.5 mb-2 pb-1 text-sm font-bold text-slate-900 border-b border-slate-200 dark:text-white dark:border-slate-800">
        {children}
      </h1>
    ),
    h2: ({ children }: any) => (
      <h2 className="mt-3 mb-1.5 text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
        {children}
      </h2>
    ),
    h3: ({ children }: any) => (
      <h3 className="mt-2.5 mb-1 text-xs font-bold text-blue-900 dark:text-blue-300 border-l-2 border-blue-500 pl-2">
        {children}
      </h3>
    ),
    h4: ({ children }: any) => (
      <h4 className="mt-2 mb-1 text-[11px] font-semibold text-slate-800 dark:text-slate-200 border-l-2 border-indigo-400 pl-1.5">
        {children}
      </h4>
    ),

    // Paragraphs
    p: ({ children }: any) => <p className="mb-2 leading-relaxed text-xs">{children}</p>,

    // Strong / Bold: Highlight key AWS exam concepts and terms
    strong: ({ children }: any) => (
      <strong className="font-bold text-slate-950 dark:text-white bg-amber-500/15 dark:bg-amber-400/20 px-1 py-0.5 rounded text-[11.5px]">
        {children}
      </strong>
    ),

    // Italics
    em: ({ children }: any) => <em className="italic text-slate-700 dark:text-slate-300">{children}</em>,

    // Lists
    ul: ({ children }: any) => (
      <ul className="my-1.5 ml-3.5 list-disc space-y-1 text-xs marker:text-blue-500">{children}</ul>
    ),
    ol: ({ children }: any) => (
      <ol className="my-1.5 ml-4 list-decimal space-y-1 text-xs marker:font-bold marker:text-blue-500">
        {children}
      </ol>
    ),
    li: ({ children }: any) => <li className="leading-relaxed pl-0.5">{children}</li>,

    // Tables (GFM)
    table: ({ children }: any) => (
      <div className="my-3 overflow-x-auto rounded-xl border border-slate-200 shadow-xs dark:border-slate-800">
        <table className="w-full border-collapse text-left text-xs">{children}</table>
      </div>
    ),
    thead: ({ children }: any) => (
      <thead className="bg-slate-100 text-slate-900 font-bold border-b border-slate-200 dark:bg-slate-800/90 dark:text-slate-100 dark:border-slate-700">
        {children}
      </thead>
    ),
    tbody: ({ children }: any) => (
      <tbody className="divide-y divide-slate-200/70 dark:divide-slate-800">{children}</tbody>
    ),
    tr: ({ children }: any) => (
      <tr className="even:bg-slate-50/50 dark:even:bg-slate-800/30 hover:bg-blue-50/50 dark:hover:bg-slate-800/70 transition-colors">
        {children}
      </tr>
    ),
    th: ({ children }: any) => (
      <th className="px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider">{children}</th>
    ),
    td: ({ children }: any) => (
      <td className="px-3 py-1.5 text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
        {children}
      </td>
    ),

    // Blockquotes & Callout Alerts
    blockquote: ({ children }: any) => {
      const rawText = React.Children.toArray(children)
        .map((c: any) => (typeof c === 'string' ? c : c?.props?.children || ''))
        .join(' ');

      if (rawText.includes('[!TIP]')) {
        return (
          <div className="my-2 rounded-xl border border-emerald-300 bg-emerald-50/80 p-2.5 text-emerald-950 dark:border-emerald-800/70 dark:bg-emerald-950/40 dark:text-emerald-200 flex items-start gap-2">
            <Lightbulb className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400 mt-0.5" />
            <div className="text-xs leading-relaxed">{stripAlertTag(children)}</div>
          </div>
        );
      }
      if (rawText.includes('[!WARNING]') || rawText.includes('[!CAUTION]')) {
        return (
          <div className="my-2 rounded-xl border border-amber-300 bg-amber-50/80 p-2.5 text-amber-950 dark:border-amber-800/70 dark:bg-amber-950/40 dark:text-amber-200 flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
            <div className="text-xs leading-relaxed">{stripAlertTag(children)}</div>
          </div>
        );
      }
      if (rawText.includes('[!IMPORTANT]')) {
        return (
          <div className="my-2 rounded-xl border border-indigo-300 bg-indigo-50/80 p-2.5 text-indigo-950 dark:border-indigo-800/70 dark:bg-indigo-950/40 dark:text-indigo-200 flex items-start gap-2">
            <ShieldCheck className="h-4 w-4 shrink-0 text-indigo-600 dark:text-indigo-400 mt-0.5" />
            <div className="text-xs leading-relaxed">{stripAlertTag(children)}</div>
          </div>
        );
      }

      return (
        <blockquote className="my-2 border-l-3 border-blue-500 bg-blue-50/40 dark:bg-blue-950/20 px-3 py-1.5 rounded-r-lg text-slate-700 dark:text-slate-300 italic text-xs">
          <div className="flex items-start gap-1.5">
            <Info className="h-3.5 w-3.5 shrink-0 text-blue-500 mt-0.5 not-italic" />
            <div>{children}</div>
          </div>
        </blockquote>
      );
    },

    // Code & Mermaid Diagrams
    code: ({ className, children, ...props }: any) => {
      const match = /language-(\w+)/.exec(className || '');
      const language = match ? match[1] : '';
      const codeString = String(children).replace(/\n$/, '');

      // Mermaid diagram detection
      const trimmed = codeString.trim();
      const isMermaid =
        language === 'mermaid' ||
        trimmed.startsWith('graph ') ||
        trimmed.startsWith('sequenceDiagram') ||
        trimmed.startsWith('flowchart ') ||
        trimmed.startsWith('stateDiagram') ||
        trimmed.startsWith('erDiagram') ||
        ((!language || language === 'text' || language === 'code') &&
          /(?:-->|==>|-\.->|--\s*".*?"\s*-->)/.test(trimmed) &&
          /(?:[a-zA-Z0-9_-]+\[".*?"\]|[a-zA-Z0-9_-]+\[.*?\]|[a-zA-Z0-9_-]+\(".*?"\)|subgraph\b)/.test(trimmed));

      if (isMermaid) {
        return <MermaidRenderer code={codeString} />;
      }

      // Inline code
      const isInline = !className && !codeString.includes('\n');
      if (isInline) {
        return (
          <code
            className="rounded bg-slate-200/80 px-1.5 py-0.5 font-mono text-[11px] font-semibold text-blue-700 dark:bg-slate-800 dark:text-blue-300 border border-slate-300/60 dark:border-slate-700/60"
            {...props}
          >
            {children}
          </code>
        );
      }

      // Code block
      return <CodeBlock language={language} value={codeString} />;
    },

    // Images: clickable with Lightbox preview
    img: ({ src, alt }: any) => {
      if (!src) return null;
      return (
        <span className="my-2 block max-w-sm cursor-zoom-in overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm transition-transform hover:scale-[1.01]">
          <img
            src={src}
            alt={alt || 'Hình minh họa AWS'}
            className="h-auto w-full object-cover"
            onClick={() => setPreviewImage({ src, alt })}
          />
        </span>
      );
    },

    // Links
    a: ({ href, children }: any) => (
      <a
        href={href}
        target="_blank"
        rel="noreferrer"
        className="inline-flex items-center gap-0.5 text-blue-600 underline hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
      >
        <span>{children}</span>
        <ExternalLink className="h-3 w-3" />
      </a>
    ),
  }), [setPreviewImage]);

  // If message is from user (typically short and white text on blue background)
  if (!isAssistant) {
    return (
      <div className="whitespace-pre-wrap font-sans text-xs break-words leading-relaxed">
        {content}
      </div>
    );
  }

  return (
    <div className="ai-markdown-content text-xs leading-relaxed text-slate-800 dark:text-slate-200 break-words">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={markdownComponents}
      >
        {healedContent}
      </ReactMarkdown>

      {/* Lightbox preview for images */}
      <ImageLightboxModal
        isOpen={Boolean(previewImage)}
        onClose={() => setPreviewImage(null)}
        title={previewImage?.alt || 'Xem hình ảnh'}
        imageSrc={previewImage?.src}
      />
    </div>
  );
};

export const AIMarkdownRenderer = React.memo(AIMarkdownRendererComponent);

