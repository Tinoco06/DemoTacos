import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from 'react';
import { cn } from '../../lib/format';

const CONTROL =
  'h-11 w-full rounded-lg border border-line bg-white px-3 text-sm text-ink placeholder:text-muted/70 focus:border-azul focus:outline-none focus:ring-2 focus:ring-azul/25 disabled:bg-marfil disabled:text-muted';

interface FieldProps {
  label: string;
  hint?: ReactNode;
  error?: string | null;
  children: ReactNode;
  className?: string;
}

/** Etiqueta, control y mensaje de ayuda o error con espaciado uniforme. */
export function Field({ label, hint, error, children, className }: FieldProps) {
  return (
    <label className={cn('block', className)}>
      <span className="mb-1.5 block text-sm font-medium text-ink">{label}</span>
      {children}
      {error ? (
        <span className="mt-1.5 block text-xs text-bad">{error}</span>
      ) : hint ? (
        <span className="mt-1.5 block text-xs text-muted">{hint}</span>
      ) : null}
    </label>
  );
}

export function Input({ className, invalid, ...rest }: InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }) {
  return <input className={cn(CONTROL, invalid && 'border-bad', className)} aria-invalid={invalid || undefined} {...rest} />;
}

export function Select({ className, children, ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={cn(CONTROL, 'pr-8', className)} {...rest}>
      {children}
    </select>
  );
}

/** Campo de importe en lempiras. */
export function MoneyInput({ className, invalid, ...rest }: InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }) {
  return (
    <div className="relative">
      <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-muted">L</span>
      <input
        inputMode="decimal"
        autoComplete="off"
        placeholder="0.00"
        className={cn(CONTROL, 'pl-8 text-right tabular-nums', invalid && 'border-bad', className)}
        aria-invalid={invalid || undefined}
        {...rest}
      />
    </div>
  );
}

export function Checkbox({ label, hint, ...rest }: InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: string }) {
  return (
    <label className="flex min-h-11 cursor-pointer items-start gap-3 rounded-lg border border-line bg-white px-3 py-2.5">
      <input type="checkbox" className="mt-0.5 size-5 shrink-0 accent-frambuesa" {...rest} />
      <span>
        <span className="block text-sm font-medium text-ink">{label}</span>
        {hint && <span className="block text-xs text-muted">{hint}</span>}
      </span>
    </label>
  );
}
