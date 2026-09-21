import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Recallify',
    short_name: 'Recallify',
    description: 'A flashcard scheduler built on FSRS that shows its work.',
    start_url: '/today',
    display: 'standalone',
    // Blush paper, from @recallify/tokens. rgb() because hex literals are reserved
    // for the tokens package by the lint rule.
    background_color: 'rgb(238 226 220)',
    theme_color: 'rgb(238 226 220)',
    icons: [{ src: '/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' }],
  };
}
