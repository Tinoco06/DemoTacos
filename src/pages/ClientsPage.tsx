import { useState } from 'react';
import { Eye, HandCoins, Plus, Users } from 'lucide-react';
import type { Client } from '../types';
import { useApp, useAttempt } from '../store/AppStore';
import { Button } from '../components/ui/Button';
import { Alert, Badge, Card, EmptyState, PageHeader, StatCard, SummaryRow } from '../components/ui/Basics';
import { DataTable, type Column } from '../components/ui/DataTable';
import { Checkbox, Field, Input } from '../components/ui/Field';
import { Modal } from '../components/ui/Modal';
import { AbonoModal } from '../components/domain/AbonoModal';
import { METHOD_LABEL, clientBalance, sumBy, totalCreditBalance } from '../lib/calc';
import { fmtDateTime, fmtMoney, fmtOrderNumber } from '../lib/format';

function ClientFormModal({ client, onClose }: { client: Client | null; onClose: () => void }) {
  const { actions } = useApp();
  const attempt = useAttempt();
  const [name, setName] = useState(client?.name ?? '');
  const [contact, setContact] = useState(client?.contact ?? '');
  const [phone, setPhone] = useState(client?.phone ?? '');
  const [creditAuthorized, setCreditAuthorized] = useState(client?.creditAuthorized ?? false);
  const [submitted, setSubmitted] = useState(false);
  const nameError = name.trim().length < 2 ? 'Ingrese el nombre del cliente.' : null;

  const save = () => {
    setSubmitted(true);
    if (nameError) return;
    if (attempt(() => actions.saveClient({ id: client?.id ?? null, name, contact, phone, creditAuthorized }), client ? 'Cliente actualizado.' : 'Cliente creado.').ok) onClose();
  };

  return (
    <Modal
      title={client ? 'Editar cliente' : 'Nuevo cliente'}
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>Cancelar</Button>
          <Button variant="primary" onClick={save}>
            Guardar cliente
          </Button>
        </>
      }
    >
      <form
        className="grid grid-cols-1 gap-5 sm:grid-cols-2"
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
      >
        <Field label="Nombre o entidad" error={submitted ? nameError : null} className="sm:col-span-2">
          <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={60} autoFocus invalid={submitted && Boolean(nameError)} />
        </Field>
        <Field label="Persona de contacto">
          <Input value={contact} onChange={(e) => setContact(e.target.value)} maxLength={60} />
        </Field>
        <Field label="Teléfono">
          <Input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} maxLength={20} />
        </Field>
        <div className="sm:col-span-2">
          <Checkbox label="Crédito autorizado" hint="Solo los clientes autorizados pueden recibir ventas al crédito." checked={creditAuthorized} onChange={(e) => setCreditAuthorized(e.target.checked)} />
        </div>
        <button type="submit" hidden />
      </form>
    </Modal>
  );
}

function ClientDetailModal({ client, onClose, onEdit, onAbono }: { client: Client; onClose: () => void; onEdit: () => void; onAbono: () => void }) {
  const { state } = useApp();
  const balance = clientBalance(state, client.id);
  const mine = state.payments.filter((p) => p.clientId === client.id).sort((a, b) => b.date.localeCompare(a.date));
  const charged = sumBy(mine.filter((p) => p.kind === 'venta'), (p) => p.amount);
  const paid = sumBy(mine.filter((p) => p.kind === 'abono'), (p) => p.amount);

  return (
    <Modal
      title={client.name}
      description={[client.contact, client.phone].filter(Boolean).join(' · ')}
      size="lg"
      onClose={onClose}
      footer={
        <>
          <Button onClick={onEdit}>Editar datos</Button>
          <Button variant="primary" icon={HandCoins} disabled={balance <= 0} onClick={onAbono}>
            Registrar abono
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-5">
        <div className="flex flex-col gap-2 rounded-lg bg-marfil px-4 py-4">
          <div className="mb-1">
            <Badge tone={client.creditAuthorized ? 'success' : 'neutral'}>{client.creditAuthorized ? 'Crédito autorizado' : 'Crédito no autorizado'}</Badge>
          </div>
          <SummaryRow label="Compras al crédito" value={fmtMoney(charged)} />
          <SummaryRow label="Abonos recibidos" value={`- ${fmtMoney(paid)}`} />
          <div className="border-t border-line pt-2">
            <SummaryRow label="Saldo pendiente" value={<span className="text-xl">{fmtMoney(balance)}</span>} strong />
          </div>
        </div>
        <div>
          <h3 className="mb-2 text-sm font-semibold text-ink">Movimientos de la cuenta</h3>
          {mine.length === 0 ? (
            <p className="rounded-lg border border-line px-4 py-6 text-center text-sm text-muted">Este cliente todavía no tiene compras al crédito.</p>
          ) : (
            <ul className="divide-y divide-line rounded-lg border border-line">
              {mine.map((p) => {
                const order = state.orders.find((o) => o.id === p.orderId);
                return (
                  <li key={p.id} className="flex items-center gap-4 px-4 py-3 text-sm">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-ink">{p.kind === 'venta' ? `Compra al crédito${order ? ` · pedido ${fmtOrderNumber(order.number)}` : ''}` : `Abono · ${METHOD_LABEL[p.method]}`}</p>
                      <p className="text-muted">{fmtDateTime(p.date)}</p>
                    </div>
                    <span className={`shrink-0 font-semibold tabular-nums ${p.kind === 'abono' ? 'text-ok' : 'text-ink'}`}>
                      {p.kind === 'abono' ? '- ' : '+ '}
                      {fmtMoney(p.amount)}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </Modal>
  );
}

type Dialog = { kind: 'detalle' | 'editar' | 'abono'; id: string } | { kind: 'nuevo' } | null;

export function ClientsPage() {
  const { state } = useApp();
  const [dialog, setDialog] = useState<Dialog>(null);
  const selected = dialog && dialog.kind !== 'nuevo' ? state.clients.find((c) => c.id === dialog.id) : undefined;

  const columns: Column<Client>[] = [
    {
      key: 'cliente',
      header: 'Cliente',
      render: (c) => (
        <div>
          <p className="font-medium">{c.name}</p>
          <p className="text-muted">{c.contact || 'Sin contacto'}</p>
        </div>
      ),
    },
    { key: 'telefono', header: 'Teléfono', render: (c) => <span className="whitespace-nowrap">{c.phone || '—'}</span> },
    { key: 'credito', header: 'Crédito', render: (c) => <Badge tone={c.creditAuthorized ? 'success' : 'neutral'}>{c.creditAuthorized ? 'Autorizado' : 'No autorizado'}</Badge> },
    { key: 'saldo', header: 'Saldo pendiente', align: 'right', render: (c) => <span className="font-semibold">{fmtMoney(clientBalance(state, c.id))}</span> },
    {
      key: 'acciones',
      sticky: true,
      header: 'Acciones',
      align: 'right',
      render: (c) => (
        <div className="flex justify-end gap-2">
          <Button size="sm" icon={Eye} onClick={() => setDialog({ kind: 'detalle', id: c.id })}>
            Ver cuenta
          </Button>
          <Button size="sm" variant="primary" disabled={clientBalance(state, c.id) <= 0} onClick={() => setDialog({ kind: 'abono', id: c.id })}>
            Abonar
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Clientes y créditos"
        description="Entidades que compran al crédito y sus saldos pendientes."
        actions={
          <Button variant="primary" icon={Plus} onClick={() => setDialog({ kind: 'nuevo' })}>
            Nuevo cliente
          </Button>
        }
      />
      <Alert tone="info">Los clientes mostrados son ficticios y se utilizan únicamente para la demostración.</Alert>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <StatCard label="Saldo pendiente total" value={fmtMoney(totalCreditBalance(state))} hint="Ventas al crédito menos abonos" icon={HandCoins} />
        <StatCard label="Clientes con crédito autorizado" value={state.clients.filter((c) => c.creditAuthorized).length} hint={`${state.clients.length} clientes registrados`} icon={Users} />
      </div>

      <Card flush>
        <DataTable columns={columns} rows={state.clients} rowKey={(c) => c.id} minWidth={700} empty={<EmptyState icon={Users} title="Sin clientes registrados" />} />
      </Card>

      {dialog?.kind === 'nuevo' && <ClientFormModal client={null} onClose={() => setDialog(null)} />}
      {dialog?.kind === 'editar' && selected && <ClientFormModal client={selected} onClose={() => setDialog({ kind: 'detalle', id: selected.id })} />}
      {dialog?.kind === 'abono' && selected && <AbonoModal clientId={selected.id} onClose={() => setDialog(null)} />}
      {dialog?.kind === 'detalle' && selected && (
        <ClientDetailModal client={selected} onClose={() => setDialog(null)} onEdit={() => setDialog({ kind: 'editar', id: selected.id })} onAbono={() => setDialog({ kind: 'abono', id: selected.id })} />
      )}
    </div>
  );
}
