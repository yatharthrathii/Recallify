/**
 * Facts about the site that more than one page needs. The maker's GitHub
 * profile is the one outbound link the site carries: a visitor who wants to
 * know who is behind the product can find them, and everything else stays
 * about the product.
 */
export const MAKER = 'Yatharth Rathi';
export const GITHUB = 'https://github.com/yatharthrathii';

/**
 * The canonical origin, for metadata that has to be absolute. Vercel exposes
 * the production domain to every build without configuration; a custom domain
 * is set with NEXT_PUBLIC_SITE_URL and wins.
 */
export function siteUrl(): URL {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL;
  if (explicit) return new URL(explicit);
  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  return new URL(vercel ? `https://${vercel}` : 'http://localhost:3000');
}
