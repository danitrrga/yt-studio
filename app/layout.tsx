import type { Metadata } from 'next';
import { Inter, JetBrains_Mono } from 'next/font/google';
import { Toaster } from 'sonner';
import { UIProvider } from '@/components/UIProvider';
import { TooltipProvider } from '@/components/ui/Tooltip';
import { Shell } from '@/components/Shell';
import { KeyboardShortcutsHost } from '@/components/KeyboardShortcutsHost';
import { ShortcutsDialog } from '@/components/ShortcutsDialog';
import { CommandPalette } from '@/components/CommandPalette';
import { QuickAddDialog } from '@/components/QuickAddDialog';
import { FocusPill } from '@/components/FocusPill';
import './globals.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });
const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '700'],
  variable: '--font-jetbrains',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'yt/studio',
  description: 'Local production dashboard for YouTube videos',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${inter.variable} ${jetbrainsMono.variable} dark`}>
      <body>
        <UIProvider>
          <TooltipProvider>
            <Shell>{children}</Shell>
            <KeyboardShortcutsHost />
            <CommandPalette />
            <QuickAddDialog />
            <ShortcutsDialog />
            <FocusPill />
            <Toaster
              theme="dark"
              position="bottom-right"
              toastOptions={{
                style: {
                  background: 'var(--color-surface-elevated)',
                  border: '1px solid var(--color-border)',
                  color: 'var(--color-fg)',
                },
              }}
            />
          </TooltipProvider>
        </UIProvider>
      </body>
    </html>
  );
}
