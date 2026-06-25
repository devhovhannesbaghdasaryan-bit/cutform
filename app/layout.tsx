import type { Metadata } from 'next';
import { Toaster } from 'sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { getLocaleForFormatting } from '@/lib/i18n';
import { getRequestLocale } from '@/lib/i18n-server';
import './globals.css';

export const metadata: Metadata = {
  title: 'Snip - Wooden Marketplace',
  description: 'Buy crafted wooden products and generate custom laser-cut designs with AI.',
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getRequestLocale();

  return (
    <html lang={getLocaleForFormatting(locale)}>
      <body className="min-h-screen bg-background">
        <TooltipProvider delayDuration={150}>
          {children}
          <Toaster richColors position="top-right" />
        </TooltipProvider>
      </body>
    </html>
  );
}
