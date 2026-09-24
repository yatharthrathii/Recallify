import type { Metadata, Viewport } from 'next';
import { Bricolage_Grotesque, IBM_Plex_Mono, IBM_Plex_Sans } from 'next/font/google';
import { Providers } from '@/lib/providers';
import { THEME_BOOT_SCRIPT } from '@/lib/theme';
import './globals.css';

// Self-hosted by next/font: no render-blocking request to Google, no layout
// shift, and the CSS variables line up with the ones in globals.css.
const bricolage = Bricolage_Grotesque({
  subsets: ['latin'],
  variable: '--font-bricolage',
  display: 'swap',
  axes: ['opsz'],
});

const plexSans = IBM_Plex_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-plex-sans',
  display: 'swap',
});

const plexMono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-plex-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  title: { default: 'Recallify', template: '%s · Recallify' },
  description:
    'A flashcard scheduler built on FSRS that shows its work: the forgetting curve of every card, and why each one is due.',
  applicationName: 'Recallify',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  // Blush, from @recallify/tokens, and not conditioned on the system scheme:
  // the site is light by default whatever the system says, so the browser's
  // own chrome should match that rather than the operating system. Kept as
  // rgb() because the repo's lint rule reserves hex literals for tokens.
  themeColor: 'rgb(238 226 220)',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${bricolage.variable} ${plexSans.variable} ${plexMono.variable}`}
      // The boot script sets data-theme before hydration, so the attribute on
      // the server and the client legitimately differ.
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT_SCRIPT }} />
      </head>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
