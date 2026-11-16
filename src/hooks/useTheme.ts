import { useEffect } from 'react';
import { useSettingsStore } from '@/stores/settingsStore';

/** 主题与字号同步：将设置中的主题应用到 documentElement（Tailwind dark class 策略），
 * 并根据 fontScale 调整根字号（Tailwind rem 单位随之全局缩放） */
export const useTheme = (): void => {
  const theme = useSettingsStore((s) => s.theme);
  const fontScale = useSettingsStore((s) => s.fontScale);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }, [theme]);

  useEffect(() => {
    const scale = Number.isFinite(fontScale) && fontScale > 0 ? fontScale : 1;
    document.documentElement.style.fontSize = `${16 * scale}px`;
  }, [fontScale]);
};
