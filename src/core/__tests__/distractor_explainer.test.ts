import { describe, it, expect } from 'vitest';
import {
  generateOptionExplanation,
  generateAllOptionExplanations,
  getSelectedWrongExplanations,
} from '../distractorExplainer';
import { generateEnhancedExplanation } from '../explanationEnhancer';
import type { Question } from '../types';

describe('distractorExplainer - Vietnamese wrong-answer explanations', () => {
  const q1: Question = {
    id: 1,
    originalId: '1',
    text: 'A company collects data for temperature, humidity, and atmospheric pressure in cities across multiple continents. The average volume of data that the company collects from each site daily is 500 GB. Each site has a high-speed Internet connection.\nThe company wants to aggregate the data from all these global sites as quickly as possible in a single Amazon S3 bucket. The solution must minimize operational complexity.\nWhich solution meets these requirements?',
    choices: {
      A: 'Turn on S3 Transfer Acceleration on the destination S3 bucket. Use multipart uploads to directly upload site data to the destination S3 bucket.',
      B: 'Upload the data from each site to an S3 bucket in the closest Region. Use S3 Cross-Region Replication to copy objects to the destination S3 bucket. Then remove the data from the origin S3 bucket.',
      C: 'Schedule AWS Snowball Edge Storage Optimized device jobs daily to transfer data from each site to the closest Region. Use S3 Cross-Region Replication to copy objects to the destination S3 bucket.',
      D: 'Upload the data from each site to an Amazon EC2 instance in the closest Region. Store the data in an Amazon Elastic Block Store (Amazon EBS) volume. At regular intervals, take an EBS snapshot and copy it to the Region that contains the destination S3 bucket. Restore the EBS volume in that Region.',
    },
    choiceKeys: ['A', 'B', 'C', 'D'],
    answer: 'A',
    answerDescription: '',
    communityVotes: [],
    topic: '1',
    serviceTags: ['Amazon S3'],
    domain: 'Domain 3: Design High-Performing Architectures',
    difficulty: 'Medium',
    isMultiSelect: false,
    expectedChoicesCount: 1,
  };

  it('correctly explains why Choice C is WRONG in Question 1 (Snowball Edge daily)', () => {
    const expC = generateOptionExplanation(q1, 'C', true);

    expect(expC.isCorrect).toBe(false);
    expect(expC.isSelected).toBe(true);
    expect(expC.key).toBe('C');
    expect(expC.violationType).toBe('Độ trễ vật lý & Vận hành bất khả thi');
    expect(expC.shortReasonVi).toContain('AWS Snowball là thiết bị');
    expect(expC.detailedReasonVi).toContain('AWS Snowball Edge là thiết bị phần cứng vật lý');
    expect(expC.detailedReasonVi).toContain('daily');
    expect(expC.detailedReasonVi).toContain('500 GB');
    expect(expC.detailedReasonVi).toContain('minimize operational complexity');
    expect(expC.contrastWithCorrectVi).toContain('Amazon S3 Transfer Acceleration');
  });

  it('correctly explains why Choice B is WRONG in Question 1 (Intermediate bucket + CRR + delete)', () => {
    const expB = generateOptionExplanation(q1, 'B', false);

    expect(expB.isCorrect).toBe(false);
    expect(expB.key).toBe('B');
    expect(expB.violationType).toContain('Quy trình trung gian dư thừa & Tăng chi phí');
    expect(expB.shortReasonVi).toContain('Tạo bucket S3 tạm');
    expect(expB.detailedReasonVi).toContain('Cross-Region Replication');
    expect(expB.detailedReasonVi).toContain('liên vùng');
  });

  it('correctly explains why Choice D is WRONG in Question 1 (EC2 + EBS snapshot copy anti-pattern)', () => {
    const expD = generateOptionExplanation(q1, 'D', false);

    expect(expD.isCorrect).toBe(false);
    expect(expD.key).toBe('D');
    expect(expD.violationType).toContain('Độ phức tạp vận hành');
    expect(expD.shortReasonVi).toContain('Tự triển khai máy chủ EC2');
    expect(expD.detailedReasonVi).toContain('anti-pattern');
    expect(expD.detailedReasonVi).toContain('EBS');
  });

  it('correctly marks Choice A as correct answer', () => {
    const expA = generateOptionExplanation(q1, 'A', false);

    expect(expA.isCorrect).toBe(true);
    expect(expA.violationType).toBe('Đáp án chính xác');
    expect(expA.shortReasonVi).toContain('đúng');
  });

  it('generates all option explanations for Question 1', () => {
    const all = generateAllOptionExplanations(q1, 'C');

    expect(Object.keys(all)).toEqual(['A', 'B', 'C', 'D']);
    expect(all['A'].isCorrect).toBe(true);
    expect(all['B'].isCorrect).toBe(false);
    expect(all['C'].isCorrect).toBe(false);
    expect(all['C'].isSelected).toBe(true);
    expect(all['D'].isCorrect).toBe(false);
  });

  it('returns selected wrong explanations when user selected wrong answer C', () => {
    const wrong = getSelectedWrongExplanations(q1, 'C');

    expect(wrong.length).toBe(1);
    expect(wrong[0].key).toBe('C');
    expect(wrong[0].isCorrect).toBe(false);
    expect(wrong[0].detailedReasonVi.length).toBeGreaterThan(50);
  });

  it('returns empty array when user selected correct answer A', () => {
    const wrong = getSelectedWrongExplanations(q1, 'A');
    expect(wrong.length).toBe(0);
  });

  // Question 2: SQS FIFO vs Standard and SNS
  const q2: Question = {
    id: 2,
    originalId: '2',
    text: 'A company is building an ecommerce web application on AWS. The application sends information about new orders to an Amazon API Gateway REST API to process. The company wants to ensure that orders are processed in the order that they are received.\nWhich solution will meet these requirements?',
    choices: {
      A: 'Use an API Gateway integration to publish a message to an Amazon Simple Notification Service (Amazon SNS) topic when the application receives an order. Subscribe an AWS Lambda function to the topic to perform processing.',
      B: 'Use an API Gateway integration to send a message to an Amazon Simple Queue Service (Amazon SQS) FIFO queue when the application receives an order. Configure the SQS FIFO queue to invoke an AWS Lambda function for processing.',
      C: 'Use an API Gateway authorizer to block any requests while the application processes an order.',
      D: 'Use an API Gateway integration to send a message to an Amazon Simple Queue Service (Amazon SQS) standard queue when the application receives an order. Configure the SQS standard queue to invoke an AWS Lambda function for processing.',
    },
    choiceKeys: ['A', 'B', 'C', 'D'],
    answer: 'B',
    answerDescription: '',
    communityVotes: [],
    topic: '1',
    serviceTags: ['Amazon API Gateway', 'Amazon SQS', 'AWS Lambda'],
    domain: 'Domain 2: Design Resilient Architectures',
    difficulty: 'Medium',
    isMultiSelect: false,
    expectedChoicesCount: 1,
  };

  it('explains why SQS Standard is wrong when FIFO is needed (Question 2 Choice D)', () => {
    const expD = generateOptionExplanation(q2, 'D', true);

    expect(expD.isCorrect).toBe(false);
    expect(expD.violationType).toContain('Không bảo toàn thứ tự');
    expect(expD.detailedReasonVi).toContain('best-effort ordering');
    expect(expD.detailedReasonVi).toContain('SQS FIFO');
  });

  it('explains why SNS topic is wrong when FIFO queuing is needed (Question 2 Choice A)', () => {
    const expA = generateOptionExplanation(q2, 'A', false);

    expect(expA.isCorrect).toBe(false);
    expect(expA.violationType).toContain('Sai mô hình hàng đợi đệm');
    expect(expA.detailedReasonVi).toContain('Publish/Subscribe');
  });

  it('explains why API Gateway authorizer blocking is wrong (Question 2 Choice C)', () => {
    const expC = generateOptionExplanation(q2, 'C', false);

    expect(expC.isCorrect).toBe(false);
    expect(expC.violationType).toContain('Lạm dụng sai mục đích dịch vụ');
    expect(expC.detailedReasonVi).toContain('Authorizer');
  });

  it('integrates with generateEnhancedExplanation', () => {
    const enhanced = generateEnhancedExplanation(q1, 'C');

    expect(enhanced.allOptionExplanations).toBeDefined();
    expect(enhanced.selectedWrongExplanations).toHaveLength(1);
    expect(enhanced.selectedWrongExplanations[0].key).toBe('C');
    expect(enhanced.selectedWrongExplanations[0].detailedReasonVi).toContain('Snowball');
  });

  it('handles multi-select wrong answers gracefully', () => {
    const multiQ: Question = {
      ...q1,
      id: 99,
      answer: 'BD',
      isMultiSelect: true,
      expectedChoicesCount: 2,
    };

    // User selected CD: C is wrong, D is correct
    const wrong = getSelectedWrongExplanations(multiQ, 'CD');
    expect(wrong.length).toBe(1);
    expect(wrong[0].key).toBe('C');
  });

  it('correctly provides curated explanations for Question 10 (multi-select CD)', () => {
    const q10: Question = {
      id: 10,
      originalId: '10',
      text: 'A company has an application that runs on Amazon EC2 instances in an IP address target group behind an Application Load Balancer (ALB)... Which combination of actions should the solutions architect recommend? (Choose two.)',
      choices: {
        A: 'Create a new target group. Change the target type to instance.',
        B: 'Continue to use the same Systems Manager Automation document.',
        C: 'Use the AWSEC2-PatchLoadBalancerInstance Systems Manager Automation document.',
        D: 'Configure Systems Manager Maintenance Windows to control the patching schedule.',
        E: 'Configure Systems Manager State Manager to control the patching schedule. Use ALB health checks.',
      },
      choiceKeys: ['A', 'B', 'C', 'D', 'E'],
      answer: 'CD',
      answerDescription: '',
      communityVotes: [],
      topic: '1',
      serviceTags: ['AWS Systems Manager', 'Application Load Balancer'],
      domain: 'Domain 1: Design Secure Architectures',
      difficulty: 'Hard',
      isMultiSelect: true,
      expectedChoicesCount: 2,
    };

    const all = generateAllOptionExplanations(q10, 'AB');
    expect(all['C'].isCorrect).toBe(true);
    expect(all['D'].isCorrect).toBe(true);
    expect(all['A'].isCorrect).toBe(false);
    expect(all['B'].isCorrect).toBe(false);
    expect(all['E'].isCorrect).toBe(false);

    expect(all['C'].detailedReasonVi).toContain('AWSEC2-PatchLoadBalancerInstance');
    expect(all['D'].detailedReasonVi).toContain('Maintenance Windows');
    expect(all['E'].violationType).toContain('Sai công cụ & Gián đoạn kết nối');
    expect(all['A'].violationType).toContain('Không giải quyết được yêu cầu');
  });
});
