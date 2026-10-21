import { useState, type ReactNode } from 'react';
import { ArrowDownToLine, ArrowUpFromLine, CircleCheck, History, Lock, LockOpen, TriangleAlert, Wallet } from 'lucide-react';
import type { CashSession } from '../types';
import { useApp, useAttempt } from '../store/AppStore';
import { Button } from '../components/ui/Button';
import { Alert, Badge, Card, EmptyState, PageHeader, SummaryRow } from '../components/ui/Basics';
import { DataTable, type Column } from '../components/ui/DataTable';
import { Field, Input, MoneyInput } from '../components/ui/Field';
import { Modal } from '../components/ui/Modal';
import { USERS } from '../data/catalog';
import { currentSession, openOrders, orderTotal, serviceLabel, sessionSummary, sumBy, totalCreditBalance, type SessionSummary } from '../lib/calc';
import { cn, fmtFullDate, fmtMoney, fmtOrderNumber, fmtShortDate, fmtTime, parseAmount, round2 } from '../lib/format';
import { navigate } from '../lib/router';

/* Caja: punto central de la operación diaria. Hay una sola caja física; se abre al
   comenzar la jornada y solo se cierra cuando no quedan cuentas abiertas por cobrar. */

function CashStatus({ open }: { open: boolean }) {
  return (
    <span className="inline-flex items-center gap-2.5 text-lg font-semibold text-ink">
      <span className={cn('size-3 shrink-0 rounded-full', open ? 'bg-ok' : 'bg-bad')} aria-hidden />
      {open ? 'Caja abierta' : 'Caja cerrada'}
    </span>
  );
}

function Fact({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="bg-white px-5 py-4">
      <p className="text-xs font-medium uppercase tracking-wide text-muted">{label}</p>
      <div className="mt-1 text-base font-semibold tabular-nums text-ink">{value}</div>
    </div>
  );
}

function Difference({ value }: { value: number }) {
  if (Math.abs(value) < 0.005) return <Badge tone="success">Sin diferencia</Badge>;
  return <Badge tone={value > 0 ? 'info' : 'danger'}>{value > 0 ? `Sobrante ${fmtMoney(value)}` : `Faltante ${fmtMoney(-value)}`}</Badge>;
}

/** Ventas del día por método. El crédito es venta, pero no dinero recibido. */
function SalesBreakdown({ summary }: { summary: SessionSummary }) {
  return (
    <div className="flex flex-col gap-3">
      <SummaryRow label="Efectivo" value={fmtMoney(summary.sales.efectivo)} />
      <SummaryRow label="Transferencias" value={fmtMoney(summary.sales.transferencia)} />
      <SummaryRow label="Créditos" value={fmtMoney(summary.sales.credito)} />
      <div className="mt-1 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-t border-line pt-3">
        <span className="text-base font-semibold text-ink">Ventas totales</span>
        <span className="whitespace-nowrap text-2xl font-semibold tabular-nums tracking-tight text-ink">{fmtMoney(summary.sales.total)}</span>
      </div>
    </div>
  );
}

function OpenModal({ onClose }: { onClose: () => void }) {
  const { state, actions } = useApp();
  const attempt = useAttempt();
  const [amountText, setAmountText] = useState('0.00');
  const amount = amountText.trim() === '' ? 0 : parseAmount(amountText);
  const error = !(amount >= 0) ? 'Ingrese un monto válido. Puede abrir con L 0.00.' : null;
  const open = () => {
    if (!error && attempt(() => actions.openCash({ amount, user: USERS[state.role] }), 'Caja abierta.').ok) onClose();
  };
  return (
    <Modal
      title="Abrir caja"
      size="sm"
      onClose={onClose}
      footer={
        <>
          <Button size="lg" onClick={onClose}>
            Cancelar
          </Button>
          <Button size="lg" variant="primary" icon={LockOpen} disabled={Boolean(error)} onClick={open}>
            Abrir caja
          </Button>
        </>
      }
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          open();
        }}
      >
        <Field label="Monto inicial" hint="El monto inicial corresponde al efectivo disponible en caja al comenzar la jornada." error={error}>
          <MoneyInput value={amountText} onChange={(e) => setAmountText(e.target.value)} onFocus={(e) => e.target.select()} invalid={Boolean(error)} className="h-12 text-base" autoFocus />
        </Field>
        <button type="submit" hidden />
      </form>
    </Modal>
  );
}

/** Cierre bloqueado: hay cuentas con consumo pendiente de cobro. */
function BlockedModal({ onClose }: { onClose: () => void }) {
  const { state } = useApp();
  const pending = openOrders(state);
  const count = pending.length;
  return (
    <Modal
      title="No se puede cerrar la caja"
      onClose={onClose}
      footer={
        <>
          <Button size="lg" onClick={onClose}>
            Volver
          </Button>
          <Button size="lg" variant="primary" onClick={() => navigate('cobro')}>
            Ver cuentas abiertas
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-5">
        <Alert tone="warning">
          <span className="font-semibold">
            Hay {count === 1 ? '1 cuenta abierta pendiente' : `${count} cuentas abiertas pendientes`} de cobro.
          </span>{' '}
          Estas cuentas deben finalizarse antes de cerrar la caja.
        </Alert>
        <ul className="divide-y divide-line rounded-lg border border-line">
          {pending.map((order) => (
            <li key={order.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-ink">{serviceLabel(order)}</p>
                <p className="truncate text-sm text-muted">
                  {fmtOrderNumber(order.number)} · desde las {fmtTime(order.createdAt)}
                  {order.customer ? ` · ${order.customer}` : ''}
                </p>
              </div>
              <span className="text-base font-semibold tabular-nums text-ink">{fmtMoney(orderTotal(order))}</span>
              <Button size="sm" onClick={() => navigate('cobro', { pedido: order.id })}>
                Ver cuenta
              </Button>
            </li>
          ))}
        </ul>
        <p className="text-sm leading-relaxed text-muted">
          Puede cobrar cada cuenta en Cobro y ventas. Las ventas al crédito que ya se finalizaron no impiden el cierre: quedan registradas como cuentas por cobrar.
        </p>
      </div>
    </Modal>
  );
}

/** Cierre en dos pasos: resumen con efectivo declarado y, al confirmar, el comprobante de cierre. */
function CloseModal({ sessionId, onClose }: { sessionId: string; onClose: () => void }) {
  const { state, actions } = useApp();
  const attempt = useAttempt();
  const [countedText, setCountedText] = useState('');
  const [note, setNote] = useState('');
  const session = state.cashSessions.find((s) => s.id === sessionId);
  if (!session) return null;

  const summary = sessionSummary(state, session);
  const done = session.closedAt !== null;
  const expected = done ? session.expectedAmount ?? summary.expected : summary.expected;
  const counted = done ? session.countedAmount ?? 0 : parseAmount(countedText);
  const error = !done && countedText.trim() !== '' && !(counted >= 0) ? 'Ingrese un importe válido.' : null;
  const valid = counted >= 0;

  const cashBlock = (
    <section className="flex flex-col gap-3">
      <h3 className="text-xs font-medium uppercase tracking-wide text-muted">Efectivo en caja</h3>
      <div className="rounded-lg bg-marfil px-4 py-3">
        <SummaryRow label="Efectivo esperado" value={fmtMoney(expected)} strong />
        {!done && (
          <p className="mt-1 text-xs leading-relaxed text-muted">
            Monto inicial, cobros y abonos en efectivo y entradas, menos salidas y gastos pagados en efectivo. No incluye transferencias ni créditos.
          </p>
        )}
      </div>
      {done ? (
        <SummaryRow label="Efectivo declarado" value={fmtMoney(counted)} />
      ) : (
        <Field label="Efectivo declarado" hint="Cuente el efectivo físico de la gaveta e ingrese el total." error={error}>
          <MoneyInput value={countedText} onChange={(e) => setCountedText(e.target.value)} invalid={Boolean(error)} className="h-12 text-base" autoFocus />
        </Field>
      )}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-line px-4 py-3">
        <span className="text-sm font-medium text-ink">Diferencia</span>
        {valid ? (
          <span className="flex items-center gap-3">
            <span className="text-sm font-semibold tabular-nums text-ink">{fmtMoney(round2(counted - expected))}</span>
            <Difference value={round2(counted - expected)} />
          </span>
        ) : (
          <span className="text-sm text-muted">Ingrese el efectivo declarado</span>
        )}
      </div>
    </section>
  );

  if (done) {
    return (
      <Modal
        title="Caja cerrada correctamente"
        onClose={onClose}
        footer={
          <Button size="lg" variant="primary" onClick={onClose}>
            Listo
          </Button>
        }
      >
        <div className="flex flex-col gap-5">
          <div className="flex items-center gap-4 rounded-lg border border-ok/25 bg-ok-soft px-4 py-4">
            <CircleCheck className="size-8 shrink-0 text-ok" aria-hidden />
            <div>
              <p className="text-base font-semibold text-ink">Caja cerrada correctamente.</p>
              <p className="text-sm text-muted">El cierre quedó registrado en el historial.</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-line bg-line">
            <Fact label="Fecha de cierre" value={fmtFullDate(session.closedAt!)} />
            <Fact label="Hora de cierre" value={fmtTime(session.closedAt!)} />
            <Fact label="Ventas del día" value={fmtMoney(summary.sales.total)} />
            <Fact label="Estado" value={<CashStatus open={false} />} />
          </div>
          {cashBlock}
        </div>
      </Modal>
    );
  }

  return (
    <Modal
      title="Cierre de caja"
      description={`Abierta el ${fmtFullDate(session.openedAt)} a las ${fmtTime(session.openedAt)}`}
      onClose={onClose}
      footer={
        <>
          <Button size="lg" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            size="lg"
            variant="primary"
            icon={Lock}
            disabled={!valid}
            onClick={() => attempt(() => actions.closeCash({ counted, note }))}
          >
            Cerrar caja
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-6">
        <section className="flex flex-col gap-3">
          <h3 className="text-xs font-medium uppercase tracking-wide text-muted">Ventas del día</h3>
          <SalesBreakdown summary={summary} />
          {summary.sales.credito > 0 && <p className="text-xs leading-relaxed text-muted">Las ventas al crédito quedan como cuentas por cobrar y no bloquean el cierre.</p>}
        </section>
        {cashBlock}
        <Field label="Observación (opcional)">
          <Input value={note} onChange={(e) => setNote(e.target.value)} maxLength={100} placeholder="Ej. motivo de la diferencia" />
        </Field>
      </div>
    </Modal>
  );
}

function MovementModal({ type, onClose }: { type: 'entrada' | 'salida'; onClose: () => void }) {
  const { actions } = useApp();
  const attempt = useAttempt();
  const [amountText, setAmountText] = useState('');
  const [description, setDescription] = useState('');
  const amount = parseAmount(amountText);
  const amountError = amountText.trim() !== '' && !(amount > 0) ? 'Ingrese un importe mayor que cero.' : null;
  const valid = amount > 0 && description.trim().length >= 3;
  return (
    <Modal
      title={type === 'entrada' ? 'Registrar entrada de efectivo' : 'Registrar salida de efectivo'}
      size="sm"
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>Cancelar</Button>
          <Button
            variant="primary"
            disabled={!valid}
            onClick={() => {
              if (attempt(() => actions.addCashMovement({ type, amount, description }), 'Movimiento de caja registrado.').ok) onClose();
            }}
          >
            Registrar
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-5">
        <Field label="Importe" error={amountError}>
          <MoneyInput value={amountText} onChange={(e) => setAmountText(e.target.value)} invalid={Boolean(amountError)} autoFocus />
        </Field>
        <Field label="Motivo" hint={type === 'entrada' ? 'Ej. sencillo adicional para dar cambio.' : 'Ej. retiro para depósito bancario.'}>
          <Input value={description} onChange={(e) => setDescription(e.target.value)} maxLength={80} />
        </Field>
      </div>
    </Modal>
  );
}

export function CashPage() {
  const { state } = useApp();
  const [opening, setOpening] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [closingId, setClosingId] = useState<string | null>(null);
  const [movement, setMovement] = useState<'entrada' | 'salida' | null>(null);

  const session = currentSession(state);
  const summary = session ? sessionSummary(state, session) : null;
  const pending = openOrders(state);
  const receivable = totalCreditBalance(state);
  const history = state.cashSessions.filter((s) => s.closedAt).sort((a, b) => b.closedAt!.localeCompare(a.closedAt!));
  const lastClosed = history[0];
  const moves = session ? state.cashMovements.filter((m) => m.sessionId === session.id).sort((a, b) => b.date.localeCompare(a.date)) : [];

  const requestClose = () => {
    if (!session) return;
    if (pending.length > 0) setBlocked(true);
    else setClosingId(session.id);
  };

  const historyRows = history.map((s) => ({ session: s, summary: sessionSummary(state, s) }));
  const historyColumns: Column<{ session: CashSession; summary: SessionSummary }>[] = [
    {
      key: 'fecha',
      header: 'Fecha',
      render: ({ session: s }) => (
        <div className="whitespace-nowrap">
          <p className="font-medium">{fmtShortDate(s.openedAt)}</p>
          <p className="text-muted">
            {fmtTime(s.openedAt)} – {fmtTime(s.closedAt!)}
          </p>
        </div>
      ),
    },
    { key: 'ventas', header: 'Ventas', align: 'right', render: ({ summary: x }) => <span className="font-semibold">{fmtMoney(x.sales.total)}</span> },
    { key: 'efectivo', header: 'Efectivo', align: 'right', render: ({ summary: x }) => fmtMoney(x.sales.efectivo) },
    { key: 'transferencias', header: 'Transferencias', align: 'right', render: ({ summary: x }) => fmtMoney(x.sales.transferencia) },
    { key: 'credito', header: 'Crédito', align: 'right', render: ({ summary: x }) => fmtMoney(x.sales.credito) },
    { key: 'declarado', header: 'Efectivo declarado', align: 'right', render: ({ session: s }) => fmtMoney(s.countedAmount ?? 0) },
    { key: 'diferencia', header: 'Diferencia', render: ({ session: s }) => <Difference value={round2((s.countedAmount ?? 0) - (s.expectedAmount ?? 0))} /> },
  ];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Caja"
        description="Apertura, operación y cierre diario de la caja del restaurante."
        actions={
          session && (
            <>
              <Button icon={ArrowDownToLine} onClick={() => setMovement('entrada')}>
                Registrar entrada
              </Button>
              <Button icon={ArrowUpFromLine} onClick={() => setMovement('salida')}>
                Registrar salida
              </Button>
            </>
          )
        }
      />

      {session && summary ? (
        <>
          <section className="overflow-hidden rounded-xl border border-line bg-white" aria-label="Estado de la caja">
            <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
              <CashStatus open />
              <p className="text-sm text-muted">Las operaciones del día se registran en esta caja.</p>
            </div>
            <div className="grid grid-cols-2 gap-px border-t border-line bg-line lg:grid-cols-4">
              <Fact label="Fecha" value={fmtFullDate(session.openedAt)} />
              <Fact label="Hora de apertura" value={fmtTime(session.openedAt)} />
              <Fact label="Monto inicial" value={fmtMoney(session.openingAmount)} />
              <Fact label="Abierta por" value={session.user} />
            </div>
          </section>

          <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-2 xl:grid-cols-3">
            <Card title="Ventas del día" description="Desde la apertura de la caja">
              <SalesBreakdown summary={summary} />
            </Card>

            <Card title="Efectivo en caja" description="Lo que debería haber en la gaveta">
              <div className="flex flex-col gap-3">
                <SummaryRow label="Monto inicial" value={fmtMoney(summary.opening)} />
                <SummaryRow label="Cobros en efectivo" value={`+ ${fmtMoney(summary.cashSales)}`} />
                <SummaryRow label="Abonos en efectivo" value={`+ ${fmtMoney(summary.cashAbonos)}`} />
                <SummaryRow label="Entradas de efectivo" value={`+ ${fmtMoney(summary.entries)}`} />
                <SummaryRow label="Salidas de efectivo" value={`- ${fmtMoney(summary.exits)}`} />
                <SummaryRow label="Gastos en efectivo" value={`- ${fmtMoney(summary.cashExpenses)}`} />
                <div className="mt-1 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-t border-line pt-3">
                  <span className="text-base font-semibold text-ink">Efectivo esperado</span>
                  <span className="whitespace-nowrap text-2xl font-semibold tabular-nums tracking-tight text-ink">{fmtMoney(summary.expected)}</span>
                </div>
              </div>
            </Card>

            <Card title="Cierre de caja" description="Lo que se revisa antes de cerrar" className="lg:col-span-2 xl:col-span-1">
              <div className="flex flex-col gap-4">
                <div className={cn('rounded-lg border px-4 py-3', pending.length > 0 ? 'border-warn/30 bg-warn-soft' : 'border-line')}>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm font-medium text-ink">Cuentas abiertas</span>
                    <span className="text-2xl font-semibold tabular-nums text-ink">{pending.length}</span>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                    {pending.length > 0 ? (
                      <>
                        <span className="inline-flex items-center gap-1.5 text-sm font-medium text-warn">
                          <TriangleAlert className="size-4" aria-hidden /> Cierre bloqueado
                        </span>
                        <span className="text-sm tabular-nums text-ink">{fmtMoney(sumBy(pending, orderTotal))} por cobrar</span>
                      </>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 text-sm font-medium text-ok">
                        <CircleCheck className="size-4" aria-hidden /> Todas las cuentas están finalizadas
                      </span>
                    )}
                  </div>
                </div>
                <div className="rounded-lg border border-line px-4 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm font-medium text-ink">Cuentas por cobrar</span>
                    <span className="text-lg font-semibold tabular-nums text-ink">{fmtMoney(receivable)}</span>
                  </div>
                  <p className="mt-1 text-sm text-muted">Ventas al crédito ya finalizadas, pendientes de pago. No bloquean el cierre.</p>
                </div>
                <Button variant="primary" size="lg" full icon={Lock} onClick={requestClose}>
                  Cerrar caja
                </Button>
              </div>
            </Card>
          </div>

          <Card title="Entradas y salidas de efectivo" flush>
            {moves.length === 0 ? (
              <EmptyState icon={Wallet} title="Sin movimientos manuales" description="Las entradas y salidas de efectivo que registre aparecerán aquí." />
            ) : (
              <ul className="divide-y divide-line">
                {moves.map((m) => (
                  <li key={m.id} className="flex items-center gap-4 px-5 py-3">
                    <Badge tone={m.type === 'entrada' ? 'success' : 'neutral'}>{m.type === 'entrada' ? 'Entrada' : 'Salida'}</Badge>
                    <span className="min-w-0 flex-1 truncate text-sm text-ink">{m.description}</span>
                    <span className="hidden text-sm text-muted sm:block">{fmtTime(m.date)}</span>
                    <span className="text-sm font-semibold tabular-nums text-ink">
                      {m.type === 'entrada' ? '+' : '-'} {fmtMoney(m.amount)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </>
      ) : (
        <section className="overflow-hidden rounded-xl border border-line bg-white" aria-label="Estado de la caja">
          <div className="flex flex-wrap items-center justify-between gap-4 px-5 py-5">
            <div className="min-w-0">
              <CashStatus open={false} />
              <p className="mt-1 text-sm text-muted">No se pueden registrar nuevas operaciones hasta realizar una apertura.</p>
            </div>
            <Button variant="primary" size="lg" icon={LockOpen} onClick={() => setOpening(true)}>
              Abrir caja
            </Button>
          </div>
          {lastClosed && (
            <div className="grid grid-cols-2 gap-px border-t border-line bg-line lg:grid-cols-4">
              <Fact label="Último cierre" value={fmtFullDate(lastClosed.closedAt!)} />
              <Fact label="Hora de cierre" value={fmtTime(lastClosed.closedAt!)} />
              <Fact label="Ventas del último día" value={fmtMoney(sessionSummary(state, lastClosed).sales.total)} />
              <Fact label="Efectivo declarado" value={fmtMoney(lastClosed.countedAmount ?? 0)} />
            </div>
          )}
        </section>
      )}

      <Card title="Historial de cierres" description="Cada cierre conserva sus ventas y el arqueo de efectivo" flush>
        <DataTable columns={historyColumns} rows={historyRows} rowKey={(r) => r.session.id} minWidth={700} empty={<EmptyState icon={History} title="Sin cierres registrados" />} />
      </Card>

      {opening && <OpenModal onClose={() => setOpening(false)} />}
      {blocked && <BlockedModal onClose={() => setBlocked(false)} />}
      {closingId && <CloseModal sessionId={closingId} onClose={() => setClosingId(null)} />}
      {movement && <MovementModal type={movement} onClose={() => setMovement(null)} />}
    </div>
  );
}
