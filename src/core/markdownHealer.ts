/**
 * Utility to heal unclosed markdown blocks and diagrams
 * Useful when Generative AI responses reach token limits or get cut off mid-generation.
 */
export function autoHealMarkdown(raw: string): string {
  if (!raw) return '';
  let text = raw;

  // 1. Auto-close unclosed code block fences ```
  const fences = (text.match(/```/g) || []).length;
  if (fences % 2 !== 0) {
    // Unclosed code block exists
    const lastFenceIndex = text.lastIndexOf('```');
    const unclosedBlock = text.slice(lastFenceIndex);

    if (unclosedBlock.startsWith('```mermaid')) {
      const subgraphCount = (unclosedBlock.match(/\bsubgraph\b/g) || []).length;
      const endCount = (unclosedBlock.match(/\bend\b/g) || []).length;
      if (subgraphCount > endCount) {
        const missing = subgraphCount - endCount;
        text += '\n' + '  end\n'.repeat(missing);
      }
    }
    text += '\n```\n';
  }

  // 2. Heal orphaned diagram headers placed immediately before a code block:
  // e.g.: 'flowchart TD subgraph ... end' \n\n ```text \n alb["..."] ... ```
  text = text.replace(
    /(?:^|\n)[ \t]*['"`]?[ \t]*((?:flowchart|graph)\s+[A-Za-z]+[^\n]*)[ \t]*['"`]?[ \t]*\n+[ \t]*```(?:text)?\n([\s\S]*?)```/gi,
    (_match, header, body) => {
      const cleanHeader = header.replace(/^['"`]+|['"`]+$/g, '').trim();
      return `\n\n\`\`\`mermaid\n${cleanHeader}\n${body.trim()}\n\`\`\``;
    }
  );

  // 3. Convert mistagged code blocks (```text or untagged ```) that contain Mermaid syntax to ```mermaid:
  text = text.replace(
    /(?:^|\n)[ \t]*```(?:text)?[ \t]*\n([\s\S]*?)```/gi,
    (match, body) => {
      const trimmed = body.trim();
      const hasMermaidArrows = /(?:-->|==>|-\.->|--\s*".*?"\s*-->)/.test(trimmed);
      const hasMermaidNodes = /(?:[a-zA-Z0-9_-]+\[".*?"\]|[a-zA-Z0-9_-]+\[.*?\]|[a-zA-Z0-9_-]+\(".*?"\)|subgraph\b)/.test(trimmed);

      if (hasMermaidArrows && hasMermaidNodes) {
        const hasHeader = /^(?:flowchart|graph|sequenceDiagram|classDiagram|stateDiagram|erDiagram)\s+/i.test(trimmed);
        const mermaidCode = hasHeader ? trimmed : `flowchart TD\n${trimmed}`;
        return `\n\n\`\`\`mermaid\n${mermaidCode}\n\`\`\``;
      }
      return match;
    }
  );

  return text;
}
