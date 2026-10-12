import {
  ChartColumn,
  ClipboardList,
  HandCoins,
  LayoutDashboard,
  LayoutGrid,
  Package,
  ReceiptText,
  Tag,
  Users,
  Wallet,
  type LucideIcon,
} from 'lucide-react';
import type { Role } from '../types';
import type { PageId } from './router';

export interface NavItem {
  id: PageId;
  label: string;
  icon: LucideIcon;
  roles: Role[];
  group: 'Operación' | 'Administración';
}

export const NAV: NavItem[] = [
  { id: 'panel', label: 'Panel principal', icon: LayoutDashboard, roles: ['admin'], group: 'Operación' },
  { id: 'mesas', label: 'Mesas', icon: LayoutGrid, roles: ['admin', 'mesero'], group: 'Operación' },
  { id: 'pedidos', label: 'Pedidos', icon: ClipboardList, roles: ['admin', 'mesero'], group: 'Operación' },
  { id: 'cobro', label: 'Cobro y ventas', icon: HandCoins, roles: ['admin'], group: 'Operación' },
  { id: 'caja', label: 'Caja', icon: Wallet, roles: ['admin'], group: 'Operación' },
  { id: 'inventario', label: 'Inventario', icon: Package, roles: ['admin'], group: 'Administración' },
  { id: 'gastos', label: 'Gastos', icon: ReceiptText, roles: ['admin'], group: 'Administración' },
  { id: 'reportes', label: 'Reportes', icon: ChartColumn, roles: ['admin'], group: 'Administración' },
  { id: 'productos', label: 'Productos y precios', icon: Tag, roles: ['admin'], group: 'Administración' },
  { id: 'clientes', label: 'Clientes y créditos', icon: Users, roles: ['admin'], group: 'Administración' },
];

export const navFor = (role: Role) => NAV.filter((item) => item.roles.includes(role));
export const homeFor = (role: Role): PageId => (role === 'admin' ? 'panel' : 'mesas');
