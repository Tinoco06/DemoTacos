import { useState } from 'react';
import { Ban, HandCoins, Plus, Printer } from 'lucide-react';
import type { Order } from '../../types';
import { useApp, useAttempt } from '../../store/AppStore';
import { useToast } from '../ui/Toast';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Segmented } from '../ui/Basics';
import { Field, Input } from '../ui/Field';
import { KitchenTicket, SaleReceipt } from './Tickets';
import { serviceLabel } from '../../lib/calc';
import { fmtOrderNumber } from '../../lib/format';
import { navigate } from '../../lib/router';
import { USERS } from '../../data/catalog';

type View = 'cocina' | 'cuenta';

/** Consulta de un pedido con la vista previa del ticket de cocina y del comprobante. */
export function OrderDetailModal({ orderId, initialView = 'cuenta', onClose }: { orderId: string; initialView?: View; onClose: () => void }) {
  const { state, actions } = useApp();
  const toast = useToast();
  const attempt = useAttempt();
  const [view, setView] = useState<View>(initialView);
  const [cancelling, setCancelling] = useState(false);
  const [reason, setReason] = useState('');
  const order: Order | undefined = state.orders.find((o) => o.id === orderId);
  if (!order) return null;

  const isAdmin = state.role === 'admin';
  const open = order.status === 'abierta';
  const kitchen = order.operations.filter((o) => o.kind === 'cocina');
  const title = `Pedido ${fmtOrderNumber(order.number)} · ${serviceLabel(order)}`;

  if (cancelling) {
    return (
      <Modal
        title="Cancelar pedido"
        description={title}
        size="sm"
        onClose={() => setCancelling(false)}
        footer={
          <>
            <Button onClick={() => setCancelling(false)}>Volver</Button>
            <Button
              variant="danger"
              disabled={reason.trim().length < 3}
              onClick={() => {
                const result = attempt(() => actions.cancelOrder({ orderId: order.id, reason, user: USERS[state.role] }), 'Pedido cancelado. Las bebidas volvieron al inventario.');
                if (result.ok) onClose();
              }}
            >
              Cancelar pedido
            </Button>
          </>
        }
      >
        <p className="mb-4 text-sm leading-relaxed text-ink">
          La cuenta se cerrará sin cobro{order.tableName ? ` y ${order.tableName} quedará libre` : ''}. Esta operación queda registrada.
        </p>
        <Field label="Motivo de la cancelación" hint="Obligatorio, mínimo 3 caracteres.">
          <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Ej. el cliente se retiró" autoFocus />
        </Field>
      </Modal>
    );
  }

  return (
    <Modal
      title={title}
      onClose={onClose}
      footer={
        <>
          {open && isAdmin && (
            <Button variant="danger" icon={Ban} onClick={() => setCancelling(true)} className="sm:mr-auto">
              Cancelar pedido
            </Button>
          )}
          <Button icon={Printer} onClick={() => toast.info('Impresión simulada: el documento se enviaría a la impresora térmica.')}>
            Imprimir
          </Button>
          {open && (
            <Button icon={Plus} onClick={() => navigate('pedido', { pedido: order.id })}>
              Agregar productos
            </Button>
          )}
          {open && isAdmin && (
            <Button variant="primary" icon={HandCoins} onClick={() => navigate('cobro', { pedido: order.id })}>
              Cobrar
            </Button>
          )}
        </>
      }
    >
      <div className="mb-4">
        <Segmented
          label="Documento"
          full
          value={view}
          onChange={setView}
          options={[
            { value: 'cuenta', label: order.status === 'cobrada' ? 'Comprobante de venta' : 'Estado de cuenta' },
            { value: 'cocina', label: 'Tickets de cocina', count: kitchen.length },
          ]}
        />
      </div>
      {view === 'cocina' ? (
        kitchen.length === 0 ? (
          <p className="rounded-lg border border-line px-4 py-8 text-center text-sm text-muted">Esta cuenta no tiene envíos a cocina: solo incluye productos de entrega directa.</p>
        ) : (
          <div className="flex flex-col gap-4">
            <p className="text-sm text-muted">
              {kitchen.length === 1 ? '1 envío a cocina.' : `${kitchen.length} envíos a cocina independientes.`} Consultarlos o reimprimirlos no modifica la cuenta ni el inventario.
            </p>
            {kitchen.map((operation) => (
              <KitchenTicket key={operation.id} order={order} operation={operation} />
            ))}
          </div>
        )
      ) : (
        <SaleReceipt order={order} payments={state.payments} clients={state.clients} />
      )}
    </Modal>
  );
}
