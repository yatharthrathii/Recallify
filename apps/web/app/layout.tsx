import type { Metadata } from 'next';
import { Fraunces, IBM_Plex_Mono, IBM_Plex_Sans } from 'next/font/google';
import './globals.css';

// Self-hosted by next/font: no render-blocking request to Google, no layout
// shift, and the CSS variables line up with the ones in globals.css.
const fraunces = Fraunces({
  subsets: ['latin'],
  variable: '--font-display',
  display: 'swap',
  axes: ['SOFT', 'WONK', 'opsz'],
});

const plexSans = IBM_Plex_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-ui',
  display: 'swap',
});

const plexMono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Recallify',
  description:
    'A spaced-repetition scheduler built on FSRS, with the algorithm made visible.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${fraunces.variable} ${plexSans.variable} ${plexMono.variable}`}
    >
      <body>{children}</body>
    </html>
  );
}
