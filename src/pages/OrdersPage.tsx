import { useState } from 'react';
import { ClipboardList, Eye, HandCoins, Plus, ReceiptText } from 'lucide-react';
import type { Order } from '../types';
import { useApp } from '../store/AppStore';
import { Button } from '../components/ui/Button';
import { Badge, Card, EmptyState, PageHeader, Segmented } from '../components/ui/Basics';
import { DataTable, type Column } from '../components/ui/DataTable';
import { OrderDetailModal } from '../components/domain/OrderDetailModal';
import { METHOD_LABEL, itemsCount, openOrders, orderTotal, serviceLabel } from '../lib/calc';
import { fmtDateTime, fmtMoney, fmtOrderNumber, fmtTime } from '../lib/format';
import { navigate } from '../lib/router';

type Tab = 'abiertas' | 'ventas' | 'canceladas';
const RECENT_LIMIT = 25;

const byClosedDesc = (a: Order, b: Order) => (b.closedAt ?? '').localeCompare(a.closedAt ?? '');

export function OrdersPage() {
  const { state } = useApp();
  const isAdmin = state.role === 'admin';
  const [tab, setTab] = useState<Tab>('abiertas');
  const [detail, setDetail] = useState<{ id: string; view: 'cocina' | 'cuenta' } | null>(null);

  const open = openOrders(state);
  const sold = state.orders.filter((o) => o.status === 'cobrada').sort(byClosedDesc);
  const cancelled = state.orders.filter((o) => o.status === 'cancelada').sort(byClosedDesc);

  const paymentLabel = (order: Order) => {
    const methods = [...new Set(state.payments.filter((p) => p.orderId === order.id && p.kind === 'venta').map((p) => METHOD_LABEL[p.method]))];
    return methods.length > 1 ? `Mixto (${methods.join(' + ')})` : methods[0] ?? 'Sin cobro';
  };

  const common: Column<Order>[] = [
    { key: 'numero', header: 'Pedido', render: (o) => <span className="font-medium tabular-nums">{fmtOrderNumber(o.number)}</span> },
    {
      key: 'servicio',
      header: 'Servicio',
      render: (o) => (
        <div className="min-w-0">
          <p>{serviceLabel(o)}</p>
          {o.customer && <p className="max-w-56 truncate text-muted">{o.customer}</p>}
        </div>
      ),
    },
  ];

  const openColumns: Column<Order>[] = [
    ...common,
    { key: 'hora', header: 'Abierta', render: (o) => fmtTime(o.createdAt) },
    { key: 'productos', header: 'Unidades', align: 'right', render: (o) => itemsCount(o.items) },
    { key: 'total', header: 'Importe', align: 'right', render: (o) => <span className="font-semibold">{fmtMoney(orderTotal(o))}</span> },
    {
      key: 'acciones',
      header: 'Acciones',
      align: 'right',
      render: (o) => (
        <div className="flex justify-end gap-2">
          <Button size="sm" icon={Eye} onClick={() => setDetail({ id: o.id, view: 'cocina' })}>
            Ver
          </Button>
          <Button size="sm" variant="primary" icon={HandCoins} onClick={() => navigate('cobro', { pedido: o.id })}>
            Cobrar
          </Button>
        </div>
      ),
    },
  ];

  const closedColumns = (kind: 'ventas' | 'canceladas'): Column<Order>[] => [
    ...common,
    { key: 'fecha', header: kind === 'ventas' ? 'Cobrada' : 'Cancelada', render: (o) => fmtDateTime(o.closedAt ?? o.createdAt) },
    kind === 'ventas'
      ? { key: 'pago', header: 'Forma de pago', render: (o) => paymentLabel(o) }
      : { key: 'motivo', header: 'Motivo', render: (o) => <span className="text-muted">{o.cancelReason || 'Sin motivo'}</span> },
    { key: 'total', header: 'Importe', align: 'right', render: (o) => <span className="font-semibold">{fmtMoney(orderTotal(o))}</span> },
    {
      key: 'acciones',
      header: 'Acciones',
      align: 'right',
      render: (o) => (
        <Button size="sm" icon={ReceiptText} onClick={() => setDetail({ id: o.id, view: 'cuenta' })}>
          {kind === 'ventas' ? 'Comprobante' : 'Ver detalle'}
        </Button>
      ),
    },
  ];

  // El mesero ve las cuentas abiertas como tarjetas táctiles, sin tablas ni funciones administrativas.
  if (!isAdmin) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title="Cuentas abiertas" description={`${open.length} ${open.length === 1 ? 'pedido pendiente' : 'pedidos pendientes'} de cobro`} />
        {open.length === 0 ? (
          <Card>
            <EmptyState icon={ClipboardList} title="Sin cuentas abiertas" description="Los pedidos confirmados aparecerán aquí." action={<Button variant="primary" size="lg" onClick={() => navigate('mesas')}>Ir a mesas</Button>} />
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {open.map((order) => (
              <div key={order.id} className="flex flex-col gap-4 rounded-xl border border-line bg-white p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-lg font-semibold text-ink">{serviceLabel(order)}</p>
                    <p className="text-sm text-muted">
                      {fmtOrderNumber(order.number)} · {fmtTime(order.createdAt)}
                    </p>
                  </div>
                  <span className="text-lg font-semibold tabular-nums text-ink">{fmtMoney(orderTotal(order))}</span>
                </div>
                <p className="line-clamp-2 min-h-10 text-sm text-muted">{order.items.map((i) => `${i.qty}× ${i.name}`).join(', ')}</p>
                <div className="grid grid-cols-2 gap-3">
                  <Button size="lg" icon={Eye} onClick={() => setDetail({ id: order.id, view: 'cocina' })}>
                    Ver
                  </Button>
                  <Button size="lg" variant="primary" icon={Plus} onClick={() => navigate('pedido', { pedido: order.id })}>
                    Agregar
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
        {detail && <OrderDetailModal orderId={detail.id} initialView={detail.view} onClose={() => setDetail(null)} />}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Pedidos y comprobantes"
        description="Cuentas abiertas, ventas recientes y vista previa de tickets."
      />
      <Segmented
        label="Tipo de pedido"
        value={tab}
        onChange={setTab}
        options={[
          { value: 'abiertas', label: 'Cuentas abiertas', count: open.length },
          { value: 'ventas', label: 'Ventas recientes' },
          { value: 'canceladas', label: 'Canceladas', count: cancelled.length },
        ]}
      />
      <Card flush>
        {tab === 'abiertas' && (
          <DataTable columns={openColumns} rows={open} rowKey={(o) => o.id} minWidth={760} empty={<EmptyState icon={ClipboardList} title="Sin cuentas abiertas" description="Los pedidos confirmados aparecerán aquí hasta que se cobren." />} />
        )}
        {tab === 'ventas' && (
          <>
            <DataTable columns={closedColumns('ventas')} rows={sold.slice(0, RECENT_LIMIT)} rowKey={(o) => o.id} minWidth={820} empty={<EmptyState icon={ReceiptText} title="Sin ventas registradas" />} />
            {sold.length > RECENT_LIMIT && <p className="border-t border-line px-5 py-3 text-sm text-muted">Se muestran las {RECENT_LIMIT} ventas más recientes de {sold.length}. El detalle por período está en Reportes.</p>}
          </>
        )}
        {tab === 'canceladas' && (
          <DataTable columns={closedColumns('canceladas')} rows={cancelled} rowKey={(o) => o.id} minWidth={820} empty={<EmptyState icon={ClipboardList} title="Sin pedidos cancelados" description="Las operaciones canceladas quedan registradas aquí con su motivo." />} />
        )}
      </Card>
      {detail && <OrderDetailModal orderId={detail.id} initialView={detail.view} onClose={() => setDetail(null)} />}
    </div>
  );
}
