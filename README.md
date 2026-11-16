# MailTools

智能邮件助手：基于 React + TypeScript + Vite 的本地优先邮件管理应用，支持 AI 摘要、任务归档、待办清单与日历提醒。

## 功能

- **邮件同步与收发**：通过 IMAP 拉取邮件，通过 SMTP 发送邮件，支持附件与富文本正文
- **AI 摘要**：对邮件生成核心内容、关键要点与待办事项，支持流式输出
- **任务归档**：按主题相似度自动把邮件归入任务，跟踪任务时间线
- **待办清单**：自动提取待办，支持完成状态与截止时间
- **日历与提醒**：从邮件和待办生成日程，支持浏览器提醒
- **本地优先**：邮件、任务、待办、联系人等数据存放在 IndexedDB，离线可用
- **本地加密**：邮箱密码与 AI API Key 使用 AES 加密后存入 LocalStorage

## 技术栈

- React 18 + TypeScript + Vite
- Tailwind CSS
- Zustand 状态管理
- Dexie / IndexedDB 本地存储
- imapflow、mailparser、nodemailer
- Vercel Serverless Functions（`api/` 目录）

## 快速开始

```bash
npm install
cp .env.example .env
npm run dev
```

启动后打开 Vite 输出的本地地址，在「设置」页填写邮箱服务器与 AI 服务信息即可使用。

## 环境变量

服务端 AI 配置均为可选，用户也可在「设置」页填写，页面配置优先级更高：

| 变量 | 说明 |
| --- | --- |
| `AI_API_URL` | OpenAI 兼容接口地址，例如 `https://api.example.com/v1` |
| `AI_API_KEY` | API Key，仅存放于服务端环境变量 |
| `AI_MODEL` | 模型名称 |

请勿把真实 `.env` 文件提交到仓库；`.gitignore` 已忽略 `.env`、`.env.local` 等文件。

## 常用脚本

```bash
npm run dev      # 本地开发
npm run build    # 类型检查 + 生产构建
npm run preview  # 预览生产构建
npm test         # 运行单元测试
npm run lint     # ESLint 检查
```

## 目录结构

```text
api/          Vercel Serverless 接口（AI 摘要、邮件同步/发送）
server/       IMAP、SMTP、AI 核心逻辑
src/          前端源码
  components/ 通用、邮件、任务、待办、日历组件
  pages/      页面
  services/   业务服务
  stores/     Zustand 状态
  db/         IndexedDB 数据访问
  utils/      工具函数与演示数据
  types/      TypeScript 类型
public/       静态资源
```

## 数据与隐私

- 邮件数据仅保存在浏览器本地 IndexedDB，不会上传到第三方服务
- 除用户主动配置的 AI 摘要接口外，不向外部服务发送邮件内容
- 邮箱密码与 API Key 在写入本地存储前会加密
- 示例数据中的邮箱、姓名均为占位内容，不对应真实账号

## 说明

项目默认的 IMAP/SMTP 主机使用 `example.com` 占位，请按自己的邮箱服务商填写。部署到 Vercel 时，`vercel.json` 已配置接口超时与 SPA 路由重写。
