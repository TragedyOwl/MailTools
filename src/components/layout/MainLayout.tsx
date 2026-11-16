import { Outlet } from 'react-router-dom';
import { MobileTabBar, Sidebar } from './Sidebar';
import { AiSummaryStatusBar } from './AiSummaryStatusBar';

/** 主布局：左侧导航 + 内容区（移动端底部 Tab），右下角全局挂载 AI 摘要状态条 */
export const MainLayout = () => (
  <div className="flex h-screen overflow-hidden">
    <Sidebar />
    <main className="flex min-w-0 flex-1 flex-col pb-16 md:pb-0">
      <Outlet />
    </main>
    <MobileTabBar />
    <AiSummaryStatusBar />
  </div>
);
