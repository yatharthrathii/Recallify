import Link from 'next/link';
import { cn } from '@/lib/cn';

/**
 * The mark is the product in eleven pixels: a memory decaying, a review
 * lifting it back, and the decay starting again, slower.
 */
export function Mark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden
      className={cn('size-6', className)}
      fill="none"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3 5c2.5 6 5 9.5 8.5 11" className="stroke-ink" />
      <path d="M11.5 16V6.5" className="stroke-ink-faint" strokeDasharray="1.5 3" />
      <path d="M11.5 6.5c3 3.5 6 6 9.5 7.5" className="stroke-accent" />
    </svg>
  );
}

export function Logo({ href = '/', className }: { href?: string; className?: string }) {
  return (
    <Link
      href={href}
      className={cn('inline-flex items-center gap-2 rounded-sm text-ink', className)}
      aria-label="Recallify"
    >
      <Mark />
      <span className="font-display text-[20px] font-semibold leading-none">
        Recallify
      </span>
    </Link>
  );
}
