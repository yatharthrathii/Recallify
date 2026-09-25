import type { MetadataRoute } from 'next';
import { siteUrl } from '@/lib/site';

const PAGES: ReadonlyArray<[path: string, priority: number]> = [
  ['/', 1],
  ['/how-it-works', 0.8],
  ['/android', 0.6],
  ['/about', 0.6],
  ['/register', 0.5],
  ['/login', 0.3],
  ['/terms', 0.2],
  ['/privacy', 0.2],
];

export default function sitemap(): MetadataRoute.Sitemap {
  const origin = siteUrl();
  return PAGES.map(([path, priority]) => ({
    url: new URL(path, origin).toString(),
    priority,
    changeFrequency: 'monthly',
  }));
}
