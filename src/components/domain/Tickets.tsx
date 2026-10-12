import type { ReactNode } from 'react';
import type { Client, Order, OrderItem, Payment } from '../../types';
import { METHOD_LABEL, itemsCount, orderSubtotal, orderTotal, serviceLabel } from '../../lib/calc';
import { fmtDateTime, fmtMoney, fmtOrderNumber } from '../../lib/format';

/* Vistas previas de impresión. La impresión es simulada: no se conecta a ninguna impresora. */

function Paper({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-lg bg-marfil p-4 sm:p-6">
      <div className="mx-auto w-full max-w-[320px] border border-line bg-white px-5 py-6 font-mono text-[13px] leading-relaxed text-ink">{children}</div>
    </div>
  );
}

const Rule = () => <div className="my-3 border-t border-dashed border-carbon/40" />;

function Line({ left, right, bold }: { left: ReactNode; right: ReactNode; bold?: boolean }) {
  return (
    <div className={`flex justify-between gap-3 ${bold ? 'font-bold' : ''}`}>
      <span className="min-w-0">{left}</span>
      <span className="shrink-0 tabular-nums">{right}</span>
    </div>
  );
}

function Heading({ subtitle }: { subtitle: string }) {
  return (
    <div className="text-center">
      <p className="text-base font-bold tracking-widest">TACOS GRILL</p>
      <p className="uppercase">{subtitle}</p>
    </div>
  );
}

interface KitchenTicketProps {
  order: Order;
  items: OrderItem[];
  date: string;
  isAddition?: boolean;
}

export function KitchenTicket({ order, items, date, isAddition }: KitchenTicketProps) {
  return (
    <Paper>
      <Heading subtitle={isAddition ? 'Cocina · Adición' : 'Ticket de cocina'} />
      <Rule />
      <Line left="Pedido" right={fmtOrderNumber(order.number)} bold />
      <Line left="Servicio" right={serviceLabel(order)} bold />
      {order.customer && <p className="break-words">Entrega: {order.customer}</p>}
      <Line left="Fecha" right={fmtDateTime(date)} />
      <Line left="Atendió" right={order.waiter} />
      <Rule />
      <ul className="flex flex-col gap-2">
        {items.map((item, index) => (
          <li key={`${item.productId}-${index}`}>
            <p className="text-[15px] font-bold leading-snug">
              {item.qty} x {item.name}
            </p>
            {item.note && <p className="pl-4">* {item.note}</p>}
          </li>
        ))}
      </ul>
      <Rule />
      <p className="text-center">{itemsCount(items)} {itemsCount(items) === 1 ? 'unidad' : 'unidades'}</p>
    </Paper>
  );
}

interface SaleReceiptProps {
  order: Order;
  payments: Payment[];
  clients: Client[];
  /** Descuento todavía no registrado, para previsualizar la cuenta antes de cobrar. */
  previewDiscount?: number;
}

export function SaleReceipt({ order, payments, clients, previewDiscount }: SaleReceiptProps) {
  const shown: Order = previewDiscount !== undefined ? { ...order, discount: previewDiscount } : order;
  const paid = order.status === 'cobrada';
  const mine = payments.filter((p) => p.orderId === order.id && p.kind === 'venta');
  return (
    <Paper>
      <Heading subtitle={paid ? 'Comprobante de venta' : order.status === 'cancelada' ? 'Pedido cancelado' : 'Estado de cuenta'} />
      <Rule />
      <Line left="Pedido" right={fmtOrderNumber(order.number)} />
      <Line left="Servicio" right={serviceLabel(order)} />
      {order.customer && <p className="break-words">Entrega: {order.customer}</p>}
      <Line left="Fecha" right={fmtDateTime(order.closedAt ?? order.createdAt)} />
      <Rule />
      <ul className="flex flex-col gap-1.5">
        {order.items.map((item, index) => (
          <li key={`${item.productId}-${index}`}>
            <p className="leading-snug">{item.name}</p>
            <Line left={<span className="pl-4">{item.qty} x {fmtMoney(item.price)}</span>} right={fmtMoney(item.qty * item.price)} />
          </li>
        ))}
      </ul>
      <Rule />
      <Line left="Subtotal" right={fmtMoney(orderSubtotal(shown))} />
      {shown.discount > 0 && <Line left="Descuento" right={`- ${fmtMoney(shown.discount)}`} />}
      {shown.shipping > 0 && <Line left="Envío" right={fmtMoney(shown.shipping)} />}
      <div className="mt-1 text-[15px]">
        <Line left="TOTAL" right={fmtMoney(orderTotal(shown))} bold />
      </div>
      {paid && mine.length > 0 && (
        <>
          <Rule />
          <p className="uppercase">Forma de pago</p>
          {mine.map((p) => (
            <Line key={p.id} left={METHOD_LABEL[p.method]} right={fmtMoney(p.amount)} />
          ))}
          {mine
            .filter((p) => p.method === 'credito')
            .map((p) => (
              <p key={p.id} className="break-words">
                Crédito a: {clients.find((c) => c.id === p.clientId)?.name ?? 'Cliente'}
              </p>
            ))}
        </>
      )}
      {order.status === 'cancelada' && order.cancelReason && (
        <>
          <Rule />
          <p className="break-words">Motivo: {order.cancelReason}</p>
        </>
      )}
      <Rule />
      <p className="text-center">{paid ? '¡Gracias por su compra!' : 'Documento sin valor fiscal'}</p>
      {paid && <p className="text-center">Documento sin valor fiscal</p>}
    </Paper>
  );
}
