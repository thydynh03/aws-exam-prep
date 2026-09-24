import type { RawQuestion, Question, AWSDomain } from './types';
import { SAA_EXAM_QUOTAS_65, SAA_EXAM_QUOTAS_32 } from './domainMeta';
import { parseAllQuestions } from './questionParser';
import rawQuestionsData from '../data/questions.json';

class QuestionRepository {
  private questions: Question[] = [];
  private questionMap: Map<number, Question> = new Map();
  private domainBuckets: Map<AWSDomain, Question[]> = new Map();
  private standard32: Question[] = [];
  private serviceTags: string[] = [];

  constructor() {
    this.init(rawQuestionsData as RawQuestion[]);
  }

  private init(rawData: RawQuestion[]) {
    this.questions = parseAllQuestions(rawData);
    this.questionMap.clear();
    this.domainBuckets.clear();

    const allDomains: AWSDomain[] = [
      'Domain 1: Design Secure Architectures',
      'Domain 2: Design Resilient Architectures',
      'Domain 3: Design High-Performing Architectures',
      'Domain 4: Design Cost-Optimized Architectures',
    ];
    for (const d of allDomains) {
      this.domainBuckets.set(d, []);
    }

    const tagSet = new Set<string>();

    for (const q of this.questions) {
      this.questionMap.set(q.id, q);
      for (const tag of q.serviceTags) {
        tagSet.add(tag);
      }
      const bucket = this.domainBuckets.get(q.domain);
      if (bucket) {
        bucket.push(q);
      }
    }

    // First 32 questions as the legacy sequential test sample set
    this.standard32 = this.questions.slice(0, 32);
    this.serviceTags = Array.from(tagSet).sort();
  }

  public getAllQuestions(): Question[] {
    return this.questions;
  }

  public getStandard32Questions(): Question[] {
    return this.standard32;
  }

  public getQuestionsByDomain(domain: AWSDomain): Question[] {
    return this.domainBuckets.get(domain) || [];
  }

  /**
   * Generates a 65-question AWS SAA-C03 mock exam strictly compliant with official Content Domain ratios:
   * - Domain 1: Design Secure Architectures (30% -> 20 questions)
   * - Domain 2: Design Resilient Architectures (26% -> 17 questions)
   * - Domain 3: Design High-Performing Architectures (24% -> 15 questions)
   * - Domain 4: Design Cost-Optimized Architectures (20% -> 13 questions)
   * Total = 65 questions (100%)
   */
  public get65AssociateQuestions(randomize = true): Question[] {
    return this.generateSAAExamSet(65, randomize);
  }

  /**
   * Generates a 32-question AWS SAA-C03 mini mock exam strictly compliant with official Content Domain ratios:
   * - Domain 1: Design Secure Architectures (30% -> 10 questions)
   * - Domain 2: Design Resilient Architectures (26% -> 8 questions)
   * - Domain 3: Design High-Performing Architectures (24% -> 8 questions)
   * - Domain 4: Design Cost-Optimized Architectures (20% -> 6 questions)
   * Total = 32 questions (100%)
   */
  public get32AssociateQuestions(randomize = true): Question[] {
    return this.generateSAAExamSet(32, randomize);
  }

  public generateSAAExamSet(count: 65 | 32, randomize = true): Question[] {
    const quotas = count === 65 ? SAA_EXAM_QUOTAS_65 : SAA_EXAM_QUOTAS_32;
    const selected: Question[] = [];

    const domains: AWSDomain[] = [
      'Domain 1: Design Secure Architectures',
      'Domain 2: Design Resilient Architectures',
      'Domain 3: Design High-Performing Architectures',
      'Domain 4: Design Cost-Optimized Architectures',
    ];

    for (const domain of domains) {
      const quota = quotas[domain];
      const pool = [...(this.domainBuckets.get(domain) || [])];

      if (randomize) {
        for (let i = pool.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [pool[i], pool[j]] = [pool[j], pool[i]];
        }
      }

      selected.push(...pool.slice(0, quota));
    }

    if (randomize) {
      // Natural interleave: shuffle the combined domain questions
      for (let i = selected.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [selected[i], selected[j]] = [selected[j], selected[i]];
      }
      return selected;
    }

    // Deterministic balanced interleave for non-random preset: D1, D2, D3, D4, D1, D2, D3, D4...
    const d1 = selected.filter((q) => q.domain === 'Domain 1: Design Secure Architectures');
    const d2 = selected.filter((q) => q.domain === 'Domain 2: Design Resilient Architectures');
    const d3 = selected.filter((q) => q.domain === 'Domain 3: Design High-Performing Architectures');
    const d4 = selected.filter((q) => q.domain === 'Domain 4: Design Cost-Optimized Architectures');

    const interleaved: Question[] = [];
    const maxLen = Math.max(d1.length, d2.length, d3.length, d4.length);
    for (let i = 0; i < maxLen; i++) {
      if (i < d1.length) interleaved.push(d1[i]);
      if (i < d2.length) interleaved.push(d2[i]);
      if (i < d3.length) interleaved.push(d3[i]);
      if (i < d4.length) interleaved.push(d4[i]);
    }
    return interleaved;
  }

  public getQuestionById(id: number): Question | undefined {
    return this.questionMap.get(id);
  }

  public getQuestionsByIds(ids: number[]): Question[] {
    const list: Question[] = [];
    for (const id of ids) {
      const q = this.questionMap.get(id);
      if (q) list.push(q);
    }
    return list;
  }

  public getCustomExamSet(count: number, shuffle = false): Question[] {
    const pool = [...this.questions];
    if (shuffle) {
      for (let i = pool.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [pool[i], pool[j]] = [pool[j], pool[i]];
      }
    }
    return pool.slice(0, Math.min(count, pool.length));
  }

  public getAllServiceTags(): string[] {
    return this.serviceTags;
  }

  public filterQuestions(opts: {
    tag?: string;
    search?: string;
    ids?: number[];
    isMultiSelect?: boolean;
    useStandard32Only?: boolean;
  }): Question[] {
    let source = opts.useStandard32Only ? this.standard32 : this.questions;

    if (opts.ids && opts.ids.length > 0) {
      const idSet = new Set(opts.ids);
      source = source.filter(q => idSet.has(q.id));
    }

    if (opts.tag && opts.tag !== 'All') {
      source = source.filter(q => q.serviceTags.includes(opts.tag!));
    }

    if (opts.isMultiSelect !== undefined) {
      source = source.filter(q => q.isMultiSelect === opts.isMultiSelect);
    }

    if (opts.search && opts.search.trim()) {
      const query = opts.search.trim().toLowerCase();
      source = source.filter(q => {
        if (q.text.toLowerCase().includes(query)) return true;
        if (String(q.id).includes(query)) return true;
        for (const val of Object.values(q.choices)) {
          if (val.toLowerCase().includes(query)) return true;
        }
        return false;
      });
    }

    return source;
  }
}

export const questionRepository = new QuestionRepository();
