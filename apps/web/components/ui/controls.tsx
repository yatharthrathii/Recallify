'use client';

import * as DropdownPrimitive from '@radix-ui/react-dropdown-menu';
import * as SliderPrimitive from '@radix-ui/react-slider';
import * as TooltipPrimitive from '@radix-ui/react-tooltip';
import type { ComponentProps, ReactNode } from 'react';
import { cn } from '@/lib/cn';

// ---------------------------------------------------------------- menu

export const Menu = DropdownPrimitive.Root;
export const MenuTrigger = DropdownPrimitive.Trigger;

export function MenuContent({
  className,
  align = 'end',
  ...rest
}: ComponentProps<typeof DropdownPrimitive.Content>) {
  return (
    <DropdownPrimitive.Portal>
      <DropdownPrimitive.Content
        align={align}
        sideOffset={6}
        className={cn(
          'z-50 min-w-48 rounded-md border border-line-strong bg-surface p-1 shadow-[var(--shadow-md)] animate-pop-in',
          className,
        )}
        {...rest}
      />
    </DropdownPrimitive.Portal>
  );
}

export function MenuItem({
  className,
  danger = false,
  ...rest
}: ComponentProps<typeof DropdownPrimitive.Item> & { danger?: boolean }) {
  return (
    <DropdownPrimitive.Item
      className={cn(
        'flex h-9 cursor-default select-none items-center gap-2.5 rounded-sm px-2.5 text-ui outline-none',
        'data-[highlighted]:bg-surface-alt data-[disabled]:opacity-45',
        danger ? 'text-danger' : 'text-ink',
        className,
      )}
      {...rest}
    />
  );
}

export function MenuLabel({ children }: { children: ReactNode }) {
  return (
    <DropdownPrimitive.Label className="eyebrow px-2.5 py-1.5">
      {children}
    </DropdownPrimitive.Label>
  );
}

export function MenuSeparator() {
  return <DropdownPrimitive.Separator className="-mx-1 my-1 h-px bg-line" />;
}

// ---------------------------------------------------------------- tooltip

export const TooltipProvider = TooltipPrimitive.Provider;

export function Tooltip({ label, children }: { label: ReactNode; children: ReactNode }) {
  return (
    <TooltipPrimitive.Root delayDuration={250}>
      <TooltipPrimitive.Trigger asChild>{children}</TooltipPrimitive.Trigger>
      <TooltipPrimitive.Portal>
        <TooltipPrimitive.Content
          sideOffset={6}
          className="z-50 max-w-64 rounded-sm bg-ink px-2 py-1 text-caption text-paper animate-fade-in"
        >
          {label}
        </TooltipPrimitive.Content>
      </TooltipPrimitive.Portal>
    </TooltipPrimitive.Root>
  );
}

// ---------------------------------------------------------------- slider

interface SliderProps {
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
  onCommit?: (value: number) => void;
  label: string;
  disabled?: boolean;
}

export function Slider({
  value,
  min,
  max,
  step,
  onChange,
  onCommit,
  label,
  disabled,
}: SliderProps) {
  return (
    <SliderPrimitive.Root
      value={[value]}
      min={min}
      max={max}
      step={step}
      {...(disabled !== undefined ? { disabled } : {})}
      onValueChange={([next]) => next !== undefined && onChange(next)}
      onValueCommit={([next]) => next !== undefined && onCommit?.(next)}
      className="relative flex h-6 w-full touch-none select-none items-center"
    >
      <SliderPrimitive.Track className="relative h-1 grow rounded-full bg-line-strong">
        <SliderPrimitive.Range className="absolute h-full rounded-full bg-accent" />
      </SliderPrimitive.Track>
      <SliderPrimitive.Thumb
        aria-label={label}
        className={cn(
          'block size-5 rounded-full border-2 border-accent bg-surface shadow-[var(--shadow-sm)]',
          'transition-transform duration-[90ms] hover:scale-110 active:scale-95',
          'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
        )}
      />
    </SliderPrimitive.Root>
  );
}

// ---------------------------------------------------------------- segmented

interface SegmentedProps<T extends string> {
  value: T;
  onChange: (value: T) => void;
  options: readonly { value: T; label: string }[];
  label: string;
  className?: string;
}

/** A small either/or. Radio semantics, so arrow keys move between options. */
export function Segmented<T extends string>({
  value,
  onChange,
  options,
  label,
  className,
}: SegmentedProps<T>) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={cn(
        'inline-flex rounded-md border border-line-strong bg-surface-alt p-0.5',
        className,
      )}
      onKeyDown={(event) => {
        if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;
        event.preventDefault();
        const index = options.findIndex((o) => o.value === value);
        const step = event.key === 'ArrowRight' ? 1 : -1;
        const next = options[(index + step + options.length) % options.length];
        if (next) onChange(next.value);
      }}
    >
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={active}
            tabIndex={active ? 0 : -1}
            onClick={() => onChange(option.value)}
            className={cn(
              'h-8 flex-1 rounded-[6px] px-3 text-ui font-medium transition-colors duration-[90ms]',
              active
                ? 'bg-surface text-ink shadow-[var(--shadow-sm)]'
                : 'text-ink-muted hover:text-ink',
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
