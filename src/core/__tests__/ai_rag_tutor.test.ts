import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  getAITutorConfig,
  saveAITutorConfig,
  clearAITutorConfig,
  stripApiKeyFromExport,
  DEFAULT_AI_CONFIG,
  PROVIDER_DEFAULT_MODELS,
  MODEL_DESCRIPTIONS,
} from '../aiConfigStorage';
import {
  getAIConversation,
  saveAIConversation,
  clearAIConversation,
  type AIChatMessage,
} from '../aiConversationStorage';
import {
  retrieveRelevantKnowledge,
  buildAIPromptContext,
  generateKnowledgeEngineResponse,
  classifyUserQueryIntent,
} from '../aiRagEngine';
import { sendAITutorMessage } from '../aiClient';
import { autoHealMarkdown } from '../markdownHealer';
import type { Question } from '../types';

describe('Feature 31: AI RAG Tutor / AWS Certification Assistant', () => {
  beforeEach(() => {
    clearAITutorConfig('user_alice');
    clearAITutorConfig('user_bob');
    clearAIConversation('user_alice');
    clearAIConversation('user_bob');
  });

  /* ==========================================================================
     1. Local-Only Config Storage & Account Isolation
     ========================================================================== */
  describe('AI Config Storage & Account Isolation', () => {
    it('returns default config when no custom settings are stored', () => {
      const config = getAITutorConfig('user_alice');
      expect(config.provider).toBe(DEFAULT_AI_CONFIG.provider);
      expect(config.apiKey).toBe('');
      expect(config.systemMode).toBe('explain');
    });

    it('persists and isolates API key and provider between separate learner accounts', () => {
      saveAITutorConfig('user_alice', {
        provider: 'gemini',
        apiKey: 'AIzaSy_ALICE_SECRET_KEY',
        model: 'gemini-1.5-flash',
        systemMode: 'exam',
      });

      saveAITutorConfig('user_bob', {
        provider: 'openai',
        apiKey: 'sk-proj-BOB_SECRET_KEY',
        model: 'gpt-4o-mini',
        systemMode: 'beginner',
      });

      const aliceConfig = getAITutorConfig('user_alice');
      const bobConfig = getAITutorConfig('user_bob');

      // Alice isolation
      expect(aliceConfig.provider).toBe('gemini');
      expect(aliceConfig.apiKey).toBe('AIzaSy_ALICE_SECRET_KEY');
      expect(aliceConfig.systemMode).toBe('exam');

      // Bob isolation
      expect(bobConfig.provider).toBe('openai');
      expect(bobConfig.apiKey).toBe('sk-proj-BOB_SECRET_KEY');
      expect(bobConfig.systemMode).toBe('beginner');

      // Strict account boundary: Bob cannot access Alice's API key
      expect(bobConfig.apiKey).not.toBe(aliceConfig.apiKey);
    });

    it('stripApiKeyFromExport strips API keys to guarantee zero telemetry leakage', () => {
      const safeConfig = stripApiKeyFromExport({
        provider: 'deepseek',
        apiKey: 'sk-super-secret-key-12345',
        model: 'deepseek-chat',
        systemMode: 'deep_dive',
      });

      expect((safeConfig as any).apiKey).toBeUndefined();
      expect(safeConfig.provider).toBe('deepseek');
      expect(safeConfig.systemMode).toBe('deep_dive');
    });

    it('clearAITutorConfig only removes target user config and preserves other learners', () => {
      saveAITutorConfig('user_alice', { provider: 'gemini', apiKey: 'key_alice' });
      saveAITutorConfig('user_bob', { provider: 'openai', apiKey: 'key_bob' });

      clearAITutorConfig('user_alice');

      expect(getAITutorConfig('user_alice').apiKey).toBe('');
      expect(getAITutorConfig('user_bob').apiKey).toBe('key_bob');
    });

    it('provides comprehensive modern model options across all AI providers', () => {
      expect(PROVIDER_DEFAULT_MODELS.gemini.length).toBeGreaterThanOrEqual(6);
      expect(PROVIDER_DEFAULT_MODELS.openai.length).toBeGreaterThanOrEqual(6);
      expect(PROVIDER_DEFAULT_MODELS.anthropic.length).toBeGreaterThanOrEqual(5);
      expect(PROVIDER_DEFAULT_MODELS.deepseek.length).toBeGreaterThanOrEqual(3);

      expect(PROVIDER_DEFAULT_MODELS.gemini).toContain('gemini-2.5-pro');
      expect(PROVIDER_DEFAULT_MODELS.openai).toContain('gpt-4o');
      expect(PROVIDER_DEFAULT_MODELS.anthropic).toContain('claude-3-7-sonnet-20250219');
      expect(MODEL_DESCRIPTIONS['gemini-2.5-pro']).toBeDefined();
    });

    it('supports saving and using custom manually entered model IDs', () => {
      saveAITutorConfig('user_alice', {
        provider: 'custom',
        apiKey: 'custom-key-xyz',
        model: 'meta-llama/Llama-3.3-70B-Instruct',
        customEndpoint: 'https://api.together.xyz/v1',
      });

      const aliceConfig = getAITutorConfig('user_alice');
      expect(aliceConfig.model).toBe('meta-llama/Llama-3.3-70B-Instruct');
      expect(aliceConfig.customEndpoint).toBe('https://api.together.xyz/v1');
    });
  });

  /* ==========================================================================
     2. User-Scoped Conversation Storage
     ========================================================================== */
  describe('AI Conversation Storage Isolation', () => {
    it('saves and retrieves chat messages per user', () => {
      const sampleMessages: AIChatMessage[] = [
        {
          id: 'msg_1',
          role: 'user',
          content: 'Tại sao S3 Glacier Deep Archive lại rẻ nhất?',
          timestamp: Date.now(),
        },
        {
          id: 'msg_2',
          role: 'assistant',
          content: 'Glacier Deep Archive có chi phí lưu trữ thấp nhất với $0.00099/GB/tháng.',
          timestamp: Date.now(),
        },
      ];

      saveAIConversation('user_alice', sampleMessages);

      const aliceMessages = getAIConversation('user_alice');
      expect(aliceMessages).toHaveLength(2);
      expect(aliceMessages[0].content).toContain('S3 Glacier Deep Archive');

      // Bob has empty conversation
      expect(getAIConversation('user_bob')).toHaveLength(0);
    });

    it('clears conversation only for specified user', () => {
      const msg: AIChatMessage = { id: '1', role: 'user', content: 'Test', timestamp: 1 };
      saveAIConversation('user_alice', [msg]);
      saveAIConversation('user_bob', [msg]);

      clearAIConversation('user_alice');
      expect(getAIConversation('user_alice')).toHaveLength(0);
      expect(getAIConversation('user_bob')).toHaveLength(1);
    });
  });

  /* ==========================================================================
     3. RAG Retrieval & Prompt Context Engine
     ========================================================================== */
  describe('RAG Retrieval & Prompt Engine', () => {
    const mockQuestion: Question = {
      id: 101,
      originalId: '101',
      text: 'A company needs an Amazon S3 storage class for data rarely accessed but requires millisecond retrieval.',
      choices: {
        A: 'S3 Standard-Infrequent Access (S3 Standard-IA)',
        B: 'S3 Glacier Flexible Retrieval',
        C: 'S3 Glacier Deep Archive',
        D: 'S3 One Zone-Infrequent Access',
      },
      choiceKeys: ['A', 'B', 'C', 'D'],
      answer: 'A',
      answerDescription: 'S3 Standard-IA is designed for rarely accessed data with immediate (millisecond) retrieval.',
      communityVotes: [],
      domain: 'Domain 2: Design Resilient Architectures',
      difficulty: 'Medium',
      topic: 'Storage',
      serviceTags: ['S3'],
      isMultiSelect: false,
      expectedChoicesCount: 1,
    };

    it('retrieves relevant knowledge and AWS service guides for query', () => {
      const { citations } = retrieveRelevantKnowledge('S3 Glacier archival and storage classes', mockQuestion, 3);
      expect(citations.length).toBeGreaterThan(0);
      const hasMatch = citations.some(
        c => c.title.toLowerCase().includes('s3') || c.title.toLowerCase().includes('storage') || c.type === 'question'
      );
      expect(hasMatch).toBe(true);
    });

    it('builds comprehensive grounded prompt context', () => {
      const { systemPrompt, userPrompt, citations } = buildAIPromptContext({
        userQuery: 'Vì sao chọn S3 Standard-IA thay vì Glacier?',
        currentQuestion: mockQuestion,
        selectedAnswer: 'B',
        isSubmitted: true,
        isCorrect: false,
        userNotes: 'Cần lưu ý: Glacier mất vài phút đến vài giờ.',
        mode: 'exam',
      });

      expect(systemPrompt).toContain('AWS Certified Solutions Architect - Associate');
      expect(userPrompt).toContain('S3 Standard-IA');
      expect(userPrompt).toContain('#101');
      expect(userPrompt).toContain('Đáp án B');
      expect(systemPrompt).toContain('VẼ SƠ ĐỒ KIẾN TRÚC MERMAID BẮT BUỘC');
      expect(systemPrompt).toContain('ĐỊNH DẠNG MARKDOWN PHONG PHÚ');
      expect(citations.length).toBeGreaterThan(0);
    });

    it('generates high quality offline fallback response with Mermaid diagram when no API key configured', () => {
      const offlineResponse = generateKnowledgeEngineResponse({
        userQuery: 'Hãy phân tích câu hỏi này',
        currentQuestion: mockQuestion,
        selectedAnswer: 'B',
        isSubmitted: true,
        isCorrect: false,
        mode: 'explain',
      });

      expect(offlineResponse.answer).toContain('Phân tích Câu hỏi #101');
      expect(offlineResponse.answer).toContain('Đáp án đúng: **A**');
      expect(offlineResponse.answer).toContain('```mermaid');
      expect(offlineResponse.citations.length).toBeGreaterThan(0);
    });

    it('generates helpful screen context guidance when reading current screen without active question', () => {
      const screenResponse = generateKnowledgeEngineResponse({
        userQuery: '[ĐỌC MÀN HÌNH HIỆN TẠI]\nNội dung: Thẻ Flashcards AWS SAA-C03',
        mode: 'explain',
      });

      expect(screenResponse.answer).toContain('Đã nhận diện ngữ cảnh màn hình hiện tại');
      expect(screenResponse.citations.length).toBeGreaterThan(0);
    });

    it('accurately classifies user intent between question solving and general concept query', () => {
      // Concept queries
      expect(classifyUserQueryIntent('aws cognito là gì')).toEqual({
        isQuestionSolvingIntent: false,
        isGeneralConceptIntent: true,
      });
      expect(classifyUserQueryIntent('cho ví dụ về vpc endpoint')).toEqual({
        isQuestionSolvingIntent: false,
        isGeneralConceptIntent: true,
      });
      expect(classifyUserQueryIntent('so sánh SQS và SNS')).toEqual({
        isQuestionSolvingIntent: false,
        isGeneralConceptIntent: true,
      });
      expect(classifyUserQueryIntent('s3 là gì')).toEqual({
        isQuestionSolvingIntent: false,
        isGeneralConceptIntent: true,
      });
      expect(classifyUserQueryIntent('TCP-based application là cái gì')).toEqual({
        isQuestionSolvingIntent: false,
        isGeneralConceptIntent: true,
      });
      expect(classifyUserQueryIntent('AWS Global Accelerator là gì')).toEqual({
        isQuestionSolvingIntent: false,
        isGeneralConceptIntent: true,
      });
      expect(classifyUserQueryIntent('CIDR block nghĩa là gì')).toEqual({
        isQuestionSolvingIntent: false,
        isGeneralConceptIntent: true,
      });

      // Question solving queries
      expect(classifyUserQueryIntent('Hãy giải thích toàn diện câu hỏi này, từ khóa đề thi')).toEqual({
        isQuestionSolvingIntent: true,
        isGeneralConceptIntent: false,
      });
      expect(classifyUserQueryIntent('Vì sao tôi chọn đáp án B lại sai?')).toEqual({
        isQuestionSolvingIntent: true,
        isGeneralConceptIntent: false,
      });
      expect(classifyUserQueryIntent('Câu này chọn gì?')).toEqual({
        isQuestionSolvingIntent: true,
        isGeneralConceptIntent: false,
      });
      expect(classifyUserQueryIntent('Vì sao chọn S3 Standard-IA thay vì Glacier?')).toEqual({
        isQuestionSolvingIntent: true,
        isGeneralConceptIntent: false,
      });
      // Option comparison queries
      expect(classifyUserQueryIntent('a và c khác gì nhau')).toEqual({
        isQuestionSolvingIntent: true,
        isGeneralConceptIntent: false,
      });
      expect(classifyUserQueryIntent('so sánh a và b')).toEqual({
        isQuestionSolvingIntent: true,
        isGeneralConceptIntent: false,
      });
      expect(classifyUserQueryIntent('a khác gì c')).toEqual({
        isQuestionSolvingIntent: true,
        isGeneralConceptIntent: false,
      });
    });

    it('builds concept-focused prompt with mandatory examples and strictly NO answer spoilers for concept queries', () => {
      const { systemPrompt, userPrompt } = buildAIPromptContext({
        userQuery: 'aws cognito là gì',
        currentQuestion: mockQuestion,
        selectedAnswer: '',
        isSubmitted: false,
        mode: 'explain',
      });

      // Must instruct to answer concept directly and mandate real-world examples
      expect(systemPrompt).toContain('CÂU HỎI KHÁI NIỆM / DỊCH VỤ ĐỘC LẬP');
      expect(systemPrompt).toContain('BẮT BUỘC CÓ VÍ DỤ THỰC TẾ');
      expect(systemPrompt).toContain('TUYỆT ĐỐI KHÔNG GIẢI ĐỀ THI HAY TIẾT LỘ ĐÁP ÁN');

      // User prompt must NOT contain spoiler option breakdown (✅ [ĐÁP ÁN ĐÚNG])
      expect(userPrompt).not.toContain('✅ [ĐÁP ÁN ĐÚNG]');
      expect(userPrompt).not.toContain('❌ [ĐÁP ÁN SAI]');
      expect(userPrompt).toContain('aws cognito là gì');
    });

    it('generates offline concept response with real-world examples without spoiling active question answer', () => {
      const conceptResponse = generateKnowledgeEngineResponse({
        userQuery: 'aws cognito là gì',
        currentQuestion: mockQuestion,
        selectedAnswer: '',
        isSubmitted: false,
        mode: 'explain',
      });

      // Explains Cognito and provides real-world examples
      expect(conceptResponse.answer).toContain('Amazon Cognito');
      expect(conceptResponse.answer).toContain('Ví dụ thực tế trong doanh nghiệp');
      // Strictly must NOT reveal the mockQuestion's answer (Option A) or question analysis
      expect(conceptResponse.answer).not.toContain('Phân tích Câu hỏi #101');
      expect(conceptResponse.answer).not.toContain('Đáp án đúng: **A**');
    });

    it('generates offline concept response for TCP-based application without spoiling active question answer', () => {
      const conceptResponse = generateKnowledgeEngineResponse({
        userQuery: 'TCP-based application là cái gì',
        currentQuestion: mockQuestion,
        selectedAnswer: '',
        isSubmitted: false,
        mode: 'explain',
      });

      expect(conceptResponse.answer).toContain('TCP-based Applications');
      expect(conceptResponse.answer).not.toContain('Phân tích Câu hỏi #101');
      expect(conceptResponse.answer).not.toContain('Đáp án đúng: **A**');
    });

    it('generates offline service comparison response with use cases without spoiling question answer', () => {
      const compResponse = generateKnowledgeEngineResponse({
        userQuery: 'so sánh SQS và SNS',
        currentQuestion: mockQuestion,
        mode: 'explain',
      });

      expect(compResponse.answer).toContain('So sánh AWS');
      expect(compResponse.answer).toContain('Amazon SQS');
      expect(compResponse.answer).toContain('Amazon SNS');
      expect(compResponse.answer).toContain('Ví dụ thực tế');
      expect(compResponse.answer).not.toContain('Phân tích Câu hỏi #101');
      expect(compResponse.answer).not.toContain('Đáp án đúng: **A**');
    });

    it('generates comparison table and official AWS documentation citations for "so sánh tcp và http"', () => {
      const compResponse = generateKnowledgeEngineResponse({
        userQuery: 'so sánh tcp và http',
        mode: 'explain',
      });

      expect(compResponse.answer).toContain('| Tiêu chí |');
      expect(compResponse.answer).toContain('Layer 4');
      expect(compResponse.answer).toContain('Layer 7');
      expect(compResponse.answer).toContain('Network Load Balancer');
      expect(compResponse.answer).toContain('Application Load Balancer');
      expect(compResponse.answer).toContain('Nguồn tài liệu AWS chính thức');
      expect(compResponse.answer).toContain('docs.aws.amazon.com');
      expect(compResponse.citations.some(c => c.url?.includes('docs.aws.amazon.com'))).toBe(true);
    });

    it('answers 3-way comparison "amz textract khác gì với amz comprehend medical và khác gì với amz rekognition" with deep architecture and no refusal', () => {
      const response = generateKnowledgeEngineResponse({
        userQuery: 'amz textract khác gì với amz comprehend medical và khác gì với amz rekognition',
        mode: 'explain',
      });

      expect(response.answer).toContain('Amazon Textract vs Amazon Comprehend Medical vs Amazon Rekognition');
      expect(response.answer).toContain('Amazon Textract');
      expect(response.answer).toContain('Amazon Comprehend Medical');
      expect(response.answer).toContain('Amazon Rekognition');
      expect(response.answer).toContain('mermaid');
      expect(response.answer).toContain('HIPAA');
      expect(response.answer).not.toContain('Tôi chưa tìm thấy tài liệu chi tiết');
    });

    it('generates direct option comparison response when user asks about two choices of the question with imageAttached', () => {
      const q104: Question = {
        id: 104,
        originalId: '104',
        text: 'A company has a multi-tier application that runs six front-end web servers in an Amazon EC2 Auto Scaling group in a single Availability Zone behind an Application Load Balancer (ALB).',
        choices: {
          A: 'Create an Auto Scaling group that uses three instances across each of two Regions.',
          B: 'Modify the Auto Scaling group to use three instances across each of two Availability Zones.',
          C: 'Create an Auto Scaling template that can be used to quickly create more instances in another Region.',
          D: 'Change the ALB in front of the Amazon EC2 instances in a round-robin configuration to balance traffic to the web tier.',
        },
        choiceKeys: ['A', 'B', 'C', 'D'],
        answer: 'B',
        answerDescription: 'Modify the Auto Scaling group to use three instances across each of two Availability Zones.',
        communityVotes: [],
        domain: 'Domain 2: Design Resilient Architectures',
        difficulty: 'Medium',
        topic: '1',
        serviceTags: ['ec2'],
        isMultiSelect: false,
        expectedChoicesCount: 1,
      };

      const res = generateKnowledgeEngineResponse({
        userQuery: 'a và c khác gì nhau',
        currentQuestion: q104,
        mode: 'explain',
        imageAttached: true,
      });

      // Must compare options A and C
      expect(res.answer).toContain('So sánh chi tiết Lựa chọn A và C');
      expect(res.answer).toContain('Phương án A');
      expect(res.answer).toContain('Phương án C');
      expect(res.answer).toContain('Auto Scaling Group là tài nguyên cấp');
      expect(res.answer).toContain('Phương án B');
      // Must include image notice because imageAttached: true
      expect(res.answer).toContain('Lưu ý về hình ảnh đính kèm (Vision AI)');
    });

    it('generates comparison response for NLB vs ALB and never dumps VPC lecture even on VPC question', () => {
      const vpcQuestion: Question = {
        id: 576,
        originalId: '576',
        text: 'A company needs a multi-tier VPC network topology...',
        choices: { A: 'VPC Peering', B: 'Transit Gateway', C: 'NAT Gateway', D: 'IGW' },
        choiceKeys: ['A', 'B', 'C', 'D'],
        answer: 'B',
        answerDescription: 'Transit gateway connects multiple VPCs in hub and spoke.',
        communityVotes: [],
        domain: 'Domain 1: Design Secure Architectures',
        difficulty: 'Medium',
        topic: 'VPC',
        serviceTags: ['VPC', 'Transit Gateway'],
        isMultiSelect: false,
        expectedChoicesCount: 1,
      };

      const res = generateKnowledgeEngineResponse({
        userQuery: 'NLB khác gì ALB',
        currentQuestion: vpcQuestion,
        mode: 'explain',
      });

      expect(res.answer).toContain('So sánh AWS');
      expect(res.answer).toContain('ALB');
      expect(res.answer).toContain('NLB');
      expect(res.answer).toContain('Layer 7');
      expect(res.answer).toContain('Layer 4');
      expect(res.answer).not.toContain('Khái niệm AWS: Amazon Virtual Private Cloud');
    });

    it('answers image capability queries without dumping EC2 or VPC', () => {
      const ec2Question: Question = {
        id: 104,
        originalId: '104',
        text: 'An application runs on EC2...',
        choices: { A: 'A', B: 'B', C: 'C', D: 'D' },
        choiceKeys: ['A', 'B', 'C', 'D'],
        answer: 'B',
        answerDescription: 'Distribute EC2 across multi-AZ.',
        communityVotes: [],
        domain: 'Domain 2: Design Resilient Architectures',
        difficulty: 'Medium',
        topic: 'EC2',
        serviceTags: ['EC2', 'Auto Scaling'],
        isMultiSelect: false,
        expectedChoicesCount: 1,
      };

      const res = generateKnowledgeEngineResponse({
        userQuery: 'm đọc được ảnh không',
        currentQuestion: ec2Question,
        mode: 'explain',
      });

      expect(res.answer).toContain('Khả năng đọc hình ảnh (Vision AI)');
      expect(res.answer).not.toContain('Khái niệm AWS: Amazon EC2');
    });

    it('answers conversational greetings with assistant introduction', () => {
      const res = generateKnowledgeEngineResponse({
        userQuery: 'xin chào',
        mode: 'explain',
      });

      expect(res.answer).toContain('Xin chào! Tôi là Trợ lý Luyện thi AWS');
      expect(res.answer).toContain('Phân tích câu hỏi đề thi');
    });
  });

  /* ==========================================================================
     4. AI Client Fallback Execution
     ========================================================================== */
  describe('AI Client Execution', () => {
    const mockQuestion: Question = {
      id: 202,
      originalId: '202',
      text: 'An application needs asynchronous processing with FIFO ordering.',
      choices: {
        A: 'Amazon SQS FIFO Queue',
        B: 'Amazon SNS Topic',
        C: 'Amazon SQS Standard Queue',
        D: 'AWS Step Functions',
      },
      choiceKeys: ['A', 'B', 'C', 'D'],
      answer: 'A',
      answerDescription: 'Amazon SQS FIFO queue guarantees First-In-First-Out ordering and exactly-once processing.',
      communityVotes: [],
      domain: 'Domain 3: Design High-Performing Architectures',
      difficulty: 'Easy',
      topic: 'Decoupled Messaging',
      serviceTags: ['SQS'],
      isMultiSelect: false,
      expectedChoicesCount: 1,
    };

    it('falls back seamlessly to local Knowledge Engine when no API key is provided', async () => {
      const result = await sendAITutorMessage({
        systemPrompt: 'System Instruction',
        userPrompt: 'Giải thích câu hỏi này cho tôi',
        citations: [],
        currentQuestion: mockQuestion,
        selectedAnswer: 'A',
        isSubmitted: true,
        isCorrect: true,
        config: {
          provider: 'gemini',
          apiKey: '', // No key provided
          model: 'gemini-1.5-flash',
          temperature: 0.3,
          systemMode: 'explain',
        },
      });

      expect(result.content).toBeDefined();
      expect(result.content).toContain('Đáp án đúng: **A**');
      expect(result.citations.length).toBeGreaterThan(0);
    });

    it('sends multi-turn conversation history to Gemini and concatenates all text parts', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          candidates: [
            {
              content: {
                parts: [
                  { text: 'Chào bạn! ' },
                  { text: 'Dưới đây là lời giải chi tiết: phương án A là chính xác.' },
                ],
              },
              finishReason: 'STOP',
            },
          ],
        }),
      } as any);

      const result = await sendAITutorMessage({
        systemPrompt: 'You are an AWS Tutor',
        userPrompt: 'Tại sao câu A lại đúng?',
        citations: [],
        history: [
          { role: 'user', content: 'Hãy giải thích câu hỏi này.' },
          { role: 'assistant', content: 'Đây là câu hỏi về S3 và DynamoDB.' },
        ],
        config: {
          provider: 'gemini',
          apiKey: 'test-gemini-key',
          model: 'gemini-2.0-flash',
          temperature: 0.3,
          systemMode: 'explain',
        },
      });

      expect(fetchSpy).toHaveBeenCalled();
      const calledBody = JSON.parse(fetchSpy.mock.calls[0][1]?.body as string);
      // History should be present and alternating
      expect(calledBody.contents.length).toBeGreaterThan(1);
      expect(calledBody.contents[0].role).toBe('user');
      expect(calledBody.contents[1].role).toBe('model');
      expect(calledBody.contents[2].role).toBe('user');
      // maxOutputTokens must be at least 8192 to prevent premature truncation
      expect(calledBody.generationConfig.maxOutputTokens).toBeGreaterThanOrEqual(8192);
      // Both parts should be concatenated (resolving the parts[0] cutoff bug)
      expect(result.content).toBe('Chào bạn! Dưới đây là lời giải chi tiết: phương án A là chính xác.');

      fetchSpy.mockRestore();
    });

    it('sends multi-turn conversation history to OpenAI-compatible provider with max_tokens 8192', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                role: 'assistant',
                content: 'Phương án A tối ưu chi phí hơn phương án B vì S3 Standard-IA rẻ hơn.',
              },
            },
          ],
        }),
      } as any);

      const result = await sendAITutorMessage({
        systemPrompt: 'You are an AWS Tutor',
        userPrompt: 'Thế còn phương án B?',
        citations: [],
        history: [
          { role: 'user', content: 'Phân tích câu hỏi S3 này.' },
          { role: 'assistant', content: 'Phương án A là S3 Standard-IA.' },
        ],
        config: {
          provider: 'openai',
          apiKey: 'test-openai-key',
          model: 'gpt-4o-mini',
          temperature: 0.3,
          systemMode: 'explain',
        },
      });

      expect(fetchSpy).toHaveBeenCalled();
      const calledBody = JSON.parse(fetchSpy.mock.calls[0][1]?.body as string);
      expect(calledBody.messages.length).toBe(4);
      expect(calledBody.messages[0].role).toBe('system');
      expect(calledBody.messages[1].role).toBe('user');
      expect(calledBody.messages[2].role).toBe('assistant');
      expect(calledBody.messages[3].role).toBe('user');
      expect(calledBody.max_tokens).toBe(8192);
      expect(result.content).toContain('Phương án A tối ưu chi phí');

      fetchSpy.mockRestore();
    });
  });

  /* ==========================================================================
     5. Markdown Auto-Healing (Prevents Truncated Diagrams and Raw Broken Text)
     ========================================================================== */
  describe('Markdown & Diagram Auto-Healing', () => {
    it('auto-closes unclosed code blocks when response is truncated mid-generation', () => {
      const truncated = 'Dưới đây là sơ đồ:\n```mermaid\ngraph TD\n  A --> B';
      const healed = autoHealMarkdown(truncated);

      expect(healed.endsWith('```\n')).toBe(true);
      const fenceCount = (healed.match(/```/g) || []).length;
      expect(fenceCount % 2).toBe(0);
    });

    it('auto-closes unclosed Mermaid subgraphs when truncated inside a subgraph', () => {
      const truncatedInsideSubgraph = `Dưới đây là sơ đồ luồng:
\`\`\`mermaid
graph TD
  subgraph "Châu Âu"
    Site_EU["Site 1"]
  end
  subgraph "AWS Global Network"`;

      const healed = autoHealMarkdown(truncatedInsideSubgraph);
      expect(healed).toContain('end');
      expect(healed.endsWith('```\n')).toBe(true);
      const subgraphs = (healed.match(/\bsubgraph\b/g) || []).length;
      const ends = (healed.match(/\bend\b/g) || []).length;
      expect(ends).toBeGreaterThanOrEqual(subgraphs);
    });

    it('leaves fully closed markdown untouched without modifying structure', () => {
      const complete = '### Tiêu đề\n```ts\nconst x = 1;\n```\nNội dung hoàn chỉnh.';
      expect(autoHealMarkdown(complete)).toBe(complete);
    });

    it('heals orphaned diagram header and text code block into valid mermaid', () => {
      const raw = `### 4. 📐 Sơ Đồ Kiến Trúc & Luồng Xử Lý
'flowchart TD subgraph "Systems Manager" mw["Maintenance Windows"] doc["Automation Document"] end'

\`\`\`text
alb["Application Load Balancer"]
tg["Target Group"]
mw -->|"1. Kích hoạt"| doc
doc -->|"2. Deregister"| tg
\`\`\``;

      const healed = autoHealMarkdown(raw);
      expect(healed).toContain('```mermaid');
      expect(healed).toContain('flowchart TD');
      expect(healed).toContain('alb["Application Load Balancer"]');
      expect(healed).not.toContain('```text');
    });

    it('converts mistagged text code block containing mermaid syntax to mermaid', () => {
      const raw = `\`\`\`text
Client["User"] --> ALB["Load Balancer"]
ALB --> EC2["App Server"]
\`\`\``;

      const healed = autoHealMarkdown(raw);
      expect(healed).toContain('```mermaid');
      expect(healed).toContain('flowchart TD');
      expect(healed).toContain('Client["User"] --> ALB["Load Balancer"]');
      expect(healed).not.toContain('```text');
    });
  });
});
