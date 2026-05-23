import './globals.css';
import type { Metadata } from 'next';
import Link from 'next/link';
import { GeistSans } from 'geist/font/sans';
import { ConfigBanner } from '@/components/ConfigBanner';
import { NavLinks } from '@/components/NavLinks';

export const metadata: Metadata = {
  title: 'Job Applicant Assistant',
  description: 'Personal AI-powered job search OS',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={GeistSans.variable}>
      <body className="font-sans">
        <div className="min-h-screen flex flex-col">
          <header className="sticky top-0 z-30 border-b border-ink/10 bg-paper/80 backdrop-blur">
            <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
              <Link href="/" className="font-semibold tracking-tight">JAA</Link>
              <NavLinks />
            </div>
          </header>
          <ConfigBanner />
          <main className="mx-auto w-full max-w-6xl flex-1 px-4">{children}</main>
          <footer className="border-t border-ink/10 px-4 py-4 text-center text-xs text-ink/45">
            Single-user MVP · No auth · Configure env vars to enable features
          </footer>
        </div>
      </body>
    </html>
  );
}
