'use client';

import Sidebar from './Sidebar';
import { useUI } from './UIProvider';

export function Shell({ children }: { children: React.ReactNode }) {
  const { focus, pathname, writingMode } = useUI();
  const isVideoDetail = /^\/videos\/[^/]+$/.test(pathname);
  const hideSidebar =
    (focus && pathname === '/videos') || isVideoDetail || writingMode;
  return (
    <div className="h-screen flex overflow-hidden">
      {!hideSidebar && <Sidebar />}
      <main className="flex-1 overflow-y-auto relative">{children}</main>
    </div>
  );
}
