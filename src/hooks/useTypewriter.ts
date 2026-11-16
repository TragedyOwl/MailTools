import { useEffect, useState } from 'react';

interface TypewriterResult {
  /** 当前应显示的文本子串 */
  displayed: string;
  /** 是否已播放完整段文本 */
  done: boolean;
}

/**
 * 打字机效果 Hook：将完整文本按固定节奏逐字释放，模拟模型实时输出。
 * text 变化时自动从头重新播放；播放完毕后停止计时器，避免空转。
 *
 * @param text         待逐字展示的完整文本
 * @param charsPerTick 每个计时周期释放的字符数（越大越快）
 * @param intervalMs   计时周期（毫秒）
 */
export const useTypewriter = (text: string, charsPerTick = 6, intervalMs = 16): TypewriterResult => {
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!text) {
      setCount(0);
      return;
    }
    setCount(0);
    const timer = window.setInterval(() => {
      setCount((prev) => {
        const next = prev + charsPerTick;
        if (next >= text.length) {
          window.clearInterval(timer);
          return text.length;
        }
        return next;
      });
    }, intervalMs);
    return () => window.clearInterval(timer);
  }, [text, charsPerTick, intervalMs]);

  return { displayed: text.slice(0, count), done: count >= text.length };
};
