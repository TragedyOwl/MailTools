/**
 * HTML / 纯文本互转工具（写信正文基于 HTML 编辑，摘要与发送降级需要纯文本）。
 * htmlToText 不依赖 DOM，可在 Node 测试环境运行。
 */

/** 转义 HTML 特殊字符，防止邮件署名/引用头中的内容被当作标签解析 */
export const escapeHtml = (text: string): string =>
  text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

/** 纯文本 → 安全 HTML（转义 + 换行转段落） */
export const textToHtml = (text: string): string =>
  escapeHtml(text)
    .split(/\r?\n/)
    .map((line) => `<p>${line || '<br>'}</p>`)
    .join('');

/** HTML → 纯文本（去标签、保留换行结构、还原基础实体） */
export const htmlToText = (html: string): string =>
  html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<(ul|ol)[^>]*>/gi, '\n')
    .replace(/<li[^>]*>/gi, '• ')
    .replace(/<\/(p|div|li|tr|blockquote|ul|ol|h[1-6])>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, '\n\n')
    .trim();

/**
 * 将邮件 HTML 包装为完整文档并注入样式，用于 iframe srcDoc 渲染。
 * - 注入 color-scheme / 基础排版，保证浅色与深色模式下的可读性
 * - 深色模式用 !important 覆盖邮件自带的内联背景/字色（多数邮件硬编码白底黑字）
 * - rootFontSize 传入当前全局根字号，使正文随字号档位缩放
 */
export const wrapMailHtml = (html: string, options: { dark: boolean; rootFontSize?: number }): string => {
  const darkCss = options.dark
    ? `
      html, body { background: #111827 !important; color: #e5e7eb !important; color-scheme: dark; }
      * { background-color: transparent !important; }
      body, div, p, span, td, th, li, blockquote, a, h1, h2, h3, h4, h5, h6, label, strong, em, b, i, u, font {
        color: inherit !important;
      }
      a { color: #60a5fa !important; }
      img { max-width: 100%; height: auto; }
      hr { border-color: #374151 !important; }
      table { border-color: #374151 !important; }`
    : `
      img { max-width: 100%; height: auto; }`;

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  html, body { margin: 0; padding: 0; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif;
    font-size: ${options.rootFontSize ?? 14}px;
    line-height: 1.7;
    color: #111827;
    word-break: break-word;
    padding: 12px 16px;
    box-sizing: border-box;
  }
  a { color: #2563eb; }
  ${darkCss}
</style>
</head>
<body>${html}</body>
</html>`;
};
