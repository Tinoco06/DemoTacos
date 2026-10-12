import { useState } from 'react';
import { useApp, useAttempt } from '../../store/AppStore';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Alert, Segmented, SummaryRow } from '../ui/Basics';
import { Field, MoneyInput } from '../ui/Field';
import { clientBalance, currentSession } from '../../lib/calc';
import { fmtMoney, parseAmount, round2 } from '../../lib/format';

/** Registro de un abono a la cuenta de crédito de un cliente. */
export function AbonoModal({ clientId, onClose }: { clientId: string; onClose: () => void }) {
  const { state, actions } = useApp();
  const attempt = useAttempt();
  const [amountText, setAmountText] = useState('');
  const [method, setMethod] = useState<'efectivo' | 'transferencia'>('efectivo');
  const client = state.clients.find((c) => c.id === clientId);
  if (!client) return null;

  const balance = clientBalance(state, client.id);
  const amount = parseAmount(amountText);
  const noCash = method === 'efectivo' && !currentSession(state);
  const error =
    amountText.trim() === ''
      ? null
      : Number.isNaN(amount) || amount <= 0
        ? 'Ingrese un importe válido mayor que cero.'
        : amount > balance
          ? `El abono no puede superar el saldo de ${fmtMoney(balance)}.`
          : null;
  const valid = !error && amount > 0 && !noCash;

  return (
    <Modal
      title="Registrar abono"
      description={client.name}
      size="sm"
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>Cancelar</Button>
          <Button
            variant="primary"
            disabled={!valid}
            onClick={() => {
              const result = attempt(() => actions.registerAbono({ clientId: client.id, amount, method }), `Abono de ${fmtMoney(amount)} registrado.`);
              if (result.ok) onClose();
            }}
          >
            Registrar abono
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-5">
        <div className="rounded-lg bg-marfil px-4 py-3">
          <SummaryRow label="Saldo pendiente" value={fmtMoney(balance)} strong />
          {valid && <div className="mt-1"><SummaryRow label="Saldo después del abono" value={fmtMoney(round2(balance - amount))} muted /></div>}
        </div>
        <Field label="Importe del abono" error={error}>
          <MoneyInput value={amountText} onChange={(e) => setAmountText(e.target.value)} invalid={Boolean(error)} autoFocus />
        </Field>
        <Button size="sm" onClick={() => setAmountText(balance.toFixed(2))} className="self-start">
          Abonar el saldo completo
        </Button>
        <div>
          <p className="mb-1.5 text-sm font-medium text-ink">Método de pago</p>
          <Segmented
            label="Método de pago"
            full
            size="lg"
            value={method}
            onChange={setMethod}
            options={[
              { value: 'efectivo', label: 'Efectivo' },
              { value: 'transferencia', label: 'Transferencia' },
            ]}
          />
        </div>
        {noCash && <Alert tone="warning">La caja está cerrada. Ábrala para recibir efectivo o registre el abono como transferencia.</Alert>}
      </div>
    </Modal>
  );
}
