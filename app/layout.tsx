import type { Metadata } from 'next';
import { SpeedInsights } from '@vercel/speed-insights/next';
import { getTranslations } from 'next-intl/server';
import { Toaster } from 'sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { getLocaleForFormatting } from '@/lib/i18n';
import { getRequestLocale } from '@/lib/i18n-server';
import './globals.css';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations();
  return {
    title: t('landing.siteTitle'),
    description: t('landing.siteDescription'),
    icons: {
      icon: [
        { url: '/favicon-32x32.png', type: 'image/png', sizes: '32x32' },
        { url: '/icon.png', type: 'image/png', sizes: '512x512' },
      ],
      apple: [{ url: '/apple-touch-icon.png', type: 'image/png', sizes: '180x180' }],
    },
  };
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getRequestLocale();

  return (
    <html lang={getLocaleForFormatting(locale)} suppressHydrationWarning>
      <head>
        <script
          // biome-ignore lint/security/noDangerouslySetInnerHtml: static inline theme bootstrap script; no user input
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('snip-theme');var d=t==='dark'||(!t&&matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.classList.toggle('dark',d);document.documentElement.dataset.theme=d?'dark':'light'}catch(e){}})()`,
          }}
        />
      </head>
      <body className="min-h-screen bg-background">
        <TooltipProvider delayDuration={150}>
          {children}
          <Toaster richColors position="top-right" />
        </TooltipProvider>
        <SpeedInsights />
      </body>
    </html>
  );
}
