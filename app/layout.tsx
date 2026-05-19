import type { Metadata } from 'next';
import { Toaster } from 'sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import './globals.css';

export const metadata: Metadata = {
  title: 'Snip — AI Image to SVG',
  description: 'Turn any image into a manufacturing-ready SVG with AI.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-background">
        <TooltipProvider delayDuration={150}>
          {children}
          <Toaster richColors position="top-right" />
        </TooltipProvider>
      </body>
    </html>
  );
}
