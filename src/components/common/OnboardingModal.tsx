import { CalendarCheck, Layers, Mail, Sparkles } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useSettingsStore } from '@/stores/settingsStore';
import { Modal } from '@/components/common/Modal';
import { Button } from '@/components/common/Button';

const FEATURES = [
  {
    icon: Mail,
    color: 'bg-sky-50 text-sky-600 dark:bg-sky-950 dark:text-sky-400',
    title: '定时同步邮件',
    description: '配置企业 IMAP 邮箱，自动定时拉取最新邮件，增量同步快速省流',
  },
  {
    icon: Sparkles,
    color: 'bg-violet-50 text-violet-600 dark:bg-violet-950 dark:text-violet-400',
    title: 'AI 标准摘要',
    description: '每封邮件自动生成核心内容、关键要点与行动项，30 秒掌握要点',
  },
  {
    icon: Layers,
    color: 'bg-amber-50 text-amber-600 dark:bg-amber-950 dark:text-amber-400',
    title: '任务自动归档',
    description: '同一任务的往来邮件智能聚合，完整时间线确保任务连续可追溯',
  },
  {
    icon: CalendarCheck,
    color: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400',
    title: '待办与日历提醒',
    description: '重要行动项自动生成待办清单，一键插入日历，浏览器通知准时提醒',
  },
] as const;

/** 首次启动引导：功能介绍 + 进入配置 */
export const OnboardingModal = () => {
  const navigate = useNavigate();

  const handleFinish = (toSettings: boolean): void => {
    useSettingsStore.getState().setOnboarded();
    if (toSettings) navigate('/settings');
  };

  return (
    <Modal open title="欢迎使用智能邮件助手" onClose={() => handleFinish(false)}>
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-3">
          {FEATURES.map((feature) => (
            <div key={feature.title} className="flex items-start gap-3">
              <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${feature.color}`}>
                <feature.icon size={16} />
              </div>
              <div>
                <p className="text-sm font-medium text-ink dark:text-gray-100">{feature.title}</p>
                <p className="mt-0.5 text-xs leading-5 text-ink-muted dark:text-gray-500">{feature.description}</p>
              </div>
            </div>
          ))}
        </div>

        <p className="rounded-lg bg-black/[0.03] px-3 py-2 text-[11px] leading-4 text-ink-muted dark:bg-white/5 dark:text-gray-500">
          所有数据均保存在本地浏览器，邮箱密码与 API Key 经 AES-256 加密存储，不会上传到任何第三方服务器。
        </p>

        <div className="flex items-center justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={() => handleFinish(false)}>
            先看看
          </Button>
          <Button size="sm" onClick={() => handleFinish(true)}>
            立即配置邮箱
          </Button>
        </div>
      </div>
    </Modal>
  );
};
