import { useState } from 'react';
import { CircleCheck, HandCoins, Printer, Users } from 'lucide-react';
import type { Client, Order } from '../types';
import { useApp } from '../store/AppStore';
import { useToast } from '../components/ui/Toast';
import { Button } from '../components/ui/Button';
import { Badge, Card, EmptyState, PageHeader, Segmented, StatCard } from '../components/ui/Basics';
import { DataTable, type Column } from '../components/ui/DataTable';
import { Modal } from '../components/ui/Modal';
import { PaymentPanel } from '../components/domain/PaymentPanel';
import { SaleReceipt } from '../components/domain/Tickets';
import { AbonoModal } from '../components/domain/AbonoModal';
import { clientBalance, openOrders, orderTotal, serviceLabel, totalCreditBalance } from '../lib/calc';
import { cn, fmtMoney, fmtOrderNumber, fmtTime } from '../lib/format';
import { navigate } from '../lib/router';

type Tab = 'cobrar' | 'saldos';

export function CheckoutPage({ params }: { params: Record<string, string> }) {
  const { state } = useApp();
  const toast = useToast();
  const open = openOrders(state);
  const [tab, setTab] = useState<Tab>('cobrar');
  const [selectedId, setSelectedId] = useState<string | null>(params.pedido ?? null);
  const [charged, setCharged] = useState<Order | null>(null);
  const [abonoFor, setAbonoFor] = useState<string | null>(null);

  const selected = open.find((o) => o.id === selectedId) ?? null;
  const debtors = state.clients.map((c) => ({ client: c, balance: clientBalance(state, c.id) })).filter((d) => d.balance > 0).sort((a, b) => b.balance - a.balance);

  const debtColumns: Column<{ client: Client; balance: number }>[] = [
    {
      key: 'cliente',
      header: 'Cliente',
      render: (d) => (
        <div>
          <p className="font-medium">{d.client.name}</p>
          <p className="text-muted">{d.client.contact}</p>
        </div>
      ),
    },
    { key: 'credito', header: 'Crédito', render: (d) => <Badge tone={d.client.creditAuthorized ? 'success' : 'neutral'}>{d.client.creditAuthorized ? 'Autorizado' : 'No autorizado'}</Badge> },
    { key: 'saldo', header: 'Saldo pendiente', align: 'right', render: (d) => <span className="font-semibold">{fmtMoney(d.balance)}</span> },
    {
      key: 'acciones',
      header: 'Acciones',
      align: 'right',
      render: (d) => (
        <Button size="sm" variant="primary" onClick={() => setAbonoFor(d.client.id)}>
          Registrar abono
        </Button>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Cobro y ventas" description="Cobre cuentas abiertas y registre abonos de clientes al crédito." />
      <Segmented
        label="Sección"
        value={tab}
        onChange={setTab}
        options={[
          { value: 'cobrar', label: 'Cobrar cuentas', count: open.length },
          { value: 'saldos', label: 'Saldos y abonos', count: debtors.length },
        ]}
      />

      {tab === 'cobrar' && (
        <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
          <Card title="Cuentas abiertas" flush>
            {open.length === 0 ? (
              <EmptyState icon={HandCoins} title="Nada por cobrar" description="No hay cuentas abiertas en este momento." />
            ) : (
              <ul className="flex flex-col gap-2 p-3">
                {open.map((order) => {
                  const active = order.id === selected?.id;
                  return (
                    <li key={order.id}>
                      <button
                        type="button"
                        aria-pressed={active}
                        onClick={() => setSelectedId(order.id)}
                        className={cn('flex min-h-16 w-full items-center justify-between gap-3 rounded-lg border px-4 py-3 text-left transition-colors', active ? 'border-frambuesa bg-frambuesa-soft' : 'border-line bg-white hover:bg-marfil')}
                      >
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-semibold text-ink">{serviceLabel(order)}</span>
                          <span className="block text-sm text-muted">
                            {fmtOrderNumber(order.number)} · {fmtTime(order.createdAt)}
                          </span>
                        </span>
                        <span className="shrink-0 text-sm font-semibold tabular-nums text-ink">{fmtMoney(orderTotal(order))}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>

          <Card>
            {selected ? (
              <PaymentPanel key={selected.id} order={selected} onCharged={setCharged} />
            ) : (
              <EmptyState icon={HandCoins} title="Seleccione una cuenta" description="Elija una cuenta abierta de la lista para revisar el total y registrar el cobro." />
            )}
          </Card>
        </div>
      )}

      {tab === 'saldos' && (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <StatCard label="Saldo pendiente de crédito" value={fmtMoney(totalCreditBalance(state))} hint="Ventas al crédito menos abonos recibidos" icon={HandCoins} />
            <StatCard label="Clientes con saldo" value={debtors.length} hint={`${state.clients.filter((c) => c.creditAuthorized).length} clientes con crédito autorizado`} icon={Users} />
          </div>
          <Card title="Saldos pendientes" flush action={<Button size="sm" onClick={() => navigate('clientes')}>Ver clientes</Button>}>
            <DataTable columns={debtColumns} rows={debtors} rowKey={(d) => d.client.id} empty={<EmptyState icon={Users} title="Sin saldos pendientes" description="Ningún cliente tiene compras al crédito por pagar." />} />
          </Card>
        </>
      )}

      {charged && (
        <Modal
          title="Cobro registrado"
          description={`Pedido ${fmtOrderNumber(charged.number)} · ${serviceLabel(charged)}`}
          onClose={() => setCharged(null)}
          footer={
            <>
              <Button size="lg" icon={Printer} onClick={() => toast.info('Impresión simulada: el comprobante se enviaría a la impresora térmica.')}>
                Imprimir comprobante
              </Button>
              <Button size="lg" variant="primary" onClick={() => setCharged(null)}>
                Listo
              </Button>
            </>
          }
        >
          <div className="mb-5 flex items-center gap-4 rounded-lg border border-ok/25 bg-ok-soft px-4 py-4">
            <CircleCheck className="size-9 shrink-0 text-ok" aria-hidden />
            <div>
              <p className="text-base font-semibold text-ink">Venta cobrada: {fmtMoney(orderTotal(charged))}</p>
              <p className="text-sm text-muted">{charged.tableName ? `${charged.tableName} quedó libre.` : 'La cuenta quedó cerrada.'}</p>
            </div>
          </div>
          <SaleReceipt order={charged} payments={state.payments} clients={state.clients} />
        </Modal>
      )}
      {abonoFor && <AbonoModal clientId={abonoFor} onClose={() => setAbonoFor(null)} />}
    </div>
  );
}
