export type Role = 'mesero' | 'admin';

export type CategoryId =
  | 'mexicano'
  | 'catracho'
  | 'refrescos'
  | 'cervezas-nacionales'
  | 'cervezas-internacionales'
  | 'cubetazos';

export interface Category {
  id: CategoryId;
  name: string;
}

/** PREPARADO: requiere preparación y se envía a cocina. DIRECTO: se entrega al cliente sin pasar por cocina. */
export type Fulfillment = 'PREPARADO' | 'DIRECTO';

export interface Product {
  id: string;
  name: string;
  detail?: string;
  categoryId: CategoryId;
  price: number;
  active: boolean;
  fulfillment: Fulfillment;
  /** Solo las bebidas controlan existencias; los platos no descuentan stock. */
  trackStock: boolean;
  stock: number;
  minStock: number;
  /** Precio tomado de una etiqueta manuscrita, pendiente de confirmar. */
  provisional?: boolean;
  /** Producto creado durante la demostración, fuera del menú confirmado. */
  demo?: boolean;
}

export interface PriceChange {
  id: string;
  productId: string;
  productName: string;
  oldPrice: number;
  newPrice: number;
  date: string;
  user: string;
}

export interface DiningTable {
  id: string;
  name: string;
  active: boolean;
}

export type ServiceType = 'mesa' | 'domicilio';

export interface OrderItem {
  productId: string;
  name: string;
  price: number;
  qty: number;
  note: string;
  fulfillment: Fulfillment;
}

/**
 * Cada incorporación a una cuenta: un envío a cocina (comidas) o una entrega
 * directa (bebidas). Es el historial; consultarlo o reimprimirlo no modifica la cuenta.
 */
export interface OrderOperation {
  id: string;
  kind: 'cocina' | 'directo';
  /** Consecutivo dentro de la cuenta, por tipo: envío a cocina 1, 2, 3… */
  number: number;
  date: string;
  user: string;
  items: OrderItem[];
}

export type OrderStatus = 'abierta' | 'cobrada' | 'cancelada';

export interface Order {
  id: string;
  number: number;
  service: ServiceType;
  tableId: string | null;
  tableName: string | null;
  customer: string;
  /** Productos confirmados en la cuenta. Las comidas pendientes de envío no se guardan aquí. */
  items: OrderItem[];
  operations: OrderOperation[];
  shipping: number;
  discount: number;
  status: OrderStatus;
  createdAt: string;
  closedAt: string | null;
  waiter: string;
  cancelReason?: string;
}

export type PayMethod = 'efectivo' | 'transferencia' | 'credito';

/**
 * Libro único de pagos. Una venta genera uno o varios registros 'venta' cuya suma
 * es igual al total de la cuenta, por lo que una venta mixta nunca se duplica.
 * Los registros 'credito' son cargos a la cuenta del cliente, no dinero recibido.
 */
export interface Payment {
  id: string;
  date: string;
  method: PayMethod;
  amount: number;
  kind: 'venta' | 'abono';
  orderId: string | null;
  clientId: string | null;
  sessionId: string | null;
}

export interface PaymentPart {
  method: PayMethod;
  amount: number;
  clientId?: string | null;
}

export interface Client {
  id: string;
  name: string;
  contact: string;
  phone: string;
  creditAuthorized: boolean;
}

export type StockMoveType = 'entrada' | 'salida' | 'ajuste' | 'venta' | 'devolucion';

export interface StockMovement {
  id: string;
  productId: string;
  productName: string;
  type: StockMoveType;
  delta: number;
  resultingStock: number;
  date: string;
  note: string;
  user: string;
}

export interface CashSession {
  id: string;
  openedAt: string;
  closedAt: string | null;
  openingAmount: number;
  expectedAmount: number | null;
  countedAmount: number | null;
  user: string;
  note: string;
}

export interface CashMovement {
  id: string;
  sessionId: string;
  type: 'entrada' | 'salida';
  amount: number;
  description: string;
  date: string;
}

export const EXPENSE_CATEGORIES = ['Insumos', 'Bebidas', 'Servicios públicos', 'Otros'] as const;
export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];

export interface Expense {
  id: string;
  description: string;
  category: ExpenseCategory;
  date: string;
  amount: number;
  method: 'efectivo' | 'transferencia';
  /** Si se pagó con efectivo de la caja abierta, se descuenta del efectivo esperado. */
  sessionId: string | null;
}

export interface AppState {
  version: number;
  role: Role;
  products: Product[];
  priceHistory: PriceChange[];
  tables: DiningTable[];
  orders: Order[];
  payments: Payment[];
  clients: Client[];
  stockMovements: StockMovement[];
  cashSessions: CashSession[];
  cashMovements: CashMovement[];
  expenses: Expense[];
  nextOrderNumber: number;
}
