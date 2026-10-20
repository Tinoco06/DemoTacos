import type { AppState, Client, DiningTable, Expense, ExpenseCategory, Product } from '../types';
import { currentSession, openOrderForTable, openOrders, sessionSummary } from '../lib/calc';
import { endOfDay, round2, startOfDay, uid } from '../lib/format';
import { SimError } from './errors';

/* Simulación de inventario, caja, gastos, catálogo, mesas y clientes. */

// ---------- Inventario ----------

export interface StockInput {
  productId: string;
  type: 'entrada' | 'salida' | 'ajuste';
  /** Entrada y salida: unidades que se mueven. Ajuste: existencia real contada. */
  qty: number;
  note: string;
  user: string;
}

export function adjustStock(state: AppState, input: StockInput): AppState {
  const product = state.products.find((p) => p.id === input.productId);
  if (!product || !product.trackStock) throw new SimError('Este producto no controla existencias.');
  if (!Number.isInteger(input.qty) || input.qty < 0) throw new SimError('Ingrese una cantidad entera válida.');
  if (input.type !== 'ajuste' && input.qty === 0) throw new SimError('La cantidad debe ser mayor que cero.');
  if (input.type === 'salida' && input.qty > product.stock) {
    throw new SimError(`Solo hay ${product.stock} unidades de ${product.name}.`);
  }
  const stock = input.type === 'entrada' ? product.stock + input.qty : input.type === 'salida' ? product.stock - input.qty : input.qty;
  if (stock === product.stock) throw new SimError('El ajuste no cambia la existencia actual.');
  return {
    ...state,
    products: state.products.map((p) => (p.id === product.id ? { ...p, stock } : p)),
    stockMovements: [
      {
        id: uid('stk'),
        productId: product.id,
        productName: product.name,
        type: input.type,
        delta: stock - product.stock,
        resultingStock: stock,
        date: new Date().toISOString(),
        note: input.note.trim(),
        user: input.user,
      },
      ...state.stockMovements,
    ],
  };
}

// ---------- Caja ----------

export function openCash(state: AppState, input: { amount: number; user: string }): AppState {
  if (currentSession(state)) throw new SimError('Ya hay una caja abierta.');
  if (!(input.amount >= 0)) throw new SimError('Ingrese un saldo inicial válido.');
  return {
    ...state,
    cashSessions: [
      ...state.cashSessions,
      {
        id: uid('caja'),
        openedAt: new Date().toISOString(),
        closedAt: null,
        openingAmount: round2(input.amount),
        expectedAmount: null,
        countedAmount: null,
        user: input.user,
        note: '',
      },
    ],
  };
}

export function closeCash(state: AppState, input: { counted: number; note: string }): AppState {
  const session = currentSession(state);
  if (!session) throw new SimError('No hay una caja abierta.');
  // Una cuenta abierta todavía tiene consumo por cobrar. Las ventas al crédito ya finalizadas no bloquean.
  const pending = openOrders(state).length;
  if (pending > 0) {
    throw new SimError(`Hay ${pending === 1 ? '1 cuenta abierta pendiente' : `${pending} cuentas abiertas pendientes`} de cobro. Finalícelas antes de cerrar la caja.`);
  }
  if (!(input.counted >= 0)) throw new SimError('Ingrese el efectivo declarado.');
  const expected = sessionSummary(state, session).expected;
  return {
    ...state,
    cashSessions: state.cashSessions.map((s) =>
      s.id === session.id
        ? { ...s, closedAt: new Date().toISOString(), expectedAmount: expected, countedAmount: round2(input.counted), note: input.note.trim() }
        : s,
    ),
  };
}

export function addCashMovement(state: AppState, input: { type: 'entrada' | 'salida'; amount: number; description: string }): AppState {
  const session = currentSession(state);
  if (!session) throw new SimError('Abra la caja para registrar movimientos.');
  if (!(input.amount > 0)) throw new SimError('Ingrese un importe mayor que cero.');
  if (!input.description.trim()) throw new SimError('Describa el motivo del movimiento.');
  if (input.type === 'salida' && input.amount > sessionSummary(state, session).expected) {
    throw new SimError('La salida supera el efectivo esperado en caja.');
  }
  return {
    ...state,
    cashMovements: [
      ...state.cashMovements,
      { id: uid('mov'), sessionId: session.id, type: input.type, amount: round2(input.amount), description: input.description.trim(), date: new Date().toISOString() },
    ],
  };
}

// ---------- Gastos ----------

export interface ExpenseInput {
  description: string;
  category: ExpenseCategory;
  date: Date;
  amount: number;
  method: Expense['method'];
}

export function addExpense(state: AppState, input: ExpenseInput): AppState {
  if (!input.description.trim()) throw new SimError('Describa el gasto.');
  if (!(input.amount > 0)) throw new SimError('Ingrese un importe mayor que cero.');
  const now = new Date();
  if (input.date.getTime() > endOfDay(now).getTime()) throw new SimError('La fecha no puede ser futura.');
  const isToday = startOfDay(input.date).getTime() === startOfDay(now).getTime();
  const session = currentSession(state);
  const date = isToday ? now : new Date(startOfDay(input.date).getTime() + 12 * 3600000);
  return {
    ...state,
    expenses: [
      ...state.expenses,
      {
        id: uid('exp'),
        description: input.description.trim(),
        category: input.category,
        date: date.toISOString(),
        amount: round2(input.amount),
        method: input.method,
        // Un gasto en efectivo del día sale de la caja abierta.
        sessionId: input.method === 'efectivo' && isToday && session ? session.id : null,
      },
    ],
  };
}

export const deleteExpense = (state: AppState, id: string): AppState => ({
  ...state,
  expenses: state.expenses.filter((e) => e.id !== id),
});

// ---------- Productos ----------

export interface ProductInput {
  id: string | null;
  name: string;
  categoryId: Product['categoryId'];
  price: number;
  active: boolean;
  fulfillment: Product['fulfillment'];
  trackStock: boolean;
  stock: number;
  minStock: number;
  user: string;
}

export function saveProduct(state: AppState, input: ProductInput): AppState {
  const name = input.name.trim();
  if (!name) throw new SimError('Ingrese el nombre del producto.');
  if (!(input.price > 0)) throw new SimError('Ingrese un precio mayor que cero.');
  if (state.products.some((p) => p.id !== input.id && p.name.toLowerCase() === name.toLowerCase())) {
    throw new SimError('Ya existe un producto con ese nombre.');
  }
  const price = round2(input.price);
  const now = new Date().toISOString();

  if (!input.id) {
    const product: Product = {
      id: uid('prod'),
      name,
      categoryId: input.categoryId,
      price,
      active: input.active,
      fulfillment: input.fulfillment,
      trackStock: input.trackStock,
      stock: input.trackStock ? Math.max(0, Math.trunc(input.stock)) : 0,
      minStock: input.trackStock ? Math.max(0, Math.trunc(input.minStock)) : 0,
      demo: true,
    };
    return { ...state, products: [...state.products, product] };
  }

  const current = state.products.find((p) => p.id === input.id);
  if (!current) throw new SimError('Producto no encontrado.');
  const updated: Product = {
    ...current,
    name,
    categoryId: input.categoryId,
    price,
    active: input.active,
    fulfillment: input.fulfillment,
    trackStock: input.trackStock,
    minStock: input.trackStock ? Math.max(0, Math.trunc(input.minStock)) : 0,
    // Un precio confirmado por el administrador deja de ser provisional.
    provisional: price !== current.price ? false : current.provisional,
  };
  return {
    ...state,
    products: state.products.map((p) => (p.id === updated.id ? updated : p)),
    priceHistory:
      price !== current.price
        ? [{ id: uid('prc'), productId: current.id, productName: name, oldPrice: current.price, newPrice: price, date: now, user: input.user }, ...state.priceHistory]
        : state.priceHistory,
  };
}

export const setProductActive = (state: AppState, input: { id: string; active: boolean }): AppState => ({
  ...state,
  products: state.products.map((p) => (p.id === input.id ? { ...p, active: input.active } : p)),
});

// ---------- Mesas ----------

export function saveTable(state: AppState, input: { id: string | null; name: string }): AppState {
  const name = input.name.trim();
  if (!name) throw new SimError('Ingrese el nombre de la mesa.');
  if (state.tables.some((t) => t.id !== input.id && t.name.toLowerCase() === name.toLowerCase())) {
    throw new SimError('Ya existe una mesa con ese nombre.');
  }
  if (!input.id) {
    const table: DiningTable = { id: uid('mesa'), name, active: true };
    return { ...state, tables: [...state.tables, table] };
  }
  return {
    ...state,
    tables: state.tables.map((t) => (t.id === input.id ? { ...t, name } : t)),
    orders: state.orders.map((o) => (o.tableId === input.id && o.status === 'abierta' ? { ...o, tableName: name } : o)),
  };
}

export function setTableActive(state: AppState, input: { id: string; active: boolean }): AppState {
  if (!input.active && openOrderForTable(state, input.id)) {
    throw new SimError('La mesa tiene una cuenta abierta. Cóbrela o cancélela antes de desactivarla.');
  }
  return { ...state, tables: state.tables.map((t) => (t.id === input.id ? { ...t, active: input.active } : t)) };
}

// ---------- Clientes ----------

export function saveClient(state: AppState, input: Omit<Client, 'id'> & { id: string | null }): AppState {
  const name = input.name.trim();
  if (!name) throw new SimError('Ingrese el nombre del cliente.');
  const data = { name, contact: input.contact.trim(), phone: input.phone.trim(), creditAuthorized: input.creditAuthorized };
  if (!input.id) return { ...state, clients: [...state.clients, { id: uid('cli'), ...data }] };
  return { ...state, clients: state.clients.map((c) => (c.id === input.id ? { ...c, ...data } : c)) };
}
