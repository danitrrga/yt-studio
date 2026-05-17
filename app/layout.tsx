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
  description: 'Local production dashboard for YouTube videos — manage scripts, track pipeline stages, and ship faster.',
  openGraph: {
    title: 'yt/studio',
    description: 'Local production dashboard for YouTube videos — manage scripts, track pipeline stages, and ship faster.',
    images: [{ url: '/assets/og-social.png', width: 1280, height: 640 }],
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'yt/studio',
    description: 'Local production dashboard for YouTube videos — manage scripts, track pipeline stages, and ship faster.',
    images: ['/assets/og-social.png'],
  },
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
                  background: 'var(--bg-raised)',
                  border: '1px solid var(--line)',
                  color: 'var(--fg)',
                },
              }}
            />
          </TooltipProvider>
        </UIProvider>
      </body>
    </html>
  );
}
