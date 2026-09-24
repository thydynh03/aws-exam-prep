import type { AWSDomain } from './types';

export interface DomainMeta {
  id: 1 | 2 | 3 | 4;
  code: 'D1' | 'D2' | 'D3' | 'D4';
  domain: AWSDomain;
  shortTitle: string;
  weightPercent: number;
  weightLabel: string;
  badgeClasses: string;
  dotColor: string;
  descriptionVi: string;
  descriptionEn: string;
}

export const SAA_DOMAINS: Record<AWSDomain, DomainMeta> = {
  'Domain 1: Design Secure Architectures': {
    id: 1,
    code: 'D1',
    domain: 'Domain 1: Design Secure Architectures',
    shortTitle: 'Secure Architectures',
    weightPercent: 30,
    weightLabel: '30%',
    badgeClasses:
      'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/60 dark:text-indigo-300 dark:border-indigo-800/60',
    dotColor: 'bg-indigo-500',
    descriptionVi: 'Thiết kế kiến trúc bảo mật: Quản lý danh tính, phân quyền IAM, mã hóa dữ liệu KMS, bảo mật mạng VPC/WAF.',
    descriptionEn: 'Design secure architectures: Identity & access, IAM policies, KMS encryption, network security VPC/WAF.',
  },
  'Domain 2: Design Resilient Architectures': {
    id: 2,
    code: 'D2',
    domain: 'Domain 2: Design Resilient Architectures',
    shortTitle: 'Resilient Architectures',
    weightPercent: 26,
    weightLabel: '26%',
    badgeClasses:
      'bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/60 dark:text-sky-300 dark:border-sky-800/60',
    dotColor: 'bg-sky-500',
    descriptionVi: 'Thiết kế kiến trúc đàn hồi & chịu lỗi: Tách rời dịch vụ SQS/SNS, Multi-AZ, Multi-Region, Auto Scaling, DR.',
    descriptionEn: 'Design resilient architectures: Decoupled SQS/SNS, Multi-AZ, Multi-Region, Auto Scaling, disaster recovery.',
  },
  'Domain 3: Design High-Performing Architectures': {
    id: 3,
    code: 'D3',
    domain: 'Domain 3: Design High-Performing Architectures',
    shortTitle: 'High-Performing',
    weightPercent: 24,
    weightLabel: '24%',
    badgeClasses:
      'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800/60',
    dotColor: 'bg-amber-500',
    descriptionVi: 'Thiết kế kiến trúc hiệu năng cao: Bộ nhớ đệm ElastiCache/CloudFront, DynamoDB DAX, lưu trữ tối ưu FSx/EBS io2.',
    descriptionEn: 'Design high-performing architectures: Caching ElastiCache/CloudFront, DynamoDB DAX, fast storage FSx/EBS io2.',
  },
  'Domain 4: Design Cost-Optimized Architectures': {
    id: 4,
    code: 'D4',
    domain: 'Domain 4: Design Cost-Optimized Architectures',
    shortTitle: 'Cost-Optimized',
    weightPercent: 20,
    weightLabel: '20%',
    badgeClasses:
      'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800/60',
    dotColor: 'bg-emerald-500',
    descriptionVi: 'Thiết kế kiến trúc tối ưu chi phí: Vòng đời S3 Lifecycle, Spot Instances, Savings Plans, giảm chi phí truyền dữ liệu.',
    descriptionEn: 'Design cost-optimized architectures: S3 Lifecycle tiers, Spot instances, Savings Plans, data transfer optimization.',
  },
};

export const SAA_EXAM_QUOTAS_65 = {
  'Domain 1: Design Secure Architectures': 20, // 30.77%
  'Domain 2: Design Resilient Architectures': 17, // 26.15%
  'Domain 3: Design High-Performing Architectures': 15, // 23.08%
  'Domain 4: Design Cost-Optimized Architectures': 13, // 20.00%
} as const;

export const SAA_EXAM_QUOTAS_32 = {
  'Domain 1: Design Secure Architectures': 10, // 31.25%
  'Domain 2: Design Resilient Architectures': 8,  // 25.00%
  'Domain 3: Design High-Performing Architectures': 8,  // 25.00%
  'Domain 4: Design Cost-Optimized Architectures': 6,  // 18.75%
} as const;

export function getDomainMeta(domain: AWSDomain): DomainMeta {
  return SAA_DOMAINS[domain] || SAA_DOMAINS['Domain 1: Design Secure Architectures'];
}
