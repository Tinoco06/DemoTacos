import type { AppState, Order, OrderItem, Payment, PaymentPart, ServiceType, StockMovement } from '../types';
import { clientBalance, currentSession, itemsSubtotal, openOrderForTable, orderTotal } from '../lib/calc';
import { fmtMoney, fmtOrderNumber, round2, uid } from '../lib/format';
import { SimError } from './errors';

/* Funciones de simulación de pedidos y cobros. Reciben el estado y devuelven uno
   nuevo; en el sistema definitivo se sustituyen por llamadas a la API. */

export interface SubmitOrderInput {
  orderId: string | null;
  service: ServiceType;
  tableId: string | null;
  customer: string;
  shipping: number;
  items: OrderItem[];
  user: string;
}

export interface SubmitOrderResult {
  order: Order;
  /** Productos enviados a cocina en esta confirmación. */
  sentItems: OrderItem[];
  isAddition: boolean;
  sentAt: string;
}

function mergeItems(current: OrderItem[], added: OrderItem[]): OrderItem[] {
  const result = current.map((i) => ({ ...i }));
  for (const item of added) {
    const same = result.find((i) => i.productId === item.productId && i.note === item.note && i.price === item.price);
    if (same) same.qty += item.qty;
    else result.push({ ...item });
  }
  return result;
}

export function submitOrder(state: AppState, input: SubmitOrderInput): [AppState, SubmitOrderResult] {
  const items = input.items.filter((i) => i.qty > 0).map((i) => ({ ...i, note: i.note.trim() }));
  if (items.length === 0) throw new SimError('Agregue al menos un producto al pedido.');

  const needed = new Map<string, number>();
  for (const i of items) needed.set(i.productId, (needed.get(i.productId) ?? 0) + i.qty);
  for (const [productId, qty] of needed) {
    const product = state.products.find((p) => p.id === productId);
    if (!product || !product.active) throw new SimError('Uno de los productos ya no está disponible.');
    if (product.trackStock && product.stock < qty) {
      throw new SimError(`Stock insuficiente de ${product.name}. Disponibles: ${product.stock}.`);
    }
  }

  let existing = input.orderId ? state.orders.find((o) => o.id === input.orderId && o.status === 'abierta') : undefined;
  if (input.orderId && !existing) throw new SimError('La cuenta ya no está abierta.');
  if (!existing && input.service === 'mesa') {
    const table = state.tables.find((t) => t.id === input.tableId);
    if (!table || !table.active) throw new SimError('Seleccione una mesa disponible.');
    existing = openOrderForTable(state, table.id);
  }
  if (input.shipping < 0) throw new SimError('El costo de envío no puede ser negativo.');
  if (!existing && input.service === 'domicilio' && input.customer.trim().length < 3) {
    throw new SimError('Ingrese la dirección de entrega del pedido a domicilio.');
  }

  const now = new Date().toISOString();
  const table = state.tables.find((t) => t.id === input.tableId);
  const order: Order = existing
    ? { ...existing, items: mergeItems(existing.items, items) }
    : {
        id: uid('ord'),
        number: state.nextOrderNumber,
        service: input.service,
        tableId: input.service === 'mesa' ? table!.id : null,
        tableName: input.service === 'mesa' ? table!.name : null,
        customer: input.service === 'domicilio' ? input.customer.trim() : '',
        items,
        shipping: input.service === 'domicilio' ? round2(input.shipping) : 0,
        discount: 0,
        status: 'abierta',
        createdAt: now,
        closedAt: null,
        waiter: input.user,
      };

  const movements: StockMovement[] = [];
  const products = state.products.map((p) => {
    const qty = needed.get(p.id);
    if (!qty || !p.trackStock) return p;
    const stock = p.stock - qty;
    movements.push({
      id: uid('stk'),
      productId: p.id,
      productName: p.name,
      type: 'venta',
      delta: -qty,
      resultingStock: stock,
      date: now,
      note: `Pedido ${fmtOrderNumber(order.number)}`,
      user: input.user,
    });
    return { ...p, stock };
  });

  const next: AppState = {
    ...state,
    products,
    stockMovements: [...movements, ...state.stockMovements],
    orders: existing ? state.orders.map((o) => (o.id === order.id ? order : o)) : [...state.orders, order],
    nextOrderNumber: existing ? state.nextOrderNumber : state.nextOrderNumber + 1,
  };
  return [next, { order, sentItems: items, isAddition: Boolean(existing), sentAt: now }];
}

export function cancelOrder(state: AppState, input: { orderId: string; reason: string; user: string }): AppState {
  const order = state.orders.find((o) => o.id === input.orderId);
  if (!order || order.status !== 'abierta') throw new SimError('Solo se pueden cancelar cuentas abiertas.');
  const now = new Date().toISOString();

  const returned = new Map<string, number>();
  for (const i of order.items) returned.set(i.productId, (returned.get(i.productId) ?? 0) + i.qty);
  const movements: StockMovement[] = [];
  const products = state.products.map((p) => {
    const qty = returned.get(p.id);
    if (!qty || !p.trackStock) return p;
    const stock = p.stock + qty;
    movements.push({
      id: uid('stk'),
      productId: p.id,
      productName: p.name,
      type: 'devolucion',
      delta: qty,
      resultingStock: stock,
      date: now,
      note: `Cancelación del pedido ${fmtOrderNumber(order.number)}`,
      user: input.user,
    });
    return { ...p, stock };
  });

  return {
    ...state,
    products,
    stockMovements: [...movements, ...state.stockMovements],
    orders: state.orders.map((o) =>
      o.id === order.id ? { ...o, status: 'cancelada', closedAt: now, cancelReason: input.reason.trim() } : o,
    ),
  };
}

export interface ChargeInput {
  orderId: string;
  discount: number;
  parts: PaymentPart[];
}

export function chargeOrder(state: AppState, input: ChargeInput): [AppState, Order] {
  const order = state.orders.find((o) => o.id === input.orderId);
  if (!order || order.status !== 'abierta') throw new SimError('La cuenta ya no está abierta.');
  if (input.discount < 0 || input.discount > itemsSubtotal(order.items)) {
    throw new SimError('El descuento no puede superar el subtotal.');
  }

  const now = new Date().toISOString();
  const charged: Order = { ...order, discount: round2(input.discount), status: 'cobrada', closedAt: now };
  const total = orderTotal(charged);
  const parts = input.parts.filter((p) => p.amount > 0);
  const assigned = round2(parts.reduce((n, p) => n + p.amount, 0));
  if (Math.abs(assigned - total) > 0.004) {
    throw new SimError(`Los pagos suman ${fmtMoney(assigned)} y el total es ${fmtMoney(total)}.`);
  }

  const session = currentSession(state);
  const payments: Payment[] = parts.map((part) => {
    if (part.method === 'efectivo' && !session) throw new SimError('Abra la caja para recibir efectivo.');
    if (part.method === 'credito') {
      const client = state.clients.find((c) => c.id === part.clientId);
      if (!client) throw new SimError('Seleccione el cliente para la venta al crédito.');
      if (!client.creditAuthorized) throw new SimError(`${client.name} no tiene crédito autorizado.`);
    }
    return {
      id: uid('pay'),
      date: now,
      method: part.method,
      amount: round2(part.amount),
      kind: 'venta',
      orderId: order.id,
      clientId: part.method === 'credito' ? part.clientId ?? null : null,
      sessionId: part.method === 'efectivo' ? session!.id : null,
    };
  });

  return [
    {
      ...state,
      orders: state.orders.map((o) => (o.id === order.id ? charged : o)),
      payments: [...state.payments, ...payments],
    },
    charged,
  ];
}

export function registerAbono(state: AppState, input: { clientId: string; amount: number; method: 'efectivo' | 'transferencia' }): AppState {
  const client = state.clients.find((c) => c.id === input.clientId);
  if (!client) throw new SimError('Cliente no encontrado.');
  const balance = clientBalance(state, client.id);
  if (!(input.amount > 0)) throw new SimError('Ingrese un importe mayor que cero.');
  if (input.amount > balance + 0.004) throw new SimError(`El abono no puede superar el saldo de ${fmtMoney(balance)}.`);
  const session = currentSession(state);
  if (input.method === 'efectivo' && !session) throw new SimError('Abra la caja para recibir efectivo.');
  return {
    ...state,
    payments: [
      ...state.payments,
      {
        id: uid('pay'),
        date: new Date().toISOString(),
        method: input.method,
        amount: round2(input.amount),
        kind: 'abono',
        orderId: null,
        clientId: client.id,
        sessionId: input.method === 'efectivo' ? session!.id : null,
      },
    ],
  };
}
