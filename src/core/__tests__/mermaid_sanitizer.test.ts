import { describe, it, expect, vi } from 'vitest';
import { sanitizeMermaidCode, healMermaidFallback } from '../../components/ai/mermaidSanitizer';

vi.mock('dompurify', () => {
  return {
    default: {
      addHook: () => {},
      sanitize: (s: any) => s,
    },
  };
});

describe('Mermaid Sanitizer & Auto-Healer', () => {
  it('fixes subgraphs declared with quoted titles and no IDs', async () => {
    const raw = `graph TD
    subgraph "Châu Âu"
        Site_EU[🏢 Site 1]
    end
    subgraph "Châu Á"
        Site_Asia[🏢 Site 2]
    end
    subgraph "Châu Mỹ"
        Site_NA[🏢 Site 3]
    end

    subgraph "AWS Global Network"`;

    const sanitized = sanitizeMermaidCode(raw);

    // Subgraphs with content must now have valid IDs followed by ["Title"]
    expect(sanitized).toMatch(/subgraph\s+sg_\d+_chau_au\s*\["Châu Âu"\]/);
    expect(sanitized).toMatch(/subgraph\s+sg_\d+_chau_a\s*\["Châu Á"\]/);
    expect(sanitized).toMatch(/subgraph\s+sg_\d+_chau_my\s*\["Châu Mỹ"\]/);

    // Node labels with emojis must be quoted
    expect(sanitized).toContain('Site_EU["🏢 Site 1"]');
    expect(sanitized).toContain('Site_Asia["🏢 Site 2"]');
    expect(sanitized).toContain('Site_NA["🏢 Site 3"]');

    // Trailing empty/truncated subgraph is removed to prevent syntax error
    expect(sanitized).not.toContain('sg_4_aws_global_network');

    // All opened subgraphs must be balanced with 'end'
    const openCount = (sanitized.match(/\bsubgraph\b/g) || []).length;
    const endCount = (sanitized.match(/\bend\b/g) || []).length;
    expect(openCount).toBe(3);
    expect(endCount).toBe(3);
  });

  it('strips markdown fences and mermaid prefix', () => {
    const raw = `\`\`\`mermaid
mermaid graph TD
    A --> B
\`\`\``;
    const sanitized = sanitizeMermaidCode(raw);
    expect(sanitized.startsWith('graph TD')).toBe(true);
    expect(sanitized).not.toContain('```');
    expect(sanitized).not.toContain('mermaid graph');
  });

  it('supplies default header if omitted by LLM', () => {
    const raw = `A[Client] --> B[Server]`;
    const sanitized = sanitizeMermaidCode(raw);
    expect(sanitized.startsWith('flowchart TD')).toBe(true);
    expect(sanitized).toContain('A["Client"] --> B["Server"]');
  });

  it('safely quotes unquoted node labels with special characters', () => {
    const raw = `graph LR
    EC2[Amazon EC2 (Web App: Port 80)] --> RDS[(Amazon Aurora: Multi-AZ)]
    ALB(Internet-facing ALB)`;
    const sanitized = sanitizeMermaidCode(raw);
    expect(sanitized).toContain('EC2["Amazon EC2 (Web App: Port 80)"]');
    expect(sanitized).toContain('ALB("Internet-facing ALB")');
  });

  it('heals fallback diagram by flattening subgraphs when needed', () => {
    const raw = `graph TD
    subgraph Corrupt Subgraph
        A --> B
    end`;
    const healed = healMermaidFallback(raw);
    expect(healed.startsWith('graph TD')).toBe(true);
    expect(healed).not.toContain('subgraph');
    expect(healed).toContain('A --> B');
  });

  it('handles uppercase Flowchart and truncated arrow from Question 10', () => {
    const raw = `Flowchart LR
    subgraph "AWS Cloud"
        A["⚙️<br>SSM Maintenance Window<br>(Lên lịch vá lỗi)"] -- 1. Trigger --> B["🤖<br>SSM Automation Document<br>(AWSEC2-PatchLoadBalancerInstance)"]

        subgraph "VPC"
            ALB["🌐<br>Application Load Balancer"] --> TG["🎯<br>Target Group (IP Type)"]
            TG -- Traffic --> EC2_1["🖥️<br>EC2 Instance 1<br>(Healthy)"]
            TG -- Traffic --> EC2_2["🖥️<br>EC2 Instance 2<br>(Healthy)"]
        end

        B -- "2. Deregister Instance 1" --> TG
        B -- "3. Patch Instance 1" -->`;

    const sanitized = sanitizeMermaidCode(raw);
    expect(sanitized.startsWith('flowchart LR')).toBe(true);
    // Incomplete trailing arrow should be cleaned up so it does not cause a syntax error
    expect(sanitized).not.toMatch(/-->\s*$/);
    // Outer and inner subgraphs should be balanced
    const openCount = (sanitized.match(/\bsubgraph\b/g) || []).length;
    const endCount = (sanitized.match(/\bend\b/g) || []).length;
    expect(openCount).toBe(endCount);
  });

  it('cleans and normalizes Question 10 diagram properly', () => {
    const raw = `Flowchart LR
    subgraph "AWS Cloud"
        A["⚙️<br>SSM Maintenance Window<br>(Lên lịch vá lỗi)"] -- 1. Trigger --> B["🤖<br>SSM Automation Document<br>(AWSEC2-PatchLoadBalancerInstance)"]

        subgraph "VPC"
            ALB["🌐<br>Application Load Balancer"] --> TG["🎯<br>Target Group (IP Type)"]
            TG -- Traffic --> EC2_1["🖥️<br>EC2 Instance 1<br>(Healthy)"]
            TG -- Traffic --> EC2_2["🖥️<br>EC2 Instance 2<br>(Healthy)"]
        end

        B -- "2. Deregister Instance 1" --> TG
        B -- "3. Patch Instance 1" -->`;

    const sanitized = sanitizeMermaidCode(raw);
    expect(sanitized).toContain('flowchart LR');
    expect(sanitized).toContain('subgraph sg_1_aws_cloud["AWS Cloud"]');
    expect(sanitized).toContain('subgraph sg_2_vpc["VPC"]');
    expect(sanitized).toContain('-->|"1. Trigger"|');
    expect(sanitized).toContain('-->|"2. Deregister Instance 1"|');
    expect(sanitized).not.toContain('Patch Instance 1'); // Incomplete trailing line dropped
    const openCount = (sanitized.match(/\bsubgraph\b/g) || []).length;
    const endCount = (sanitized.match(/\bend\b/g) || []).length;
    expect(openCount).toBe(2);
    expect(endCount).toBe(2);
  });

  it('parses the user control tower diagram', async () => {
    const raw = `flowchart TD
  subgraph ManagementAccount ["👑 Tài khoản Quản lý (Trụ sở chính)"]
    CT["🏰 AWS Control Tower"]
    SH["📊 AWS Security Hub (Màn hình trung tâm)"]
    AF["🏭 Account Factory (Nhà máy tạo tài khoản)"]
  end

  subgraph MemberAccounts ["🏢 Các tài khoản thành viên (Văn phòng chi nhánh)"]
    Acc1["✅ Account 1 (Mới)"]
    Acc2["✅ Account 2 (Mới)"]
    Acc3["✅ Account 3 (Hiện có)"]
  end

  CT -->|"Thiết lập & Quản lý"| SH
  AF -->|"Tạo ra theo chuẩn"| Acc1
  AF -->|"Tạo ra theo chuẩn"| Acc2
  SH -->|"🔍 Kiểm tra tuân thủ (FSBP)"| Acc1
  SH -->|"🔍 Kiểm tra tuân thủ (FSBP)"| Acc2
  SH -->|"🔍 Kiểm tra tuân thủ (FSBP)"| Acc3`;

    const sanitized = sanitizeMermaidCode(raw);
    expect(sanitized).toContain('subgraph ManagementAccount["👑 Tài khoản Quản lý (Trụ sở chính)"]');
    expect(sanitized).toContain('CT["🏰 AWS Control Tower"]');
    expect(sanitized).toContain('-->|"Thiết lập và Quản lý"| SH');
    expect(sanitized.startsWith('flowchart TD')).toBe(true);

    // Also verify ultra safe healer generates clean lines
    const { healMermaidUltraSafe } = await import('../../components/ai/mermaidSanitizer');
    const ultraSafe = healMermaidUltraSafe(raw);
    expect(ultraSafe).toContain('flowchart TD');
    expect(ultraSafe).not.toContain('subgraph');
    expect(ultraSafe).toContain('CT["🏰 AWS Control Tower"]');
  });
});

