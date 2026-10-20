import { useState } from 'react';
import { Banknote, Check, Landmark, Split, UserCheck } from 'lucide-react';
import type { Order, PaymentPart, PayMethod } from '../../types';
import { useApp, useAttempt } from '../../store/AppStore';
import { Button } from '../ui/Button';
import { Alert, SummaryRow } from '../ui/Basics';
import { Field, MoneyInput, Select } from '../ui/Field';
import { currentSession, orderSubtotal, serviceLabel } from '../../lib/calc';
import { cn, fmtMoney, fmtOrderNumber, parseAmount, round2 } from '../../lib/format';

type Mode = PayMethod | 'mixto';

const MODES: Array<{ id: Mode; label: string; icon: typeof Banknote }> = [
  { id: 'efectivo', label: 'Efectivo', icon: Banknote },
  { id: 'transferencia', label: 'Transferencia', icon: Landmark },
  { id: 'credito', label: 'Crédito', icon: UserCheck },
  { id: 'mixto', label: 'Pago mixto', icon: Split },
];

const amountOrZero = (text: string) => (text.trim() === '' ? 0 : parseAmount(text));

/** Panel de cobro: total, método de pago y confirmación en una sola vista. */
export function PaymentPanel({ order, onCharged }: { order: Order; onCharged: (order: Order) => void }) {
  const { state, actions } = useApp();
  const attempt = useAttempt();
  const [mode, setMode] = useState<Mode>('efectivo');
  const [discountText, setDiscountText] = useState('');
  const [receivedText, setReceivedText] = useState('');
  const [clientId, setClientId] = useState('');
  const [mix, setMix] = useState({ efectivo: '', transferencia: '', credito: '' });

  const subtotal = orderSubtotal(order);
  const discount = amountOrZero(discountText);
  const discountError = Number.isNaN(discount) || discount < 0 ? 'Importe no válido.' : discount > subtotal ? 'Supera el subtotal.' : null;
  const total = round2(Math.max(0, subtotal - (discountError ? 0 : discount)) + order.shipping);
  const authorized = state.clients.filter((c) => c.creditAuthorized);
  const cashOpen = Boolean(currentSession(state));

  const received = amountOrZero(receivedText);
  const mixValues = { efectivo: amountOrZero(mix.efectivo), transferencia: amountOrZero(mix.transferencia), credito: amountOrZero(mix.credito) };
  const mixInvalid = Object.values(mixValues).some((v) => Number.isNaN(v) || v < 0);
  const assigned = mixInvalid ? 0 : round2(mixValues.efectivo + mixValues.transferencia + mixValues.credito);
  const remaining = round2(total - assigned);

  let parts: PaymentPart[] = [];
  let problem: string | null = discountError ? 'Corrija el descuento.' : null;
  if (!problem) {
    if (mode === 'efectivo') {
      if (Number.isNaN(received)) problem = 'El efectivo recibido no es válido.';
      else if (receivedText.trim() !== '' && received < total) problem = `Faltan ${fmtMoney(total - received)} para cubrir el total.`;
      parts = [{ method: 'efectivo', amount: total }];
    } else if (mode === 'transferencia') {
      parts = [{ method: 'transferencia', amount: total }];
    } else if (mode === 'credito') {
      if (!clientId) problem = 'Seleccione un cliente con crédito autorizado.';
      parts = [{ method: 'credito', amount: total, clientId }];
    } else {
      if (mixInvalid) problem = 'Revise los importes ingresados.';
      else if (remaining > 0) problem = `Faltan ${fmtMoney(remaining)} por asignar.`;
      else if (remaining < 0) problem = `Los importes superan el total por ${fmtMoney(-remaining)}.`;
      else if (mixValues.credito > 0 && !clientId) problem = 'Seleccione el cliente para la parte al crédito.';
      parts = [
        { method: 'efectivo', amount: mixValues.efectivo },
        { method: 'transferencia', amount: mixValues.transferencia },
        { method: 'credito', amount: mixValues.credito, clientId },
      ];
    }
  }
  if (!problem && !cashOpen) problem = 'La caja está cerrada. Ábrala para registrar cobros.';

  const quick = [...new Set([total, ...[50, 100, 200, 500].map((step) => Math.ceil(total / step) * step)])].filter((v) => v >= total).slice(0, 4);

  const confirm = () => {
    const result = attempt(() => actions.chargeOrder({ orderId: order.id, discount: discount || 0, parts }));
    if (result.ok) onCharged(result.value);
  };

  const clientSelect = (
    <Field label="Cliente con crédito autorizado">
      <Select value={clientId} onChange={(e) => setClientId(e.target.value)}>
        <option value="">Seleccione un cliente</option>
        {authorized.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </Select>
    </Field>
  );

  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="text-sm text-muted">Pedido {fmtOrderNumber(order.number)}</p>
        <h2 className="text-xl font-semibold text-ink">{serviceLabel(order)}</h2>
        {order.customer && <p className="mt-0.5 text-sm text-muted">{order.customer}</p>}
      </div>

      <ul className="flex flex-col divide-y divide-line rounded-lg border border-line">
        {order.items.map((item, index) => (
          <li key={`${item.productId}-${index}`} className="flex items-baseline justify-between gap-4 px-4 py-2.5 text-sm">
            <span className="min-w-0 text-ink">
              <span className="mr-2 font-semibold tabular-nums">{item.qty}×</span>
              {item.name}
            </span>
            <span className="shrink-0 tabular-nums text-ink">{fmtMoney(item.qty * item.price)}</span>
          </li>
        ))}
      </ul>

      <div className="flex flex-col gap-2">
        <SummaryRow label="Subtotal" value={fmtMoney(subtotal)} />
        <div className="flex items-center justify-between gap-4">
          <label htmlFor="descuento" className="text-sm text-ink">
            Descuento <span className="text-muted">(opcional)</span>
          </label>
          <div className="w-36">
            <MoneyInput id="descuento" value={discountText} onChange={(e) => setDiscountText(e.target.value)} invalid={Boolean(discountError)} />
          </div>
        </div>
        {discountError && <p className="text-right text-xs text-bad">{discountError}</p>}
        {order.shipping > 0 && <SummaryRow label="Envío" value={fmtMoney(order.shipping)} />}
        <div className="mt-2 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-t border-line pt-4">
          <span className="text-base font-semibold text-ink">Total a cobrar</span>
          <span className="whitespace-nowrap text-3xl font-semibold tabular-nums tracking-tight text-ink">{fmtMoney(total)}</span>
        </div>
      </div>

      <div className="@container">
        <p className="mb-2 text-sm font-medium text-ink">Método de pago</p>
        <div className="grid grid-cols-2 gap-3 @md:grid-cols-4" role="radiogroup" aria-label="Método de pago">
          {MODES.map((m) => (
            <button
              key={m.id}
              type="button"
              role="radio"
              aria-checked={mode === m.id}
              onClick={() => setMode(m.id)}
              className={cn(
                'flex h-20 flex-col items-center justify-center gap-1.5 rounded-lg border text-sm font-medium transition-colors',
                mode === m.id ? 'border-carbon bg-carbon text-white' : 'border-line bg-white text-ink hover:bg-marfil',
              )}
            >
              <m.icon className="size-5" aria-hidden />
              {m.label}
            </button>
          ))}
        </div>
      </div>

      {mode === 'efectivo' && (
        <div className="flex flex-col gap-3">
          <Field label="Efectivo recibido" hint="Déjelo vacío si el cliente paga el importe exacto.">
            <MoneyInput value={receivedText} onChange={(e) => setReceivedText(e.target.value)} />
          </Field>
          <div className="flex flex-wrap gap-2">
            {quick.map((value, index) => (
              <Button key={value} size="sm" onClick={() => setReceivedText(value.toFixed(2))}>
                {index === 0 ? 'Exacto' : fmtMoney(value)}
              </Button>
            ))}
          </div>
          <div className="rounded-lg bg-marfil px-4 py-3">
            <SummaryRow label="Cambio a entregar" value={fmtMoney(!Number.isNaN(received) && received > total ? received - total : 0)} strong />
          </div>
        </div>
      )}

      {mode === 'transferencia' && <Alert tone="info">Confirme que la transferencia fue recibida antes de completar el cobro. No se suma al efectivo de la caja.</Alert>}

      {mode === 'credito' && (
        <div className="flex flex-col gap-3">
          {clientSelect}
          <Alert tone="info">La venta queda registrada y el importe se carga al saldo pendiente del cliente.</Alert>
        </div>
      )}

      {mode === 'mixto' && (
        <div className="flex flex-col gap-3">
          {(['efectivo', 'transferencia', 'credito'] as const).map((method) => (
            <div key={method} className="flex items-center gap-3">
              <label htmlFor={`mix-${method}`} className="w-28 shrink-0 text-sm font-medium capitalize text-ink">
                {method === 'credito' ? 'Crédito' : method}
              </label>
              <div className="min-w-0 flex-1">
                <MoneyInput id={`mix-${method}`} value={mix[method]} onChange={(e) => setMix({ ...mix, [method]: e.target.value })} />
              </div>
              <Button
                size="sm"
                disabled={mixInvalid || remaining <= 0}
                onClick={() => setMix({ ...mix, [method]: round2((Number.isNaN(mixValues[method]) ? 0 : mixValues[method]) + remaining).toFixed(2) })}
              >
                Resto
              </Button>
            </div>
          ))}
          {mixValues.credito > 0 && clientSelect}
          <div className="rounded-lg bg-marfil px-4 py-3">
            <SummaryRow label="Asignado" value={`${fmtMoney(assigned)} de ${fmtMoney(total)}`} strong />
          </div>
        </div>
      )}

      {problem && <Alert tone="warning">{problem}{!cashOpen && <> <a href="#/caja" className="font-medium underline">Ir a caja</a></>}</Alert>}

      <Button variant="primary" size="lg" full icon={Check} disabled={Boolean(problem)} onClick={confirm}>
        Confirmar cobro de {fmtMoney(total)}
      </Button>
    </div>
  );
}
