import { describe, it, expect, beforeEach } from 'vitest';
import { storage } from '../storage';
import { renderInlineFormattedText } from '../noteFormatter';

describe('QuestionNotesEditor & Rich Formatting', () => {
  beforeEach(() => {
    storage.deleteNote(999);
  });

  it('persists notes with bold, highlight, and markdown formatting', () => {
    const noteContent =
      '### Analysis for Question 999\n' +
      '- Option A is correct because ==AWS KMS== provides automatic rotation.\n' +
      '- Option D is wrong because **Amazon EBS** is not ==Highly Available== across Regions.\n' +
      '- Use `S3 Intelligent-Tiering` to optimize cost.';

    storage.saveNote(999, noteContent);
    const saved = storage.getNote(999);

    expect(saved).not.toBeNull();
    expect(saved?.noteText).toBe(noteContent);
    expect(saved?.noteText).toContain('==AWS KMS==');
    expect(saved?.noteText).toContain('**Amazon EBS**');
    expect(saved?.noteText).toContain('`S3 Intelligent-Tiering`');

    storage.deleteNote(999);
    expect(storage.getNote(999)).toBeNull();
  });

  it('correctly parses inline formatted text tokens', () => {
    const text = 'Đáp án D sai vì ==Amazon EBS== không phải là **Highly Available**. Dùng `KMS` để encrypt.';
    const elements = renderInlineFormattedText(text) as any[];

    expect(Array.isArray(elements)).toBe(true);
    expect(elements.length).toBeGreaterThanOrEqual(5);

    // Find highlight token
    const hasHighlight = elements.some(
      (el: any) => el && el.type === 'mark' && el.props && el.props.children === 'Amazon EBS'
    );
    expect(hasHighlight).toBe(true);

    // Find bold token
    const hasBold = elements.some(
      (el: any) => el && el.type === 'strong' && el.props && el.props.children === 'Highly Available'
    );
    expect(hasBold).toBe(true);

    // Find code token
    const hasCode = elements.some(
      (el: any) => el && el.type === 'code' && el.props && el.props.children === 'KMS'
    );
    expect(hasCode).toBe(true);
  });

  it('converts markdown to note HTML and vice-versa seamlessly for single-surface editor', async () => {
    const { markdownToNoteHtml, noteHtmlToMarkdown } = await import('../noteFormatter');

    const originalMd =
      '### Analysis for Question 999\n' +
      '- Option A is correct because ==AWS KMS== provides automatic rotation.\n' +
      '- Option D is wrong because **Amazon EBS** is not ==Highly Available== across Regions.\n' +
      '- Use `S3 Intelligent-Tiering` to optimize cost.';

    const html = markdownToNoteHtml(originalMd);
    expect(html).toContain('<mark class="note-highlight');
    expect(html).toContain('AWS KMS');
    expect(html).toContain('<strong class="font-bold');
    expect(html).toContain('Amazon EBS');
    expect(html).toContain('<code class="');
    expect(html).toContain('S3 Intelligent-Tiering');

    const convertedBack = noteHtmlToMarkdown(html);
    expect(convertedBack).toContain('==AWS KMS==');
    expect(convertedBack).toContain('**Amazon EBS**');
    expect(convertedBack).toContain('==Highly Available==');
    expect(convertedBack).toContain('`S3 Intelligent-Tiering`');
  });

  it('correctly detects active typing targets with isTypingInInput to protect notes from keyboard shortcuts', async () => {
    const { isTypingInInput } = await import('../noteFormatter');

    // Null or invalid
    expect(isTypingInInput(null)).toBe(false);
    expect(isTypingInInput(undefined as any)).toBe(false);

    // Standard HTML inputs
    expect(isTypingInInput({ tagName: 'INPUT' } as any)).toBe(true);
    expect(isTypingInInput({ tagName: 'textarea' } as any)).toBe(true);
    expect(isTypingInInput({ tagName: 'SELECT' } as any)).toBe(true);

    // ContentEditable surface
    expect(isTypingInInput({ tagName: 'DIV', isContentEditable: true } as any)).toBe(true);

    // Nested element inside ContentEditable
    const spanInside = {
      tagName: 'SPAN',
      closest: (sel: string) => (sel === '[contenteditable="true"]' ? {} : null),
    };
    expect(isTypingInInput(spanInside as any)).toBe(true);

    // Element with role="textbox"
    const textbox = {
      tagName: 'DIV',
      closest: (sel: string) => (sel === '[role="textbox"]' ? {} : null),
    };
    expect(isTypingInInput(textbox as any)).toBe(true);

    // Element with .note-editor-surface class
    const surfaceChild = {
      tagName: 'P',
      closest: (sel: string) => (sel === '.note-editor-surface' ? {} : null),
    };
    expect(isTypingInInput(surfaceChild as any)).toBe(true);

    // Regular page container / body / buttons should not be treated as typing
    expect(isTypingInInput({ tagName: 'DIV', closest: () => null } as any)).toBe(false);
    expect(isTypingInInput({ tagName: 'BUTTON', closest: () => null } as any)).toBe(false);
  });

  it('manages and persists notes section open preference in storage', () => {
    storage.setNotesSectionOpen(true);
    expect(storage.isNotesSectionOpen()).toBe(true);

    storage.setNotesSectionOpen(false);
    expect(storage.isNotesSectionOpen()).toBe(false);
  });
});
