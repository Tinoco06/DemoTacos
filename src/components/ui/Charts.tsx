import { useState } from 'react';
import { cn, fmtMoney } from '../../lib/format';

export interface ChartSeries {
  name: string;
  /** Clase de Tailwind para el relleno de la barra. */
  color: string;
}

export interface ChartGroup {
  label: string;
  title: string;
  values: number[];
}

function niceMax(value: number) {
  if (value <= 0) return 100;
  const power = 10 ** Math.floor(Math.log10(value));
  const step = [1, 2, 2.5, 5, 10].find((s) => s * power >= value) ?? 10;
  return step * power;
}

const compact = (n: number) => (n >= 1000 ? `${(n / 1000).toLocaleString('en-US', { maximumFractionDigits: 1 })} mil` : String(n));

/** Barras verticales, simples o agrupadas, con un único eje en lempiras. */
export function BarChart({ series, groups }: { series: ChartSeries[]; groups: ChartGroup[] }) {
  const [active, setActive] = useState<number | null>(null);
  const max = niceMax(Math.max(0, ...groups.flatMap((g) => g.values)));
  const ticks = [max, max / 2, 0];

  return (
    <div>
      {series.length > 1 && (
        <ul className="mb-4 flex flex-wrap gap-x-5 gap-y-1 text-sm text-ink">
          {series.map((s) => (
            <li key={s.name} className="flex items-center gap-2">
              <span className={cn('size-3 rounded-sm', s.color)} aria-hidden />
              {s.name}
            </li>
          ))}
        </ul>
      )}
      <div className="flex gap-3">
        <div className="flex h-52 w-12 shrink-0 flex-col justify-between text-right text-xs tabular-nums text-muted" aria-hidden>
          {ticks.map((t) => (
            <span key={t} className="-translate-y-1/2 first:translate-y-0 last:translate-y-0">
              {compact(t)}
            </span>
          ))}
        </div>
        <div className="min-w-0 flex-1">
          <div className="relative h-52">
            <div className="absolute inset-0 flex flex-col justify-between" aria-hidden>
              {ticks.map((t) => (
                <span key={t} className={cn('block h-px w-full', t === 0 ? 'bg-carbon/30' : 'bg-line')} />
              ))}
            </div>
            <div className="absolute inset-0 flex items-end" onMouseLeave={() => setActive(null)}>
              {groups.map((group, index) => (
                <div
                  key={group.title}
                  tabIndex={0}
                  onMouseEnter={() => setActive(index)}
                  onFocus={() => setActive(index)}
                  onBlur={() => setActive(null)}
                  aria-label={`${group.title}: ${series.map((s, i) => `${s.name} ${fmtMoney(group.values[i])}`).join(', ')}`}
                  className={cn('relative flex h-full flex-1 items-end justify-center gap-0.5 rounded-sm outline-offset-0', active === index && 'bg-carbon/5')}
                >
                  {group.values.map((value, i) => (
                    <span
                      key={series[i].name}
                      className={cn('block w-full max-w-4 rounded-t-[4px]', series[i].color)}
                      style={{ height: `${(value / max) * 100}%`, minHeight: value > 0 ? 2 : 0 }}
                    />
                  ))}
                  {active === index && (
                    <div
                      role="tooltip"
                      className={cn(
                        'pointer-events-none absolute top-1 z-10 w-max rounded-lg border border-line bg-white px-3 py-2 text-left text-xs shadow-md',
                        index < groups.length / 2 ? 'left-0' : 'right-0',
                      )}
                    >
                      <p className="mb-1 font-medium text-ink">{group.title}</p>
                      {series.map((s, i) => (
                        <p key={s.name} className="flex items-center gap-2 text-ink">
                          <span className={cn('size-2 rounded-sm', s.color)} aria-hidden />
                          <span className="text-muted">{s.name}</span>
                          <span className="ml-auto pl-3 font-medium tabular-nums">{fmtMoney(group.values[i])}</span>
                        </p>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
          <div className="mt-2 flex" aria-hidden>
            {groups.map((group) => (
              <span key={group.title} className="flex-1 overflow-hidden text-center text-[11px] leading-tight text-muted">
                {group.label.split(' ').map((part) => (
                  <span key={part} className="block">
                    {part}
                  </span>
                ))}
              </span>
            ))}
          </div>
        </div>
      </div>
      <details className="mt-4 text-sm">
        <summary className="inline-block rounded text-muted hover:text-ink">Ver datos en tabla</summary>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[320px] text-sm">
            <thead>
              <tr className="border-b border-line text-xs uppercase tracking-wide text-muted">
                <th className="py-2 text-left font-medium">Día</th>
                {series.map((s) => (
                  <th key={s.name} className="py-2 text-right font-medium">
                    {s.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {groups.map((group) => (
                <tr key={group.title} className="border-b border-line last:border-0">
                  <td className="py-2">{group.title}</td>
                  {group.values.map((value, i) => (
                    <td key={series[i].name} className="py-2 text-right tabular-nums">
                      {fmtMoney(value)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}

/** Lista de barras horizontales para repartos de un total. */
export function ShareBars({ items }: { items: Array<{ label: string; value: number; note?: string }> }) {
  const total = items.reduce((n, i) => n + i.value, 0);
  return (
    <ul className="flex flex-col gap-4">
      {items.map((item) => {
        const share = total > 0 ? (item.value / total) * 100 : 0;
        return (
          <li key={item.label}>
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <span className="font-medium text-ink">{item.label}</span>
              <span className="tabular-nums text-ink">
                {fmtMoney(item.value)} <span className="text-muted">· {share.toFixed(0)}%</span>
              </span>
            </div>
            <div className="mt-2 h-2 rounded-full bg-marfil">
              <div className="h-2 rounded-full bg-azul" style={{ width: `${share}%`, minWidth: item.value > 0 ? 4 : 0 }} />
            </div>
            {item.note && <p className="mt-1.5 text-xs text-muted">{item.note}</p>}
          </li>
        );
      })}
    </ul>
  );
}
