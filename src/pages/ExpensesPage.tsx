import { useState } from 'react';
import { Plus, ReceiptText, Trash2 } from 'lucide-react';
import { EXPENSE_CATEGORIES, type Expense, type ExpenseCategory } from '../types';
import { useApp, useAttempt } from '../store/AppStore';
import { Button } from '../components/ui/Button';
import { Alert, Badge, Card, EmptyState, PageHeader } from '../components/ui/Basics';
import { DataTable, type Column } from '../components/ui/DataTable';
import { Field, Input, MoneyInput, Select } from '../components/ui/Field';
import { ConfirmDialog, Modal } from '../components/ui/Modal';
import { currentSession, inRange, sumBy } from '../lib/calc';
import { addDays, endOfDay, fmtDate, fmtMoney, fromDateInput, parseAmount, startOfDay, toDateInput } from '../lib/format';

function ExpenseModal({ onClose }: { onClose: () => void }) {
  const { state, actions } = useApp();
  const attempt = useAttempt();
  const today = toDateInput(new Date());
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<ExpenseCategory>('Insumos');
  const [dateText, setDateText] = useState(today);
  const [amountText, setAmountText] = useState('');
  const [method, setMethod] = useState<Expense['method']>('efectivo');
  const [submitted, setSubmitted] = useState(false);

  const amount = parseAmount(amountText);
  const date = fromDateInput(dateText);
  const errors = {
    description: description.trim().length < 3 ? 'Describa el gasto (mínimo 3 caracteres).' : null,
    amount: !(amount > 0) ? 'Ingrese un importe mayor que cero.' : null,
    date: !date ? 'Seleccione una fecha.' : dateText > today ? 'La fecha no puede ser futura.' : null,
  };
  const valid = !errors.description && !errors.amount && !errors.date;
  const fromCash = method === 'efectivo' && dateText === today && Boolean(currentSession(state));

  const save = () => {
    setSubmitted(true);
    if (!valid || !date) return;
    if (attempt(() => actions.addExpense({ description, category, date, amount, method }), 'Gasto registrado.').ok) onClose();
  };

  return (
    <Modal
      title="Registrar gasto"
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>Cancelar</Button>
          <Button variant="primary" onClick={save}>
            Guardar gasto
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
        <Field label="Descripción" error={submitted ? errors.description : null} className="sm:col-span-2">
          <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Ej. compra de carnes y verduras" maxLength={80} autoFocus invalid={submitted && Boolean(errors.description)} />
        </Field>
        <Field label="Categoría">
          <Select value={category} onChange={(e) => setCategory(e.target.value as ExpenseCategory)}>
            {EXPENSE_CATEGORIES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </Select>
        </Field>
        <Field label="Fecha" error={submitted ? errors.date : null}>
          <Input type="date" value={dateText} max={today} onChange={(e) => setDateText(e.target.value)} invalid={submitted && Boolean(errors.date)} />
        </Field>
        <Field label="Importe" error={submitted ? errors.amount : null}>
          <MoneyInput value={amountText} onChange={(e) => setAmountText(e.target.value)} invalid={submitted && Boolean(errors.amount)} />
        </Field>
        <Field label="Método de pago">
          <Select value={method} onChange={(e) => setMethod(e.target.value as Expense['method'])}>
            <option value="efectivo">Efectivo</option>
            <option value="transferencia">Transferencia</option>
          </Select>
        </Field>
        {fromCash && (
          <div className="sm:col-span-2">
            <Alert tone="info">Este gasto se descontará del efectivo esperado de la caja abierta.</Alert>
          </div>
        )}
        <button type="submit" hidden />
      </form>
    </Modal>
  );
}

export function ExpensesPage() {
  const { state, actions } = useApp();
  const attempt = useAttempt();
  const now = new Date();
  const [fromText, setFromText] = useState(toDateInput(addDays(now, -13)));
  const [toText, setToText] = useState(toDateInput(now));
  const [category, setCategory] = useState('todas');
  const [method, setMethod] = useState('todos');
  const [adding, setAdding] = useState(false);
  const [deleting, setDeleting] = useState<Expense | null>(null);

  const from = fromDateInput(fromText);
  const to = fromDateInput(toText);
  const rangeError = from && to && from > to ? 'La fecha inicial es posterior a la final.' : null;
  const rows = state.expenses
    .filter((e) => (!from || !to || rangeError ? true : inRange(e.date, startOfDay(from), endOfDay(to))))
    .filter((e) => category === 'todas' || e.category === category)
    .filter((e) => method === 'todos' || e.method === method)
    .sort((a, b) => b.date.localeCompare(a.date));

  const columns: Column<Expense>[] = [
    { key: 'fecha', header: 'Fecha', render: (e) => <span className="whitespace-nowrap">{fmtDate(e.date)}</span> },
    { key: 'descripcion', header: 'Descripción', render: (e) => <span className="font-medium">{e.description}</span> },
    { key: 'categoria', header: 'Categoría', render: (e) => <Badge>{e.category}</Badge> },
    { key: 'metodo', header: 'Método de pago', render: (e) => (e.method === 'efectivo' ? 'Efectivo' : 'Transferencia') },
    { key: 'importe', header: 'Importe', align: 'right', render: (e) => <span className="font-semibold">{fmtMoney(e.amount)}</span> },
    {
      key: 'acciones',
      header: 'Acciones',
      align: 'right',
      render: (e) => (
        <Button size="sm" variant="ghost" icon={Trash2} onClick={() => setDeleting(e)}>
          Eliminar
        </Button>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Gastos"
        description="Registro de compras, servicios y otros egresos del restaurante."
        actions={
          <Button variant="primary" icon={Plus} onClick={() => setAdding(true)}>
            Registrar gasto
          </Button>
        }
      />

      <Card>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Field label="Desde" error={rangeError}>
            <Input type="date" value={fromText} onChange={(e) => setFromText(e.target.value)} invalid={Boolean(rangeError)} />
          </Field>
          <Field label="Hasta">
            <Input type="date" value={toText} onChange={(e) => setToText(e.target.value)} />
          </Field>
          <Field label="Categoría">
            <Select value={category} onChange={(e) => setCategory(e.target.value)}>
              <option value="todas">Todas las categorías</option>
              {EXPENSE_CATEGORIES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </Select>
          </Field>
          <Field label="Método de pago">
            <Select value={method} onChange={(e) => setMethod(e.target.value)}>
              <option value="todos">Todos los métodos</option>
              <option value="efectivo">Efectivo</option>
              <option value="transferencia">Transferencia</option>
            </Select>
          </Field>
        </div>
      </Card>

      <Card
        title={`${rows.length} ${rows.length === 1 ? 'gasto' : 'gastos'}`}
        description="Según los filtros seleccionados"
        action={
          <p className="text-right">
            <span className="block text-xs uppercase tracking-wide text-muted">Total</span>
            <span className="text-xl font-semibold tabular-nums text-ink">{fmtMoney(sumBy(rows, (e) => e.amount))}</span>
          </p>
        }
        flush
      >
        <DataTable columns={columns} rows={rows} rowKey={(e) => e.id} minWidth={780} empty={<EmptyState icon={ReceiptText} title="Sin gastos en este filtro" description="Ajuste el período o los filtros, o registre un gasto nuevo." />} />
      </Card>

      {adding && <ExpenseModal onClose={() => setAdding(false)} />}
      {deleting && (
        <ConfirmDialog
          title="Eliminar gasto"
          message={
            <>
              Se eliminará <strong className="font-semibold">{deleting.description}</strong> por {fmtMoney(deleting.amount)}. Los reportes y la caja se recalcularán.
            </>
          }
          confirmLabel="Eliminar gasto"
          danger
          onClose={() => setDeleting(null)}
          onConfirm={() => {
            attempt(() => actions.deleteExpense(deleting.id), 'Gasto eliminado.');
            setDeleting(null);
          }}
        />
      )}
    </div>
  );
}
