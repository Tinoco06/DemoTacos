import type { Category, Client, DiningTable, Product } from '../types';

export const CATEGORIES: Category[] = [
  { id: 'mexicano', name: 'Menú mexicano' },
  { id: 'catracho', name: 'Menú catracho' },
  { id: 'refrescos', name: 'Refrescos y agua' },
  { id: 'cervezas-nacionales', name: 'Cervezas nacionales' },
  { id: 'cervezas-internacionales', name: 'Cervezas internacionales' },
  { id: 'cubetazos', name: 'Cubetazos' },
];

export const categoryName = (id: string) => CATEGORIES.find((c) => c.id === id)?.name ?? id;

const dish = (id: string, name: string, categoryId: Product['categoryId'], price: number, extra: Partial<Product> = {}): Product => ({
  id,
  name,
  categoryId,
  price,
  active: true,
  trackStock: false,
  stock: 0,
  minStock: 0,
  ...extra,
});

const drink = (id: string, name: string, categoryId: Product['categoryId'], price: number, stock: number, minStock: number): Product => ({
  id,
  name,
  categoryId,
  price,
  active: true,
  trackStock: true,
  stock,
  minStock,
});

/** Menú inicial de Tacos Grill según las fotografías del menú. */
export const INITIAL_PRODUCTS: Product[] = [
  dish('tacos-2', 'Tacos, orden de dos', 'mexicano', 60),
  dish('tacos-3', 'Tacos, orden de tres', 'mexicano', 90),
  dish('torta', 'Torta mexicana', 'mexicano', 100),
  dish('quesadilla', 'Quesadilla', 'mexicano', 100),

  // Precios tomados de etiquetas manuscritas: provisionales hasta que el dueño los confirme.
  dish('carne-asada', 'Carne asada con tajadas', 'catracho', 170, { provisional: true }),
  dish('pollo-asado', 'Pollo asado con tajadas', 'catracho', 170, { provisional: true }),
  dish('chuleta', 'Chuleta con tajadas', 'catracho', 160, { provisional: true }),
  dish('carne-mixta', 'Carne mixta con tajadas', 'catracho', 190, { provisional: true, detail: 'Incluye chorizo' }),

  drink('coca-desechable', 'Coca-Cola desechable', 'refrescos', 30, 36, 12),
  drink('coca-vidrio', 'Coca-Cola de vidrio', 'refrescos', 15, 6, 12),
  drink('coca-3l', 'Coca-Cola de 3 litros', 'refrescos', 75, 8, 4),
  drink('coca-2l', 'Coca-Cola de 2 litros', 'refrescos', 60, 10, 4),
  drink('coca-15l', 'Coca-Cola de 1.5 litros', 'refrescos', 50, 9, 4),
  drink('agua-bolsa', 'Agua en bolsa', 'refrescos', 5, 60, 20),
  drink('agua-bote', 'Agua en bote', 'refrescos', 30, 18, 8),

  drink('salva-vida', 'Salva Vida', 'cervezas-nacionales', 35, 48, 24),
  drink('barena', 'Barena', 'cervezas-nacionales', 35, 40, 24),
  drink('imperial', 'Imperial', 'cervezas-nacionales', 35, 30, 18),

  drink('corona', 'Corona Extra', 'cervezas-internacionales', 55, 20, 12),
  drink('miller-lite', 'Miller Lite', 'cervezas-internacionales', 45, 14, 12),
  drink('miller-draft', 'Miller Draft', 'cervezas-internacionales', 55, 0, 6),
  drink('ultra', 'Ultra', 'cervezas-internacionales', 50, 16, 12),
  drink('heineken', 'Heineken', 'cervezas-internacionales', 40, 18, 12),

  // Los cubetazos se venden con precio propio y no descuentan inventario en el prototipo.
  dish('cubetazo-int', 'Cubetazo internacional', 'cubetazos', 300, { detail: 'Seis cervezas' }),
  dish('cubetazo-nac', 'Cubetazo nacional', 'cubetazos', 210, { detail: 'Seis cervezas' }),
];

export const INITIAL_TABLES: DiningTable[] = Array.from({ length: 8 }, (_, i) => ({
  id: `mesa-${i + 1}`,
  name: `Mesa ${i + 1}`,
  active: true,
}));

/** Clientes ficticios, únicamente para la demostración. */
export const INITIAL_CLIENTS: Client[] = [
  { id: 'cli-1', name: 'Ferretería El Progreso', contact: 'Marlon Castillo', phone: '9900-0101', creditAuthorized: true },
  { id: 'cli-2', name: 'Taller Mecánico Hermanos Mejía', contact: 'Óscar Mejía', phone: '9900-0102', creditAuthorized: true },
  { id: 'cli-3', name: 'Cooperativa La Esperanza', contact: 'Suyapa Reyes', phone: '9900-0103', creditAuthorized: true },
  { id: 'cli-4', name: 'Oficina Contable Zelaya', contact: 'Karla Zelaya', phone: '9900-0104', creditAuthorized: true },
  { id: 'cli-5', name: 'Constructora Valle Alto', contact: 'Edwin Paz', phone: '9900-0105', creditAuthorized: false },
];

export const USERS = { admin: 'Administrador', mesero: 'Mesero' } as const;
