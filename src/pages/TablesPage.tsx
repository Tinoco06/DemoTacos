import { useState } from 'react';
import { Bike, LayoutGrid, Pencil, Plus, Settings2 } from 'lucide-react';
import type { DiningTable } from '../types';
import { useApp, useAttempt } from '../store/AppStore';
import { Button } from '../components/ui/Button';
import { Alert, Badge, Card, EmptyState, PageHeader } from '../components/ui/Basics';
import { Input } from '../components/ui/Field';
import { Modal } from '../components/ui/Modal';
import { TableCard } from '../components/domain/Cards';
import { currentSession, openOrderForTable, openOrders, orderTotal, serviceLabel } from '../lib/calc';
import { fmtMoney, fmtOrderNumber, fmtTime } from '../lib/format';
import { navigate } from '../lib/router';

function ManageTablesModal({ onClose }: { onClose: () => void }) {
  const { state, actions } = useApp();
  const attempt = useAttempt();
  const [newName, setNewName] = useState('');
  const [editing, setEditing] = useState<{ id: string; name: string } | null>(null);
  const suggestion = `Mesa ${state.tables.length + 1}`;

  const add = () => {
    const name = newName.trim() || suggestion;
    if (attempt(() => actions.saveTable({ id: null, name }), `${name} agregada.`).ok) setNewName('');
  };
  const rename = () => {
    if (editing && attempt(() => actions.saveTable(editing), 'Mesa actualizada.').ok) setEditing(null);
  };
  const toggle = (table: DiningTable) =>
    attempt(() => actions.setTableActive({ id: table.id, active: !table.active }), table.active ? `${table.name} desactivada.` : `${table.name} activada.`);

  return (
    <Modal title="Administrar mesas" description="Agregue, renombre o desactive mesas. No hay un límite de cantidad." onClose={onClose} footer={<Button onClick={onClose}>Listo</Button>}>
      <form
        className="mb-5 flex gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          add();
        }}
      >
        <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder={suggestion} aria-label="Nombre de la nueva mesa" maxLength={24} />
        <Button type="submit" variant="primary" icon={Plus}>
          Agregar mesa
        </Button>
      </form>
      <ul className="divide-y divide-line rounded-lg border border-line">
        {state.tables.map((table) => {
          const busy = Boolean(openOrderForTable(state, table.id));
          const isEditing = editing?.id === table.id;
          return (
            <li key={table.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
              {isEditing ? (
                <form
                  className="flex min-w-0 flex-1 gap-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    rename();
                  }}
                >
                  <Input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} aria-label="Nombre de la mesa" maxLength={24} autoFocus />
                  <Button type="submit" variant="primary">
                    Guardar
                  </Button>
                  <Button onClick={() => setEditing(null)}>Cancelar</Button>
                </form>
              ) : (
                <>
                  <div className="min-w-32 flex-1">
                    <p className="truncate text-sm font-medium text-ink">{table.name}</p>
                    <div className="mt-1">{!table.active ? <Badge>Inactiva</Badge> : busy ? <Badge tone="warning">Cuenta abierta</Badge> : <Badge tone="success">Libre</Badge>}</div>
                  </div>
                  <Button size="sm" icon={Pencil} onClick={() => setEditing({ id: table.id, name: table.name })}>
                    Editar
                  </Button>
                  <Button size="sm" disabled={busy} title={busy ? 'Resuelva la cuenta abierta antes de desactivar la mesa' : undefined} onClick={() => toggle(table)} className="w-28">
                    {table.active ? 'Desactivar' : 'Activar'}
                  </Button>
                </>
              )}
            </li>
          );
        })}
      </ul>
      <p className="mt-3 text-xs text-muted">Una mesa con cuenta abierta no puede desactivarse hasta que la cuenta se cobre o se cancele.</p>
    </Modal>
  );
}

export function TablesPage() {
  const { state } = useApp();
  const [managing, setManaging] = useState(false);
  const isAdmin = state.role === 'admin';
  const tables = state.tables.filter((t) => t.active);
  const busy = tables.filter((t) => openOrderForTable(state, t.id)).length;
  const others = openOrders(state).filter((o) => o.service !== 'mesa');

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Mesas"
        description={`${busy} con cuenta abierta · ${tables.length - busy} libres`}
        actions={
          <>
            <Button size="lg" icon={Bike} onClick={() => navigate('pedido', { servicio: 'domicilio' })}>
              Pedido a domicilio
            </Button>
            {isAdmin && (
              <Button size="lg" icon={Settings2} onClick={() => setManaging(true)}>
                Administrar mesas
              </Button>
            )}
          </>
        }
      />

      {!currentSession(state) && (
        <Alert
          tone="warning"
          action={
            isAdmin && (
              <Button size="sm" variant="primary" onClick={() => navigate('caja')}>
                Abrir caja
              </Button>
            )
          }
        >
          <span className="font-semibold">La caja está cerrada.</span> No se pueden tomar pedidos hasta realizar la apertura{isAdmin ? '.' : '. Pida al administrador que abra la caja.'}
        </Alert>
      )}

      {tables.length === 0 ? (
        <Card>
          <EmptyState icon={LayoutGrid} title="No hay mesas activas" description={isAdmin ? 'Agregue o active mesas para comenzar a tomar pedidos.' : 'Pida al administrador que active las mesas.'} />
        </Card>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {tables.map((table) => (
            <TableCard key={table.id} table={table} order={openOrderForTable(state, table.id)} onSelect={() => navigate('pedido', { mesa: table.id })} />
          ))}
        </div>
      )}

      {others.length > 0 && (
        <Card title="Pedidos a domicilio" description="Cuentas abiertas fuera de las mesas" flush>
          <ul className="divide-y divide-line">
            {others.map((order) => (
              <li key={order.id}>
                <button type="button" onClick={() => navigate('pedido', { pedido: order.id })} className="flex min-h-16 w-full items-center gap-4 px-5 py-3 text-left hover:bg-marfil">
                  <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-crema-soft text-warn">
                    <Bike className="size-5" aria-hidden />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium text-ink">
                      {serviceLabel(order)} · {fmtOrderNumber(order.number)}
                    </span>
                    <span className="block truncate text-sm text-muted">{order.customer || `Desde las ${fmtTime(order.createdAt)}`}</span>
                  </span>
                  <span className="text-base font-semibold tabular-nums text-ink">{fmtMoney(orderTotal(order))}</span>
                </button>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {managing && <ManageTablesModal onClose={() => setManaging(false)} />}
    </div>
  );
}
