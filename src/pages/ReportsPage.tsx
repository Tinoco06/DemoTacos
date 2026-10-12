import { useState } from 'react';
import { Banknote, Calculator, ReceiptText, TrendingUp, Users } from 'lucide-react';
import { useApp } from '../store/AppStore';
import { Alert, Card, EmptyState, PageHeader, Segmented, StatCard, SummaryRow } from '../components/ui/Basics';
import { BarChart, ShareBars } from '../components/ui/Charts';
import { Field, Input } from '../components/ui/Field';
import { clientBalance, dailySeries, periodSummary, totalCreditBalance } from '../lib/calc';
import { addDays, endOfDay, fmtDate, fmtMoney, fromDateInput, round2, startOfDay, startOfWeek, toDateInput } from '../lib/format';

type Preset = 'siete' | 'semana' | 'anterior' | 'catorce' | 'personalizado';

export function ReportsPage() {
  const { state } = useApp();
  const now = new Date();
  const [preset, setPreset] = useState<Preset>('siete');
  const [fromText, setFromText] = useState(toDateInput(addDays(now, -6)));
  const [toText, setToText] = useState(toDateInput(now));

  const weekStart = startOfWeek(now);
  const customFrom = fromDateInput(fromText);
  const customTo = fromDateInput(toText);
  const customError = !customFrom || !customTo ? 'Seleccione ambas fechas.' : customFrom > customTo ? 'La fecha inicial es posterior a la final.' : round2((customTo.getTime() - customFrom.getTime()) / 86400000) > 60 ? 'El período máximo es de 60 días.' : null;

  const [from, to] =
    preset === 'siete'
      ? [addDays(startOfDay(now), -6), endOfDay(now)]
      : preset === 'semana'
      ? [weekStart, endOfDay(addDays(weekStart, 6))]
      : preset === 'anterior'
        ? [addDays(weekStart, -7), endOfDay(addDays(weekStart, -1))]
        : preset === 'catorce' || customError
          ? [addDays(startOfDay(now), -13), endOfDay(now)]
          : [startOfDay(customFrom!), endOfDay(customTo!)];

  const summary = periodSummary(state, from, to);
  const series = dailySeries(state, from, to);
  const estimate = round2(summary.sales - summary.expenses);
  const debtors = state.clients.map((c) => ({ client: c, balance: clientBalance(state, c.id) })).filter((d) => d.balance > 0).sort((a, b) => b.balance - a.balance);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Reportes semanales" description={`Período del ${fmtDate(from)} al ${fmtDate(to)}`} />

      <div className="flex flex-col gap-4">
        <Segmented
          label="Período"
          value={preset}
          onChange={setPreset}
          options={[
            { value: 'siete', label: 'Últimos 7 días' },
            { value: 'semana', label: 'Esta semana' },
            { value: 'anterior', label: 'Semana anterior' },
            { value: 'catorce', label: 'Últimos 14 días' },
            { value: 'personalizado', label: 'Personalizado' },
          ]}
        />
        {preset === 'personalizado' && (
          <div className="grid max-w-md grid-cols-2 gap-4">
            <Field label="Desde" error={customError}>
              <Input type="date" value={fromText} onChange={(e) => setFromText(e.target.value)} invalid={Boolean(customError)} />
            </Field>
            <Field label="Hasta">
              <Input type="date" value={toText} onChange={(e) => setToText(e.target.value)} />
            </Field>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Ventas totales" value={fmtMoney(summary.sales)} hint={`${summary.salesCount} cuentas cobradas`} icon={TrendingUp} />
        <StatCard label="Cobros recibidos" value={fmtMoney(summary.received)} hint={summary.abonos > 0 ? `Incluye ${fmtMoney(summary.abonos)} en abonos` : 'Efectivo y transferencias'} icon={Banknote} />
        <StatCard label="Gastos registrados" value={fmtMoney(summary.expenses)} hint="Todas las categorías" icon={ReceiptText} />
        <StatCard label="Resultado estimado" value={fmtMoney(estimate)} hint="Ventas menos gastos registrados" icon={Calculator} />
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <Card title="Ventas y gastos por día" description="En lempiras" className="xl:col-span-2">
          <BarChart
            series={[
              { name: 'Ventas', color: 'bg-azul' },
              { name: 'Gastos', color: 'bg-frambuesa' },
            ]}
            groups={series.map((d) => ({ label: d.label, title: fmtDate(d.date), values: [d.sales, d.expenses] }))}
          />
        </Card>

        <Card title="Ventas por método de pago" description="Cada venta se cuenta una sola vez">
          {summary.sales === 0 ? (
            <EmptyState icon={Banknote} title="Sin ventas en el período" />
          ) : (
            <ShareBars
              items={[
                { label: 'Efectivo', value: summary.byMethod.efectivo },
                { label: 'Transferencia', value: summary.byMethod.transferencia },
                { label: 'Crédito', value: summary.byMethod.credito, note: 'Vendido al crédito: pendiente de cobro hasta recibir abonos.' },
              ]}
            />
          )}
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <Card title="Resultado estimado del período">
          <div className="flex flex-col gap-3">
            <SummaryRow label="Ventas totales" value={fmtMoney(summary.sales)} />
            <SummaryRow label="Gastos registrados" value={`- ${fmtMoney(summary.expenses)}`} />
            <div className="border-t border-line pt-3">
              <SummaryRow label="Resultado estimado" value={<span className="text-xl">{fmtMoney(estimate)}</span>} strong />
            </div>
            <SummaryRow label="De las ventas, quedó al crédito" value={fmtMoney(summary.byMethod.credito)} muted />
            <div className="mt-2">
              <Alert tone="info">
                Es una estimación operativa, no la ganancia neta. Solo considera los gastos registrados en el sistema: no incluye salarios, alquiler, costos no ingresados ni ventas al crédito que aún no se han cobrado.
              </Alert>
            </div>
          </div>
        </Card>

        <Card
          title="Saldos pendientes de crédito"
          description="Saldo actual por cliente, a la fecha de hoy"
          action={
            <p className="text-right">
              <span className="block text-xs uppercase tracking-wide text-muted">Total</span>
              <span className="text-xl font-semibold tabular-nums text-ink">{fmtMoney(totalCreditBalance(state))}</span>
            </p>
          }
          flush
        >
          {debtors.length === 0 ? (
            <EmptyState icon={Users} title="Sin saldos pendientes" />
          ) : (
            <ul className="divide-y divide-line">
              {debtors.map((d) => (
                <li key={d.client.id} className="flex items-center justify-between gap-4 px-5 py-3 text-sm">
                  <span className="min-w-0 truncate text-ink">{d.client.name}</span>
                  <span className="font-semibold tabular-nums text-ink">{fmtMoney(d.balance)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
