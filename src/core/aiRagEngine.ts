/**
 * Retrieval-Augmented Generation (RAG) Engine for AWS AI Tutor
 *
 * Implements context-aware knowledge retrieval over:
 * 1. 1,019 SAA-C03 Question Bank with canonical answers and explanations
 * 2. 42 AWS Architecture Service Guides (core concepts, traps, exam relevance)
 * 3. Distractor Explanations & Architectural Anti-Pattern rules
 * 4. Learner's personal study notes and analytics
 */

import type { Question } from './types';
import { AWS_SERVICES, SERVICE_COMPARISONS } from './serviceDatabase';
import { questionRepository } from './questionRepository';
import { generateAllOptionExplanations } from './distractorExplainer';
import { detectQuestionClues } from './questionClues';
import { getDomainMeta } from './domainMeta';
import { getCuratedExplanation } from './curatedExplanations';
import type { AICitation } from './aiConversationStorage';
import type { AITutorMode } from './aiConfigStorage';

export interface RAGContext {
  systemPrompt: string;
  userPrompt: string;
  citations: AICitation[];
  detectedServices: string[];
  relatedQuestionIds: number[];
}

/**
 * Retrieve relevant AWS knowledge items for a given query or current question
 */
export function retrieveRelevantKnowledge(
  query: string,
  currentQuestion?: Question,
  limit: number = 4
): { citations: AICitation[]; serviceSnippets: string[]; relatedQuestions: Question[] } {
  const citations: AICitation[] = [];
  const serviceSnippets: string[] = [];
  const queryLower = (query || '').toLowerCase();
  const qText = (currentQuestion?.text || '').toLowerCase();
  const searchTerms = `${queryLower} ${qText}`;

  // 1. Retrieve matching AWS Services
  const matchedServices = AWS_SERVICES.filter((svc) => {
    const nameMatch = svc.name.toLowerCase().includes(queryLower) || qText.includes(svc.name.toLowerCase());
    const idMatch = searchTerms.includes(svc.id.toLowerCase());
    const abbrMatch = svc.abbreviation && searchTerms.includes(svc.abbreviation.toLowerCase());
    const tagMatch = currentQuestion?.serviceTags?.some(t => t.toLowerCase() === svc.id.toLowerCase());
    return nameMatch || idMatch || abbrMatch || tagMatch;
  }).slice(0, 3);

  for (const svc of matchedServices) {
    citations.push({
      id: `svc_${svc.id}`,
      title: `Cẩm nang AWS: ${svc.name} (${svc.category})`,
      snippet: `${svc.summary} | Trọng tâm thi: ${svc.examRelevance}`,
      url: svc.docsUrl,
      type: 'aws_service',
    });

    serviceSnippets.push(
      `### ${svc.name} (${svc.category})
- **Tổng quan:** ${svc.summary}
- **Khái niệm cốt lõi:**
${svc.coreConcepts.slice(0, 3).map(c => `  * ${c}`).join('\n')}
- **Bẫy thi AWS (Common Traps):**
${svc.commonTraps.slice(0, 2).map(t => `  * ⚠️ ${t}`).join('\n')}
- **Trọng tâm đề thi SAA-C03:** ${svc.examRelevance}`
    );
  }

  // 2. Retrieve related questions from the 1,019 question bank
  const allQuestions = questionRepository.getAllQuestions();
  const relatedQuestions: Question[] = [];

  if (currentQuestion) {
    citations.push({
      id: `q_${currentQuestion.id}`,
      title: `Câu hỏi #${currentQuestion.id}: ${currentQuestion.domain}`,
      snippet: `Đáp án chuẩn: ${currentQuestion.answer}. ${(currentQuestion.answerDescription || '').slice(0, 160)}...`,
      type: 'question',
    });

    // Find 2 similar questions in same domain/topic or sharing service tags
    for (const q of allQuestions) {
      if (q.id === currentQuestion.id) continue;
      const shareTag = q.serviceTags.some(t => currentQuestion.serviceTags.includes(t));
      const sameTopic = q.topic === currentQuestion.topic;
      if (shareTag || sameTopic) {
        relatedQuestions.push(q);
        if (relatedQuestions.length >= 2) break;
      }
    }
  } else if (queryLower.trim()) {
    // Search question bank by query keywords
    for (const q of allQuestions) {
      if (q.text.toLowerCase().includes(queryLower) || q.serviceTags.some(t => queryLower.includes(t.toLowerCase()))) {
        relatedQuestions.push(q);
        citations.push({
          id: `q_${q.id}`,
          title: `Câu hỏi #${q.id} (Chủ đề: ${q.topic})`,
          snippet: q.text.slice(0, 140) + '...',
          type: 'question',
        });
        if (relatedQuestions.length >= 2) break;
      }
    }
  }

  return { citations: citations.slice(0, limit), serviceSnippets, relatedQuestions };
}

type ChatHistoryItem = { role: 'user' | 'assistant'; content: string };

export interface ConversationContext {
  /** Prior turns, excluding the current query */
  priorTurns: ChatHistoryItem[];
  isFollowUp: boolean;
  /** Displayed question, or the question the conversation is about (e.g. pasted screen text) */
  resolvedQuestion?: Question;
  /** Query enriched with the conversation topic, for keyword retrieval */
  retrievalQuery: string;
}

/**
 * Extracts a virtual Question object from screen-reading or pasted question text in chat.
 */
export function parsePastedQuestion(text: string): Question | undefined {
  if (!text) return undefined;

  const isScreenReading = text.includes('[ĐỌC MÀN HÌNH HIỆN TẠI') || text.includes('- Nội dung đề bài:') || text.includes('Mã câu hỏi:');
  const hasOptions = /\b[A-E]\.\s+/i.test(text);

  if (!isScreenReading && !hasOptions) return undefined;

  // 1. Extract ID
  const idMatch = text.match(/(?:mã câu hỏi|câu hỏi|câu|question)[^#\n]{0,20}#\s*(\d{1,5})/i) || text.match(/#\s*(\d{1,5})/);
  const id = idMatch ? parseInt(idMatch[1], 10) : 9999;

  // 2. Extract Domain
  const domainMatch = text.match(/\[Domain:\s*([^\]]+)\]/i);
  let domain = (domainMatch ? domainMatch[1].trim() : '') as any;
  if (!domain || !domain.startsWith('Domain')) {
    domain = 'Domain 4: Design Cost-Optimized Architectures';
  }

  // 3. Extract Question Text
  let questionText = '';
  if (text.includes('- Nội dung đề bài:')) {
    const afterPrompt = text.split('- Nội dung đề bài:')[1] || '';
    questionText = afterPrompt.split('- Các phương án lựa chọn:')[0]?.trim() || '';
  } else {
    const lines = text.split('\n');
    const qLines: string[] = [];
    for (const line of lines) {
      const trimmed = line.trim();
      if (/^[A-E]\.\s+/.test(trimmed)) break;
      if (!trimmed.startsWith('[') && !trimmed.startsWith('- Chế độ') && !trimmed.startsWith('- Mã câu')) {
        qLines.push(trimmed);
      }
    }
    questionText = qLines.join('\n').trim();
  }

  // 4. Extract Choices
  const choices: Record<string, string> = {};
  const choiceKeys: string[] = [];
  const lines = text.split('\n');
  let currentKey: string | null = null;
  let currentVal: string[] = [];

  for (const line of lines) {
    const optMatch = line.trim().match(/^([A-E])\.\s+(.*)$/);
    if (optMatch) {
      if (currentKey && currentVal.length > 0) {
        choices[currentKey] = currentVal.join(' ').trim();
        choiceKeys.push(currentKey);
      }
      currentKey = optMatch[1].toUpperCase();
      currentVal = [optMatch[2].trim()];
    } else if (currentKey) {
      const trimmed = line.trim();
      if (trimmed.startsWith('- Trạng thái') || trimmed.startsWith('Hãy đọc') || trimmed.startsWith('[') || !trimmed) {
        if (currentKey && currentVal.length > 0) {
          choices[currentKey] = currentVal.join(' ').trim();
          choiceKeys.push(currentKey);
          currentKey = null;
          currentVal = [];
        }
      } else {
        currentVal.push(trimmed);
      }
    }
  }
  if (currentKey && currentVal.length > 0) {
    choices[currentKey] = currentVal.join(' ').trim();
    choiceKeys.push(currentKey);
  }

  if (choiceKeys.length < 2) return undefined;

  // 5. Infer or determine correct answer
  let answer = choiceKeys[0];
  const ansExplicitMatch = text.match(/(?:đáp án đúng|đáp án là|answer is|correct answer)\s*[:=]?\s*([A-E]+)/i);
  if (ansExplicitMatch) {
    answer = ansExplicitMatch[1].toUpperCase();
  } else {
    // Check if question asks about physical tapes and backup software investment -> iSCSI-VTL choice
    const qLower = (questionText + ' ' + text).toLowerCase();
    if (qLower.includes('tape') || qLower.includes('băng từ')) {
      const vtlChoice = choiceKeys.find(k => choices[k].toLowerCase().includes('vtl') || choices[k].toLowerCase().includes('tape'));
      if (vtlChoice) answer = vtlChoice;
    }
  }

  // 6. Extract Service Tags
  const combined = `${questionText} ${Object.values(choices).join(' ')}`.toLowerCase();
  const serviceTags: string[] = [];
  const candidateTags = [
    'AWS Storage Gateway', 'Storage Gateway', 'iSCSI-VTL', 'Amazon EFS', 'Amazon S3',
    'S3 Glacier', 'Amazon EC2', 'AWS Lambda', 'Amazon DynamoDB', 'Amazon RDS',
    'Amazon Aurora', 'Amazon VPC', 'Application Load Balancer', 'Network Load Balancer',
    'Amazon SQS', 'Amazon SNS', 'AWS KMS', 'Amazon CloudFront', 'Route 53',
  ];
  for (const tag of candidateTags) {
    if (combined.includes(tag.toLowerCase()) && !serviceTags.includes(tag)) {
      serviceTags.push(tag);
    }
  }

  return {
    id,
    originalId: String(id),
    text: questionText || 'Câu hỏi bài thi AWS Solutions Architect Associate',
    choices,
    choiceKeys: choiceKeys.sort(),
    answer,
    answerDescription: `Đáp án chính xác là **${answer}**: ${choices[answer] || ''}. Lựa chọn này đáp ứng tối ưu yêu cầu của đề bài.`,
    communityVotes: [],
    topic: '1',
    serviceTags: serviceTags.length > 0 ? serviceTags : ['AWS Solutions Architect'],
    domain,
    difficulty: 'Medium',
    isMultiSelect: answer.length > 1,
    expectedChoicesCount: Math.max(1, answer.length),
  };
}

/**
 * Resolves what an ongoing conversation is about so follow-ups ("đề có gì mà phải chọn...")
 * are answered against the right question instead of as a standalone concept query.
 */
export function resolveConversationContext(
  userQuery: string,
  history: ChatHistoryItem[] = [],
  currentQuestion?: Question
): ConversationContext {
  const priorTurns = history.filter(
    (h, i, arr) => !(i === arr.length - 1 && h.role === 'user' && h.content.trim() === userQuery.trim())
  );
  const isFollowUp = priorTurns.length > 0;

  let resolvedQuestion = currentQuestion;

  // 1. Check if userQuery itself specifies question id (e.g. "câu #517" or "câu 517")
  if (!resolvedQuestion) {
    const queryIdMatch = userQuery.match(/(?:câu hỏi|câu|question)\s*(?:số|#)?\s*(\d{1,5})/i);
    if (queryIdMatch) {
      resolvedQuestion = questionRepository.getQuestionById(Number(queryIdMatch[1]));
    }
  }

  if (!resolvedQuestion && isFollowUp) {
    const priorUserText = priorTurns.filter((h) => h.role === 'user').map((h) => h.content).join('\n');
    // 2. Explicit question id in pasted screen text, e.g. "Mã câu hỏi: #517" / "Câu #517"
    for (const m of priorUserText.matchAll(/(?:câu hỏi|câu|question)[^#\n]{0,20}#\s*(\d{1,5})/gi)) {
      const q = questionRepository.getQuestionById(Number(m[1]));
      if (q) { resolvedQuestion = q; break; }
    }
    // 3. Pasted question body: match a distinctive prefix of a bank question
    if (!resolvedQuestion && priorUserText.length > 120) {
      const haystack = priorUserText.toLowerCase().replace(/\s+/g, ' ');
      resolvedQuestion = questionRepository.getAllQuestions().find((q) => {
        const probe = q.text.toLowerCase().replace(/\s+/g, ' ').slice(0, 90);
        return probe.length >= 60 && haystack.includes(probe);
      });
    }
    // 4. Synthesize Question from screen-reading text or pasted options
    if (!resolvedQuestion) {
      resolvedQuestion = parsePastedQuestion(priorUserText);
    }
  }

  // 5. If still not resolved, check if userQuery contains pasted question
  if (!resolvedQuestion) {
    resolvedQuestion = parsePastedQuestion(userQuery);
  }

  let retrievalQuery = userQuery;
  if (isFollowUp) {
    const anchorSource =
      resolvedQuestion?.text || priorTurns.find((h) => h.role === 'user')?.content || '';
    const anchor = anchorSource.replace(/\s+/g, ' ').trim().slice(0, 400);
    if (anchor) retrievalQuery = `${userQuery} ${anchor}`;
  }

  return { priorTurns, isFollowUp, resolvedQuestion, retrievalQuery };
}

export interface QueryIntent {
  isQuestionSolvingIntent: boolean;
  isGeneralConceptIntent: boolean;
  isConversationalOrMeta?: boolean;
  isAskingImageCapability?: boolean;
  isScreenReadingIntent?: boolean;
}

/**
 * Classifies learner query intent to distinguish between:
 * 1. Asking to solve/explain the current exam question or its options (Question Solving Intent)
 * 2. Asking a standalone concept/service question (Concept/Knowledge Intent)
 * 3. Conversational / capability queries (Image reading, greetings, bot instructions)
 */
export function classifyUserQueryIntent(userQuery: string): QueryIntent {
  const q = (userQuery || '').trim().toLowerCase();
  if (!q) {
    return { isQuestionSolvingIntent: false, isGeneralConceptIntent: false };
  }

  // Conversational & Bot Capability detection
  const isAskingImageCapability =
    /(?:đọc|nhận diện|xem|hiểu|quét|thấy|phân tích)\s+(?:được\s+)?(?:ảnh|hình|image|screenshot|photo)/i.test(q) ||
    /(?:ảnh|hình|image|photo)\s+(?:có\s+)?(?:đọc|xem|nhận diện|hiểu)\s+được\s+(?:không|k|\?)/i.test(q) ||
    /(?:ra|m|bot|bạn)?\s*đọc\s+(?:được\s+)?(?:ảnh|hình|image)/i.test(q) ||
    /đọc\s+ảnh\s*(?:được\s*)?(?:không|k|\?)/i.test(q);

  const isGreetingOrMeta =
    /^(chào|xin chào|hello|hi|hey|alo|bạn là ai|who are you|hướng dẫn|trợ giúp|help)\b/i.test(q) ||
    /^(giới thiệu|tính năng|chức năng)\b/i.test(q) ||
    /(?:bạn|bot|ai|m)\s+(?:có\s+thể\s+|làm\s+được\s+|giúp\s+được\s+)(?:gì|những gì)/i.test(q);

  const isScreenReading = q.includes('[đọc màn hình hiện tại') || q.includes('[doc man hinh hien tai');
  if (isScreenReading) {
    return {
      isQuestionSolvingIntent: false,
      isGeneralConceptIntent: false,
      isScreenReadingIntent: true,
    };
  }

  if (isAskingImageCapability) {
    return {
      isQuestionSolvingIntent: false,
      isGeneralConceptIntent: false,
      isConversationalOrMeta: true,
      isAskingImageCapability: true,
    };
  }

  if (isGreetingOrMeta) {
    return {
      isQuestionSolvingIntent: false,
      isGeneralConceptIntent: false,
      isConversationalOrMeta: true,
      isAskingImageCapability: false,
    };
  }

  // Explicit keywords indicating user wants exam question solved, answers checked, or options broken down
  const questionSolvingKeywords = [
    'giải thích câu này',
    'giải thích bài này',
    'giải thích câu hỏi',
    'giải thích đề',
    'phân tích câu này',
    'phân tích bài này',
    'phân tích câu hỏi',
    'câu này chọn gì',
    'câu này đáp án',
    'đáp án câu này',
    'đáp án đúng của câu này',
    'đáp án của bài này',
    'tại sao chọn a',
    'tại sao chọn b',
    'tại sao chọn c',
    'tại sao chọn d',
    'tại sao chọn e',
    'vì sao chọn a',
    'vì sao chọn b',
    'vì sao chọn c',
    'vì sao chọn d',
    'vì sao chọn e',
    'vì sao chọn',
    'tại sao chọn',
    'tại sao lại chọn',
    'tại sao tôi sai',
    'vì sao tôi sai',
    'tại sao lại sai',
    'tại sao sai',
    'sao sai',
    'sao lại sai',
    'tôi chọn sai',
    'phân tích các phương án',
    'phân tích các đáp án',
    'phân tích từng lựa chọn',
    'phân tích 4 đáp án',
    'phân tích đáp án',
    'phương án a đúng hay sai',
    'các phương án gây nhiễu',
    'bóc mẽ bẫy',
    'mẹo câu này',
    'hãy giải thích toàn diện câu hỏi này',
    'hãy phân tích chi tiết từng lựa chọn',
    'sơ đồ cho câu hỏi này',
    'vẽ sơ đồ cho câu này',
    'đề có cái gì',
    'đề có gì',
    'đề hỏi gì',
    'đề hỏi cái gì',
    'đề yêu cầu gì',
    'đề yêu cầu',
    'trong đề',
    'yêu cầu của đề',
    'dựa vào đề',
    'phải chọn',
    'tại sao phải chọn',
    'vì sao phải chọn',
    'sao lại chọn',
    'sao phải chọn',
  ];

  const hasQuestionSolvingKeyword = questionSolvingKeywords.some((kw) => q.includes(kw));
  const mentionsPromptOrRequirement = (q.includes('đề') || q.includes('yêu cầu')) && (q.includes('chọn') || q.includes('giao thức') || q.includes('tại sao') || q.includes('cái gì'));

  // Check if query is asking why an answer/option was wrong / right, or mentions specific option letters A-E
  const isAskingWhyWrong =
    (q.includes('tại sao') || q.includes('vì sao') || q.includes('sao lại') || q.includes('sao')) &&
    (q.includes('sai') || q.includes('đúng'));
  const mentionsOptionLetter = /\b(phương án|đáp án|lựa chọn|câu|chọn)\s+[a-e]\b/i.test(q) || /\b[a-e]\s+(đúng|sai|lại sai)\b/i.test(q);
  const mentionsSelfMistake = (q.includes('tôi') || q.includes('mình')) && (q.includes('chọn') || q.includes('sai'));

  // Check if query is comparing specific question options (e.g., "a và c", "so sánh a và c", "a khác c", "a khác gì c", "a với c")
  const isComparingOptions =
    /\b[a-e]\s*(?:và|với|vs|khác(?:\s+gì)?|hay|hoặc)\s*[a-e]\b/i.test(q) ||
    /(?:so\s+sánh|khác\s+(?:nhau|gì))\s*(?:giữa)?\s*[a-e]\s*(?:và|với|vs)\s*[a-e]\b/i.test(q) ||
    /(?:phương án|đáp án|lựa chọn)\s*[a-e]\b.*?(?:phương án|đáp án|lựa chọn)?\s*[a-e]\b/i.test(q);

  // If user explicitly asks about solving or analyzing the question/options
  if (
    hasQuestionSolvingKeyword ||
    mentionsPromptOrRequirement ||
    isComparingOptions ||
    (isAskingWhyWrong && (mentionsOptionLetter || mentionsSelfMistake)) ||
    (mentionsOptionLetter && q.includes('chọn'))
  ) {
    return { isQuestionSolvingIntent: true, isGeneralConceptIntent: false };
  }

  // If query specifically references the prompt/exam, do not treat as standalone concept
  if ((q.includes('đề') || q.includes('câu hỏi')) && (q.includes('chọn') || q.includes('phải') || q.includes('sao'))) {
    return { isQuestionSolvingIntent: true, isGeneralConceptIntent: false };
  }

  // Concept / explanation query indicators
  const conceptIndicators = [
    'là gì',
    'la gi',
    'là cái gì',
    'la cai gi',
    'cái gì',
    'cai gi',
    'nghĩa là gì',
    'nghia la gi',
    'nghĩa là sao',
    'nghia la sao',
    'dùng để làm gì',
    'dung de lam gi',
    'để làm gì',
    'de lam gi',
    'dùng làm gì',
    'dung lam gi',
    'làm gì',
    'lam gi',
    'khái niệm',
    'định nghĩa',
    'what is',
    'what are',
    'what does',
    'what means',
    'hoạt động như thế nào',
    'hoat dong nhu the nao',
    'hoạt động thế nào',
    'hoat dong the nao',
    'hoạt động ra sao',
    'cơ chế hoạt động',
    'cơ chế',
    'how does',
    'how it works',
    'how to use',
    'ví dụ',
    'vi du',
    'cho ví dụ',
    'cho vi du',
    'cho 1 ví dụ',
    'example',
    'use case',
    'tình huống thực tế',
    'so sánh',
    'so sanh',
    'khác gì',
    'khac gi',
    'khác nhau',
    'khac nhau',
    'difference',
    'vs',
    'versus',
    'khi nào dùng',
    'khi nao dung',
    'khi nào nên dùng',
    'when to use',
    'lợi ích',
    'tác dụng',
    'ý nghĩa',
    'ưu điểm',
    'nhược điểm',
    'nguyên lý',
    'bản chất',
    'giải thích khái niệm',
    'thế nào',
    'the nao',
    'như thế nào',
    'nhu the nao',
    'ra sao',
  ];

  const hasConceptIndicator = conceptIndicators.some((kw) => q.includes(kw));

  const isConceptPattern =
    /\blà\s+(?:cái\s+)?gì\b/i.test(q) ||
    /\b(?:cái\s+)?gì\s+(?:vậy|thế|đấy|\?)\b/i.test(q) ||
    /\bnghĩa\s+là\s+(?:gì|sao)\b/i.test(q) ||
    /\b(?:dùng|sử dụng)\s+(?:để\s+)?làm\s+gì\b/i.test(q) ||
    /\bhoạt\s+động\s+(?:như\s+thế\s+nào|thế\s+nào|ra\s+sao)\b/i.test(q) ||
    /\b(what|how|why)\b/i.test(q) ||
    /^(?:giải thích|tìm hiểu|cho hỏi|hỏi về)\s+(?:khái niệm\s+)?(.+)/i.test(q);

  // Check if query explicitly mentions the question on screen
  const mentionsQuestion =
    q.includes('câu này') ||
    q.includes('bài này') ||
    q.includes('đáp án câu') ||
    q.includes('đề bài này') ||
    q.includes('đề này') ||
    q.includes('câu hỏi này');

  const words = q.split(/\s+/).filter(Boolean);
  const isShortLookup = words.length <= 6 && !mentionsQuestion;
  const hasAwsTerm = AWS_SERVICES.some(s =>
    q.includes(s.name.toLowerCase()) ||
    q.includes(s.id.toLowerCase()) ||
    (Boolean(s.abbreviation) && q.split(/\s+/).some(w => w.toLowerCase() === s.abbreviation?.toLowerCase()))
  ) || SERVICE_COMPARISONS.some(c => c.id.split('-vs-').some(t => q.includes(t)));

  const isGeneralConcept =
    !mentionsQuestion &&
    (hasConceptIndicator || isConceptPattern || (isShortLookup && hasAwsTerm) || true);

  return {
    isQuestionSolvingIntent: false,
    isGeneralConceptIntent: isGeneralConcept,
  };
}

/**
 * Builds context-rich instruction and prompt for the AI Tutor
 */
export function buildAIPromptContext(params: {
  currentQuestion?: Question;
  selectedAnswer?: string;
  isSubmitted?: boolean;
  isCorrect?: boolean;
  userNotes?: string;
  userQuery: string;
  mode?: AITutorMode;
  learnerAnalytics?: {
    accuracyPercent?: number;
    weakTopics?: string[];
  };
  imageAttached?: boolean;
  /** Conversation so far; sent to the LLM as turns by aiClient, used here to resolve context */
  history?: ChatHistoryItem[];
}): RAGContext {
  const {
    selectedAnswer = '',
    isSubmitted = false,
    isCorrect = false,
    userNotes = '',
    userQuery,
    mode = 'explain',
    learnerAnalytics,
    imageAttached = false,
    history = [],
  } = params;

  const convo = resolveConversationContext(userQuery, history, params.currentQuestion);
  const currentQuestion = convo.resolvedQuestion;
  const { citations, serviceSnippets, relatedQuestions } = retrieveRelevantKnowledge(convo.retrievalQuery, currentQuestion);
  const intent = classifyUserQueryIntent(userQuery);
  // In a multi-turn conversation the LLM decides itself (it sees the full history), so the
  // keyword classifier must not force "concept only" and hide the question context.
  const isConceptOnly = !convo.isFollowUp && intent.isGeneralConceptIntent && !intent.isQuestionSolvingIntent;

  // Mode Specific Directive - Primary Persona & Structure Instructions
  let modeGuidance = '';
  if (convo.isFollowUp) {
    modeGuidance = `
=== HỘI THOẠI NHIỀU LƯỢT ===
Đây là một lượt trong cuộc hội thoại đang diễn ra (các lượt trước đã được gửi kèm). Trước khi trả lời, hãy TỰ XÁC ĐỊNH:
- Nếu câu hỏi mới tham chiếu tới đề bài, kịch bản, phương án hoặc nội dung đã bàn trước đó (kể cả tham chiếu ngầm như "nó", "cái đó", "đề có gì mà..."): trả lời BÁM SÁT ngữ cảnh đó — trích đúng các cụm từ/ràng buộc trong đề dẫn tới kết luận, giải thích vì sao phương án đó đúng và các phương án khác không thỏa.
- Nếu câu hỏi mới là chủ đề độc lập không liên quan: trả lời như câu hỏi khái niệm, kèm ví dụ thực tế, không giải bài thi.
- Trả lời đúng trọng tâm điều học viên đang hỏi; không lặp lại nguyên văn câu trả lời trước, không áp khuôn cấu trúc cứng nhắc.`;
  } else if (isConceptOnly) {
    modeGuidance = `
=== BẠN ĐANG TRẢ LỜI CÂU HỎI KHÁI NIỆM / DỊCH VỤ ĐỘC LẬP ===
MỤC TIÊU TỐI THƯỢNG: Trả lời trực tiếp, rõ ràng bản chất kỹ thuật của câu hỏi học viên, VÀ BẮT BUỘC CUNG CẤP VÍ DỤ THỰC TẾ MINH HỌA sinh động, dễ hiểu.

QUY TẮC CỐT LÕI (TUYỆT ĐỐI TUÂN THỦ):
1. 🎯 CHỈ TRẢ LỜI ĐÚNG CÂU HỎI CỦA HỌC VIÊN:
   - Học viên đang hỏi một câu hỏi khái niệm / dịch vụ AWS (ví dụ: "${userQuery}").
   - Tập trung 100% vào việc làm sáng tỏ khái niệm, cơ chế và ứng dụng của công nghệ này.
2. 💡 BẮT BUỘC CÓ VÍ DỤ THỰC TẾ (Real-World Practical Example):
   - Luôn đưa ra ít nhất 1 ví dụ thực tế trong doanh nghiệp hoặc ví von đời sống cụ thể (ví dụ: luồng người dùng truy cập, luồng dữ liệu di chuyển từng bước) để người học hình dung được cách áp dụng trong dự án thật.
3. 🚫 TUYỆT ĐỐI KHÔNG GIẢI ĐỀ THI HAY TIẾT LỘ ĐÁP ÁN ĐỀ BÀI:
   - Học viên CHỈ hỏi về khái niệm/công nghệ, KHÔNG yêu cầu giải câu hỏi thi đang hiển thị trên màn hình.
   - TUYỆT ĐỐI KHÔNG nói "Đáp án đúng là...", "Phương án A là...", "Vì sao các phương án khác sai...".
   - TUYỆT ĐỐI KHÔNG giải bài toán hay bóc tách các lựa chọn A, B, C, D của câu hỏi thi trên màn hình.
4. 🌟 CẤU TRÚC PHẢN HỒI ĐỀ XUẤT:
   - **📌 Khái niệm cốt lõi & Vai trò**: Bản chất là gì? Giải quyết bài toán gì trên AWS?
   - **⚙️ Cơ chế hoạt động & Thành phần then chốt**: Các thành phần cốt lõi hoạt động cùng nhau ra sao? (Ví dụ: User Pool vs Identity Pool...)
   - **🏢 Ví dụ thực tế sinh động (Real-World Use Case)**: Kịch bản dự án thực tế cụ thể, dễ hiểu.
   - **💡 Khi nào nên chọn & Mẹo thiết kế (Key Takeaway)**: Điểm mấu chốt cần nhớ khi chọn dịch vụ này trong thực tế.`;
  } else {
    switch (mode) {
      case 'exam':
        modeGuidance = `
=== BẠN ĐANG Ở CHẾ ĐỘ: 'EXAM MINDSET' (TƯ DUY THI CHỨNG CHỈ SAA-C03) ===
MỤC TIÊU TỐI THƯỢNG: Giúp học viên tối ưu hóa điểm số, phản xạ nhanh và tuyệt đối không sập bẫy trong đề thi thật Pearson VUE.
CẤU TRÚC PHẢN HỒI BẮT BUỘC:
1. 🎯 TỪ KHÓA QUYẾT ĐỊNH ĐỀ THI (Exam Keywords):
   - Bóc tách chính xác các từ khóa ràng buộc (ví dụ: **most cost-effective**, **least operational overhead**, **high availability**, **millisecond latency**).
   - Chỉ rõ tiêu chí này trực tiếp dẫn tới dịch vụ nào và loại trừ dịch vụ nào.
2. ❌ BÓC MẼ BẪY CỦA TỪNG PHƯƠNG ÁN GÂY NHIỄU (Distractor Traps):
   - Mổ xẻ từng phương án sai: Tại sao phương án này vi phạm tiêu chí đề thi? (Anti-pattern, chi phí quá cao, cấu hình thủ công phức tạp, thiếu tính dự phòng).
3. 🏆 CÔNG THỨC CHỌN ĐÁP ÁN ĐÚNG: Vì sao đáp án đúng là giải pháp tối ưu theo chuẩn kiến trúc AWS.
4. > [!TIP] Mẹo phòng thi 15 giây (Exam Trick): Dấu hiệu nhận biết đáp án cực nhanh khi làm bài thi.
5. > [!WARNING] Cạm bẫy 70% thí sinh mắc phải: Lỗi sai kinh điển cần tránh.`;
      break;

    case 'beginner':
      modeGuidance = `
=== BẠN ĐANG Ở CHẾ ĐỘ: 'BEGINNER' (GIẢI THÍCH CHO NGƯỜI MỚI - DỄ HIỂU, VÍ VON THỰC TẾ) ===
MỤC TIÊU TỐI THƯỢNG: Giúp người mới bắt đầu học AWS hiểu sâu bản chất bằng hình ảnh đời thường, không bị ngợp thuật ngữ.
CẤU TRÚC PHẢN HỒI BẮT BUỘC:
1. 🌟 VÍ VON THỰC TẾ ĐỜI SỐNG (Real-life Analogy):
   - BẮT BUỘC mở đầu bằng 1 ví von đời sống cực kỳ sinh động và gần gũi (ví dụ: ví S3 như kho hàng chứa đồ vô tận, CloudFront như các tiệm tạp hóa đầu ngõ, SQS như quầy bốc số thứ tự xếp hàng, VPC như căn nhà có tường rào bảo vệ, Auto Scaling như cửa hàng tự động gọi thêm nhân viên khi đông khách...).
2. 🧩 CÂU CHUYỆN ĐỀ BÀI: Diễn đạt lại bài toán bằng lời kể bình dân, dễ hiểu.
3. 💡 GIẢI PHÁP ĐƠN GIẢN: Tại sao chọn giải pháp này lại thông minh và tiết kiệm công sức nhất.
4. 📐 SƠ ĐỒ HÌNH TƯỢNG ĐƠN GIẢN: Vẽ sơ đồ luồng dữ liệu Mermaid ngắn gọn với các biểu tượng emoji trực quan.
5. 🌱 CÂU CHỐT DỄ NHỚ: "Cứ nghe đến [từ khóa] là nghĩ ngay đến [dịch vụ]".`;
      break;

    case 'deep_dive':
      modeGuidance = `
=== BẠN ĐANG Ở CHẾ ĐỘ: 'DEEP DIVE' (PHÂN TÍCH CHUYÊN SÂU TẦNG THIẾT KẾ HỆ THỐNG) ===
MỤC TIÊU TỐI THƯỢNG: Phân tích kiến trúc ở cấp độ Solutions Architect Professional / Production-grade.
CẤU TRÚC PHẢN HỒI BẮT BUỘC:
1. 🏗️ CƠ CHẾ NỘI BỘ TẦNG SÂU (Under the Hood Mechanics):
   - Phân tích chi tiết cơ chế hoạt động, giao thức mạng, throughput, IOPS, connection pooling, storage tiering, latency p99.
2. 📊 BẢNG TRADE-OFF ANALYSIS ĐA CHIỀU:
   - Lập bảng Markdown Table so sánh đa chiều: Chi phí (TCO) vs Độ phức tạp vận hành vs Độ trễ vs Khả năng mở rộng vs RTO/RPO.
3. 📐 SƠ ĐỒ KIẾN TRÚC ENTERPRISE: Vẽ sơ đồ Mermaid toàn diện gồm Multi-AZ, VPC Endpoints, Auto Scaling, Security Groups, IAM Roles.
4. ⚠️ KỊCH BẢN LỖI & KHẢ NĂNG CHỊU LỖI (Failure Scenarios & Resilience): Hệ thống ứng phó thế nào khi có sự cố vùng hoặc nghẽn mạng.`;
      break;

    case 'flashcard':
      modeGuidance = `
=== BẠN ĐANG Ở CHẾ ĐỘ: 'FLASHCARD' (THẺ GHI NHỚ CÔ ĐỌNG) ===
MỤC TIÊU TỐI THƯỢNG: Đúc kết kiến thức thành 3 thẻ học nhanh súc tích, cực kỳ dễ ghi nhớ và ôn tập cấp tốc.
CẤU TRÚC PHẢN HỒI BẮT BUỘC (Trình bày đúng 3 khối thẻ sau):
---
### 🗂️ THẺ 1: TÌNH HUỐNG & DỊCH VỤ CỐT LÕI
- **Mặt trước (Dấu hiệu nhận biết):** Nhu cầu cốt lõi của bài toán là gì?
- **Mặt sau (Dịch vụ chuẩn xác):** Tên dịch vụ AWS + Tính năng then chốt giải quyết vấn đề.
---
### 🗂️ THẺ 2: NGUYÊN TẮC VÀNG KIẾN TRÚC AWS
- **Quy tắc:** Nguyên tắc thiết kế cần ghi nhớ.
- **Khi nào chọn:** Các trường hợp sử dụng chuẩn (Use cases).
- **Khi nào KHÔNG chọn:** Các trường hợp vi phạm hoặc lãng phí chi phí.
---
### 🗂️ THẺ 3: BẪY ĐỀ THI SAA-C03 & CÁCH NÉ
- **Bẫy thường gặp:** Phương án gây nhiễu nào hay đánh lừa người học?
- **Cách né bẫy:** Mẹo nhận diện phương án sai trong 3 giây.
---`;
      break;

    case 'quiz':
      modeGuidance = `
=== BẠN ĐANG Ở CHẾ ĐỘ: 'QUIZ ME' (THỬ THÁCH PHẢN XẠ) ===
MỤC TIÊU TỐI THƯỢNG: Thử thách học viên tự tư duy qua câu hỏi mới tương tự.
QUY TẮC QUAN TRỌNG: TUYỆT ĐỐI KHÔNG giải thích tuột hết bài cũ ngay!
CẤU TRÚC PHẢN HỒI BẮT BUỘC:
1. 🎯 NHẬN XÉT NHANH: Nêu ngắn gọn điểm mấu chốt của câu hỏi trên màn hình trong 1-2 câu.
2. ❓ CÂU HỎI THỬ THÁCH TƯƠNG TỰ (Interactive Quiz Scenario):
   - Đưa ra 1 câu hỏi tình huống thực tế SAA-C03 tương tự hoặc ở dạng biến thể mới liên quan đến dịch vụ này.
   - Cung cấp 4 phương án lựa chọn A, B, C, D rõ ràng, có bẫy tinh tế.
3. ⏳ LỜI MỜI HỌC VIÊN: "👉 Hãy chọn đáp án bạn cho là đúng (A, B, C hoặc D) và gửi vào ô chat, tôi sẽ chấm điểm và phân tích chi tiết cho bạn!".
*(KHÔNG tiết lộ trước đáp án của câu hỏi mới này để kích thích học viên tự tư duy!)*`;
      break;

    case 'mistake_review':
      modeGuidance = `
=== BẠN ĐANG Ở CHẾ ĐỘ: 'MISTAKE REVIEW' (GIẢI TỎA SAI LẦM & SO SÁNH ĐỐI KHÁNG) ===
MỤC TIÊU TỐI THƯỢNG: Loại bỏ triệt để các nhầm lẫn nguy hiểm giữa các dịch vụ AWS có tên gọi hoặc tính năng tương tự nhau.
CẤU TRÚC PHẢN HỒI BẮT BUỘC:
1. ⚠️ NGUYÊN NHÂN GÂY NHẦM: Chỉ rõ lý do vì sao 80% thí sinh thường phân vân giữa phương án đúng và phương án sai trong tình huống này.
2. ⚔️ BẢNG ĐỐI KHÁNG SO SÁNH TRỰC DIỆN (Head-to-Head Comparison Table):
   - Lập bảng Markdown Table so sánh giữa Dịch vụ Chuẩn vs Dịch vụ Gây Nhầm:
     * Tiêu chí so sánh (Mục đích, Cách thức, Chi phí, Độ trễ, Use case chuẩn).
3. 🚫 CÁC ANTI-PATTERNS CẦN TRÁNH: Các thiết kế sai lầm thường gặp.
4. 🎯 QUY TẮC PHÂN BIỆT 3 GIÂY: Câu thần chú nhớ nhanh để không bao giờ bị nhầm lần nữa.`;
      break;

    default: // 'explain'
      modeGuidance = `
=== BẠN ĐANG Ở CHẾ ĐỘ: 'EXPLAIN' (GIẢI THÍCH CHUYÊN GIA TOÀN DIỆN & TRỰC DIỆN) ===
MỤC TIÊU TỐI THƯỢNG: Cung cấp giải thích chuẩn xác, mổ xẻ tường tận vì sao các câu khác sai, chia sẻ mẹo phòng thi và sơ đồ kiến trúc trực quan.
QUY TẮC CỐT LÕI BẮT BUỘC:
- TUYỆT ĐỐI KHÔNG chào hỏi xã giao ("Chào bạn", "Dưới đây là..."), KHÔNG nhắc lại nguyên văn đề bài. Đi thẳng vào phân tích kỹ thuật.
- BẮT BUỘC TRẢ LỜI ĐẦY ĐỦ 4 PHẦN THEO ĐÚNG CẤU TRÚC SAU:

### 1. 🎯 Đáp Án Đúng & Cơ Chế Hoạt Động (AWS Architecture)
- Nêu rõ đáp án đúng và phân tích trực diện cơ chế kỹ thuật của dịch vụ AWS liên quan.
- Chỉ rõ vì sao đây là giải pháp tối ưu theo chuẩn AWS Well-Architected Framework (độ sẵn sàng, chi phí, độ phức tạp vận hành).

### 2. ❌ Vì Sao Từng Phương Án Còn Lại SAI? (Bóc Mẽ Bẫy Đề Thi)
- Mổ xẻ chi tiết TẤT CẢ các phương án sai còn lại (từng chữ cái A, B, C, D, E...):
  * Chỉ rõ lý do kỹ thuật sai (anti-pattern, chi phí đắt đỏ, cấu hình không tương thích, hoặc gây gián đoạn kết nối người dùng).
  * Vạch trần cạm bẫy tâm lý mà đề thi gài vào phương án đó.

### 3. 🔑 Mẹo Nhận Diện Đề & Trick Thi SAA-C03 (30-Second Exam Shortcut)
- > [!TIP] Trick phòng thi 30 giây: Cặp từ khóa vàng liên kết trực tiếp bài toán với dịch vụ chuẩn để chọn nhanh không do dự.
- > [!WARNING] Cạm bẫy dễ mất điểm: Sai lầm kinh điển mà thí sinh hay mắc phải khi đọc vội đề bài.

### 4. 📐 Sơ Đồ Kiến Trúc & Luồng Xử Lý (Mermaid & Giải Thích Chi Tiết)
- BẮT BUỘC đặt toàn bộ mã sơ đồ trong khối mã \`\`\`mermaid ... \`\`\` (TUYỆT ĐỐI KHÔNG dùng \`\`\`text, \`\`\`code hay đặt lệnh ra ngoài khối code).
- Ví dụ mẫu chuẩn:
\`\`\`mermaid
flowchart TD
  A["Node 1"] -->|"Hành động"| B["Node 2"]
\`\`\`
- CÚ PHÁP MERMAID BẮT BUỘC:
  * Dòng đầu tiên bên TRONG khối \`\`\`mermaid luôn là chữ thường: \`flowchart TD\` hoặc \`flowchart LR\` (tuyệt đối KHÔNG viết hoa Flowchart hay Graph).
  * Mọi nhãn node bọc trong dấu ngoặc kép: \`ID["Nội dung"]\`.
  * Mọi mũi tên phải có đích đến rõ ràng (tuyệt đối KHÔNG bỏ lửng mũi tên ở cuối dòng).
  * Giữ sơ đồ ngắn gọn (4 - 7 nodes) để đảm bảo không bị cắt cụt.
- 🔍 GIẢI THÍCH CHI TIẾT SƠ ĐỒ DỰA TRÊN CONTEXT ĐỀ BÀI (BẮT BUỘC PHẢI CÓ NGAY DƯỚI SƠ ĐỒ):
  * **Giải mã các thành phần trong sơ đồ:** Nêu rõ từng Node đại diện cho thành phần/dịch vụ nào trong ngữ cảnh bài toán (ví dụ: ALB nhận traffic, Target Group quản lý IP, Maintenance Window điều phối thời gian, Automation Document vá lỗi, EC2 instances).
  * **Phân tích luồng xử lý theo từng bước (Step-by-Step Flow):** Diễn giải chi tiết từng bước 1, 2, 3... kết nối giữa các node, chỉ rõ dữ liệu/lệnh di chuyển ra sao và cơ chế bảo vệ hệ thống (như connection draining không làm rớt kết nối khách hàng, tự động ngắt tải, health check hồi phục).
  * **Ý nghĩa đối với ràng buộc đề bài:** Khẳng định vì sao luồng hoạt động này giải quyết triệt để yêu cầu đề thi (ví dụ: vá lỗi an toàn không gián đoạn dịch vụ, tự động hóa giảm gánh nặng vận hành).`;
    }
  }

  // Question context assembly
  let questionBlock = '';
  if (currentQuestion) {
    if (isConceptOnly) {
      questionBlock = `
==================== NGỮ CẢNH HỌC TẬP (BACKGROUND CONTEXT ONLY) ====================
- Học viên đang học trong chủ đề: ${currentQuestion.domain} (${currentQuestion.topic})
- Dịch vụ liên quan trong đề bài: ${currentQuestion.serviceTags?.join(', ') || 'AWS'}
(LƯU Ý NGHIÊM NGẶT: Học viên đang hỏi một câu hỏi khái niệm / dịch vụ độc lập. TUYỆT ĐỐI KHÔNG giải bài thi hay tiết lộ đáp án của câu hỏi trên màn hình).
`;
    } else {
      const allExplanations = generateAllOptionExplanations(currentQuestion, selectedAnswer);
      const clues = currentQuestion?.text ? detectQuestionClues(currentQuestion.text) : [];

      const choicesFormatted = currentQuestion.choiceKeys
        .map(k => `  ${k}. ${currentQuestion.choices[k] || ''}`)
        .join('\n');

      const optionsAnalysis = currentQuestion.choiceKeys
        .map(k => {
          const exp = allExplanations[k];
          const isTarget = currentQuestion.answer.includes(k);
          const mark = isTarget ? '✅ [ĐÁP ÁN ĐÚNG]' : '❌ [ĐÁP ÁN SAI]';
          return `* Phương án ${k} ${mark}:
  - Phân tích: ${exp?.detailedReasonVi || exp?.shortReasonVi || 'Không phù hợp với yêu cầu.'}`;
        })
        .join('\n\n');

      const curated = getCuratedExplanation(currentQuestion.id);
      const curatedBlock = curated ? `
- Phân tích bẫy thi & Mẹo từ chuyên gia biên soạn:
  * Cảnh báo bẫy đề thi: ${curated.trapWarningVi}
  * Mẹo nhận diện cốt lõi: ${curated.keyTakeawayVi}
  * Nguyên tắc SAA-C03: ${curated.ruleEn}
` : '';

      const domainMeta = getDomainMeta(currentQuestion.domain);

      questionBlock = `
==================== THÔNG TIN CÂU HỎI HIỆN TẠI (CONTEXT) ====================
- Mã câu hỏi: #${currentQuestion.id}
- Miền kiến thức (SAA-C03 Content Domain): ${currentQuestion.domain} (${domainMeta.code} - Tỷ trọng ${domainMeta.weightLabel} đề thi)
- Trọng tâm kiến trúc Domain: ${domainMeta.descriptionVi}
- Topic: ${currentQuestion.topic}
- Nội dung đề bài:
${currentQuestion.text}

- Các phương án lựa chọn:
${choicesFormatted}

- Trạng thái người học:
  * Lựa chọn của học viên: ${selectedAnswer ? `Đáp án ${selectedAnswer}` : 'Chưa chọn'}
  * Đã nộp/kiểm tra chưa: ${isSubmitted ? 'Đã kiểm tra' : 'Đang suy nghĩ'}
  * Kết quả: ${isSubmitted ? (isCorrect ? '✅ ĐÚNG' : '❌ SAI') : 'Chưa xác định'}
  * Đáp án chính thức: ${currentQuestion.answer}

- Giải thích chính thức từ ngân hàng câu hỏi:
${currentQuestion.answerDescription}
${curatedBlock}
- Phân tích chi tiết từng phương án từ hệ thống chuyên gia:
${optionsAnalysis}

- Từ khóa then chốt trong đề (Clues):
${clues.map(c => `  * "${c.matchText}" (${c.clue.label}): ${c.clue.architecturalGuidance}`).join('\n')}
`;
    }
  }

  // Learner Notes context
  let notesBlock = '';
  if (userNotes && userNotes.trim()) {
    notesBlock = `
==================== GHI CHÚ HỌC TẬP CỦA HỌC VIÊN ====================
Học viên đã tự tay viết ghi chú cho câu hỏi này:
"${userNotes}"
(Hãy đánh giá, khen ngợi điểm đúng trong ghi chú và bổ sung nếu còn thiếu sót).
`;
  }

  // Learner study habits context
  let analyticsBlock = '';
  if (learnerAnalytics) {
    analyticsBlock = `
- Thống kê học tập của học viên:
  * Tỷ lệ chính xác chung: ${learnerAnalytics.accuracyPercent ?? 0}%
  * Các chủ đề còn yếu: ${learnerAnalytics.weakTopics?.join(', ') || 'Đang cập nhật'}
`;
  }

  // AWS Services context
  const servicesBlock = serviceSnippets.length > 0
    ? `
==================== TRI THỨC KIẾN TRÚC AWS LIÊN QUAN (RAG) ====================
${serviceSnippets.join('\n\n')}
`
    : '';

  // Related questions context
  const relatedBlock = relatedQuestions.length > 0
    ? `
==================== CÁC CÂU HỎI TƯƠNG TỰ TRONG HỆ THỐNG ====================
${relatedQuestions.map(q => `- Câu #${q.id}: ${q.text.slice(0, 120)}... (Đáp án: ${q.answer})`).join('\n')}
`
    : '';

  const generalRules = isConceptOnly
    ? `QUY TẮC BẮT BUỘC VỀ NỘI DUNG VÀ TRÌNH BÀY:
1. KHÔNG CHÀO HỎI LAN MAN: Bắt đầu câu trả lời ngay lập tức bằng giải thích kỹ thuật và ví dụ thực tế.
2. TRẢ LỜI BẰNG TIẾNG VIỆT KỸ THUẬT CHUẨN XÁC: Giữ nguyên tên chuẩn tiếng Anh của các dịch vụ, tham số, tài liệu AWS.
3. BẮT BUỘC CUNG CẤP VÍ DỤ THỰC TẾ: Minh họa cách áp dụng vào thực tế dự án một cách trực quan, dễ hiểu.
4. TUYỆT ĐỐI KHÔNG GIẢI ĐỀ BÀI TRÊN MÀN HÌNH: Không đưa ra đáp án đúng hay phân tích các lựa chọn của câu hỏi thi trừ khi học viên yêu cầu rõ ràng.
5. ĐỊNH DẠNG MARKDOWN PHONG PHÚ: Sử dụng in đậm, danh sách có thứ tự, và Callout Box GitHub (> [!TIP], > [!WARNING]).
6. BẮT BUỘC TẠO BẢNG SO SÁNH (MARKDOWN TABLE) KHI CÓ Ý ĐỊNH SO SÁNH:
   - Khi nhận được câu hỏi liên quan tới so sánh, phân biệt giữa các giao thức hoặc dịch vụ (ví dụ: "so sánh tcp và http", "alb vs nlb", "sqs vs sns", "s3 vs ebs"): BẮT BUỘC phải tạo một Bảng so sánh Markdown (Comparison Table) đa tiêu chí (Tầng hoạt động/OSI, Cơ chế, Tốc độ/Độ trễ, Khả năng định tuyến, Dịch vụ AWS tương ứng, Ưu nhược điểm, Tình huống áp dụng thực tế SAA-C03).
7. LUÔN LUÔN GẮN NGUỒN TÀI LIỆU AWS CHÍNH THỨC:
   - Ở cuối câu trả lời, BẮT BUỘC thêm mục:
     "### 🔗 Nguồn tài liệu AWS chính thức (Official Documentation):"
     Kèm ít nhất 1-3 liên kết chính xác từ https://docs.aws.amazon.com/... hoặc AWS Whitepapers liên quan để học viên tra cứu kiểm chứng.`
    : `QUY TẮC BẮT BUỘC VỀ NỘI DUNG VÀ TRÌNH BÀY:
1. KHÔNG CHÀO HỎI LAN MAN: Bắt đầu câu trả lời ngay lập tức bằng phân tích kỹ thuật. Tuyệt đối không mở đầu bằng "Chào bạn", "Dưới đây là...", hay nhắc lại toàn bộ câu hỏi.
2. TRẢ LỜI BẰNG TIẾNG VIỆT KỸ THUẬT CHUẨN XÁC: Giữ nguyên tên chuẩn tiếng Anh của các dịch vụ, tham số, tài liệu AWS (ví dụ: Systems Manager Automation Document, AWSEC2-PatchLoadBalancerInstance, Maintenance Windows, Target Group IP-type, Connection Draining, ALB, EventBridge).
3. ĐÁP ỨNG TRỌN VẸN YÊU CẦU NGƯỜI HỌC: Luôn trả lời đầy đủ, trực diện mọi khía cạnh người học hỏi (đáp án đúng, lý do các phương án khác sai, mẹo thi SAA-C03, và sơ đồ luồng dữ liệu).
4. VẼ SƠ ĐỒ KIẾN TRÚC MERMAID BẮT BUỘC:
   - Toàn bộ sơ đồ BẮT BUỘC phải nằm bên trong khối mã Markdown \`\`\`mermaid ... \`\`\`. Tuyệt đối KHÔNG dùng \`\`\`text, \`\`\`code hay đặt bất kỳ lệnh \`flowchart\` nào bên ngoài khối code.
   - Dòng đầu tiên bên trong khối \`\`\`mermaid luôn là chữ thường: \`flowchart TD\` hoặc \`flowchart LR\` (tuyệt đối KHÔNG viết hoa \`Flowchart\` hay \`Graph\`).
   - Mọi nhãn node phải đặt trong dấu ngoặc kép: \`ID["Nội dung nhãn"]\`.
   - Mọi mũi tên phải kết nối từ node nguồn sang node đích: \`A --> B\` hoặc \`A -->|"Nhãn"| B\`. Tuyệt đối KHÔNG kết thúc dòng bằng \`-->\` bỏ lửng.
   - Giữ sơ đồ tinh gọn trong khoảng 4 đến 7 nodes để hiển thị rõ ràng, thẩm mỹ và không bị nghẽn token.
   - Nếu dùng \`subgraph\`, bắt buộc có ID và nhãn ngoặc kép: \`subgraph sg_name ["Tên"]\`, và luôn có câu lệnh \`end\` tương ứng.
   - BẮT BUỘC GIẢI THÍCH CHI TIẾT SƠ ĐỒ DỰA TRÊN CONTEXT ĐỀ BÀI NGAY DƯỚI SƠ ĐỒ: Phải nêu rõ từng Node đại diện cho tài nguyên nào trong tình huống đề bài, phân tích luồng xử lý theo từng bước (Bước 1 -> Bước 2 -> Bước 3...) và giải thích cơ chế kỹ thuật giúp thỏa mãn các ràng buộc bài toán (như zero downtime, connection draining, chống tràn tải, bảo toàn thứ tự).
5. ĐỊNH DẠNG MARKDOWN PHONG PHÚ: Sử dụng in đậm, danh sách có thứ tự, và Callout Box GitHub (> [!TIP], > [!WARNING]) để làm nổi bật thông tin quan trọng.
6. BẮT BUỘC TẠO BẢNG SO SÁNH (MARKDOWN TABLE) KHI CÓ Ý ĐỊNH SO SÁNH:
   - Nếu câu hỏi yêu cầu so sánh hai hoặc nhiều phương án hay dịch vụ, BẮT BUỘC phải có Bảng so sánh Markdown đối chiếu các tiêu chí then chốt.
7. LUÔN LUÔN GẮN NGUỒN TÀI LIỆU AWS CHÍNH THỨC:
   - Ở cuối câu trả lời, BẮT BUỘC có mục "### 🔗 Nguồn tài liệu AWS chính thức (Official Documentation):" dẫn link chuẩn xác từ https://docs.aws.amazon.com/...`;

  // System Prompt
  const systemPrompt = `Bạn là AWS Certified Solutions Architect - Associate & Professional AI Tutor chuyên sâu cho kỳ thi AWS SAA-C03.

${modeGuidance}

${generalRules}
${imageAttached ? '\n- Học viên có đính kèm ảnh/sơ đồ kiến trúc. Hãy phân tích kỹ các thành phần trong ảnh và đối chiếu với kiến trúc AWS chuẩn.' : ''}
`.trim();

  // User Prompt Assembly
  const userPrompt = `
${questionBlock}
${notesBlock}
${servicesBlock}
${relatedBlock}
${analyticsBlock}

==================== YÊU CẦU / CÂU HỎI CỦA HỌC VIÊN ====================
${userQuery}
`.trim();

  return {
    systemPrompt,
    userPrompt,
    citations,
    detectedServices: currentQuestion?.serviceTags || [],
    relatedQuestionIds: relatedQuestions.map(q => q.id),
  };
}

/**
 * Intelligent Knowledge Engine fallback (produces rich, structured response when no API key is provided)
 */
export function generateKnowledgeEngineResponse(params: {
  currentQuestion?: Question;
  selectedAnswer?: string;
  isSubmitted?: boolean;
  isCorrect?: boolean;
  userNotes?: string;
  userQuery: string;
  mode?: AITutorMode;
  history?: Array<{ role: 'user' | 'assistant'; content: string }>;
  imageAttached?: boolean;
}): { answer: string; citations: AICitation[] } {
  const { selectedAnswer, userNotes: _userNotes, userQuery, mode = 'explain', history = [], imageAttached } = params;

  // Extract pure user query if full prompt context was passed
  let cleanUserQuery = (userQuery || '').trim();
  const splitMarker = '==================== YÊU CẦU / CÂU HỎI CỦA HỌC VIÊN ====================';
  if (cleanUserQuery.includes(splitMarker)) {
    cleanUserQuery = cleanUserQuery.split(splitMarker)[1]?.trim() || cleanUserQuery;
  }

  // Resolve the question the conversation is about (displayed, or pasted earlier in the thread)
  const convo = resolveConversationContext(cleanUserQuery, history, params.currentQuestion);
  const currentQuestion = convo.resolvedQuestion;
  const intent = classifyUserQueryIntent(cleanUserQuery);

  const { citations, serviceSnippets } = retrieveRelevantKnowledge(convo.retrievalQuery, currentQuestion);

  const isQuestionExplicitInQuery = /(?:câu này|bài này|đề này|đề bài|đề có|đề hỏi|đề yêu cầu|yêu cầu của đề|trong đề|câu hỏi này|đáp án câu|đáp án của|đáp án đó|tại sao chọn|tại sao phải chọn|vì sao chọn|sao lại chọn|phải chọn|tại sao sai|vì sao sai|sao sai|sao lại sai|tôi chọn|chọn [a-e]\b|phương án [a-e]\b|lựa chọn [a-e]\b|\b[a-e]\b.*?(?:đúng|sai)|giải thích câu|giải thích đề|bóc mẽ bẫy|chọn giao thức)/i.test(cleanUserQuery);
  const isQuestionSolving =
    !cleanUserQuery ||
    intent.isQuestionSolvingIntent ||
    isQuestionExplicitInQuery ||
    (convo.isFollowUp && /(?:tại sao|vì sao|sao lại|sao thế|đáp án|chọn|phương án|lựa chọn|nó|cái đó)/i.test(cleanUserQuery));

  const isConceptOnly = !isQuestionSolving && intent.isGeneralConceptIntent;

  const wrapWithImageNotice = (text: string): string => {
    if (!imageAttached) return text;
    const imageNotice = `> [!NOTE]\n> 📷 **Lưu ý về hình ảnh đính kèm (Vision AI):**\n> Chế độ *Knowledge Engine (Nội bộ)* hoạt động offline trên trình duyệt nên không có mô hình thị giác AI để đọc trực tiếp ảnh chụp. Hệ thống đã tự động liên kết với câu hỏi thi trên màn hình để giải đáp cho bạn.\n> 👉 *Để AI trực tiếp "nhìn", đọc ảnh đề thi và phân tích sơ đồ kiến trúc phức tạp, vui lòng mở **Cài đặt AI (⚙️)** và nhập **API Key** (Google Gemini, OpenAI hoặc Anthropic - có thể lấy Gemini API Key miễn phí tại Google AI Studio).* \n\n`;
    return imageNotice + text;
  };

  const executeEngine = (): { answer: string; citations: AICitation[] } => {
    // 0A. Direct Bot Capability Inquiry: Image reading explanation without dumping AWS lectures
    if (intent.isAskingImageCapability) {
      const imgAnswer = `### 👁️ Khả năng đọc hình ảnh (Vision AI) của Trợ lý AWS

Hệ thống hỗ trợ nhận diện và đọc hình ảnh đề thi theo 2 cơ chế:

1. **⚡ Khi kết nối Mô hình AI Trực tuyến (Multimodal Vision):**
   - **Đọc ảnh 100%:** Khi bạn cấu hình API Key cá nhân trong **Cài đặt AI (⚙️)** (hỗ trợ **Google Gemini 2.5 Flash / Pro**, **OpenAI GPT-4o / GPT-4o-mini**, hoặc **Anthropic Claude 3.5 Sonnet**), AI sẽ kích hoạt tính năng Computer Vision để **đọc trực tiếp toàn bộ chữ trong ảnh chụp đề thi**, nhận diện câu hỏi, các lựa chọn A/B/C/D và phân tích sơ đồ mạng VPC / ALB / Auto Scaling...
   - Bạn chỉ cần bấm nút 📎 (đính kèm ảnh) hoặc dán (Ctrl+V) ảnh chụp màn hình vào ô chat.

2. **🔒 Khi ở chế độ Nội bộ / Ngoại tuyến (Curated Knowledge Engine):**
   - Chế độ nội bộ chạy trực tiếp trên trình duyệt để phản hồi siêu tốc mà không phụ thuộc Internet hay tốn chi phí. Do hoạt động offline, hệ thống không nhúng mô hình thị giác nặng để quét trực tiếp pixel ảnh; thay vào đó, hệ thống sẽ tự động đồng bộ theo câu hỏi đang hiển thị trên màn hình của bạn.

> [!TIP]
> **Cách mở khóa Vision AI hoàn toàn miễn phí:** Bấm biểu tượng **⚙️ Cài đặt** ở góc trên thanh chat, chọn nhà cung cấp **Google Gemini** và dán API Key. Bạn có thể tạo Gemini API Key miễn phí không giới hạn tại [Google AI Studio](https://aistudio.google.com/).`;
      return { answer: imgAnswer, citations: [] };
    }

    // 0B. Conversational, Greetings & Assistant Introduction
    if (intent.isConversationalOrMeta) {
      const metaAnswer = `### 👋 Xin chào! Tôi là Trợ lý Luyện thi AWS Solutions Architect (SAA-C03)

Tôi là AI chuyên sâu về kiến trúc điện toán đám mây AWS, sẵn sàng đồng hành cùng bạn:
- 🎯 **Phân tích câu hỏi đề thi:** Bóc tách yêu cầu, giải thích bản chất kỹ thuật và vạch trần cạm bẫy của từng lựa chọn sai (Distractor Traps).
- ⚖️ **So sánh dịch vụ & đáp án:** So sánh chuyên sâu giữa các dịch vụ (*ALB vs NLB*, *SQS vs SNS*, *S3 vs EBS vs EFS*, *RDS Multi-AZ vs Read Replicas*) hoặc so sánh hai lựa chọn cụ thể (*"A và C khác gì nhau"*).
- 📐 **Vẽ sơ đồ kiến trúc (Mermaid):** Trực quan hóa luồng dữ liệu, phân vùng mạng VPC, High Availability và Disaster Recovery.
- 👁️ **Đọc ảnh đề thi (Vision AI):** Nhận diện ảnh chụp màn hình bài thi khi bạn cấu hình API Key trong mục **Cài đặt (⚙️)**.

*Hãy chọn một câu hỏi luyện tập trên màn hình hoặc hỏi bất kỳ dịch vụ AWS nào bạn muốn tìm hiểu nhé!*`;
      return { answer: metaAnswer, citations: [] };
    }

    // 0C. Screen Context Reading Command
    if (userQuery.includes('[ĐỌC MÀN HÌNH HIỆN TẠI') || cleanUserQuery.includes('[ĐỌC MÀN HÌNH HIỆN TẠI')) {
      let screenAdvice = '';
      if (userQuery.includes('Flashcards')) {
        screenAdvice = 'Bạn đang ôn tập các thẻ ghi nhớ Flashcards AWS. Hãy đọc kỹ khái niệm, liên hệ với tình huống thực tế và ghi nhớ các bẫy đề thi SAA-C03 liên quan!';
      } else if (userQuery.includes('Service Explorer') || userQuery.includes('Dịch vụ')) {
        screenAdvice = 'Bạn đang tra cứu cẩm nang dịch vụ AWS. Hãy chú ý đặc biệt đến các so sánh giữa các dịch vụ tương đồng (ví dụ SQS vs SNS, ALB vs NLB, S3 Standard vs Intelligent-Tiering).';
      } else if (userQuery.includes('Result') || userQuery.includes('kết quả') || userQuery.includes('Bảng kết quả')) {
        screenAdvice = 'Bạn đang xem kết quả bài thi. Hãy tập trung ôn lại các câu trả lời sai và các Domain dưới 72% để cải thiện điểm số bài thi chính thức.';
      } else if (userQuery.includes('Weakness') || userQuery.includes('Điểm mù')) {
        screenAdvice = 'Bạn đang xem bảng phân tích điểm mù và rủi ro kiến thức. Hãy làm bài kiểm tra nhắm mục tiêu (Targeted Drill) để loại bỏ các quan niệm sai lầm nguy hiểm.';
      } else if (userQuery.includes('Kế hoạch') || userQuery.includes('Plan')) {
        screenAdvice = 'Bạn đang xem lộ trình học tập 30 ngày. Hãy kiên trì duy trì nhịp học mỗi ngày 20-30 câu hỏi để tạo phản xạ thi tốt nhất!';
      } else {
        screenAdvice = 'Tôi đã nhận diện được ngữ cảnh màn hình của bạn! Bạn có thể chọn câu hỏi luyện tập để phân tích chuyên sâu hoặc gửi câu hỏi bất kỳ để tôi giải đáp.';
      }

      return {
        answer: `### 🖥 Đã nhận diện ngữ cảnh màn hình hiện tại!
${screenAdvice}

${serviceSnippets && serviceSnippets.length > 0 ? `#### 📚 Cẩm nang kiến trúc liên quan:\n${serviceSnippets.slice(0, 2).join('\n\n')}\n\n` : ''}
*(Mẹo: Bấm ⚙️ Cài đặt để nhập API Key riêng nếu muốn hỏi đáp tương tác tự do, phân tích sơ đồ và sinh code).*`,
        citations,
      };
    }

    // Direct Option Comparison Handler: If user asks to compare two choices (e.g., "a và c khác gì nhau", "so sánh a và b")
    if (currentQuestion) {
      const compareMatch =
        cleanUserQuery.match(/\b([A-E])\s*(?:và|với|vs|khác(?:\s+gì)?|hay|hoặc)\s*([A-E])\b/i) ||
        cleanUserQuery.match(/(?:so\s+sánh|khác\s+(?:nhau|gì))\s*(?:giữa)?\s*([A-E])\s*(?:và|với|vs)\s*([A-E])\b/i) ||
        cleanUserQuery.match(/(?:phương án|đáp án|lựa chọn)\s*([A-E])\b.*?(?:phương án|đáp án|lựa chọn)\s*([A-E])\b/i);

      if (compareMatch) {
        const opt1Key = compareMatch[1].toUpperCase();
        const opt2Key = compareMatch[2].toUpperCase();

        if (currentQuestion.choices[opt1Key] && currentQuestion.choices[opt2Key] && opt1Key !== opt2Key) {
          const allExplanations = generateAllOptionExplanations(currentQuestion, selectedAnswer);
          const exp1 = allExplanations[opt1Key];
          const exp2 = allExplanations[opt2Key];
          const isOpt1Correct = currentQuestion.answer.includes(opt1Key);
          const isOpt2Correct = currentQuestion.answer.includes(opt2Key);

          let compareResponse = `### ⚖️ So sánh chi tiết Lựa chọn ${opt1Key} và ${opt2Key} — Câu hỏi #${currentQuestion.id}\n\n`;

          compareResponse += `#### 1. 📋 Đối chiếu nội dung 2 phương án:\n`;
          compareResponse += `- **Phương án ${opt1Key}:** "${currentQuestion.choices[opt1Key]}"\n`;
          compareResponse += `- **Phương án ${opt2Key}:** "${currentQuestion.choices[opt2Key]}"\n\n`;

          compareResponse += `#### 2. 🔍 Phân tích kỹ thuật chuyên sâu:\n\n`;
          compareResponse += `##### 🔹 Phương án ${opt1Key} ${isOpt1Correct ? '✅ *(Đáp án đúng)*' : '❌ *(Đáp án sai / Gây nhiễu)*'}:\n`;
          compareResponse += `- **Đánh giá:** ${exp1?.violationType || (isOpt1Correct ? 'Đáp án chuẩn xác' : 'Không phù hợp')}\n`;
          compareResponse += `- **Bản chất kỹ thuật:** ${exp1?.detailedReasonVi || exp1?.shortReasonVi}\n\n`;

          compareResponse += `##### 🔹 Phương án ${opt2Key} ${isOpt2Correct ? '✅ *(Đáp án đúng)*' : '❌ *(Đáp án sai / Gây nhiễu)*'}:\n`;
          compareResponse += `- **Đánh giá:** ${exp2?.violationType || (isOpt2Correct ? 'Đáp án chuẩn xác' : 'Không phù hợp')}\n`;
          compareResponse += `- **Bản chất kỹ thuật:** ${exp2?.detailedReasonVi || exp2?.shortReasonVi}\n\n`;

          compareResponse += `#### 3. ⚔️ Điểm khác biệt cốt lõi (Key Architectural Difference):\n`;
          if (opt1Key === 'A' && opt2Key === 'C' && currentQuestion.id === 104) {
            compareResponse += `- **Về tính khả thi hạ tầng AWS:** Phương án A là **cấu hình không hợp lệ** vì Auto Scaling Group là tài nguyên cấp Vùng (Regional resource), không thể trải dài qua hai Region khác nhau. Ngược lại, Phương án C về mặt kỹ thuật có thể tạo template ở Region khác được.\n`;
            compareResponse += `- **Về mục đích kiến trúc:** Phương án C là mô hình **Disaster Recovery (DR)** dạng Warm Standby/Pilot Light khi toàn bộ Region chính gặp thảm họa, chứ **không phải** là giải pháp High Availability (HA) theo thời gian thực cho ứng dụng đang chạy. Nếu AZ hiện tại gặp sự cố, Phương án C vẫn gây downtime và đòi hỏi quy trình chuyển hướng DNS liên vùng phức tạp, vi phạm tiêu chí "without modifying the application".\n\n`;
          } else {
            compareResponse += `- **Phạm vi & Mô hình:** ${exp1?.shortReasonVi} so với ${exp2?.shortReasonVi}\n\n`;
          }

          compareResponse += `#### 4. 🏆 Kết luận & Phương án tối ưu cho đề thi SAA-C03:\n`;
          if (!isOpt1Correct && !isOpt2Correct) {
            compareResponse += `Cả hai phương án **${opt1Key}** và **${opt2Key}** đều **KHÔNG PHẢI** là đáp án đúng của đề bài!\n\n`;
            compareResponse += `👉 **Đáp án chuẩn xác của câu này là: Phương án ${currentQuestion.answer}** ("${currentQuestion.choices[currentQuestion.answer]}").\n`;
            compareResponse += `*Lý do:* ${currentQuestion.answerDescription || 'Phương án này phân bổ máy chủ đều qua nhiều Availability Zones trong cùng Region, giúp ALB tự động cân bằng tải và chịu lỗi tức thì mà không cần sửa đổi ứng dụng.'}\n\n`;
          } else {
            const winningOpt = isOpt1Correct ? opt1Key : opt2Key;
            compareResponse += `👉 **Phương án ${winningOpt}** là đáp án chính xác thỏa mãn đầy đủ các ràng buộc kiến trúc của đề bài.\n\n`;
          }

          const curated = getCuratedExplanation(currentQuestion.id);
          if (curated?.trapWarningVi) {
            compareResponse += `> [!WARNING] Cạm bẫy phòng thi SAA-C03:\n> ${curated.trapWarningVi}\n\n`;
          }

          compareResponse += `*(Gợi ý: Nhập API Key cá nhân trong Cài đặt ⚙️ để trao đổi tương tác chuyên sâu và mở khóa Vision AI đọc ảnh).*`;

          return { answer: compareResponse, citations };
        }
      }
    }

    // Handle standalone concept / service / comparison queries without spoiling exam question
    if (isConceptOnly) {
      const queryLower = (cleanUserQuery || '').toLowerCase();

      // 1. Check for matching comparison
      const isComparisonQuery = queryLower.includes('so sánh') || queryLower.includes('khác') || queryLower.includes('vs') || queryLower.includes('phân biệt');

      const matchedComp = SERVICE_COMPARISONS.find(c => {
        const idTokens = c.id.split('-vs-').map(t => t.replace(/-/g, ' ').toLowerCase());
        // Match if at least 2 tokens match the query (e.g. 'alb' and 'nlb' in 'alb-vs-nlb-vs-glb')
        const matchedTokens = idTokens.filter(token => queryLower.includes(token) || (token.includes(' ') && token.split(' ').every(w => queryLower.includes(w))));
        if (matchedTokens.length >= 2) return true;

        if (queryLower.includes(c.title.toLowerCase())) return true;

        // Match services by name
        const matchedServices = c.services.filter(s => {
          const cleanName = s.replace(/\s*\(.*?\)/g, '').replace(/amazon\s+|aws\s+/g, '').trim().toLowerCase();
          return cleanName.length >= 2 && (queryLower.includes(cleanName) || (cleanName.includes(' ') && cleanName.split(' ').every(w => queryLower.includes(w))));
        });
        if (matchedServices.length >= 2) return true;

        return isComparisonQuery && (matchedTokens.length >= 1 || matchedServices.length >= 1) && (queryLower.includes(c.id.replace(/-/g, ' ')) || queryLower.includes(c.category.toLowerCase()));
      });

      if (matchedComp && (isComparisonQuery || queryLower.includes(matchedComp.id) || queryLower.includes(matchedComp.id.replace(/-/g, ' ')) || matchedComp.id.split('-vs-').filter(t => queryLower.includes(t.replace(/-/g, ' '))).length >= 2)) {
        let compText = `### ⚖️ So sánh AWS: ${matchedComp.title}\n\n`;
        compText += `| Tiêu chí | ${matchedComp.services.join(' | ')} |\n`;
        compText += `| --- | ${matchedComp.services.map(() => '---').join(' | ')} |\n`;
        for (const dim of matchedComp.dimensions) {
          compText += `| **${dim.name}** | ${matchedComp.services.map(s => dim.description[s] || '—').join(' | ')} |\n`;
        }
        compText += `\n#### 🏢 Ví dụ thực tế & Luồng kiến trúc (Architecture Pipeline):\n`;
        if (matchedComp.id === 'alb-vs-nlb-vs-glb') {
          compText += `- **ALB (Application Load Balancer - Layer 7):** Hoạt động ở tầng ứng dụng (HTTP/HTTPS/gRPC). Phù hợp cho kiến trúc Web, Microservices, container nhờ khả năng định tuyến thông minh theo URL path (\`/api\` vs \`/images\`), host header, query parameter. Hỗ trợ xác thực người dùng, tích hợp AWS WAF và SSL offloading. Địa chỉ IP của ALB thay đổi liên tục (truy cập bắt buộc qua DNS name).\n`;
          compText += `- **NLB (Network Load Balancer - Layer 4):** Hoạt động ở tầng giao vận (TCP/UDP/TLS). Xử lý hàng triệu yêu cầu/giây với độ trễ cực thấp (sub-millisecond latency). Đặc biệt: **NLB hỗ trợ gán Static IP / Elastic IP cố định cho từng AZ**, rất thích hợp khi khách hàng yêu cầu whitelist IP tĩnh trên firewall, hoặc các ứng dụng Real-time Gaming, IoT, VoIP.\n`;
          compText += `- **GLB (Gateway Load Balancer - Layer 3):** Hoạt động ở tầng mạng IP, dùng để tích hợp và nhân rộng các thiết bị ảo bảo mật của bên thứ ba (Next-Gen Firewall, IDS/IPS) mà không làm gián đoạn luồng mạng.\n\n`;
        } else if (matchedComp.id === 'textract-vs-comprehend-medical-vs-rekognition') {
          compText += `\`\`\`mermaid
graph LR
    A[Bệnh nhân / Bác sĩ] -->|Upload hồ sơ PDF/Ảnh scan| B[(Amazon S3)]
    B -->|S3 Event Trigger| C[AWS Lambda]
    C -->|1. Trích xuất text & bảng từ PDF| D[Amazon Textract]
    D -->|Text thô & quan hệ bảng| C
    C -->|2. Phân tích ngữ nghĩa y khoa & PHI| E[Amazon Comprehend Medical]
    E -->|ICD-10, RxNorm, bảo mật PHI| C
    C -->|3. Lưu trữ kết quả đã chuẩn hóa| F[(Amazon DynamoDB / OpenSearch)]
    G[Ảnh nhận diện bệnh nhân] -->|Nhận diện khuôn mặt & CCCD| H[Amazon Rekognition]
\`\`\`\n\n`;
          compText += `- **Amazon Textract (OCR thông minh):** Chuyên bóc tách văn bản, form mẫu và bảng biểu từ tài liệu scan, hóa đơn hoặc hồ sơ PDF nhiều trang. Không hiểu ngữ nghĩa chuyên ngành.\n`;
          compText += `- **Amazon Comprehend Medical (NLP Y tế):** Chuyên phân tích ngữ nghĩa y khoa từ văn bản thô, trích xuất mã bệnh ICD-10, dược phẩm RxNorm và bảo vệ thông tin sức khỏe cá nhân (PHI) tuân thủ HIPAA. Không có khả năng đọc ảnh trực tiếp.\n`;
          compText += `- **Amazon Rekognition (Thị giác máy tính):** Chuyên phân tích ảnh và video trực quan (nhận diện khuôn mặt, đối tượng, cảnh quan, kiểm duyệt nội dung). Không dùng để bóc tách văn bản y khoa phức tạp.\n\n`;
        } else {
          compText += `- **Tình huống áp dụng:** Khi thiết kế hệ thống, cần xác định rõ yêu cầu về tính năng, độ trễ và chi phí để lựa chọn giữa ${matchedComp.services.join(' và ')}. Mỗi dịch vụ giải quyết một tầng kiến trúc chuyên biệt theo chuẩn AWS Well-Architected Framework.\n\n`;
        }

        if (matchedComp.commonTrap) {
          compText += `> [!WARNING] Cạm bẫy phòng thi & Lưu ý quan trọng:\n> ${matchedComp.commonTrap}\n\n`;
        }
        compText += `> [!TIP] Mẹo phòng thi SAA-C03:\n> ${matchedComp.examTip}\n\n`;
        if (matchedComp.docsUrls && matchedComp.docsUrls.length > 0) {
          compText += `#### 🔗 Nguồn tài liệu AWS chính thức (Official Documentation):\n`;
          for (const doc of matchedComp.docsUrls) {
            compText += `- 📖 [${doc.label}](${doc.url})\n`;
          }
          compText += `\n`;
        }

        const compCitations = [...citations];
        if (matchedComp.docsUrls) {
          for (const doc of matchedComp.docsUrls) {
            compCitations.push({
              id: `doc_${doc.label.toLowerCase().replace(/[^a-z0-9]/g, '_')}`,
              title: doc.label,
              snippet: `Tài liệu chính thức từ AWS: ${matchedComp.title}`,
              url: doc.url,
              type: 'official_doc',
            });
          }
        }
        return { answer: compText, citations: compCitations };
      }

      // 2. Check for matching service (DO NOT fall back to citations from current question)
      const matchedSvc = AWS_SERVICES.find(s =>
        queryLower.includes(s.name.toLowerCase()) ||
        queryLower.includes(s.id.toLowerCase()) ||
        (Boolean(s.abbreviation) && queryLower.split(/\s+/).some(w => w.toLowerCase() === s.abbreviation?.toLowerCase())) ||
        (s.id === 'alb-nlb' && (queryLower.includes('alb') || queryLower.includes('nlb') || queryLower.includes('load balancer') || queryLower.includes('cân bằng tải'))) ||
        (s.id === 'global-accelerator' && (queryLower.includes('global accelerator') || queryLower.includes('accelerator') || queryLower.includes('anycast'))) ||
        (s.id === 'tcp-networking' && (queryLower.includes('tcp') || queryLower.includes('udp') || queryLower.includes('giao thức tcp') || queryLower.includes('socket')))
      );

      if (matchedSvc) {
        let svcText = `### 📘 Khái niệm AWS: ${matchedSvc.name} (${matchedSvc.category})\n\n`;
        svcText += `#### 1. 📌 ${matchedSvc.name} là gì?\n`;
        svcText += `${matchedSvc.summary}\n\n`;

        svcText += `#### 2. ⚙️ Cơ chế hoạt động & Khái niệm then chốt:\n`;
        for (const concept of matchedSvc.coreConcepts) {
          svcText += `- ${concept}\n`;
        }
        svcText += `\n`;

        svcText += `#### 3. 🏢 Ví dụ thực tế trong doanh nghiệp (Real-World Use Case):\n`;
        for (let i = 0; i < matchedSvc.useCases.length; i++) {
          svcText += `- **Ví dụ ${i + 1}:** ${matchedSvc.useCases[i]}\n`;
        }
        svcText += `\n`;

        if (matchedSvc.commonTraps && matchedSvc.commonTraps.length > 0) {
          svcText += `> [!WARNING] Lưu ý quan trọng & Bẫy thường gặp:\n`;
          for (const trap of matchedSvc.commonTraps) {
            svcText += `> - ${trap}\n`;
          }
          svcText += `\n`;
        }

        svcText += `> [!TIP] Khi nào nên chọn trong kiến trúc AWS:\n> ${matchedSvc.examRelevance}\n\n`;

        if (matchedSvc.docsUrl) {
          svcText += `#### 🔗 Nguồn tài liệu AWS chính thức (Official Documentation):\n`;
          svcText += `- 📖 [Tài liệu kiến trúc chính thức ${matchedSvc.name}](${matchedSvc.docsUrl})\n\n`;
        }

        svcText += `*(Gợi ý: Bấm ⚙️ Cài đặt để hỏi sâu hơn hoặc yêu cầu phân tích kịch bản mở rộng).*`;

        return { answer: svcText, citations };
      }

      // 3. Comparison query fallback: Dynamically match mentioned services and build tailored matrix
      if (isComparisonQuery) {
        const mentionedServices = AWS_SERVICES.filter(s => {
          const nameClean = s.name.replace(/Amazon\s+|AWS\s+/gi, '').trim().toLowerCase();
          const idLower = s.id.toLowerCase();
          const abbr = s.abbreviation?.toLowerCase();
          return queryLower.includes(nameClean) ||
                 queryLower.includes(idLower) ||
                 (abbr && queryLower.split(/\s+/).some(w => w === abbr));
        });

        if (mentionedServices.length >= 2) {
          let dynCompText = `### ⚖️ So sánh đối chiếu kỹ thuật: ${mentionedServices.map(s => s.name).join(' vs ')}\n\n`;
          dynCompText += `Dưới đây là bảng đối chiếu các tiêu chí then chốt trong thiết kế giải pháp AWS:\n\n`;
          dynCompText += `| Tiêu chí | ${mentionedServices.map(s => s.name).join(' | ')} |\n`;
          dynCompText += `| :--- | ${mentionedServices.map(() => ':---').join(' | ')} |\n`;
          dynCompText += `| **Danh mục & Mục đích** | ${mentionedServices.map(s => `${s.category} - ${s.summary.slice(0, 80)}...`).join(' | ')} |\n`;
          dynCompText += `| **Khái niệm then chốt** | ${mentionedServices.map(s => s.coreConcepts.slice(0, 2).join('; ')).join(' | ')} |\n`;
          dynCompText += `| **Trọng tâm đề thi SAA-C03** | ${mentionedServices.map(s => s.examRelevance).join(' | ')} |\n\n`;

          dynCompText += `#### 🏢 Phân tích kịch bản ứng dụng & Trade-offs:\n`;
          for (const svc of mentionedServices) {
            dynCompText += `- **${svc.name}:** Phù hợp khi ${svc.examRelevance.toLowerCase()}. Ví dụ điển hình: ${svc.useCases[0] || svc.summary}\n`;
          }
          dynCompText += `\n`;

          dynCompText += `#### 🔗 Nguồn tài liệu AWS chính thức (Official Documentation):\n`;
          const dynCitations = [...citations];
          for (const svc of mentionedServices) {
            if (svc.docsUrl) {
              dynCompText += `- 📖 [Tài liệu chính thức ${svc.name}](${svc.docsUrl})\n`;
              dynCitations.push({
                id: `doc_${svc.id}`,
                title: svc.name,
                snippet: svc.summary,
                url: svc.docsUrl,
                type: 'official_doc',
              });
            }
          }
          dynCompText += `\n*(Gợi ý: Mở Cài đặt ⚙️ để AI trực tuyến giải đáp thêm các kịch bản tích hợp phức tạp).*`;
          return { answer: dynCompText, citations: dynCitations };
        }
      }

      // 4. Helpful architectural synthesis when no direct service matched (never return a cold refusal)
      let generalText = `### 💡 Tư vấn Kiến trúc AWS: "${cleanUserQuery}"\n\n`;
      generalText += `Để phân tích và thiết kế tối ưu cho yêu cầu này theo chuẩn **AWS Well-Architected Framework** và bài thi **Solutions Architect (SAA-C03)**, hãy xem xét các nguyên lý kiến trúc sau:\n\n`;
      generalText += `1. **Khả năng chịu lỗi & Sẵn sàng cao (Reliability & High Availability):**\n`;
      generalText += `   - Thiết kế Multi-AZ cho Database (RDS Multi-AZ, Aurora Read Replicas) và Compute (Auto Scaling Group qua tối thiểu 2 AZs).\n`;
      generalText += `   - Phân luồng cân bằng tải: Sử dụng ALB cho ứng dụng web (HTTP/HTTPS Layer 7) và NLB cho lưu lượng mạng cực lớn hoặc IP tĩnh (Layer 4).\n\n`;
      generalText += `2. **Hiệu năng & Tách rời thành phần (Performance & Decoupling):**\n`;
      generalText += `   - Tách rời các hệ thống bằng hàng đợi bất đồng bộ: Amazon SQS (đệm tải), Amazon SNS (Fanout thông báo), Amazon EventBridge (kiến trúc hướng sự kiện).\n`;
      generalText += `   - Caching dữ liệu: Amazon CloudFront (Edge Caching toàn cầu), ElastiCache (In-memory cache cho Database).\n\n`;
      generalText += `3. **Lưu trữ & Tối ưu chi phí (Storage & Cost Optimization):**\n`;
      generalText += `   - Sử dụng S3 Lifecycle Policies để tự động chuyển dữ liệu sang S3 Glacier Flexible Retrieval hoặc Deep Archive nhằm tiết kiệm tới 95% chi phí lưu trữ.\n\n`;
      generalText += `#### 🔍 Gợi ý tra cứu nhanh các dịch vụ trọng tâm đề thi SAA-C03:\n`;
      generalText += `- **Compute & Container:** EC2, Lambda, ECS, EKS, Fargate\n`;
      generalText += `- **Storage & Transfer:** S3, EBS, EFS, CloudFront, Storage Gateway, DataSync\n`;
      generalText += `- **Database:** RDS, Aurora, DynamoDB, ElastiCache, Redshift\n`;
      generalText += `- **Networking:** VPC, Route 53, ALB, NLB, Global Accelerator, Direct Connect\n`;
      generalText += `- **Messaging & AI/ML:** SQS, SNS, EventBridge, Step Functions, Textract, Comprehend, Rekognition\n\n`;
      generalText += `*(Gợi ý: Mở mục Cài đặt ⚙️ để nhập API Key và kích hoạt mô hình AI trực tuyến tư duy tự do).*`;

      return { answer: generalText, citations: [] };
    }

  if (!currentQuestion) {
    if (userQuery.includes('[ĐỌC MÀN HÌNH HIỆN TẠI')) {
      let screenAdvice = '';
      if (userQuery.includes('Flashcards')) {
        screenAdvice = 'Bạn đang ôn tập các thẻ ghi nhớ Flashcards AWS. Hãy đọc kỹ khái niệm, liên hệ với tình huống thực tế và ghi nhớ các bẫy đề thi SAA-C03 liên quan!';
      } else if (userQuery.includes('Service Explorer') || userQuery.includes('Dịch vụ')) {
        screenAdvice = 'Bạn đang tra cứu cẩm nang dịch vụ AWS. Hãy chú ý đặc biệt đến các so sánh giữa các dịch vụ tương đồng (ví dụ SQS vs SNS, ALB vs NLB, S3 Standard vs Intelligent-Tiering).';
      } else if (userQuery.includes('Result') || userQuery.includes('kết quả') || userQuery.includes('Bảng kết quả')) {
        screenAdvice = 'Bạn đang xem kết quả bài thi. Hãy tập trung ôn lại các câu trả lời sai và các Domain dưới 72% để cải thiện điểm số bài thi chính thức.';
      } else if (userQuery.includes('Weakness') || userQuery.includes('Điểm mù')) {
        screenAdvice = 'Bạn đang xem bảng phân tích điểm mù và rủi ro kiến thức. Hãy làm bài kiểm tra nhắm mục tiêu (Targeted Drill) để loại bỏ các quan niệm sai lầm nguy hiểm.';
      } else if (userQuery.includes('Kế hoạch') || userQuery.includes('Plan')) {
        screenAdvice = 'Bạn đang xem lộ trình học tập 30 ngày. Hãy kiên trì duy trì nhịp học mỗi ngày 20-30 câu hỏi để tạo phản xạ thi tốt nhất!';
      } else {
        screenAdvice = 'Tôi đã nhận diện được ngữ cảnh màn hình của bạn! Bạn có thể chọn câu hỏi luyện tập để phân tích chuyên sâu hoặc gửi câu hỏi bất kỳ để tôi giải đáp.';
      }

      return {
        answer: `### 🖥 Đã nhận diện ngữ cảnh màn hình hiện tại!
${screenAdvice}

${serviceSnippets && serviceSnippets.length > 0 ? `#### 📚 Cẩm nang kiến trúc liên quan:\n${serviceSnippets.slice(0, 2).join('\n\n')}\n\n` : ''}
*(Mẹo: Bấm ⚙️ Cài đặt để nhập API Key riêng nếu muốn hỏi đáp tương tác tự do, phân tích sơ đồ và sinh code).*`,
        citations,
      };
    }

    return {
      answer: `### 🤖 AWS Knowledge Engine
Chào bạn! Tôi là **AWS AI Tutor**. Bạn có thể chọn bất kỳ câu hỏi nào trong danh sách luyện tập để tôi hỗ trợ phân tích chuyên sâu.

**💡 Các chủ đề nổi bật bạn có thể hỏi:**
- Kiến trúc VPC: Public Subnet, Private Subnet, NAT Gateway vs Internet Gateway
- Lưu trữ S3: Standard, Intelligent-Tiering, Glacier Flexible Retrieval, S3 CRR
- Xử lý bất đồng bộ: SQS Standard vs FIFO, SNS Fanout, EventBridge
- Cơ sở dữ liệu: Aurora Global Database, Multi-AZ vs Read Replicas, DynamoDB DAX

*(Mẹo: Nhập API Key trong phần Cài đặt AI ⚙️ để mở khóa trò chuyện Generative LLM tự do, phân tích ảnh và sinh sơ đồ tương tác!)*`,
      citations,
    };
  }

  const allExplanations = generateAllOptionExplanations(currentQuestion, selectedAnswer);
  const correctChoice = currentQuestion.answer;
  const isCorrect = selectedAnswer === correctChoice;
  const clues = currentQuestion?.text ? detectQuestionClues(currentQuestion.text) : [];

  let responseText = '';

  // Mode: FLASHCARD
  if (mode === 'flashcard') {
    responseText += `### 🗂️ Thẻ ghi nhớ Flashcards SAA-C03 — Câu #${currentQuestion.id}\n\n`;
    responseText += `---
#### 🗂️ THẺ 1: TÌNH HUỐNG & DỊCH VỤ CỐT LÕI
- **Mặt trước (Nhu cầu & Dấu hiệu nhận biết):**
  * *Chủ đề:* ${currentQuestion.domain} (${currentQuestion.topic})
  * *Đề bài:* ${currentQuestion.text.slice(0, 200)}...
- **Mặt sau (Dịch vụ & Tính năng chuẩn xác):**
  * **Đáp án đúng: ${correctChoice}** — ${currentQuestion.choices[correctChoice]}
  * *Bản chất:* ${currentQuestion.answerDescription.slice(0, 180)}...
---
#### 🗂️ THẺ 2: NGUYÊN TẮC VÀNG KIẾN TRÚC AWS
- **Quy tắc thiết kế:** ${clues.length > 0 ? clues[0].clue.architecturalGuidance : 'Ưu tiên managed service có tính sẵn sàng cao, tối ưu chi phí và giảm thiểu gánh nặng vận hành.'}
- **Khi nào chọn:** Khi đề bài xuất hiện các từ khóa về hiệu năng, chi phí hoặc mở rộng quy mô.
- **Khi nào KHÔNG chọn:** Khi các phương án khác đòi hỏi tự quản lý máy chủ hoặc cấu hình thủ công phức tạp.
---
#### 🗂️ THẺ 3: BẪY ĐỀ THI SAA-C03 & CÁCH NÉ
- **Bẫy thường gặp:** Các phương án gây nhiễu có vẻ hợp lý nhưng chi phí đắt hơn hoặc độ phức tạp vận hành cao.
- **Cách né bẫy:** Luôn soi kỹ các cụm từ *least operational overhead* hoặc *most cost-effective*.
---\n\n`;
    responseText += `*(Gợi ý: Nhập API Key cá nhân trong Cài đặt ⚙️ để trò chuyện tương tác tự do).*`;
    return { answer: responseText, citations };
  }

  // Mode: QUIZ ME
  if (mode === 'quiz') {
    responseText += `### ❓ Thử thách phản xạ kiến thức — Câu hỏi tương tự Câu #${currentQuestion.id}\n\n`;
    responseText += `> 💡 **Nhận xét nhanh về Câu #${currentQuestion.id}:** Điểm mấu chốt ở câu này là việc chọn đáp án **${correctChoice}** (${currentQuestion.choices[correctChoice] || ''}) để giải quyết yêu cầu tối ưu của đề bài.\n\n`;
    responseText += `#### 🎯 Câu hỏi thử thách dành cho bạn:\n`;
    responseText += `Một công ty khởi nghiệp đang mở rộng quy mô ứng dụng trên AWS. Họ cần một giải pháp lưu trữ/xử lý tương tự tình huống trên nhưng đặt tiêu chí **giảm thiểu tối đa chi phí vận hành (least operational overhead)** và **tự động phục hồi khi có sự cố**.\n\n`;
    responseText += `**Bạn sẽ đề xuất kiến trúc nào sau đây?**\n\n`;
    responseText += `- **A.** ${currentQuestion.choices['A'] || 'Sử dụng dịch vụ tự quản lý trên EC2'}\n`;
    responseText += `- **B.** ${currentQuestion.choices['B'] || 'Sử dụng giải pháp Serverless có tính sẵn sàng cao'}\n`;
    if (currentQuestion.choices['C']) responseText += `- **C.** ${currentQuestion.choices['C']}\n`;
    if (currentQuestion.choices['D']) responseText += `- **D.** ${currentQuestion.choices['D']}\n\n`;
    responseText += `👉 **Hãy gõ đáp án bạn chọn (A, B, C hoặc D) vào ô chat bên dưới**, tôi sẽ chấm điểm và phân tích chi tiết cho bạn ngay!\n\n`;
    responseText += `*(Gợi ý: Nhập API Key cá nhân trong Cài đặt ⚙️ để mở khóa trò chuyện Generative tương tác).*`;
    return { answer: responseText, citations };
  }

  // Mode: MISTAKE REVIEW
  if (mode === 'mistake_review') {
    responseText += `### ⚔️ Giải tỏa sai lầm & So sánh đối kháng — Câu #${currentQuestion.id}\n\n`;
    responseText += `#### 1. ⚠️ Tại sao 80% thí sinh dễ nhầm lẫn ở câu này?\n`;
    responseText += `Người học thường bị đánh lừa bởi các phương án kỹ thuật khả thi nhưng **vi phạm tiêu chí tối ưu hóa** (chi phí cao hơn hoặc phải tự vận hành). Đáp án đúng là **${correctChoice}**.\n\n`;
    responseText += `#### 2. ⚔️ Bảng so sánh đối kháng trực diện:\n\n`;
    responseText += `| Tiêu chí | Phương án chuẩn (${correctChoice}) | Các phương án gây nhiễu |\n`;
    responseText += `| --- | --- | --- |\n`;
    responseText += `| **Dịch vụ / Giải pháp** | ${currentQuestion.choices[correctChoice]?.slice(0, 45)}... | Các lựa chọn thay thế khác |\n`;
    responseText += `| **Gánh nặng vận hành** | Tối thiểu (AWS Managed) | Cao hơn (Cần tự cấu hình / quản lý) |\n`;
    responseText += `| **Hiệu quả chi phí** | Tối ưu theo nhu cầu sử dụng | Thường tốn kém hơn hoặc dư thừa |\n`;
    responseText += `| **Độ trễ & Độ tin cậy** | Đạt chuẩn High Availability | Có rủi ro Single Point of Failure |\n\n`;
    responseText += `#### 3. 🚫 Anti-Patterns cần tránh:\n`;
    for (const key of currentQuestion.choiceKeys) {
      if (!correctChoice.includes(key)) {
        const exp = allExplanations[key];
        responseText += `- ❌ **Tránh chọn ${key}:** ${exp?.shortReasonVi || exp?.detailedReasonVi || 'Không tối ưu tiêu chí đề bài.'}\n`;
      }
    }
    responseText += `\n> 🎯 **Quy tắc phân biệt 3 giây:** Khi gặp bài toán có cùng mục tiêu này, hãy luôn kiểm tra xem giải pháp có phải là dịch vụ được quản lý hoàn toàn (Fully Managed) hay không.\n\n`;
    responseText += `*(Gợi ý: Nhập API Key cá nhân trong Cài đặt ⚙️ để trò chuyện tương tác tự do).*`;
    return { answer: responseText, citations };
  }

  // Mode: BEGINNER
  if (mode === 'beginner') {
    responseText += `### 💡 Giải thích cho Người mới bắt đầu — Câu #${currentQuestion.id}\n\n`;
    responseText += `#### 1. 🌟 Ví von thực tế đời sống:\n`;
    responseText += `Hãy tưởng tượng bạn đang điều hành một chuỗi cửa hàng. Thay vì tự mình xây một nhà kho khổng lồ và thuê đội ngũ bảo vệ trông coi 24/7 (vừa tốn tiền vừa mệt đầu), bạn thuê một dịch vụ kho bãi tự động chuyên nghiệp: bạn để bao nhiêu đồ thì trả bấy nhiêu tiền, kho tự động mở rộng khi bạn có nhiều hàng. Đó chính là triết lý của **${currentQuestion.choices[correctChoice] || 'dịch vụ AWS'}** trong bài toán này!\n\n`;
    responseText += `#### 2. 🧩 Tình huống đề bài nói gì?\n`;
    responseText += `Đề bài đưa ra một nhu cầu rất thực tế: hệ thống cần xử lý dữ liệu tin cậy nhưng không muốn tốn nhiều công sức bảo trì. Đáp án thông minh nhất là **${correctChoice}**.\n\n`;
    responseText += `#### 3. 📐 Sơ đồ hình ảnh luồng đi đơn giản:\n`;
    responseText += `\`\`\`mermaid
flowchart LR
  User["👤 Người dùng"] --> App["🖥️ Ứng dụng"]
  App --> Cloud["☁️ Dịch vụ AWS tối ưu (${correctChoice})"]
\`\`\`\n\n`;
    responseText += `> 💡 **Câu chốt dễ nhớ cho người mới:** Cứ thấy bài toán yêu cầu đơn giản, tự động và tin cậy cao, hãy ưu tiên chọn giải pháp Managed Service của AWS như phương án **${correctChoice}**.\n\n`;
    responseText += `*(Gợi ý: Nhập API Key cá nhân trong Cài đặt ⚙️ để trò chuyện tương tác tự do).*`;
    return { answer: responseText, citations };
  }

  // Mode: DEEP DIVE
  if (mode === 'deep_dive') {
    responseText += `### ⚡ Phân tích Kiến trúc Chuyên sâu (Deep Dive) — Câu #${currentQuestion.id}\n\n`;
    responseText += `#### 1. 🏗️ Cơ chế kiến trúc tầng sâu & Thiết kế hệ thống:\n`;
    responseText += `- **Đáp án tối ưu:** **${correctChoice}** (${currentQuestion.choices[correctChoice]})\n`;
    responseText += `- **Bản chất kỹ thuật:** ${currentQuestion.answerDescription}\n\n`;
    responseText += `#### 2. 📊 Bảng Trade-off Analysis chi tiết:\n\n`;
    responseText += `| Thuộc tính kiến trúc | Đánh giá thiết kế (${correctChoice}) | Trade-off / Lưu ý |\n`;
    responseText += `| --- | --- | --- |\n`;
    responseText += `| **Throughput & IOPS** | Khả năng mở rộng tuyến tính | Cần giám sát metric CloudWatch |\n`;
    responseText += `| **Độ trễ (P99 Latency)** | Sub-second hoặc millisecond | Tối ưu hóa connection pooling |\n`;
    responseText += `| **Chi phí vận hành (TCO)** | Pay-as-you-go, không chi phí ẩn | Thiết lập AWS Budgets cảnh báo |\n`;
    responseText += `| **Resilience & HA** | Multi-AZ, tự động failover | Cần kiểm thử kịch bản DR định kỳ |\n\n`;
    responseText += `#### 3. 📐 Sơ đồ kiến trúc sản xuất chuẩn AWS:\n`;
    const questionLower = currentQuestion.text.toLowerCase();
    if (questionLower.includes('transfer acceleration') || questionLower.includes('continents')) {
      responseText += `\`\`\`mermaid
flowchart LR
  subgraph Edge["⚡ AWS Global Network"]
    EdgeLoc["🌐 Edge Locations (S3 Transfer Acceleration)"]
  end
  subgraph Storage["🪣 Central Storage"]
    S3["📦 Amazon S3 Bucket"]
  end
  EdgeLoc ==>|AWS Backbone Network| S3
\`\`\`\n\n`;
    } else {
      responseText += `\`\`\`mermaid
flowchart TD
  Client["💻 Client Request"] --> ALB["⚖️ Application Load Balancer"]
  ALB --> App["🖥️ Auto Scaling EC2 / Fargate"]
  App --> DB[("🗄️ Multi-AZ Database")]
\`\`\`\n\n`;
    }
    responseText += `#### 4. ⚠️ Kịch bản lỗi & Khả năng chịu lỗi (Resilience):\n`;
    responseText += `Thiết kế này đảm bảo khi một Availability Zone (AZ) gặp sự cố, lưu lượng truy cập vẫn được duy trì liên tục nhờ cơ chế tự động định tuyến của AWS.\n\n`;
    responseText += `*(Gợi ý: Nhập API Key cá nhân trong Cài đặt ⚙️ để trò chuyện tương tác tự do).*`;
    return { answer: responseText, citations };
  }

  // Mode: EXAM MINDSET
  if (mode === 'exam') {
    responseText += `### 🎯 Tư duy phòng thi SAA-C03 (Exam Mindset) — Câu #${currentQuestion.id}\n\n`;
    responseText += `#### 1. 🔑 Từ khóa quyết định trong đề bài (Exam Keywords):\n`;
    if (clues.length > 0) {
      for (const c of clues) {
        responseText += `- **"${c.matchText}"** (${c.clue.label}) ➔ ${c.clue.architecturalGuidance}\n`;
      }
    } else {
      responseText += `- **Từ khóa then chốt:** Đề bài yêu cầu giải pháp có tính sẵn sàng cao và giảm thiểu chi phí quản lý vận hành.\n`;
    }
    responseText += `\n#### 2. ❌ Bóc mẽ bẫy của từng lựa chọn gây nhiễu (Distractor Traps):\n\n`;
    for (const key of currentQuestion.choiceKeys) {
      const exp = allExplanations[key];
      const isTarget = correctChoice.includes(key);
      responseText += `- **Phương án ${key}** ${isTarget ? '🏆 **[ĐÁP ÁN ĐÚNG]**' : '❌ **[BẪY ĐỀ THI]**'}:\n`;
      responseText += `  * *Nội dung:* ${currentQuestion.choices[key]}\n`;
      responseText += `  * *Bẫy / Lý do:* ${exp?.detailedReasonVi || exp?.shortReasonVi || 'Không đáp ứng tiêu chí tối ưu.'}\n\n`;
    }
    responseText += `> [!TIP]\n> **Mẹo thi 15 giây:** Đọc lướt nhanh câu hỏi cuối cùng để xác định tiêu chí then chốt (*cost*, *operational overhead*, *latency*). 90% câu hỏi SAA-C03 dùng tiêu chí này để loại trừ ngay 2 phương án sai đầu tiên.\n\n`;
    responseText += `> [!WARNING]\n> **Cạm bẫy dễ trượt:** Đừng chọn phương án tự cài đặt phần mềm trên EC2 nếu AWS đã có dịch vụ Managed tương ứng cho bài toán đó.\n\n`;
    responseText += `*(Gợi ý: Nhập API Key cá nhân trong Cài đặt ⚙️ để trò chuyện tương tác tự do).*`;
    return { answer: responseText, citations };
  }

  // Mode: EXPLAIN (Default)
  // Header & Status
  if (selectedAnswer) {
    if (isCorrect) {
      responseText += `### 🎯 Phân tích Câu hỏi #${currentQuestion.id}: Chính xác! Bạn đã chọn đúng đáp án **${correctChoice}**\n\n`;
    } else {
      responseText += `### ⚠️ Phân tích Câu hỏi #${currentQuestion.id}: Bạn đã chọn **${selectedAnswer}**, đáp án đúng là **${correctChoice}**\n\n`;
    }
  } else {
    responseText += `### 📘 Phân tích Câu hỏi #${currentQuestion.id} (${currentQuestion.domain})\n\n`;
  }

  // If user is asking why a specific option was chosen or what requirement in the prompt demanded it
  const isAskingWhyChosen = /(?:đề có cái gì|đề hỏi cái gì|đề yêu cầu|phải chọn|tại sao chọn|vì sao chọn|sao lại chọn|tại sao phải|vì sao phải|chọn giao thức|tại sao đáp án)/i.test(cleanUserQuery);
  if (isAskingWhyChosen) {
    const queryLower = cleanUserQuery.toLowerCase();
    const targetKey = currentQuestion.choiceKeys.find(k => {
      const choiceText = (currentQuestion.choices[k] || '').toLowerCase();
      if (new RegExp(`\\b(?:phương án|lựa chọn|đáp án|chọn)\\s+${k}\\b`, 'i').test(cleanUserQuery)) return true;
      if (choiceText.includes('iscsi-virtual tape library') || choiceText.includes('iscsi-vtl') || choiceText.includes('vtl')) {
        return queryLower.includes('vtl') || queryLower.includes('iscsi-vtl');
      }
      return false;
    }) || currentQuestion.answer;

    const targetChoiceText = currentQuestion.choices[targetKey] || '';
    const isTargetCorrect = currentQuestion.answer.includes(targetKey);

    responseText += `#### 🎯 Vì sao đề bài bắt buộc phải chọn ${isTargetCorrect ? `Đáp án đúng (${targetKey})` : `Phương án ${targetKey}`}: "${targetChoiceText}"?\n\n`;
    responseText += `Dựa vào đề bài, câu hỏi chứa các **từ khóa quyết định (Key Clues) và ràng buộc kiến trúc** sau đây:\n\n`;

    const qTextLower = (currentQuestion.text + ' ' + (currentQuestion.answerDescription || '')).toLowerCase();
    if (qTextLower.includes('tape') || qTextLower.includes('băng từ')) {
      responseText += `1. **"eliminating the use of physical backup tapes" (Loại bỏ việc sử dụng băng từ vật lý):**\n`;
      responseText += `   - Ràng buộc này bắt buộc giải pháp phải thay thế băng từ truyền thống. AWS Storage Gateway với giao diện **Virtual Tape Library (iSCSI-VTL)** cho phép giả lập các cuộn băng từ ảo (virtual tapes) lưu trên **Amazon S3** và tự động lưu trữ dài hạn vào **S3 Glacier / Glacier Deep Archive**, hoàn toàn loại bỏ chi phí và rủi ro quản lý băng từ vật lý.\n\n`;
      responseText += `2. **"preserve the existing investment in the on-premises backup applications and workflows" (Bảo toàn phần mềm & quy trình sao lưu hiện tại):**\n`;
      responseText += `   - Đây là chìa khóa then chốt: Các phần mềm sao lưu doanh nghiệp cũ (như Veritas NetBackup, Commvault, Veeam...) được thiết kế chuyên biệt để ghi dữ liệu vào thư viện băng từ qua giao thức **iSCSI**. Giao diện VTL đóng vai trò là một Tape Library ảo tiêu chuẩn, giúp doanh nghiệp **không phải sửa đổi bất kỳ dòng mã hay quy trình sao lưu nào**.\n\n`;
      responseText += `3. **"reduce backup costs" (Cắt giảm chi phí sao lưu):**\n`;
      responseText += `   - Băng từ ảo đẩy trực tiếp lên đám mây với chi phí lưu trữ S3 Glacier cực thấp ($0.00099/GB/tháng), loại bỏ chi phí kho bãi, nhân công bốc dỡ và bảo trì phần cứng robot chuyển băng.\n\n`;
      responseText += `❌ **Vì sao các phương án khác sai:**\n`;
      responseText += `- **NFS (Phương án A & B):** NFS là giao thức chia sẻ file qua mạng (File Share), không giả lập được thư viện băng từ (Tape Library) nên không tương thích với phần mềm backup chuyên dụng dạng tape.\n`;
      responseText += `- **Amazon EFS (Phương án B & C):** Amazon EFS là hệ thống tệp tin mạng (NFSv4), **không hỗ trợ giao thức iSCSI** và không có cơ chế VTL để thay thế băng từ.\n\n`;
      responseText += `---\n\n`;
    } else {
      responseText += `1. **Ràng buộc cốt lõi:** Phương án **${targetKey}** thỏa mãn trực tiếp yêu cầu của đề bài về tính sẵn sàng cao, tối ưu chi phí và giảm thiểu gánh nặng vận hành theo chuẩn AWS Well-Architected.\n\n`;
      responseText += `---\n\n`;
    }
  }

  // Core Answer Breakdown
  responseText += `#### 1. Đáp án đúng: **${correctChoice}**\n`;
  responseText += `${currentQuestion.answerDescription}\n\n`;

  // Curated traps & takeaways if available
  const curated = getCuratedExplanation(currentQuestion.id);
  if (curated?.trapWarningVi) {
    responseText += `> [!WARNING] Cạm bẫy đề thi SAA-C03:\n> ${curated.trapWarningVi}\n\n`;
  }
  if (curated?.keyTakeawayVi) {
    responseText += `> [!TIP] Mẹo phòng thi 30 giây:\n> ${curated.keyTakeawayVi}\n\n`;
  }

  // Options breakdown
  responseText += `#### 2. Phân tích chi tiết từng lựa chọn A, B, C, D:\n\n`;
  for (const key of currentQuestion.choiceKeys) {
    const exp = allExplanations[key];
    const isTarget = correctChoice.includes(key);
    const isUserChoice = Boolean(selectedAnswer && selectedAnswer.includes(key));

    responseText += `- **Phương án ${key}** ${isTarget ? '✅ *(Đáp án đúng)*' : '❌ *(Đáp án sai)*'} ${isUserChoice ? '👉 *(Lựa chọn của bạn)*' : ''}\n`;
    responseText += `  * *Nội dung:* ${currentQuestion.choices[key]}\n`;
    responseText += `  * *Lý do:* ${exp?.detailedReasonVi || exp?.shortReasonVi || 'Không đáp ứng tối ưu yêu cầu của đề bài.'}\n\n`;
  }

  // Question Clues & Exam Mindset
  if (clues.length > 0) {
    responseText += `#### 3. 🔑 Từ khóa nhận diện trong đề thi (Clues):\n`;
    for (const c of clues) {
      responseText += `- **"${c.matchText}"** (${c.clue.label}) → ${c.clue.explanationVi}\n`;
    }
    responseText += `\n`;
  }

  // Architecture Mermaid Diagram & Detailed Context Explanation
  responseText += `#### 4. 📐 Sơ Đồ Kiến Trúc & Luồng Xử Lý (Mermaid & Giải Thích Chi Tiết):\n`;
  const questionLower = currentQuestion.text.toLowerCase();
  if (questionLower.includes('systems manager') || questionLower.includes('patch') || questionLower.includes('awsec2-patch')) {
    responseText += `\`\`\`mermaid
flowchart LR
  MW["⏰ Maintenance Window"] --> Doc["🤖 AWSEC2-PatchLoadBalancerInstance"]
  Doc -->|"1. Deregister & Drain"| ALB["⚖️ Target Group / ALB"]
  Doc -->|"2. Apply Patches"| EC2["🖥️ EC2 Instances"]
  Doc -->|"3. Health Check & Register"| ALB
\`\`\`\n\n`;
    responseText += `##### 🔍 Phân tích chi tiết sơ đồ luồng kiến trúc theo bối cảnh đề bài:
- **Ý nghĩa các thành phần:**
  * **⏰ Maintenance Window (Khung giờ bảo trì):** Lập lịch cố định ngoài giờ cao điểm để kích hoạt quy trình vá lỗi tự động, kiểm soát tốc độ thực thi (concurrency) và ngưỡng lỗi (error threshold).
  * **🤖 AWSEC2-PatchLoadBalancerInstance (Tài liệu tự động hóa):** Trái tim của giải pháp, chứa kịch bản chuẩn AWS để điều phối việc ngắt và nối máy chủ an toàn.
  * **⚖️ Target Group / ALB:** Nơi tiếp nhận lưu lượng truy cập của khách hàng và phân phối tới các EC2 instances đăng ký theo địa chỉ IP.
  * **🖥️ EC2 Instances:** Các máy chủ ứng dụng cần được cập nhật bản vá hệ điều hành.
- **Phân tích luồng xử lý 4 bước:**
  * **Bước 1 (Deregister & Drain):** Automation Document tự động gọi API deregister máy chủ EC2 đầu tiên ra khỏi Target Group của ALB và kích hoạt thời gian chờ *Connection Draining* để khách hàng đang kết nối không bị gián đoạn hoặc gặp lỗi HTTP 502/504.
  * **Bước 2 (Apply Patches):** Khi lưu lượng truy cập đã ngắt hoàn toàn khỏi máy chủ đó, Patch Manager tiến hành tải và cài đặt bản vá lỗi, khởi động lại instance nếu bản vá yêu cầu.
  * **Bước 3 (Health Check & Re-register):** Sau khi hoàn tất vá lỗi, máy chủ được đăng ký lại vào Target Group và ALB bắt đầu thăm dò tình trạng sức khỏe (Health Check) cho tới khi đạt trạng thái *Healthy*.
  * **Bước 4 (Chuyển tiếp máy chủ tiếp theo):** Quy trình tự động chuyển sang máy chủ tiếp theo, đảm bảo ứng dụng luôn có máy chủ hoạt động và không có downtime đối với người dùng.\n\n`;
  } else if (questionLower.includes('sqs') || questionLower.includes('fifo')) {
    responseText += `\`\`\`mermaid
flowchart LR
  Client["💻 Client Request"] --> APIGW["🌐 Amazon API Gateway"]
  APIGW --> SQS["📬 SQS FIFO Queue"]
  SQS --> Lambda["⚡ AWS Lambda"]
\`\`\`\n\n`;
    responseText += `##### 🔍 Phân tích chi tiết sơ đồ luồng kiến trúc theo bối cảnh đề bài:
- **Ý nghĩa các thành phần:**
  * **🌐 Amazon API Gateway:** Điểm tiếp nhận request từ người dùng hoặc hệ thống bên ngoài, mở rộng quy mô tự động.
  * **📬 SQS FIFO Queue:** Hàng đợi đệm bất đồng bộ với cơ chế First-In-First-Out tuyệt đối và Message Deduplication ngăn xử lý trùng lặp.
  * **⚡ AWS Lambda:** Hàm serverless xử lý logic nghiệp vụ theo từng mẻ (batch) tuần tự theo đúng thứ tự gửi đến.
- **Luồng xử lý:** Client gửi đơn hàng $\\rightarrow$ API Gateway đẩy trực tiếp vào SQS FIFO $\\rightarrow$ SQS FIFO bảo toàn nghiêm ngặt thứ tự tiếp nhận $\\rightarrow$ Lambda đọc và hoàn tất đơn hàng mà không sợ nghẽn cổ chai hay mất dữ liệu.\n\n`;
  } else if (questionLower.includes('transfer acceleration') || questionLower.includes('continents')) {
    responseText += `\`\`\`mermaid
flowchart LR
  subgraph Edge["⚡ AWS Edge Network"]
    EdgeLoc["🌐 S3 Transfer Acceleration Endpoint"]
  end
  subgraph Storage["🪣 Target Storage"]
    S3["📦 Single Amazon S3 Bucket"]
  end
  EdgeLoc ==>|AWS Global Backbone| S3
\`\`\`\n\n`;
    responseText += `##### 🔍 Phân tích chi tiết sơ đồ luồng kiến trúc theo bối cảnh đề bài:
- **Ý nghĩa các thành phần:**
  * **🌐 S3 Transfer Acceleration Endpoint:** Các điểm biên (Edge Locations) phân bố toàn cầu gần với người dùng nhất.
  * **📦 Amazon S3 Bucket:** Thùng chứa đích tập trung tại Region lưu trữ chính.
- **Luồng xử lý:** Dữ liệu từ các châu lục được upload tới Edge Location gần nhất qua Internet công cộng khoảng cách ngắn, sau đó đi qua mạng cáp quang riêng tốc độ cao của AWS Global Backbone Network tới thẳng S3 bucket, tối đa hóa tốc độ tải lên và giảm thiểu gánh nặng vận hành.\n\n`;
  } else {
    responseText += `\`\`\`mermaid
flowchart LR
  User["👤 End Users"] --> ALB["⚖️ Application Load Balancer"]
  ALB --> App["🖥️ EC2 / Fargate"]
  App --> DB[("🗄️ Database")]
\`\`\`\n\n`;
    responseText += `##### 🔍 Phân tích chi tiết sơ đồ luồng kiến trúc theo bối cảnh đề bài:
- **Ý nghĩa các thành phần:**
  * **⚖️ ALB:** Cân bằng tải lớp 7 định tuyến thông minh theo URL/Header tới các máy chủ khỏe mạnh.
  * **🖥️ EC2 / Fargate:** Tầng xử lý tính toán có khả năng co giãn tự động theo tải (Auto Scaling).\n\n`;
  }

    responseText += `\n#### 🔗 Nguồn tài liệu AWS chính thức (Official Documentation):\n`;
    if (citations && citations.length > 0) {
      for (const cit of citations.slice(0, 3)) {
        if (cit.url) {
          responseText += `- 📖 [${cit.title}](${cit.url})\n`;
        }
      }
    }
    const qLowerCombined = (currentQuestion.text + ' ' + Object.values(currentQuestion.choices).join(' ')).toLowerCase();
    if (qLowerCombined.includes('storage gateway') || qLowerCombined.includes('vtl')) {
      responseText += `- 📖 [AWS Storage Gateway - What is a Virtual Tape Library (VTL)?](https://docs.aws.amazon.com/storagegateway/latest/userguide/StorageGatewayConcepts.html#what-is-vtl)\n`;
    }
    responseText += `\n*(Gợi ý: Bấm ⚙️ Cài đặt để quản lý API Key hoặc chuyển đổi các chế độ phân tích).*`;

    return {
      answer: responseText,
      citations,
    };
  };

  const rawResult = executeEngine();
  return {
    answer: wrapWithImageNotice(rawResult.answer),
    citations: rawResult.citations,
  };
}
