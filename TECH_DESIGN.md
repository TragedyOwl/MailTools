# 智能邮件助手 - 技术设计文档

┌─────────────────────────────────────────────────────────────┐
│                        用户浏览器                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐  │
│  │   React UI   │  │  Zustand     │  │   IndexedDB      │  │
│  │  (Components)│  │  (State)     │  │  (Mail Storage)  │  │
│  └──────┬───────┘  └──────┬───────┘  └──────────────────┘  │
│         │                 │                                 │
│  ┌──────▼─────────────────▼───────┐  ┌──────────────────┐  │
│  │      Service Layer             │  │   LocalStorage   │  │
│  │  (mailService/aiService/...)   │  │  (Config/Tokens) │  │
│  └──────┬─────────────────────────┘  └──────────────────┘  │
└─────────┼───────────────────────────────────────────────────┘
          │
          ▼
┌─────────────────────────────────────────────────────────────┐
│                    Vercel Edge Functions                    │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐  │
│  │  IMAP Proxy  │  │  AI Proxy    │  │  Auth Middleware │  │
│  │  (/api/mail) │  │  (/api/ai)   │  │                  │  │
│  └──────────────┘  └──────────────┘  └──────────────────┘  │
└─────────────────────────────────────────────────────────────┘
          │
    ┌─────┴─────┐
    ▼           ▼
┌────────┐  ┌──────────┐
│IMAP    │  │  AI API  │
│Server  │  │(Kimi/   │
│        │  │OpenAI)   │
└────────┘  └──────────┘


架构说明：
纯前端应用（React + Vite）部署于Vercel
浏览器无法直接连接IMAP（CORS/TLS限制），通过Vercel Edge Function代理
AI API Key通过环境变量配置在Edge Function中，避免前端暴露
邮件数据存储于IndexedDB，配置存储于LocalStorage

2. 技术栈
| 层级      | 技术                           | 用途         |
| ------- | ---------------------------- | ---------- |
| 前端框架    | React 18 + TypeScript 5.x    | UI构建       |
| 构建工具    | Vite 5.x                     | 开发/构建      |
| 样式      | Tailwind CSS 3.x + shadcn/ui | UI样式与组件    |
| 状态管理    | Zustand 4.x                  | 全局状态       |
| 路由      | React Router 6.x             | 页面导航       |
| 数据存储    | IndexedDB (via idb-keyval)   | 邮件/任务/日历数据 |
| 配置存储    | LocalStorage + crypto-js     | 用户配置/加密凭据  |
| HTTP客户端 | Axios                        | API请求      |
| 日期处理    | date-fns                     | 日期计算       |
| 日历组件    | @schedule-x 或自研              | 日历视图       |
| IMAP协议  | imapflow (Edge Function)     | IMAP通信     |
| AI接口    | OpenAI-compatible API        | 摘要生成       |


3. 项目结构
smart-mail-assistant/
├── api/                          # Vercel Serverless Functions
│   ├── mail/
│   │   ├── fetch.ts              # 拉取邮件
│   │   ├── sync.ts               # 增量同步
│   │   └── send.ts               # 发送邮件（预留）
│   └── ai/
│       └── summarize.ts          # AI摘要代理
├── public/
├── src/
│   ├── components/               # UI组件
│   │   ├── layout/               # 布局组件
│   │   │   ├── Sidebar.tsx
│   │   │   ├── Header.tsx
│   │   │   └── MainLayout.tsx
│   │   ├── mail/                 # 邮件相关
│   │   │   ├── MailList.tsx
│   │   │   ├── MailCard.tsx
│   │   │   ├── MailDetail.tsx
│   │   │   ├── MailSummary.tsx
│   │   │   └── MailFilter.tsx
│   │   ├── task/                 # 任务归档
│   │   │   ├── TaskCard.tsx
│   │   │   ├── TaskTimeline.tsx
│   │   │   ├── TaskMergeModal.tsx
│   │   │   └── TaskList.tsx
│   │   ├── todo/                 # 待办清单
│   │   │   ├── TodoList.tsx
│   │   │   ├── TodoItem.tsx
│   │   │   └── TodoExtractor.tsx
│   │   ├── calendar/             # 日历
│   │   │   ├── CalendarView.tsx
│   │   │   ├── MonthView.tsx
│   │   │   ├── WeekView.tsx
│   │   │   ├── DayView.tsx
│   │   │   └── EventModal.tsx
│   │   └── common/               # 通用组件
│   │       ├── LoadingSpinner.tsx
│   │       ├── EmptyState.tsx
│   │       ├── Badge.tsx
│   │       └── ConfirmModal.tsx
│   ├── pages/                    # 页面
│   │   ├── InboxPage.tsx
│   │   ├── TaskPage.tsx
│   │   ├── TodoPage.tsx
│   │   ├── CalendarPage.tsx
│   │   └── SettingsPage.tsx
│   ├── hooks/                    # 自定义Hooks
│   │   ├── useMailSync.ts        # 邮件同步逻辑
│   │   ├── useAISummary.ts       # AI摘要调用
│   │   ├── useTaskGroup.ts       # 任务分组
│   │   ├── useTodoManager.ts     # 待办管理
│   │   ├── useCalendarEvents.ts  # 日历事件
│   │   └── useLocalStorage.ts    # 本地存储
│   ├── stores/                   # Zustand状态
│   │   ├── mailStore.ts
│   │   ├── taskStore.ts
│   │   ├── todoStore.ts
│   │   ├── calendarStore.ts
│   │   └── settingsStore.ts
│   ├── services/                 # 服务层
│   │   ├── mailService.ts        # 邮件API封装
│   │   ├── aiService.ts          # AI API封装
│   │   ├── taskService.ts        # 任务逻辑
│   │   └── calendarService.ts    # 日历逻辑
│   ├── db/                       # 数据层
│   │   ├── indexedDB.ts          # IndexedDB初始化
│   │   ├── mailRepository.ts     # 邮件CRUD
│   │   ├── taskRepository.ts     # 任务CRUD
│   │   ├── todoRepository.ts     # 待办CRUD
│   │   └── eventRepository.ts    # 事件CRUD
│   ├── utils/                    # 工具函数
│   │   ├── crypto.ts             # 加密/解密
│   │   ├── stringSimilarity.ts   # 字符串相似度
│   │   ├── mailParser.ts         # 邮件内容解析
│   │   ├── dateExtractor.ts      # 日期提取
│   │   └── constants.ts          # 常量
│   ├── types/                    # TypeScript类型
│   │   ├── mail.ts
│   │   ├── task.ts
│   │   ├── todo.ts
│   │   ├── calendar.ts
│   │   └── index.ts
│   ├── App.tsx
│   ├── main.tsx
│   └── index.css
├── .env.example
├── vercel.json
├── vite.config.ts
├── tailwind.config.js
└── package.json

4. 数据模型设计
4.1 邮件 (Mail)
interface Mail {
  id: string;                    // UUID
  uid: number;                   // IMAP UID
  messageId: string;             // Message-ID头
  subject: string;
  from: { name: string; email: string };
  to: { name: string; email: string }[];
  cc?: { name: string; email: string }[];
  date: string;                  // ISO 8601
  bodyText: string;              // 纯文本内容
  bodyHtml?: string;             // HTML内容
  attachments: Attachment[];
  flags: string[];               // ['\\Seen', '\\Flagged']
  inReplyTo?: string;            // 回复的Message-ID
  references?: string[];         // 引用链
  folder: string;                // 'INBOX'
  
  // AI生成字段
  summary?: MailSummary;
  category: 'notification' | 'task' | 'meeting' | 'approval' | 'other';
  priority: 'high' | 'medium' | 'low';
  
  // 关联字段
  taskId?: string;
  
  createdAt: string;
  syncedAt: string;
}


4.2 AI摘要 (MailSummary)
interface MailSummary {
  coreContent: string;           // 核心内容（1-3句）
  keyPoints: string[];           // 关键信息点列表
  actionItems: ActionItem[];     // 提取的待办
  sentiment: 'positive' | 'neutral' | 'negative';
  generatedAt: string;
}

interface ActionItem {
  content: string;
  deadline?: string;
  assignee?: string;
  confidence: number;            // AI置信度 0-1
}


4.3 任务 (Task)
interface Task {
  id: string;                    // TASK-{timestamp}-{random}
  title: string;                 // 任务标题（取首封邮件主题简化）
  status: 'active' | 'completed' | 'archived';
  mailIds: string[];             // 关联邮件ID数组（按时间排序）
  summary?: string;              // AI合并摘要
  category: string;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
  
  // 统计
  mailCount: number;
  unreadCount: number;
}

4.4 待办 (Todo)
interface Todo {
  id: string;
  content: string;
  completed: boolean;
  priority: 'high' | 'medium' | 'low';
  deadline?: string;
  sourceMailId?: string;         // 来源邮件
  sourceTaskId?: string;         // 来源任务
  calendarEventId?: string;      // 关联日历事件
  createdAt: string;
  completedAt?: string;
}

4.5 日历事件 (CalendarEvent)
interface CalendarEvent {
  id: string;
  title: string;
  description?: string;
  startTime: string;             // ISO 8601
  endTime: string;
  allDay: boolean;
  type: 'meeting' | 'deadline' | 'reminder' | 'other';
  color: string;                 // hex color
  sourceMailId?: string;
  sourceTodoId?: string;
  reminderMinutes: number[];     // [15, 60] 提前提醒分钟
  createdAt: string;
}

5. 核心模块设计
1. 前端调用 /api/mail/sync
2. Edge Function连接IMAP服务器
3. 获取UID列表，与本地最大UID比对
4. 下载新邮件（限制单次50封）
5. 解析邮件内容（plain text优先，HTML转text）
6. 返回前端，存入IndexedDB
7. 触发AI摘要生成队列

API设计：
// POST /api/mail/sync
Request: {
  host: "imap.example.com",
  port: 993,
  tls: true,
  user: string,
  password: string,        // 前端AES加密后传输，Edge Function解密
  lastUid?: number        // 增量同步
}

Response: {
  mails: RawMail[],
  lastUid: number,
  hasMore: boolean
}

5.2 AI摘要引擎
提示词模板（Prompt）：
const SUMMARY_PROMPT = `请对以下邮件内容进行标准化摘要。要求：
1. 核心内容用1-3句话概括
2. 提取所有关键信息点（时间/地点/人物/要求）
3. 识别是否有需要执行的事项（Action Items），包含截止日期
4. 判断紧急程度（高/中/低）和类别（通知/任务/会议/审批/其他）
5. 输出严格JSON格式

邮件主题：{subject}
发件人：{from}
内容：{body}

输出格式：
{
  "coreContent": "string",
  "keyPoints": ["string"],
  "actionItems": [{"content": "string", "deadline": "YYYY-MM-DD|null", "assignee": "string|null"}],
  "priority": "high|medium|low",
  "category": "notification|task|meeting|approval|other"
}`;

调用流程：
邮件入库后，加入摘要队列
批量发送（每次5封）至AI API
解析返回JSON，更新邮件记录
如有actionItems，自动创建待办

5.3 任务关联算法
function groupMailsIntoTasks(mails: Mail[]): Task[] {
  // 1. 基于引用关系（最准确）
  const referenceGraph = buildReferenceGraph(mails);
  
  // 2. 基于主题相似度（补充）
  const similarityGroups = groupBySimilarity(mails, 0.8);
  
  // 3. 合并两组结果
  const mergedGroups = mergeGroups(referenceGraph, similarityGroups);
  
  // 4. 为每个组创建/更新任务
  return mergedGroups.map(group => createOrUpdateTask(group));
}

// 字符串相似度使用 Dice Coefficient（兼顾性能与准确度）
function calculateSimilarity(s1: string, s2: string): number {
  const clean = (s: string) => s.replace(/^(Re:|Fwd:)\s*/i, '').toLowerCase();
  return diceCoefficient(clean(s1), clean(s2));
}

5.4 日历引擎
自研日历核心逻辑：
使用date-fns进行日期计算
月视图：生成6x7网格（42天），包含上月/当月/下月日期
周视图：7列时间网格，支持全天事件
日视图：24小时时间轴
事件碰撞检测：同一时间段多事件并列显示
事件自动创建：
function createEventFromMail(mail: Mail): Partial<CalendarEvent> | null {
  const dates = extractDates(mail.bodyText + mail.subject);
  if (dates.length === 0) return null;
  
  return {
    title: mail.subject,
    startTime: dates[0],
    endTime: addHours(dates[0], 1),
    type: mail.category === 'meeting' ? 'meeting' : 'reminder',
    sourceMailId: mail.id
  };
}

6. 状态管理方案 (Zustand)
// stores/mailStore.ts
interface MailState {
  mails: Mail[];
  isSyncing: boolean;
  lastSyncAt: string | null;
  
  // Actions
  syncMails: () => Promise<void>;
  addMails: (mails: Mail[]) => void;
  updateMail: (id: string, patch: Partial<Mail>) => void;
  markAsRead: (id: string) => void;
}

// stores/taskStore.ts
interface TaskState {
  tasks: Task[];
  activeTaskId: string | null;
  
  groupMails: (mailIds: string[]) => void;
  mergeTasks: (taskIds: string[]) => void;
  updateTask: (id: string, patch: Partial<Task>) => void;
}

7. 存储策略
| 数据类型     | 存储方式                 | 原因          |
| -------- | -------------------- | ----------- |
| 邮箱配置     | LocalStorage (AES加密) | 小数据量，需持久化   |
| API Key  | LocalStorage (AES加密) | 敏感信息需加密     |
| 邮件内容     | IndexedDB            | 大数据量，可能达MB级 |
| 任务/待办/事件 | IndexedDB            | 结构化查询需求     |
| UI状态     | Zustand (内存)         | 无需持久化       |
| 缓存摘要     | IndexedDB            | 避免重复调用AI    |

IndexedDB Schema：
const DB_NAME = 'SmartMailDB';
const DB_VERSION = 1;

const stores = {
  mails: '++id, uid, taskId, date, category, priority',
  tasks: '++id, status, updatedAt',
  todos: '++id, completed, deadline, sourceTaskId',
  events: '++id, startTime, endTime, type'
};

8. 安全设计
凭据加密
// utils/crypto.ts
const SECRET_KEY = deriveKeyFromUserPassword(userPassword); // 用户主密码派生
export const encrypt = (text: string) => AES.encrypt(text, SECRET_KEY).toString();
export const decrypt = (cipher: string) => AES.decrypt(cipher, SECRET_KEY).toString(Utf8);

API代理
AI API Key仅存在于Vercel环境变量
Edge Function验证请求来源（CORS + 简单Token）
请求日志脱敏

传输安全
所有API强制HTTPS
IMAP over TLS (端口993)
SMTP over SSL (端口465)

9. 部署配置
{
  "functions": {
    "api/**/*.ts": {
      "maxDuration": 30
    }
  },
  "crons": [
    {
      "path": "/api/mail/scheduled-sync",
      "schedule": "*/15 * * * *"
    }
  ]
}

环境变量：
# .env.local
AI_API_KEY=sk-xxx
AI_API_URL=https://api.moonshot.cn/v1
AI_MODEL=kimi-latest




