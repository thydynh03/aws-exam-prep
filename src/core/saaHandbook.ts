/**
 * Tra cứu tài liệu "AWS SAA-C03 Handbook" (OCR từ 299 trang ảnh LinkedIn).
 * Dữ liệu sinh bởi scripts/buildHandbook.mjs, dùng cho Service Deep Dive,
 * AI Tutor (RAG) và bộ Flashcards.
 */
import handbookData from '../data/saaHandbook.json';

export interface HandbookSubsection {
  heading: string;
  items: string[];
}

export interface HandbookSection {
  id: string;
  name: string;
  category: string;
  serviceIds: string[];
  printedPages: number[];
  summary: string;
  subsections: HandbookSubsection[];
}

export interface HandbookHit {
  section: HandbookSection;
  subsection: HandbookSubsection;
  score: number;
}

export const HANDBOOK_TITLE = handbookData.source.title;
export const HANDBOOK_SECTIONS = handbookData.sections as HandbookSection[];

const STOPWORDS = new Set(
  'the a an and or of to in on for is are be with what how when which does do can i my it this that by from as at vs về và là của có cho khi nào gì thế không'.split(' ')
);

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9à-ỹ-]+/i)
    .filter((w) => w.length > 1 && !STOPWORDS.has(w));
}

/** Các mục handbook gắn với một service id. */
export function getHandbookSectionsForService(serviceId: string): HandbookSection[] {
  const id = serviceId.toLowerCase();
  return HANDBOOK_SECTIONS.filter((s) => s.serviceIds.includes(id));
}

/**
 * Tìm các đoạn handbook liên quan tới câu hỏi. Điểm = số từ khóa trùng,
 * cộng thêm khi đoạn thuộc service đã được nhận diện hoặc từ khóa nằm trong heading.
 */
export function searchHandbook(
  query: string,
  options: { serviceIds?: string[]; limit?: number } = {}
): HandbookHit[] {
  const { serviceIds = [], limit = 3 } = options;
  const terms = Array.from(new Set(tokenize(query)));
  if (!terms.length && !serviceIds.length) return [];
  const wanted = new Set(serviceIds.map((s) => s.toLowerCase()));

  const hits: HandbookHit[] = [];
  for (const section of HANDBOOK_SECTIONS) {
    const serviceBoost = section.serviceIds.some((id) => wanted.has(id)) ? 3 : 0;
    const nameTokens = new Set(tokenize(section.name));
    const nameBoost = terms.filter((t) => nameTokens.has(t)).length * 2;
    for (const subsection of section.subsections) {
      const body = new Set(tokenize(subsection.items.join(' ')));
      const head = new Set(tokenize(subsection.heading));
      let score = 0;
      for (const t of terms) {
        if (body.has(t)) score += 1;
        if (head.has(t)) score += 2;
      }
      if (score === 0 && serviceBoost === 0) continue;
      score += serviceBoost + nameBoost;
      hits.push({ section, subsection, score });
    }
  }
  hits.sort((a, b) => b.score - a.score);

  // Không lấy quá 2 đoạn của cùng một service để câu trả lời đa dạng hơn
  const perSection = new Map<string, number>();
  const result: HandbookHit[] = [];
  for (const h of hits) {
    const n = perSection.get(h.section.id) || 0;
    if (n >= 2) continue;
    perSection.set(h.section.id, n + 1);
    result.push(h);
    if (result.length >= limit) break;
  }
  return result;
}

/** Id trong AWS_SERVICES gộp nhiều service, còn handbook tách riêng từng cái. */
const SERVICE_ALIASES: Record<string, string[]> = {
  'ecs-fargate': ['ecs', 'fargate'],
  'alb-nlb': ['elb'],
};

export function getHandbookSectionsForExplorerId(serviceId: string): HandbookSection[] {
  const ids = SERVICE_ALIASES[serviceId] || [serviceId];
  const seen = new Set<string>();
  return ids
    .flatMap((id) => getHandbookSectionsForService(id))
    .filter((s) => (seen.has(s.id) ? false : (seen.add(s.id), true)));
}

export function formatHandbookPages(pages: number[]): string {
  if (!pages.length) return '';
  const first = pages[0];
  const last = pages[pages.length - 1];
  return first === last ? `tr. ${first}` : `tr. ${first}–${last}`;
}
