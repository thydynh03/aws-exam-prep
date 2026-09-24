/**
 * Sổ đăng ký nội dung học sâu cho từng AWS service.
 *
 * Mỗi service một file trong thư mục deepdives/ vì có tới 92 service cần viết,
 * và vì nhiều tiến trình soạn nội dung chạy song song sẽ đụng nhau nếu dùng
 * chung một file.
 *
 * Tách khỏi serviceDatabase.ts để file đó giữ nguyên, và để service chưa có
 * trong AWS_SERVICES (Route 53, CloudWatch, Glacier...) vẫn có chỗ đứng.
 *
 * Khóa của map trùng với id trong src/data/serviceQuestionIndex.json.
 */
import type { ServiceDeepDive } from './types';
import { s3DeepDive } from './deepdives/s3';
import { ec2DeepDive } from './deepdives/ec2';
import { vpcDeepDive } from './deepdives/vpc';
import { dynamodbDeepDive } from './deepdives/dynamodb';
import { iamDeepDive } from './deepdives/iam';
import { route53DeepDive } from './deepdives/route53';

export const SERVICE_DEEP_DIVES: Record<string, ServiceDeepDive> = {
  s3: s3DeepDive,
  ec2: ec2DeepDive,
  vpc: vpcDeepDive,
  dynamodb: dynamodbDeepDive,
  iam: iamDeepDive,
  route53: route53DeepDive,
};

/** Lấy nội dung deep-dive theo id service, chưa có thì trả về undefined. */
export function getServiceDeepDive(serviceId: string): ServiceDeepDive | undefined {
  return SERVICE_DEEP_DIVES[serviceId];
}

/** Những service đã có nội dung deep-dive. */
export function getDeepDiveServiceIds(): string[] {
  return Object.keys(SERVICE_DEEP_DIVES);
}
