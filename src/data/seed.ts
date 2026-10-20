import type {
  AppState,
  OrderOperation,
  CashMovement,
  CashSession,
  Expense,
  ExpenseCategory,
  Order,
  OrderItem,
  PayMethod,
  Payment,
  PriceChange,
  ServiceType,
  StockMovement,
} from '../types';
import { clientBalance, orderTotal, sessionSummary } from '../lib/calc';
import { addDays, round2, startOfDay } from '../lib/format';
import { INITIAL_CLIENTS, INITIAL_PRODUCTS, INITIAL_TABLES, USERS } from './catalog';

// Se incrementa cuando cambia la forma de los datos, para descartar lo guardado en el navegador.
export const STATE_VERSION = 3;

const DEMO_ADDRESSES = ['Col. Las Palmas, casa 12', 'Barrio El Centro, frente al parque', 'Res. Los Pinos, bloque C', 'Col. San José, calle principal'];

/** Generador pseudoaleatorio con semilla fija: la demo siempre muestra el mismo historial. */
function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const WEIGHTED: Array<[string, number]> = [
  ['tacos-2', 5], ['tacos-3', 6], ['torta', 3], ['quesadilla', 3],
  ['carne-asada', 4], ['pollo-asado', 4], ['chuleta', 2], ['carne-mixta', 3],
  ['coca-desechable', 5], ['coca-vidrio', 4], ['coca-2l', 1], ['agua-bote', 2],
  ['salva-vida', 4], ['barena', 3], ['imperial', 2], ['corona', 2], ['heineken', 1], ['cubetazo-nac', 1],
];
const WEIGHT_TOTAL = WEIGHTED.reduce((n, [, w]) => n + w, 0);

const item = (productId: string, qty: number, note = ''): OrderItem => {
  const p = INITIAL_PRODUCTS.find((x) => x.id === productId)!;
  return { productId, name: p.name, price: p.price, qty, note, fulfillment: p.fulfillment };
};

/** Historial inicial de una cuenta: un envío a cocina con las comidas y una entrega directa con las bebidas. */
function seedOperations(order: Order): OrderOperation[] {
  const group = (kind: OrderOperation['kind'], fulfillment: OrderItem['fulfillment']): OrderOperation[] => {
    const items = order.items.filter((i) => i.fulfillment === fulfillment);
    return items.length ? [{ id: `${order.id}-${kind}`, kind, number: 1, date: order.createdAt, user: order.waiter, items: items.map((i) => ({ ...i })) }] : [];
  };
  return [...group('cocina', 'PREPARADO'), ...group('directo', 'DIRECTO')];
}

/**
 * Construye los datos de demostración a partir de la fecha actual: dos semanas
 * de ventas, gastos y cierres de caja, más la actividad del día en curso.
 */
export function buildSeed(now: Date): AppState {
  const rand = mulberry32(20261011);
  const today = startOfDay(now);
  const creditClients = INITIAL_CLIENTS.filter((c) => c.creditAuthorized);

  const orders: Order[] = [];
  const payments: Payment[] = [];
  const expenses: Expense[] = [];
  const cashSessions: CashSession[] = [];
  const cashMovements: CashMovement[] = [];
  let number = 1;
  let seq = 0;
  const id = (prefix: string) => `${prefix}-seed-${++seq}`;

  const pay = (order: Order, method: PayMethod, amount: number, sessionId: string, clientId: string | null = null) =>
    payments.push({
      id: id('pay'),
      date: order.closedAt!,
      method,
      amount: round2(amount),
      kind: 'venta',
      orderId: order.id,
      clientId,
      sessionId: method === 'efectivo' ? sessionId : null,
    });

  const addExpense = (date: Date, description: string, category: ExpenseCategory, amount: number, method: Expense['method'], sessionId: string) =>
    expenses.push({ id: id('exp'), description, category, date: date.toISOString(), amount, method, sessionId: method === 'efectivo' ? sessionId : null });

  const at = (day: Date, hours: number) => new Date(day.getTime() + hours * 3600000);

  // Días anteriores: del más antiguo al más reciente.
  const DIFFS = [0, 0, -10, 0, 0, 5, 0, -25, 0, 0, 0, 10, 0, 0];
  for (let d = 13; d >= 1; d--) {
    const day = addDays(today, -d);
    const sessionId = `caja-seed-${d}`;
    const weekend = [0, 5, 6].includes(day.getDay());
    const count = 7 + Math.floor(rand() * 6) + (weekend ? 4 : 0);
    const times = Array.from({ length: count }, () => 11 + rand() * 9.5).sort((a, b) => a - b);

    for (const hour of times) {
      const lines = new Map<string, number>();
      const lineCount = 1 + Math.floor(rand() * 4);
      for (let i = 0; i < lineCount; i++) {
        let pick = rand() * WEIGHT_TOTAL;
        const chosen = WEIGHTED.find(([, w]) => (pick -= w) < 0) ?? WEIGHTED[0];
        lines.set(chosen[0], (lines.get(chosen[0]) ?? 0) + 1 + Math.floor(rand() * 2));
      }
      const r = rand();
      const service: ServiceType = r < 0.8 ? 'mesa' : 'domicilio';
      const table = INITIAL_TABLES[Math.floor(rand() * INITIAL_TABLES.length)];
      const created = at(day, hour);
      const order: Order = {
        id: id('ord'),
        number: number++,
        service,
        tableId: service === 'mesa' ? table.id : null,
        tableName: service === 'mesa' ? table.name : null,
        customer: service === 'domicilio' ? DEMO_ADDRESSES[Math.floor(hour * 10) % DEMO_ADDRESSES.length] : '',
        items: [...lines].map(([productId, qty]) => item(productId, qty)),
        operations: [],
        shipping: service === 'domicilio' ? 30 + Math.floor(rand() * 3) * 10 : 0,
        discount: 0,
        status: 'cobrada',
        createdAt: created.toISOString(),
        closedAt: new Date(created.getTime() + (25 + rand() * 30) * 60000).toISOString(),
        waiter: USERS.mesero,
      };
      orders.push(order);
      const total = orderTotal(order);
      const m = rand();
      if (m < 0.66) pay(order, 'efectivo', total, sessionId);
      else if (m < 0.88) pay(order, 'transferencia', total, sessionId);
      else if (m < 0.94) pay(order, 'credito', total, sessionId, creditClients[Math.floor(rand() * creditClients.length)].id);
      else {
        const cash = Math.min(total, Math.max(10, Math.round(total / 20) * 10));
        pay(order, 'efectivo', cash, sessionId);
        if (total - cash > 0) pay(order, 'transferencia', total - cash, sessionId);
      }
    }

    if (d % 2 === 0) addExpense(at(day, 9.5), 'Compra de carnes y verduras', 'Insumos', 600 + Math.round(rand() * 50) * 10, rand() < 0.6 ? 'efectivo' : 'transferencia', sessionId);
    if (d === 1) addExpense(at(day, 10), 'Tortillas y pan', 'Insumos', 450, 'efectivo', sessionId);
    if (d === 3) addExpense(at(day, 16), 'Recarga de gas LPG', 'Otros', 780, 'efectivo', sessionId);
    if (d === 4) addExpense(at(day, 11), 'Recibo de agua potable', 'Servicios públicos', 420, 'transferencia', sessionId);
    if (d === 6 || d === 13) addExpense(at(day, 14), 'Pedido a distribuidora de bebidas', 'Bebidas', d === 6 ? 2600 : 2350, 'transferencia', sessionId);
    if (d === 8) addExpense(at(day, 12), 'Artículos de limpieza', 'Otros', 310, 'efectivo', sessionId);
    if (d === 10) addExpense(at(day, 10), 'Recibo de energía eléctrica', 'Servicios públicos', 1850, 'transferencia', sessionId);
    if (d === 5) cashMovements.push({ id: id('mov'), sessionId, type: 'salida', amount: 200, description: 'Retiro para depósito bancario', date: at(day, 18).toISOString() });

    cashSessions.push({
      id: sessionId,
      openedAt: at(day, 10.5).toISOString(),
      closedAt: at(day, 21.5).toISOString(),
      openingAmount: 500,
      expectedAmount: null,
      countedAmount: null,
      user: USERS.admin,
      note: '',
    });
  }

  // Día en curso: todo ocurre entre el inicio del turno y este momento.
  const base = new Date(Math.max(today.getTime(), now.getTime() - 6 * 3600000));
  const span = Math.max(now.getTime() - base.getTime(), 60000);
  const moment = (fraction: number) => new Date(base.getTime() + span * fraction);
  const todaySession = 'caja-seed-hoy';
  cashSessions.push({
    id: todaySession,
    openedAt: base.toISOString(),
    closedAt: null,
    openingAmount: 500,
    expectedAmount: null,
    countedAmount: null,
    user: USERS.admin,
    note: '',
  });
  cashMovements.push({ id: id('mov'), sessionId: todaySession, type: 'entrada', amount: 200, description: 'Sencillo para dar cambio', date: moment(0.05).toISOString() });
  addExpense(moment(0.15), 'Tortillas y pan del día', 'Insumos', 350, 'efectivo', todaySession);

  const todayOrder = (fraction: number, service: ServiceType, tableIndex: number | null, items: OrderItem[], extra: Partial<Order> = {}): Order => {
    const table = tableIndex === null ? null : INITIAL_TABLES[tableIndex];
    const order: Order = {
      id: id('ord'),
      number: number++,
      service,
      tableId: table?.id ?? null,
      tableName: table?.name ?? null,
      customer: '',
      items,
      operations: [],
      shipping: 0,
      discount: 0,
      status: 'abierta',
      createdAt: moment(fraction).toISOString(),
      closedAt: null,
      waiter: USERS.mesero,
      ...extra,
    };
    orders.push(order);
    return order;
  };
  const paid = (fraction: number, service: ServiceType, tableIndex: number | null, items: OrderItem[], method: PayMethod, clientId: string | null = null, extra: Partial<Order> = {}) => {
    const order = todayOrder(fraction, service, tableIndex, items, { status: 'cobrada', closedAt: moment(fraction + 0.07).toISOString(), ...extra });
    pay(order, method, orderTotal(order), todaySession, clientId);
  };

  paid(0.1, 'mesa', 0, [item('tacos-3', 2), item('coca-desechable', 2)], 'efectivo');
  paid(0.24, 'mesa', 2, [item('torta', 1), item('agua-bote', 1)], 'transferencia');
  paid(0.38, 'mesa', 3, [item('carne-asada', 2), item('pollo-asado', 1), item('salva-vida', 3)], 'efectivo');
  paid(0.52, 'mesa', 5, [item('quesadilla', 2), item('coca-vidrio', 2)], 'efectivo');
  paid(0.66, 'domicilio', null, [item('carne-mixta', 4), item('coca-2l', 1)], 'credito', 'cli-1', { shipping: 40, customer: 'Ferretería El Progreso, Barrio El Centro' });

  todayOrder(0.8, 'mesa', 1, [item('tacos-3', 2, 'Sin cebolla'), item('quesadilla', 1), item('coca-desechable', 2)]);
  todayOrder(0.87, 'mesa', 4, [item('carne-asada', 1), item('chuleta', 1), item('barena', 2)]);
  todayOrder(0.92, 'domicilio', null, [item('pollo-asado', 2), item('coca-15l', 1)], { shipping: 40, customer: 'Sra. Lourdes, Col. Las Palmas' });
  todayOrder(0.96, 'mesa', 6, [item('cubetazo-nac', 1), item('tacos-2', 2)]);

  // Abonos de clientes con saldo, registrados hace dos días por transferencia.
  const abonoDate = at(addDays(today, -2), 15);
  for (const client of creditClients) {
    const due = payments
      .filter((p) => p.clientId === client.id && p.method === 'credito' && new Date(p.date) < abonoDate)
      .reduce((n, p) => n + p.amount, 0);
    if (due > 200) {
      payments.push({ id: id('pay'), date: abonoDate.toISOString(), method: 'transferencia', amount: Math.round((due * 0.4) / 10) * 10, kind: 'abono', orderId: null, clientId: client.id, sessionId: null });
    }
  }

  const priceHistory: PriceChange[] = [
    { id: id('prc'), productId: 'heineken', productName: 'Heineken', oldPrice: 38, newPrice: 40, date: at(addDays(today, -9), 9).toISOString(), user: USERS.admin },
    { id: id('prc'), productId: 'coca-desechable', productName: 'Coca-Cola desechable', oldPrice: 28, newPrice: 30, date: at(addDays(today, -21), 9).toISOString(), user: USERS.admin },
  ];

  const move = (daysAgo: number, hour: number, productId: string, type: StockMovement['type'], delta: number, resultingStock: number, note: string): StockMovement => ({
    id: id('stk'),
    productId,
    productName: INITIAL_PRODUCTS.find((p) => p.id === productId)!.name,
    type,
    delta,
    resultingStock,
    date: at(addDays(today, -daysAgo), hour).toISOString(),
    note,
    user: USERS.admin,
  });
  const stockMovements: StockMovement[] = [
    move(1, 20, 'miller-draft', 'salida', -2, 0, 'Botellas quebradas'),
    move(2, 9, 'agua-bolsa', 'ajuste', -4, 72, 'Conteo físico'),
    move(6, 14.5, 'salva-vida', 'entrada', 48, 84, 'Pedido a distribuidora'),
    move(6, 14.5, 'barena', 'entrada', 24, 61, 'Pedido a distribuidora'),
    move(6, 14.5, 'coca-desechable', 'entrada', 24, 58, 'Pedido a distribuidora'),
  ];

  for (const order of orders) order.operations = seedOperations(order);

  const state: AppState = {
    version: STATE_VERSION,
    role: 'admin',
    products: INITIAL_PRODUCTS.map((p) => ({ ...p })),
    priceHistory,
    tables: INITIAL_TABLES.map((t) => ({ ...t })),
    orders,
    payments,
    clients: INITIAL_CLIENTS.map((c) => ({ ...c })),
    stockMovements,
    cashSessions,
    cashMovements,
    expenses,
    nextOrderNumber: number,
  };

  // Cierre de las sesiones anteriores con el mismo cálculo que usa la pantalla de caja.
  state.cashSessions = state.cashSessions.map((session, index) => {
    if (session.closedAt === null) return session;
    const expected = sessionSummary(state, session).expected;
    return { ...session, expectedAmount: expected, countedAmount: round2(expected + DIFFS[index % DIFFS.length]) };
  });

  // Ningún cliente debe quedar con saldo negativo en los datos iniciales.
  for (const client of state.clients) {
    if (clientBalance(state, client.id) < 0) {
      state.payments = state.payments.filter((p) => !(p.kind === 'abono' && p.clientId === client.id));
    }
  }

  return state;
}
