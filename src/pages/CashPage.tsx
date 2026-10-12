import { useState } from 'react';
import { ArrowDownToLine, ArrowUpFromLine, History, Lock, LockOpen, Wallet } from 'lucide-react';
import type { CashSession } from '../types';
import { useApp, useAttempt } from '../store/AppStore';
import { Button } from '../components/ui/Button';
import { Alert, Badge, Card, EmptyState, PageHeader, SummaryRow } from '../components/ui/Basics';
import { DataTable, type Column } from '../components/ui/DataTable';
import { Field, Input, MoneyInput } from '../components/ui/Field';
import { Modal } from '../components/ui/Modal';
import { USERS } from '../data/catalog';
import { currentSession, sessionSummary } from '../lib/calc';
import { fmtDateTime, fmtMoney, fmtTime, parseAmount, round2 } from '../lib/format';

function Difference({ value }: { value: number }) {
  if (Math.abs(value) < 0.005) return <Badge tone="success">Sin diferencia</Badge>;
  return <Badge tone={value > 0 ? 'info' : 'danger'}>{value > 0 ? `Sobrante ${fmtMoney(value)}` : `Faltante ${fmtMoney(-value)}`}</Badge>;
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

function CloseModal({ expected, onClose }: { expected: number; onClose: () => void }) {
  const { actions } = useApp();
  const attempt = useAttempt();
  const [countedText, setCountedText] = useState('');
  const [note, setNote] = useState('');
  const counted = parseAmount(countedText);
  const error = countedText.trim() !== '' && !(counted >= 0) ? 'Ingrese un importe válido.' : null;
  const valid = counted >= 0;
  return (
    <Modal
      title="Cerrar caja"
      description="Cuente el efectivo físico e ingrese el total."
      size="sm"
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>Cancelar</Button>
          <Button
            variant="primary"
            icon={Lock}
            disabled={!valid}
            onClick={() => {
              if (attempt(() => actions.closeCash({ counted, note }), 'Caja cerrada.').ok) onClose();
            }}
          >
            Cerrar caja
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-5">
        <div className="rounded-lg bg-marfil px-4 py-3">
          <SummaryRow label="Efectivo esperado" value={fmtMoney(expected)} strong />
        </div>
        <Field label="Efectivo contado" error={error}>
          <MoneyInput value={countedText} onChange={(e) => setCountedText(e.target.value)} invalid={Boolean(error)} autoFocus />
        </Field>
        <div className="flex items-center justify-between gap-4 rounded-lg border border-line px-4 py-3">
          <span className="text-sm font-medium text-ink">Diferencia</span>
          {valid ? <Difference value={round2(counted - expected)} /> : <span className="text-sm text-muted">Ingrese el efectivo contado</span>}
        </div>
        <Field label="Observación (opcional)">
          <Input value={note} onChange={(e) => setNote(e.target.value)} maxLength={100} placeholder="Ej. motivo de la diferencia" />
        </Field>
      </div>
    </Modal>
  );
}

export function CashPage() {
  const { state, actions } = useApp();
  const attempt = useAttempt();
  const [openingText, setOpeningText] = useState('0.00');
  const [movement, setMovement] = useState<'entrada' | 'salida' | null>(null);
  const [closing, setClosing] = useState(false);

  const session = currentSession(state);
  const summary = session ? sessionSummary(state, session) : null;
  const opening = parseAmount(openingText);
  const openingError = !(opening >= 0) ? 'Ingrese un importe válido, o 0.00 para abrir sin fondo.' : null;
  const history = state.cashSessions.filter((s) => s.closedAt).sort((a, b) => b.openedAt.localeCompare(a.openedAt));
  const moves = session ? state.cashMovements.filter((m) => m.sessionId === session.id).sort((a, b) => b.date.localeCompare(a.date)) : [];

  const historyColumns: Column<CashSession>[] = [
    { key: 'apertura', header: 'Apertura', render: (s) => <span className="whitespace-nowrap">{fmtDateTime(s.openedAt)}</span> },
    { key: 'cierre', header: 'Cierre', render: (s) => <span className="whitespace-nowrap">{fmtDateTime(s.closedAt!)}</span> },
    { key: 'inicial', header: 'Saldo inicial', align: 'right', render: (s) => fmtMoney(s.openingAmount) },
    { key: 'esperado', header: 'Esperado', align: 'right', render: (s) => fmtMoney(s.expectedAmount ?? 0) },
    { key: 'contado', header: 'Contado', align: 'right', render: (s) => fmtMoney(s.countedAmount ?? 0) },
    { key: 'diferencia', header: 'Diferencia', render: (s) => <Difference value={round2((s.countedAmount ?? 0) - (s.expectedAmount ?? 0))} /> },
  ];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Caja"
        description="Apertura, movimientos de efectivo y cierre de la sesión."
        actions={
          session && (
            <>
              <Button icon={ArrowDownToLine} onClick={() => setMovement('entrada')}>
                Registrar entrada
              </Button>
              <Button icon={ArrowUpFromLine} onClick={() => setMovement('salida')}>
                Registrar salida
              </Button>
              <Button variant="primary" icon={Lock} onClick={() => setClosing(true)}>
                Cerrar caja
              </Button>
            </>
          )
        }
      />

      {session && summary ? (
        <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-3">
          <Card title="Efectivo en caja" description={`Abierta el ${fmtDateTime(session.openedAt)} por ${session.user}`} action={<Badge tone="success">Abierta</Badge>} className="xl:col-span-2">
            <div className="flex flex-col gap-3">
              <SummaryRow label="Saldo inicial" value={fmtMoney(summary.opening)} />
              <SummaryRow label="Cobros de ventas en efectivo" value={`+ ${fmtMoney(summary.cashSales)}`} />
              <SummaryRow label="Abonos de crédito en efectivo" value={`+ ${fmtMoney(summary.cashAbonos)}`} />
              <SummaryRow label="Otras entradas de efectivo" value={`+ ${fmtMoney(summary.entries)}`} />
              <SummaryRow label="Salidas de efectivo" value={`- ${fmtMoney(summary.exits)}`} />
              <SummaryRow label="Gastos pagados en efectivo" value={`- ${fmtMoney(summary.cashExpenses)}`} />
              <div className="mt-1 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-t border-line pt-4">
                <span className="text-base font-semibold text-ink">Efectivo esperado</span>
                <span className="whitespace-nowrap text-3xl font-semibold tabular-nums tracking-tight text-ink">{fmtMoney(summary.expected)}</span>
              </div>
            </div>
          </Card>

          <Card title="Fuera del efectivo" description="Operaciones del turno que no entran a la gaveta">
            <div className="flex flex-col gap-3">
              <SummaryRow label="Transferencias recibidas" value={fmtMoney(summary.transfers)} />
              <SummaryRow label="Ventas al crédito" value={fmtMoney(summary.creditSales)} />
              <p className="mt-1 text-sm leading-relaxed text-muted">Estos importes se registran como ventas, pero no se suman al efectivo esperado.</p>
            </div>
          </Card>

          <Card title="Entradas y salidas manuales" flush className="xl:col-span-3">
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
        </div>
      ) : (
        <Card title="Abrir caja" description="No hay una sesión de caja abierta" action={<Badge tone="warning">Cerrada</Badge>} className="max-w-xl">
          <form
            className="flex flex-col gap-5"
            onSubmit={(e) => {
              e.preventDefault();
              if (!openingError) attempt(() => actions.openCash({ amount: opening, user: USERS[state.role] }), 'Caja abierta.');
            }}
          >
            <Field label="Saldo inicial en efectivo" hint="Puede abrir con L 0.00 o con el fondo de cambio disponible." error={openingError}>
              <MoneyInput value={openingText} onChange={(e) => setOpeningText(e.target.value)} invalid={Boolean(openingError)} />
            </Field>
            <div className="flex flex-wrap gap-2">
              {[0, 500, 1000].map((value) => (
                <Button key={value} size="sm" onClick={() => setOpeningText(value.toFixed(2))}>
                  {fmtMoney(value)}
                </Button>
              ))}
            </div>
            <Alert tone="info">Mientras la caja esté cerrada no se pueden registrar cobros en efectivo. Las transferencias y las ventas al crédito siguen disponibles.</Alert>
            <Button type="submit" variant="primary" size="lg" icon={LockOpen} disabled={Boolean(openingError)}>
              Abrir caja
            </Button>
          </form>
        </Card>
      )}

      <Card title="Sesiones anteriores" flush>
        <DataTable columns={historyColumns} rows={history} rowKey={(s) => s.id} minWidth={820} empty={<EmptyState icon={History} title="Sin sesiones cerradas" />} />
      </Card>

      {movement && <MovementModal type={movement} onClose={() => setMovement(null)} />}
      {closing && summary && <CloseModal expected={summary.expected} onClose={() => setClosing(false)} />}
    </div>
  );
}
