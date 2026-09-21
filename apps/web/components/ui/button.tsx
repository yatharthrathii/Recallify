import Link from 'next/link';
import type { ComponentProps } from 'react';
import { cn } from '@/lib/cn';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'inverse';
type Size = 'sm' | 'md' | 'lg';

/**
 * One button. The primary is navy ink and turns raspberry under the pointer,
 * so the accent arrives as a response to the user rather than sitting on the
 * page. `inverse` is the same button for use on a block of brand colour.
 */
export function buttonStyles(variant: Variant = 'secondary', size: Size = 'md'): string {
  return cn(
    'inline-flex shrink-0 select-none items-center justify-center gap-2 whitespace-nowrap rounded-md font-medium',
    'transition-[transform,background-color,border-color,color,opacity,box-shadow] duration-200 ease-[var(--ease-out-quint)]',
    'active:scale-[0.96] disabled:pointer-events-none disabled:opacity-45',
    size === 'sm' && 'h-8 px-3 text-caption',
    size === 'md' && 'h-10 px-4 text-ui',
    size === 'lg' && 'h-12 px-6 text-body',
    variant === 'primary' &&
      'bg-ink text-paper hover:-translate-y-0.5 hover:bg-accent hover:shadow-[var(--shadow-lift)]',
    variant === 'inverse' &&
      'bg-on-brand text-brand hover:-translate-y-0.5 hover:shadow-[var(--shadow-lift)]',
    variant === 'secondary' &&
      'border border-line-strong bg-surface text-ink hover:-translate-y-0.5 hover:border-ink hover:bg-surface',
    variant === 'ghost' && 'text-ink-muted hover:bg-surface-alt hover:text-ink',
    variant === 'danger' &&
      'border border-danger/40 bg-surface text-danger hover:bg-danger/10',
  );
}

interface ButtonProps extends ComponentProps<'button'> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
}

export function Button({
  variant,
  size,
  loading = false,
  className,
  children,
  disabled,
  type = 'button',
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(buttonStyles(variant, size), className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading ? <Spinner /> : null}
      {children}
    </button>
  );
}

interface LinkButtonProps extends ComponentProps<typeof Link> {
  variant?: Variant;
  size?: Size;
}

export function LinkButton({ variant, size, className, ...rest }: LinkButtonProps) {
  return <Link className={cn(buttonStyles(variant, size), className)} {...rest} />;
}

export function Spinner({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 16 16"
      aria-hidden
      className={cn('size-3.5 animate-spin', className)}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    >
      <path d="M8 1.5a6.5 6.5 0 1 1-6.5 6.5" />
    </svg>
  );
}

interface IconButtonProps extends ComponentProps<'button'> {
  /** Required: an icon alone says nothing to a screen reader. */
  label: string;
}

export function IconButton({
  label,
  className,
  children,
  type = 'button',
  ...rest
}: IconButtonProps) {
  return (
    <button
      type={type}
      aria-label={label}
      title={label}
      className={cn(
        'inline-flex size-9 shrink-0 items-center justify-center rounded-md text-ink-muted',
        'transition-colors duration-[90ms] hover:bg-surface-alt hover:text-ink active:scale-[0.97]',
        'disabled:pointer-events-none disabled:opacity-45',
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}
