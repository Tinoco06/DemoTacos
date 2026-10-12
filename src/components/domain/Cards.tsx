import { Plus } from 'lucide-react';
import type { DiningTable, Order, Product } from '../../types';
import { orderTotal, stockStatus } from '../../lib/calc';
import { cn, fmtMoney, fmtTime } from '../../lib/format';
import { Badge, Stepper } from '../ui/Basics';

export function TableCard({ table, order, onSelect }: { table: DiningTable; order?: Order; onSelect: () => void }) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        'flex min-h-36 flex-col justify-between rounded-xl border p-4 text-left transition-colors',
        order ? 'border-crema bg-crema-soft hover:border-warn/50' : 'border-line bg-white hover:border-carbon/30',
      )}
    >
      <div className="flex w-full flex-wrap items-center justify-between gap-x-2 gap-y-1">
        <span className="max-w-full truncate text-lg font-semibold text-ink">{table.name}</span>
        <Badge tone={order ? 'warning' : 'success'}>{order ? 'Cuenta abierta' : 'Libre'}</Badge>
      </div>
      {order ? (
        <div>
          <p className="text-2xl font-semibold tabular-nums tracking-tight text-ink">{fmtMoney(orderTotal(order))}</p>
          <p className="mt-0.5 text-sm text-muted">Desde las <span className="whitespace-nowrap">{fmtTime(order.createdAt)}</span></p>
        </div>
      ) : (
        <p className="text-sm text-muted">Toque para iniciar un pedido</p>
      )}
    </button>
  );
}

interface ProductCardProps {
  product: Product;
  qty: number;
  onChange: (qty: number) => void;
}

/** Tarjeta táctil del catálogo. El stock disponible ya descuenta lo que está en el pedido en curso. */
export function ProductCard({ product, qty, onChange }: ProductCardProps) {
  const status = stockStatus(product);
  const soldOut = status === 'agotado';
  const remaining = product.stock - qty;
  return (
    <div className={cn('flex min-h-40 flex-col gap-3 rounded-xl border bg-white p-4', qty > 0 ? 'border-frambuesa' : 'border-line', soldOut && 'bg-marfil')}>
      <div className="flex-1">
        <p className={cn('font-medium leading-snug', soldOut ? 'text-muted' : 'text-ink')}>{product.name}</p>
        {product.detail && <p className="mt-0.5 text-sm text-muted">{product.detail}</p>}
      </div>
      <div className="flex min-h-6 items-center justify-between gap-2">
        <span className={cn('text-base font-semibold tabular-nums', soldOut ? 'text-muted' : 'text-ink')}>{fmtMoney(product.price)}</span>
        {soldOut ? <Badge tone="danger">Agotado</Badge> : status === 'bajo' ? <Badge tone="warning">Quedan {Math.max(0, remaining)}</Badge> : null}
      </div>
      {qty > 0 ? (
        <Stepper value={qty} onChange={onChange} max={product.trackStock ? product.stock : undefined} label={product.name} />
      ) : (
        <button
          type="button"
          disabled={soldOut}
          onClick={() => onChange(1)}
          className="flex h-11 w-full items-center justify-center gap-2 rounded-lg border border-line bg-white text-sm font-medium text-ink hover:bg-marfil disabled:bg-transparent disabled:text-muted"
        >
          {!soldOut && <Plus className="size-5" aria-hidden />}
          {soldOut ? 'Sin existencias' : 'Agregar'}
        </button>
      )}
    </div>
  );
}
