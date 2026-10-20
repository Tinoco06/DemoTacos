export const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

export const fmtMoney = (n: number) =>
  `L ${round2(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/** Convierte el texto de un campo de importe en número; NaN si no es válido. */
export function parseAmount(value: string): number {
  const text = value.replace(/,/g, '').trim();
  if (text === '') return NaN;
  const n = Number(text);
  return Number.isFinite(n) ? round2(n) : NaN;
}

const dateFmt = new Intl.DateTimeFormat('es-HN', { day: '2-digit', month: '2-digit', year: 'numeric' });
const timeFmt = new Intl.DateTimeFormat('es-HN', { hour: '2-digit', minute: '2-digit', hour12: true });
const longFmt = new Intl.DateTimeFormat('es-HN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
const dayFmt = new Intl.DateTimeFormat('es-HN', { weekday: 'short' });
const fullFmt = new Intl.DateTimeFormat('es-HN', { day: 'numeric', month: 'long', year: 'numeric' });
const monthFmt = new Intl.DateTimeFormat('es-HN', { month: 'short' });

export const fmtDate = (iso: string | Date) => dateFmt.format(new Date(iso));
export const fmtTime = (iso: string | Date) => timeFmt.format(new Date(iso));
export const fmtDateTime = (iso: string | Date) => `${fmtDate(iso)} ${fmtTime(iso)}`;
export const fmtLongDate = (d: Date) => {
  const text = longFmt.format(d);
  return text.charAt(0).toUpperCase() + text.slice(1);
};
/** «18 de octubre de 2026» */
export const fmtFullDate = (iso: string | Date) => fullFmt.format(new Date(iso));
/** «18 oct 2026» */
export const fmtShortDate = (iso: string | Date) => {
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, '0')} ${monthFmt.format(d).replace('.', '')} ${d.getFullYear()}`;
};
export const fmtDayLabel = (d: Date) =>
  `${dayFmt.format(d).replace('.', '')} ${String(d.getDate()).padStart(2, '0')}`;

export const fmtOrderNumber = (n: number) => `#${String(n).padStart(4, '0')}`;

export function startOfDay(d: Date): Date {
  const r = new Date(d);
  r.setHours(0, 0, 0, 0);
  return r;
}

export function endOfDay(d: Date): Date {
  const r = new Date(d);
  r.setHours(23, 59, 59, 999);
  return r;
}

export function addDays(d: Date, days: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + days);
  return r;
}

/** La semana comienza el lunes. */
export function startOfWeek(d: Date): Date {
  const r = startOfDay(d);
  const offset = (r.getDay() + 6) % 7;
  return addDays(r, -offset);
}

export function toDateInput(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

export function fromDateInput(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

export const cn = (...parts: Array<string | false | null | undefined>) => parts.filter(Boolean).join(' ');

let counter = 0;
export const uid = (prefix: string) =>
  `${prefix}-${Date.now().toString(36)}${(counter++).toString(36)}${Math.random().toString(36).slice(2, 6)}`;
