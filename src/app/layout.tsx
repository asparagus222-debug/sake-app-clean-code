
import type { Metadata, Viewport } from 'next';
import './globals.css';
import {Toaster} from '@/components/ui/toaster';
import {FirebaseClientProvider} from '@/firebase/client-provider';
import {ThemeProvider} from '@/components/ThemeProvider';
import {TooltipProvider} from '@/components/ui/tooltip';

export const viewport: Viewport = {
  themeColor: '#130800',
};

export const metadata: Metadata = {
  title: '品飲帖',
  description: '記錄每一款清酒的獨特風味與回憶',
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: '品飲帖',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-TW" suppressHydrationWarning>
      <body className="font-body antialiased bg-background">
        <FirebaseClientProvider>
          <ThemeProvider>
            <TooltipProvider delayDuration={0}>
              {children}
              <Toaster />
            </TooltipProvider>
          </ThemeProvider>
        </FirebaseClientProvider>
      </body>
    </html>
  );
}
