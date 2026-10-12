import { Banknote, ChartColumn, ClipboardList, HandCoins, PackageCheck, ReceiptText, SquarePen, TrendingUp, TriangleAlert, type LucideIcon } from 'lucide-react';
import { useApp } from '../store/AppStore';
import { Button } from '../components/ui/Button';
import { Badge, Card, EmptyState, PageHeader, StatCard, SummaryRow } from '../components/ui/Basics';
import { BarChart } from '../components/ui/Charts';
import { currentSession, dailySeries, openOrders, orderTotal, periodSummary, serviceLabel, sessionSummary, stockStatus, sumBy } from '../lib/calc';
import { addDays, endOfDay, fmtDate, fmtLongDate, fmtMoney, fmtOrderNumber, fmtTime, startOfDay } from '../lib/format';
import { navigate, type PageId } from '../lib/router';

const QUICK: Array<{ page: PageId; label: string; hint: string; icon: LucideIcon }> = [
  { page: 'mesas', label: 'Tomar pedido', hint: 'Desde las mesas o a domicilio', icon: SquarePen },
  { page: 'cobro', label: 'Cobrar cuenta', hint: 'Efectivo, transferencia o crédito', icon: HandCoins },
  { page: 'gastos', label: 'Registrar gasto', hint: 'Insumos, bebidas y servicios', icon: ReceiptText },
  { page: 'reportes', label: 'Ver reportes', hint: 'Resumen semanal', icon: ChartColumn },
];

export function DashboardPage() {
  const { state } = useApp();
  const now = new Date();
  const today = periodSummary(state, startOfDay(now), endOfDay(now));
  const open = openOrders(state);
  const tracked = state.products.filter((p) => p.active && p.trackStock);
  const low = tracked.filter((p) => stockStatus(p) !== 'ok').sort((a, b) => a.stock - b.stock);
  const soldOut = low.filter((p) => stockStatus(p) === 'agotado').length;
  const session = currentSession(state);
  const cash = session ? sessionSummary(state, session) : null;
  const week = dailySeries(state, addDays(startOfDay(now), -6), endOfDay(now));

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Panel principal" description={fmtLongDate(now)} />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Ventas del día" value={fmtMoney(today.sales)} hint={`${today.salesCount} ${today.salesCount === 1 ? 'cuenta cobrada' : 'cuentas cobradas'}`} icon={TrendingUp} />
        <StatCard label="Cobros recibidos" value={fmtMoney(today.received)} hint={`Efectivo ${fmtMoney(today.receivedCash)} · Transf. ${fmtMoney(today.receivedTransfer)}`} icon={Banknote} />
        <StatCard label="Cuentas abiertas" value={open.length} hint={`${fmtMoney(sumBy(open, orderTotal))} por cobrar`} icon={ClipboardList} />
        <StatCard
          label="Stock bajo"
          value={low.length}
          hint={low.length === 0 ? 'Inventario en orden' : soldOut > 0 ? `${soldOut} ${soldOut === 1 ? 'producto agotado' : 'productos agotados'}` : 'Productos por reponer'}
          icon={low.length > 0 ? TriangleAlert : PackageCheck}
          tone={low.length > 0 ? 'warning' : 'neutral'}
        />
      </div>

      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        {QUICK.map((q) => (
          <button key={q.page} type="button" onClick={() => navigate(q.page)} className="flex items-center gap-3 rounded-xl border border-line bg-white p-4 text-left transition-colors hover:border-carbon/30">
            <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-frambuesa-soft text-frambuesa">
              <q.icon className="size-5" aria-hidden />
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-semibold text-ink">{q.label}</span>
              <span className="hidden text-sm text-muted sm:block">{q.hint}</span>
            </span>
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <Card title="Ventas de los últimos 7 días" description="Cuentas cobradas por día, en lempiras" className="xl:col-span-2">
          <BarChart series={[{ name: 'Ventas', color: 'bg-azul' }]} groups={week.map((d) => ({ label: d.label, title: fmtDate(d.date), values: [d.sales] }))} />
        </Card>

        <Card title="Caja" action={<Badge tone={session ? 'success' : 'warning'}>{session ? 'Abierta' : 'Cerrada'}</Badge>}>
          {session && cash ? (
            <div className="flex flex-col gap-3">
              <p className="text-sm text-muted">Abierta a las {fmtTime(session.openedAt)} por {session.user}</p>
              <SummaryRow label="Saldo inicial" value={fmtMoney(cash.opening)} />
              <SummaryRow label="Cobros en efectivo" value={fmtMoney(cash.cashSales + cash.cashAbonos)} />
              <SummaryRow label="Otras entradas" value={fmtMoney(cash.entries)} />
              <SummaryRow label="Salidas y gastos" value={`- ${fmtMoney(cash.exits + cash.cashExpenses)}`} />
              <div className="border-t border-line pt-3">
                <SummaryRow label="Efectivo esperado" value={fmtMoney(cash.expected)} strong />
              </div>
              <Button full onClick={() => navigate('caja')} className="mt-2">
                Ir a caja
              </Button>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              <p className="text-sm leading-relaxed text-muted">No hay una sesión de caja abierta. Ábrala para registrar cobros en efectivo.</p>
              <Button variant="primary" full onClick={() => navigate('caja')}>
                Abrir caja
              </Button>
            </div>
          )}
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <Card title="Cuentas abiertas" flush action={<Button size="sm" onClick={() => navigate('pedidos')}>Ver todas</Button>}>
          {open.length === 0 ? (
            <EmptyState icon={ClipboardList} title="Sin cuentas abiertas" description="Los pedidos confirmados aparecerán aquí hasta que se cobren." />
          ) : (
            <ul className="divide-y divide-line">
              {open.slice(0, 5).map((order) => (
                <li key={order.id} className="flex items-center gap-4 px-5 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-ink">{serviceLabel(order)}</p>
                    <p className="text-sm text-muted">{fmtOrderNumber(order.number)} · {fmtTime(order.createdAt)}</p>
                  </div>
                  <span className="text-sm font-semibold tabular-nums text-ink">{fmtMoney(orderTotal(order))}</span>
                  <Button size="sm" variant="primary" onClick={() => navigate('cobro', { pedido: order.id })}>
                    Cobrar
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="Bebidas por reponer" flush action={<Button size="sm" onClick={() => navigate('inventario')}>Ver inventario</Button>}>
          {low.length === 0 ? (
            <EmptyState icon={PackageCheck} title="Inventario en orden" description="Ninguna bebida está por debajo de su stock mínimo." />
          ) : (
            <ul className="divide-y divide-line">
              {low.slice(0, 5).map((product) => (
                <li key={product.id} className="flex items-center gap-4 px-5 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-ink">{product.name}</p>
                    <p className="text-sm text-muted">Stock mínimo: {product.minStock}</p>
                  </div>
                  <span className="text-sm tabular-nums text-ink">{product.stock} en existencia</span>
                  <Badge tone={stockStatus(product) === 'agotado' ? 'danger' : 'warning'}>{stockStatus(product) === 'agotado' ? 'Agotado' : 'Stock bajo'}</Badge>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
