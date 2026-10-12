import type { ReactNode } from 'react';
import { CircleAlert, CircleCheck, Info, Minus, Plus, TriangleAlert, type LucideIcon } from 'lucide-react';
import { cn } from '../../lib/format';

/* Piezas pequeñas de presentación compartidas por todas las pantallas. */

export function PageHeader({ title, description, actions }: { title: string; description?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <h1 className="text-2xl font-semibold tracking-tight text-ink">{title}</h1>
        {description && <p className="mt-1 text-sm text-muted">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-3">{actions}</div>}
    </div>
  );
}

export function Card({ title, description, action, children, className, flush }: { title?: string; description?: ReactNode; action?: ReactNode; children: ReactNode; className?: string; flush?: boolean }) {
  return (
    <section className={cn('rounded-xl border border-line bg-white', className)}>
      {title && (
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-4">
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-ink">{title}</h2>
            {description && <p className="mt-0.5 text-sm text-muted">{description}</p>}
          </div>
          {action}
        </header>
      )}
      <div className={flush ? '' : 'p-5'}>{children}</div>
    </section>
  );
}

type Tone = 'neutral' | 'success' | 'warning' | 'danger' | 'info' | 'brand';

const BADGE: Record<Tone, string> = {
  neutral: 'bg-carbon/6 text-muted',
  success: 'bg-ok-soft text-ok',
  warning: 'bg-warn-soft text-warn',
  danger: 'bg-bad-soft text-bad',
  info: 'bg-azul-soft text-azul',
  brand: 'bg-crema-soft text-warn',
};

export function Badge({ tone = 'neutral', children }: { tone?: Tone; children: ReactNode }) {
  return <span className={cn('inline-flex h-6 items-center whitespace-nowrap rounded-md px-2 text-xs font-medium', BADGE[tone])}>{children}</span>;
}

export function StatCard({ label, value, hint, icon: Icon, tone = 'neutral' }: { label: string; value: ReactNode; hint?: ReactNode; icon: LucideIcon; tone?: 'neutral' | 'warning' }) {
  return (
    <div className="rounded-xl border border-line bg-white p-5">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-medium text-muted">{label}</span>
        <span className={cn('grid size-9 shrink-0 place-items-center rounded-lg', tone === 'warning' ? 'bg-warn-soft text-warn' : 'bg-marfil text-muted')}>
          <Icon className="size-5" aria-hidden />
        </span>
      </div>
      <div className="mt-3 text-2xl font-semibold tabular-nums tracking-tight text-ink">{value}</div>
      {hint && <div className="mt-1 text-sm text-muted">{hint}</div>}
    </div>
  );
}

const ALERT: Record<'info' | 'warning' | 'danger' | 'success', { box: string; icon: LucideIcon }> = {
  info: { box: 'border-azul/25 bg-azul-soft text-ink', icon: Info },
  warning: { box: 'border-warn/25 bg-warn-soft text-ink', icon: TriangleAlert },
  danger: { box: 'border-bad/25 bg-bad-soft text-ink', icon: CircleAlert },
  success: { box: 'border-ok/25 bg-ok-soft text-ink', icon: CircleCheck },
};
const ALERT_ICON = { info: 'text-azul', warning: 'text-warn', danger: 'text-bad', success: 'text-ok' };

export function Alert({ tone = 'info', children, action }: { tone?: keyof typeof ALERT; children: ReactNode; action?: ReactNode }) {
  const { box, icon: Icon } = ALERT[tone];
  return (
    <div className={cn('flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg border px-4 py-3 text-sm', box)}>
      <div className="flex min-w-0 flex-1 items-start gap-3">
        <Icon className={cn('mt-0.5 size-5 shrink-0', ALERT_ICON[tone])} aria-hidden />
        <div className="min-w-0 leading-relaxed">{children}</div>
      </div>
      {action}
    </div>
  );
}

export function EmptyState({ icon: Icon, title, description, action }: { icon: LucideIcon; title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center px-6 py-12 text-center">
      <span className="grid size-12 place-items-center rounded-full bg-marfil text-muted">
        <Icon className="size-6" aria-hidden />
      </span>
      <p className="mt-4 text-base font-medium text-ink">{title}</p>
      {description && <p className="mt-1 max-w-sm text-sm text-muted">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

interface SegmentedProps<T extends string> {
  value: T;
  onChange: (value: T) => void;
  options: Array<{ value: T; label: string; count?: number; icon?: LucideIcon }>;
  size?: 'md' | 'lg';
  disabled?: boolean;
  label: string;
  full?: boolean;
}

/** Selector de opciones excluyentes: pestañas, filtros y métodos. */
export function Segmented<T extends string>({ value, onChange, options, size = 'md', disabled, label, full }: SegmentedProps<T>) {
  return (
    <div role="tablist" aria-label={label} className={cn('no-scrollbar max-w-full overflow-x-auto rounded-lg border border-line bg-white p-1', full ? 'flex' : 'inline-flex')}>
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="tab"
            aria-selected={selected}
            disabled={disabled && !selected}
            onClick={() => onChange(option.value)}
            className={cn(
              'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md px-4 text-sm font-medium transition-colors disabled:opacity-40',
              size === 'lg' ? 'h-11' : 'h-9',
              full && 'flex-1',
              selected ? 'bg-carbon text-white' : 'text-muted hover:bg-carbon/5 hover:text-ink',
            )}
          >
            {option.icon && <option.icon className="size-4" aria-hidden />}
            {option.label}
            {option.count !== undefined && (
              <span className={cn('rounded px-1.5 text-xs tabular-nums', selected ? 'bg-white/20' : 'bg-carbon/8')}>{option.count}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}

export function Stepper({ value, onChange, max, label }: { value: number; onChange: (value: number) => void; max?: number; label: string }) {
  const button = 'grid size-11 shrink-0 place-items-center rounded-lg border border-line bg-white text-ink hover:bg-marfil disabled:opacity-40';
  return (
    <div className="flex items-center justify-between gap-1" role="group" aria-label={`Cantidad de ${label}`}>
      <button type="button" className={button} onClick={() => onChange(value - 1)} aria-label={`Quitar una unidad de ${label}`}>
        <Minus className="size-5" aria-hidden />
      </button>
      <span className="min-w-8 flex-1 text-center text-base font-semibold tabular-nums">{value}</span>
      <button type="button" className={button} onClick={() => onChange(value + 1)} disabled={max !== undefined && value >= max} aria-label={`Agregar una unidad de ${label}`}>
        <Plus className="size-5" aria-hidden />
      </button>
    </div>
  );
}

/** Fila "concepto — importe" para resúmenes de totales. */
export function SummaryRow({ label, value, strong, muted }: { label: ReactNode; value: ReactNode; strong?: boolean; muted?: boolean }) {
  return (
    <div className={cn('flex items-baseline justify-between gap-4', strong ? 'text-base font-semibold text-ink' : 'text-sm', muted ? 'text-muted' : 'text-ink')}>
      <span>{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  );
}
