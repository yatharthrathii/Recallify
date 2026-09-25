import { cookies } from 'next/headers';
import { SiteFooter } from '@/components/site/footer';
import { SiteHeader } from '@/components/site/header';

/**
 * The public site: the front page, the product pages and the legal ones. It
 * keeps its own header and footer, and it stays reachable after signing in,
 * because a product people can only see while signed out is a brochure.
 */
export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const signedIn = (await cookies()).has('rc_session');

  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader signedIn={signedIn} />
      <main className="flex-1">{children}</main>
      <SiteFooter signedIn={signedIn} />
    </div>
  );
}
