import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import Providers from '@/components/Providers';

// ── next/font/google — zero render-blocking ───────────────────────────────────
// Fonts are self-hosted at build time by Next.js; no external network round-trip.
// `display: swap` ensures text is visible immediately with the fallback font
// while Inter loads asynchronously — no render-blocking, no layout shift.
const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  // Only load the weights actually used in globals.css
  weight: ['300', '400', '500', '600', '700', '800'],
  // Apply as a CSS variable so globals.css can reference --font-inter if needed
  variable: '--font-inter',
  // Next.js will automatically preload these and add `<link rel="preload">` tags
  preload: true,
});

export const metadata: Metadata = {
  title: 'InsureCRM — Insurance Agent Management',
  description:
    'Professional CRM for insurance agents to manage customer policies across Motor, Medical, Fire, and Life insurance types.',
  // Ensure correct canonical URL — eliminates http→https redirect for crawlers
  metadataBase: new URL(
    process.env.NEXTAUTH_URL ?? 'https://insurance-crm.vercel.app'
  ),
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={inter.variable}>
      {/*
        `inter.className` applies the loaded font-family directly to <body>.
        This is the Next.js recommended approach — no @import in CSS required.
      */}
      <body className={inter.className}>
        {/*
          Preconnect hints for origins that are still fetched at runtime:
          - MongoDB / Vercel serverless calls are same-origin (no hint needed)
          - next-auth makes same-origin API calls (no hint needed)
          No external origins remain after removing the Google Fonts @import,
          so no <link rel="preconnect"> tags are required here.
        */}
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
