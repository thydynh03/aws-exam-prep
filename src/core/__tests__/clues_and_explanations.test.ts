import { describe, it, expect } from 'vitest';
import { detectQuestionClues, EXAM_CLUES } from '../questionClues';
import { generateEnhancedExplanation } from '../explanationEnhancer';
import { segmentTextByMatches } from '../textHighlighter';
import type { Question } from '../types';

describe('questionClues detection', () => {
  it('detects "least operational overhead" clue', () => {
    const text = 'A company wants a serverless solution that has the least operational overhead.';
    const clues = detectQuestionClues(text);
    expect(clues.length).toBeGreaterThanOrEqual(1);
    expect(clues.some(c => c.clue.id === 'overhead')).toBe(true);
    expect(clues[0].clue.label).toBe('Managed / Serverless');
  });

  it('detects multiple clues correctly', () => {
    const text = 'A solutions architect needs a most cost-effective shared file system with sub-millisecond latency.';
    const clues = detectQuestionClues(text);
    expect(clues.length).toBeGreaterThanOrEqual(2);
    const ids = clues.map(c => c.clue.id);
    expect(ids).toContain('cost');
    expect(ids).toContain('shared-fs');
  });

  it('returns empty array when no clues match', () => {
    const text = 'This is a simple text with no special keywords.';
    const clues = detectQuestionClues(text);
    expect(clues).toEqual([]);
  });

  it('detects clues in Question 1 (operational complexity, quickly as possible, across continents)', () => {
    const text =
      'A company collects data for temperature, humidity, and atmospheric pressure in cities across multiple continents. ' +
      'The average site upload is 500 KB to 2 MB in size. The company wants to aggregate the data from all these global sites as quickly as possible ' +
      'in a single Amazon S3 bucket. The solution must minimize operational complexity. Which solution meets these requirements?';

    const clues = detectQuestionClues(text);
    expect(clues.length).toBeGreaterThanOrEqual(2);
    const ids = clues.map((c) => c.clue.id);
    expect(ids).toContain('overhead');
    expect(ids).toContain('latency');
    expect(ids).toContain('global-distribution');
  });
});

describe('explanationEnhancer', () => {
  const dummyQuestion: Question = {
    id: 101,
    originalId: 'q-101',
    text: 'A company needs to decouple their frontend from backend with least operational overhead.',
    choices: { A: 'Use SQS', B: 'Self-hosted Kafka on EC2' },
    choiceKeys: ['A', 'B'],
    answer: 'A',
    answerDescription: 'SQS provides fully managed queuing.',
    communityVotes: [],
    topic: '1',
    serviceTags: ['SQS'],
    domain: 'Domain 2: Design Resilient Architectures',
    difficulty: 'Medium',
    isMultiSelect: false,
    expectedChoicesCount: 1,
  };

  it('generates enhanced explanation with Vietnamese breakdown and Core Rule', () => {
    const enhanced = generateEnhancedExplanation(dummyQuestion);
    expect(enhanced.ruleEn).toBeDefined();
    expect(enhanced.objectiveVi).toContain('least operational overhead');
    expect(enhanced.solutionVi).toContain('A');
    expect(enhanced.trapWarningVi).toBeDefined();
    expect(enhanced.keyTakeawayVi).toBeDefined();
  });

  it('generates scenario-tailored explanation for Question 3 without keyword concatenation leakage', () => {
    const q3: Question = {
      id: 3,
      originalId: '3',
      text: "A company's containerized application runs on an Amazon EC2 instance. The application needs to download security certificates before it can communicate with other business applications. The company wants a highly secure solution to encrypt and decrypt the certificates in near real time. The solution also needs to store data in highly available storage after the data is encrypted. Which solution will meet these requirements with the LEAST operational overhead?",
      choices: {
        A: 'Manually update certificates as needed on the container image. Store the certificates in Amazon Elastic Block Store (Amazon EBS) volumes.',
        B: 'Create an AWS Lambda function that uses the Python cryptography library to encrypt and decrypt the certificates. Store the certificates in Amazon Elastic Block Store (Amazon EBS) volumes.',
        C: 'Create an AWS KMS customer managed key. Use the KMS key to encrypt and decrypt the certificates with the EC2 instance role. Store the encrypted certificates in Amazon S3.',
        D: 'Create an AWS Lambda function that uses the Python cryptography library to encrypt and decrypt the certificates. Store the certificates in an Amazon S3 bucket.',
      },
      choiceKeys: ['A', 'B', 'C', 'D'],
      answer: 'C',
      answerDescription: '',
      communityVotes: [],
      topic: '1',
      serviceTags: ['AWS KMS', 'Amazon S3', 'Amazon EC2'],
      domain: 'Domain 1: Design Secure Architectures',
      difficulty: 'Medium',
      isMultiSelect: false,
      expectedChoicesCount: 1,
    };

    const enhanced = generateEnhancedExplanation(q3, 'D');

    // Scenario-tailored content
    expect(enhanced.objectiveVi).toContain('chứng chỉ');
    expect(enhanced.solutionVi).toContain('AWS KMS');
    expect(enhanced.solutionVi).toContain('Amazon S3');
    expect(enhanced.trapWarningVi).toContain('EBS');

    // Must NOT contain Frankenstein concatenated clues
    expect(enhanced.solutionVi).not.toContain('Amazon Kinesis');
    expect(enhanced.solutionVi).not.toContain('ALB + ASG');

    // Distractor breakdown
    expect(enhanced.allOptionExplanations['A'].detailedReasonVi).toContain('Manually update');
    expect(enhanced.allOptionExplanations['B'].detailedReasonVi).toContain('Python cryptography');
    expect(enhanced.allOptionExplanations['C'].isCorrect).toBe(true);
  });
});

describe('textHighlighter zero-duplication validation', () => {
  it('never duplicates highlighted words and guarantees 100% text integrity', () => {
    const text =
      "A company's containerized application runs on an Amazon EC2 instance. " +
      'The application needs to download security certificates before it can communicate with other business applications. ' +
      'The company wants a highly secure solution to encrypt and decrypt the certificates in near real time . ' +
      'The solution also needs to store data in highly available storage after the data is encrypted. ' +
      'Which solution will meet these requirements with the LEAST operational overhead ?';

    const rules = EXAM_CLUES.map((c) => ({
      pattern: c.pattern,
      data: c,
    }));

    const segments = segmentTextByMatches(text, rules);

    // 1. Reconstructed text must exactly match original string without any loss or addition
    const reconstructed = segments.map((s) => s.text).join('');
    expect(reconstructed).toBe(text);

    // 2. Count occurrences of highlighted words in the segments
    const highlightedTexts = segments
      .filter((s) => s.type === 'highlight')
      .map((s) => s.text);

    expect(highlightedTexts).toContain('real time');
    expect(highlightedTexts).toContain('highly available');
    expect(highlightedTexts).toContain('LEAST operational overhead');

    // Each must appear exactly once in the highlighted segments
    expect(highlightedTexts.filter((t) => t === 'real time').length).toBe(1);
    expect(highlightedTexts.filter((t) => t === 'highly available').length).toBe(1);
    expect(highlightedTexts.filter((t) => t === 'LEAST operational overhead').length).toBe(1);

    // 3. No adjacent duplicate segments
    for (let i = 0; i < segments.length - 1; i++) {
      if (segments[i].type === 'highlight' && segments[i + 1].type === 'highlight') {
        expect(segments[i].text).not.toBe(segments[i + 1].text);
      }
    }
  });
});
