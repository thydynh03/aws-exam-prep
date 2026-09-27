/**
 * Dựng src/data/saaHandbook.json từ bản OCR của tài liệu "AWS SAA-C03 Handbook"
 * (299 trang ảnh tải từ LinkedIn, lưu ở sources/saa-linkedin/).
 *
 * Quy trình:
 *   1. tesseract page-NNN.(png|jpg) -> sources/saa-linkedin/text/page-NNN.txt
 *   2. node scripts/buildHandbook.mjs
 *
 * Mục lục (toc.tsv) ghi số trang in trên giấy; file ảnh lệch +1 vì trang bìa
 * không đánh số. Mỗi service lấy các trang từ trang đầu của nó tới trước trang
 * đầu của service kế tiếp.
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const srcDir = join(root, 'sources/saa-linkedin');
const TOTAL_PAGES = 299;

const toc = readFileSync(join(srcDir, 'toc.tsv'), 'utf8')
  .trim()
  .split('\n')
  .map((line) => {
    const [category, name, ids, page] = line.split('\t');
    return {
      category,
      name,
      serviceIds: ids ? ids.split(',').filter(Boolean) : [],
      printedPage: Number(page),
    };
  });

const readPage = (filePage) => {
  const f = join(srcDir, 'text', `page-${String(filePage).padStart(3, '0')}.txt`);
  return existsSync(f) ? readFileSync(f, 'utf8') : '';
};

/** Sửa lỗi OCR hay gặp và chuẩn hóa ký tự đầu dòng. */
function cleanLine(raw) {
  let s = raw
    .replace(/\$3\b/g, 'S3')
    .replace(/\bAmazon \$3/g, 'Amazon S3')
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/\s+/g, ' ')
    .trim();
  // Ký tự bullet OCR đọc ra thành + © * « • e o ¢ ...
  const bullet = /^(?:[+©*«•·●▪►»¢®o°e-]|\d+\.)\s+/;
  const isBullet = bullet.test(s);
  if (isBullet) s = s.replace(bullet, '');
  return { text: s, isBullet };
}

const HEADING_MAX_WORDS = 7;
const SMALL_WORDS = new Set(['a', 'an', 'and', 'or', 'of', 'the', 'to', 'in', 'on', 'for', 'with', 'vs', 'by', 'it', 'is']);
function looksLikeHeading(text, next) {
  if (!text || text.length > 60) return false;
  if (/[.,;:!?]/.test(text)) return false;
  if (!/^[A-Z]/.test(text)) return false;
  const words = text.split(' ');
  if (words.length > HEADING_MAX_WORDS) return false;
  // Heading của tài liệu viết Title Case: mọi từ không phải hư từ đều viết hoa
  if (!words.every((w) => SMALL_WORDS.has(w.toLowerCase()) || /^[A-Z0-9(&/-]/.test(w))) return false;
  // Heading thường theo sau bởi một dòng nội dung, không phải heading khác
  return Boolean(next);
}

function buildSection(entry, idx) {
  const start = entry.printedPage + 1;
  let nextPrinted = TOTAL_PAGES;
  for (let j = idx + 1; j < toc.length; j++) {
    if (toc[j].printedPage > entry.printedPage) {
      nextPrinted = toc[j].printedPage;
      break;
    }
  }
  const end = Math.min(TOTAL_PAGES, Math.max(start, nextPrinted)); // exclusive
  const filePages = [];
  for (let p = start; p < end || p === start; p++) filePages.push(p);

  const lines = [];
  for (const p of filePages) {
    for (const raw of readPage(p).split('\n')) {
      const { text, isBullet } = cleanLine(raw);
      if (!text) continue;
      if (/^\d{1,3}$/.test(text)) continue; // số trang
      lines.push({ text, isBullet });
    }
  }

  const subsections = [];
  let current = { heading: 'Overview', items: [] };
  const titleLower = entry.name.toLowerCase();
  for (let i = 0; i < lines.length; i++) {
    const { text, isBullet } = lines[i];
    if (text.toLowerCase() === titleLower && i < 3) continue;
    if (!isBullet && looksLikeHeading(text, lines[i + 1])) {
      if (current.items.length) subsections.push(current);
      current = { heading: text, items: [] };
      continue;
    }
    // Nối dòng bị ngắt giữa câu vào dòng trước
    const prev = current.items[current.items.length - 1];
    if (!isBullet && prev && !/[.!?:]$/.test(prev) && /^[a-z(]/.test(text)) {
      current.items[current.items.length - 1] = `${prev} ${text}`;
    } else {
      current.items.push(text);
    }
  }
  if (current.items.length) subsections.push(current);
  // Bỏ mảnh vụn OCR (tiêu đề lặp, logo) không mang nội dung
  for (let i = subsections.length - 1; i >= 0; i--) {
    if (subsections[i].items.join(' ').length < 20) subsections.splice(i, 1);
  }

  const what = subsections.find((s) => /what (it|is)/i.test(s.heading)) || subsections[0];
  const summary = what ? what.items.join(' ').slice(0, 600) : '';

  const slug = entry.name
    .toLowerCase()
    .replace(/\(.*?\)/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 48);

  return {
    id: `hb-${slug}`,
    name: entry.name,
    category: entry.category,
    serviceIds: entry.serviceIds,
    printedPages: filePages.map((p) => p - 1),
    summary,
    subsections: subsections.map((s) => ({ heading: s.heading, items: s.items })),
  };
}

const sections = toc.map(buildSection);
const out = {
  source: {
    title: 'AWS Solutions Architect Associate (SAA-C03) Handbook',
    origin: 'LinkedIn document, 299 pages',
    note: 'Text extracted by OCR (tesseract); may contain minor recognition errors.',
  },
  sections,
};
writeFileSync(join(root, 'src/data/saaHandbook.json'), JSON.stringify(out, null, 1) + '\n');
const subCount = sections.reduce((n, s) => n + s.subsections.length, 0);
console.log(`sections=${sections.length} subsections=${subCount}`);
