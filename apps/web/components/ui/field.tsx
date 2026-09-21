import { useId, type ComponentProps, type ReactNode } from 'react';
import { cn } from '@/lib/cn';

const control = cn(
  'w-full rounded-md border border-line-strong bg-surface px-3 text-ui text-ink',
  'placeholder:text-ink-faint',
  'transition-colors duration-[90ms] hover:border-ink-faint',
  'focus-visible:border-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/25',
  'disabled:cursor-not-allowed disabled:bg-surface-alt disabled:text-ink-muted',
  'aria-[invalid=true]:border-danger aria-[invalid=true]:ring-danger/20',
);

interface FieldShellProps {
  label: string;
  hint?: ReactNode;
  error?: string | undefined;
  /** Shown beside the label, right aligned: a counter, a link. */
  aside?: ReactNode;
  children: (ids: {
    id: string;
    describedBy: string | undefined;
    invalid: boolean;
  }) => ReactNode;
}

/** Label, control, hint and error, wired together for screen readers. */
function FieldShell({ label, hint, error, aside, children }: FieldShellProps) {
  const id = useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const describedBy = error ? errorId : hint ? hintId : undefined;

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={id} className="text-ui font-medium text-ink">
          {label}
        </label>
        {aside ? <span className="text-caption text-ink-faint">{aside}</span> : null}
      </div>
      {children({ id, describedBy, invalid: Boolean(error) })}
      {error ? (
        <p id={errorId} role="alert" className="text-caption text-danger">
          {error}
        </p>
      ) : hint ? (
        <p id={hintId} className="text-caption text-ink-muted">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

type Shared = Pick<FieldShellProps, 'label' | 'hint' | 'error' | 'aside'>;

export function TextField({
  label,
  hint,
  error,
  aside,
  className,
  ...rest
}: Shared & ComponentProps<'input'>) {
  return (
    <FieldShell label={label} hint={hint} error={error} aside={aside}>
      {({ id, describedBy, invalid }) => (
        <input
          id={id}
          aria-describedby={describedBy}
          aria-invalid={invalid || undefined}
          className={cn(control, 'h-10', className)}
          {...rest}
        />
      )}
    </FieldShell>
  );
}

export function TextArea({
  label,
  hint,
  error,
  aside,
  className,
  ...rest
}: Shared & ComponentProps<'textarea'>) {
  return (
    <FieldShell label={label} hint={hint} error={error} aside={aside}>
      {({ id, describedBy, invalid }) => (
        <textarea
          id={id}
          aria-describedby={describedBy}
          aria-invalid={invalid || undefined}
          className={cn(control, 'min-h-24 resize-y py-2 leading-6', className)}
          {...rest}
        />
      )}
    </FieldShell>
  );
}

/** First message for a field from an ApiError's fieldErrors. */
export function fieldError(
  errors: Record<string, string[]> | undefined,
  name: string,
): string | undefined {
  return errors?.[name]?.[0];
}
