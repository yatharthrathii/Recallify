import type { MetadataRoute } from 'next';
import { siteUrl } from '@/lib/site';

/** The public site is for indexing; the app behind sign in is not. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/today', '/decks', '/review', '/stats', '/settings', '/api/'],
    },
    sitemap: new URL('/sitemap.xml', siteUrl()).toString(),
  };
}
