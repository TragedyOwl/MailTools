# 智能邮件助手 - AI开发执行约束文档
1. 项目边界与上下文
项目定位： 基于React + TypeScript + Vite的纯前端智能邮件管理应用，部署于Vercel，数据完全本地存储（IndexedDB/LocalStorage）。
绝对约束（不可突破）：
❌ 不允许引入后端数据库（PostgreSQL/MongoDB/MySQL等）
❌ 不允许使用Google Calendar API或任何外部日历服务
❌ 不允许将用户邮件数据上传至除AI摘要API外的任何第三方
❌ 不允许使用类组件，全部使用函数式组件 + Hooks
❌ 不允许暴露敏感配置（API Key/邮箱密码）到前端源码或客户端
关键假设：
企业IMAP服务器（imap.example.com）可从公网访问
用户自行提供AI API Key（通过加密LocalStorage存储）
浏览器支持IndexedDB和Service Worker
2. 开发哲学
本地优先：所有核心功能必须在无网络时仍可查看/操作已同步数据
渐进增强：基础功能不依赖AI，AI仅作为增强层
防御性编程：IMAP连接可能失败，AI API可能超时，必须处理所有异常
性能敏感：邮件列表可能达数千条，禁止全量渲染，必须虚拟滚动

3. 代码规范
3.1 TypeScript规范
// ✅ 强制：所有函数必须显式返回类型
const parseMail = (raw: RawMail): Mail => { ... };

// ✅ 强制：禁止使用any，使用unknown + 类型守卫
const handleError = (err: unknown): string => {
  if (err instanceof Error) return err.message;
  return String(err);
};

// ✅ 强制：接口命名使用PascalCase，以I结尾可选但保持一致
interface MailProps { ... }

// ❌ 禁止：隐式any
// ❌ 禁止：使用 @ts-ignore 除非附详细注释说明原因

3.2 React规范
// ✅ 强制：组件文件使用PascalCase命名，与导出组件同名
// MailCard.tsx -> export const MailCard = ...

// ✅ 强制：Props接口命名为 {ComponentName}Props
interface MailCardProps {
  mail: Mail;
  onSelect: (id: string) => void;
}

// ✅ 强制：事件处理函数以 handle 开头
const handleClick = () => { ... };
const handleDelete = (id: string) => { ... };

// ✅ 强制：useEffect必须有清理函数（如需要）
useEffect(() => {
  const controller = new AbortController();
  fetchData(controller.signal);
  return () => controller.abort();
}, []);

// ❌ 禁止：在useEffect中直接使用async函数
// ❌ 禁止：useState初始化使用函数调用（除非惰性初始化 useState(() => fn())）

3.3 样式规范
// ✅ 强制：使用Tailwind CSS，禁止手写CSS文件（除全局reset外）
// ✅ 强制：类名顺序：布局 -> 尺寸 -> 间距 -> 外观 -> 状态
<div className="flex items-center w-full px-4 py-2 bg-white rounded-lg hover:bg-gray-50">

// ✅ 强制：复杂条件类名使用 cn() 工具（clsx + tailwind-merge）
className={cn(
  "flex items-center px-4 py-2 rounded-lg",
  isActive && "bg-blue-50 text-blue-600",
  isUnread && "font-semibold"
)}

// ❌ 禁止：使用style内联样式（动态计算值除外）
// ❌ 禁止：随意使用 !important


4. 组件设计模式
4.1 目录组织
components/
├── {domain}/           # 按领域分组：mail/ task/ todo/ calendar/
│   ├── {Component}.tsx
│   └── {Component}.test.tsx   # 同目录测试（如需要）

4.2 组件分层
| 层级        | 职责                    | 示例                    |
| --------- | --------------------- | --------------------- |
| Page      | 页面级，组合Section，连接Store | InboxPage.tsx         |
| Section   | 页面区块，业务逻辑             | MailListSection.tsx   |
| Component | 纯展示，接收props           | MailCard.tsx          |
| Primitive | 原子组件，无业务逻辑            | Button.tsx, Badge.tsx |


4.3 数据流规则
Page -> 调用Hook/Action -> 更新Zustand Store -> 组件重渲染
              ↓
        异步操作（如API）-> 成功后更新Store -> 持久化到IndexedDB

        禁止：
禁止组件直接调用IndexedDB（必须通过Store/Repository层）
禁止跨组件直接传递状态（使用Zustand）
禁止在渲染阶段执行副作用


5. 状态管理规则
5.1 Store拆分原则
按领域拆分Store，禁止单一巨型Store：
// ✅ 正确：按领域拆分
const useMailStore = create<MailState>(...);
const useTaskStore = create<TaskState>(...);

// 跨Store通信通过事件或组合Hook
const useMailTask = () => {
  const mails = useMailStore(s => s.mails);
  const groupMails = useTaskStore(s => s.groupMails);
  // ...
};

5.2 选择器优化
// ✅ 正确：使用细粒度选择器，避免不必要重渲染
const subject = useMailStore(s => s.selectedMail?.subject);

// ❌ 错误：返回整个对象
const { selectedMail } = useMailStore(); // 会导致所有字段变化都触发重渲染

6. 邮件处理规范
6.1 内容解析
// 邮件正文处理优先级：
// 1. text/plain 部分（最干净）
// 2. text/html 转纯文本（去除标签，保留换行）
// 3. 如果HTML包含表格/列表，保留结构标记

// 使用正则去除HTML标签（简单场景）
const htmlToText = (html: string): string => {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .trim();
};

6.2 任务关联实现
// 关联算法优先级（从高到低）：
// 1. In-Reply-To / References 头匹配（100%置信度）
// 2. 主题相似度 >= 0.85（Dice系数）
// 3. 同一发件人 + 相同项目代号（正则提取如 [PROJECT-123]）
// 4. 用户手动关联（持久化到task.mailIds）

// 主题清洗函数（必须统一使用）
const cleanSubject = (subject: string): string => {
  return subject
    .replace(/^(Re:|Fwd:|回复：|转发：)\s*/i, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
};


7. AI功能集成规范
7.1 API调用封装
// services/aiService.ts
// 必须实现：重试机制、超时控制、错误降级

const callAI = async (prompt: string): Promise<AISummary> => {
  const MAX_RETRIES = 3;
  const TIMEOUT = 10000; // 10s
  
  for (let i = 0; i < MAX_RETRIES; i++) {
    try {
      const res = await fetch('/api/ai/summarize', {
        method: 'POST',
        body: JSON.stringify({ prompt }),
        signal: AbortSignal.timeout(TIMEOUT)
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return parseSummary(await res.json());
    } catch (err) {
      if (i === MAX_RETRIES - 1) return getFallbackSummary(); // 降级
      await delay(1000 * (i + 1)); // 指数退避
    }
  }
};

7.2 降级策略
当AI API不可用时：
摘要降级：显示邮件前200字符 + "（摘要生成失败）"
分类降级：基于关键词规则（主题含"会议"->meeting，含"申请"->approval）
待办降级：不自动提取，依赖用户手动创建
7.3 Prompt工程约束
// ✅ 强制：所有Prompt必须包含输出格式示例，要求JSON返回
// ✅ 强制：设置max_tokens限制（摘要不超过500 tokens）
// ✅ 强制：包含防注入提示："仅基于提供邮件内容分析，不要编造信息"

// ❌ 禁止：在Prompt中直接拼接用户邮件内容而不做长度截断
// 邮件内容超过4000字符时必须分段或截断

8. 日历实现规范
8.1 自研日历约束
禁止使用 FullCalendar、react-big-calendar等重型库（体积/定制性考虑）
基于date-fns自行计算日历网格
月视图固定6行7列，共42个日期格子
事件支持跨天显示，使用绝对定位或Grid布局
8.2 日期处理
// ✅ 强制：所有日期存储使用ISO 8601字符串（UTC或带时区）
// ✅ 强制：界面显示使用用户本地时区
// ✅ 强制：使用date-fns处理日期运算，禁止原生Date复杂运算

import { format, parseISO, addDays, startOfWeek, endOfWeek } from 'date-fns';
import { zhCN } from 'date-fns/locale';

// 格式化示例
const displayDate = format(parseISO(event.startTime), 'yyyy年MM月dd日 HH:mm', { locale: zhCN });

9. 安全与隐私规范
9.1 加密实现
// utils/crypto.ts
// 使用AES-256-GCM，密钥由用户设置的主密码派生（PBKDF2）

export const encryptCredential = (text: string, masterKey: string): string => {
  const salt = CryptoJS.lib.WordArray.random(128/8);
  const key = CryptoJS.PBKDF2(masterKey, salt, { keySize: 256/32, iterations: 10000 });
  const encrypted = CryptoJS.AES.encrypt(text, key, { iv: salt });
  return salt.toString() + ':' + encrypted.toString();
};

export const decryptCredential = (cipher: string, masterKey: string): string => {
  const [saltStr, encryptedStr] = cipher.split(':');
  const salt = CryptoJS.enc.Hex.parse(saltStr);
  const key = CryptoJS.PBKDF2(masterKey, salt, { keySize: 256/32, iterations: 10000 });
  const decrypted = CryptoJS.AES.decrypt(encryptedStr, key, { iv: salt });
  return decrypted.toString(CryptoJS.enc.Utf8);
};

9.2 数据脱敏
日志中禁止输出完整邮件内容（最多前50字符）
错误上报时移除邮箱密码、API Key
IndexedDB中的敏感字段必须加密

10. 性能要求
| 指标     | 目标      | 实现手段                    |
| ------ | ------- | ----------------------- |
| 首屏加载   | < 2s    | Vite代码分割、懒加载路由          |
| 邮件列表滚动 | 60fps   | react-window虚拟滚动        |
| 单次同步   | < 10s   | 分页加载（每页50封）、并发限制3       |
| AI摘要   | < 3s/封  | 批量请求、本地缓存、后台生成          |
| 内存占用   | < 200MB | 大数据存IndexedDB，内存仅保留当前视图 |


11. 迭代开发指令
Phase 1：基础框架（MVP）
搭建Vite + React + Tailwind + Zustand项目骨架
实现IndexedDB仓库层和基础CRUD
实现邮箱配置页和IMAP连接测试
实现邮件列表和详情页（无AI摘要）
Phase 2：AI能力
接入Vercel Edge Function代理AI API
实现邮件摘要生成和展示
实现基础任务关联（基于主题相似度）
实现待办自动提取
Phase 3：任务与日历
实现任务归档视图和时间线
实现待办清单管理
实现自研日历组件（月/周/日视图）
实现事件自动创建和提醒
Phase 4：优化
增量同步优化
虚拟滚动（大数据量）
PWA离线支持
深色模式完善

12. 测试与质量门禁
// 每个Store和Service必须包含基础测试
// 使用Vitest + React Testing Library

// 示例测试规范
describe('mailService', () => {
  it('should parse raw IMAP mail to Mail type', () => {
    const result = parseRawMail(mockRawMail);
    expect(result.subject).toBe('Test Subject');
    expect(result.bodyText).not.toContain('<html>');
  });
  
  it('should handle IMAP connection timeout', async () => {
    await expect(syncMails({ timeout: 1 })).rejects.toThrow('Timeout');
  });
});


提交前检查清单：
[ ] TypeScript编译无错误（npm run build通过）
[ ] ESLint无警告（npm run lint）
[ ] 核心逻辑有单元测试覆盖
[ ] 手动验证Chrome/Firefox最新版正常
[ ] 移动端375px宽度布局无溢出


