import type { AppState, CashSession, Order, OrderItem, PayMethod, Product } from '../types';
import { addDays, endOfDay, fmtDayLabel, round2, startOfDay } from './format';

/* Cálculos derivados del estado. Los indicadores y reportes se obtienen siempre
   de las operaciones registradas, nunca de cifras fijas. */

export const sumBy = <T,>(list: T[], pick: (item: T) => number) =>
  round2(list.reduce((total, item) => total + pick(item), 0));

export const itemsSubtotal = (items: OrderItem[]) => sumBy(items, (i) => i.price * i.qty);
export const itemsCount = (items: OrderItem[]) => items.reduce((n, i) => n + i.qty, 0);
export const orderSubtotal = (order: Order) => itemsSubtotal(order.items);
export const orderTotal = (order: Order) =>
  round2(Math.max(0, orderSubtotal(order) - order.discount) + order.shipping);

export const serviceLabel = (order: Pick<Order, 'service' | 'tableName'>) =>
  order.service === 'mesa' ? order.tableName ?? 'Mesa' : 'Domicilio';

export const METHOD_LABEL: Record<PayMethod, string> = {
  efectivo: 'Efectivo',
  transferencia: 'Transferencia',
  credito: 'Crédito',
};

export function inRange(iso: string, from: Date, to: Date) {
  const t = new Date(iso).getTime();
  return t >= from.getTime() && t <= to.getTime();
}

export const openOrders = (state: AppState) =>
  state.orders.filter((o) => o.status === 'abierta').sort((a, b) => a.createdAt.localeCompare(b.createdAt));

export const openOrderForTable = (state: AppState, tableId: string) =>
  state.orders.find((o) => o.status === 'abierta' && o.tableId === tableId);

export type StockStatus = 'ok' | 'bajo' | 'agotado';
export function stockStatus(product: Product): StockStatus {
  if (!product.trackStock) return 'ok';
  if (product.stock <= 0) return 'agotado';
  return product.stock <= product.minStock ? 'bajo' : 'ok';
}

export function clientBalance(state: AppState, clientId: string) {
  const mine = state.payments.filter((p) => p.clientId === clientId);
  const charged = sumBy(mine.filter((p) => p.kind === 'venta' && p.method === 'credito'), (p) => p.amount);
  const paid = sumBy(mine.filter((p) => p.kind === 'abono'), (p) => p.amount);
  return round2(charged - paid);
}

export const totalCreditBalance = (state: AppState) =>
  sumBy(state.clients, (c) => clientBalance(state, c.id));

export interface PeriodSummary {
  sales: number;
  salesCount: number;
  /** Dinero efectivamente recibido: ventas en efectivo y transferencia más abonos. */
  received: number;
  receivedCash: number;
  receivedTransfer: number;
  expenses: number;
  byMethod: Record<PayMethod, number>;
  abonos: number;
}

export function periodSummary(state: AppState, from: Date, to: Date): PeriodSummary {
  const sold = state.orders.filter((o) => o.status === 'cobrada' && o.closedAt && inRange(o.closedAt, from, to));
  const pays = state.payments.filter((p) => inRange(p.date, from, to));
  const salePays = pays.filter((p) => p.kind === 'venta');
  const byMethod: Record<PayMethod, number> = {
    efectivo: sumBy(salePays.filter((p) => p.method === 'efectivo'), (p) => p.amount),
    transferencia: sumBy(salePays.filter((p) => p.method === 'transferencia'), (p) => p.amount),
    credito: sumBy(salePays.filter((p) => p.method === 'credito'), (p) => p.amount),
  };
  const money = pays.filter((p) => p.method !== 'credito');
  return {
    sales: sumBy(sold, orderTotal),
    salesCount: sold.length,
    received: sumBy(money, (p) => p.amount),
    receivedCash: sumBy(money.filter((p) => p.method === 'efectivo'), (p) => p.amount),
    receivedTransfer: sumBy(money.filter((p) => p.method === 'transferencia'), (p) => p.amount),
    expenses: sumBy(state.expenses.filter((e) => inRange(e.date, from, to)), (e) => e.amount),
    byMethod,
    abonos: sumBy(pays.filter((p) => p.kind === 'abono'), (p) => p.amount),
  };
}

export interface DayPoint {
  date: Date;
  label: string;
  sales: number;
  expenses: number;
}

export function dailySeries(state: AppState, from: Date, to: Date): DayPoint[] {
  const points: DayPoint[] = [];
  for (let day = startOfDay(from); day.getTime() <= to.getTime() && points.length < 62; day = addDays(day, 1)) {
    const summary = periodSummary(state, day, endOfDay(day));
    points.push({ date: day, label: fmtDayLabel(day), sales: summary.sales, expenses: summary.expenses });
  }
  return points;
}

export const currentSession = (state: AppState) => state.cashSessions.find((s) => s.closedAt === null);

export interface SessionSummary {
  opening: number;
  cashSales: number;
  cashAbonos: number;
  entries: number;
  exits: number;
  cashExpenses: number;
  expected: number;
  /** Referencia informativa: no forman parte del efectivo físico. */
  transfers: number;
  creditSales: number;
  /** Ventas cobradas durante la sesión, por método. Cada venta se cuenta una sola vez. */
  sales: Record<PayMethod, number> & { total: number };
}

export function sessionSummary(state: AppState, session: CashSession): SessionSummary {
  const pays = state.payments.filter((p) => p.sessionId === session.id && p.method === 'efectivo');
  const moves = state.cashMovements.filter((m) => m.sessionId === session.id);
  const from = new Date(session.openedAt);
  const to = session.closedAt ? new Date(session.closedAt) : new Date(8640000000000000);
  const during = state.payments.filter((p) => inRange(p.date, from, to));
  const salesDuring = during.filter((p) => p.kind === 'venta');
  const opening = session.openingAmount;
  const cashSales = sumBy(pays.filter((p) => p.kind === 'venta'), (p) => p.amount);
  const cashAbonos = sumBy(pays.filter((p) => p.kind === 'abono'), (p) => p.amount);
  const entries = sumBy(moves.filter((m) => m.type === 'entrada'), (m) => m.amount);
  const exits = sumBy(moves.filter((m) => m.type === 'salida'), (m) => m.amount);
  const cashExpenses = sumBy(state.expenses.filter((e) => e.sessionId === session.id), (e) => e.amount);
  return {
    opening,
    cashSales,
    cashAbonos,
    entries,
    exits,
    cashExpenses,
    expected: round2(opening + cashSales + cashAbonos + entries - exits - cashExpenses),
    transfers: sumBy(during.filter((p) => p.method === 'transferencia'), (p) => p.amount),
    creditSales: sumBy(during.filter((p) => p.method === 'credito' && p.kind === 'venta'), (p) => p.amount),
    sales: {
      efectivo: sumBy(salesDuring.filter((p) => p.method === 'efectivo'), (p) => p.amount),
      transferencia: sumBy(salesDuring.filter((p) => p.method === 'transferencia'), (p) => p.amount),
      credito: sumBy(salesDuring.filter((p) => p.method === 'credito'), (p) => p.amount),
      total: sumBy(salesDuring, (p) => p.amount),
    },
  };
}
