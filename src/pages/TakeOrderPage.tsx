import { useEffect, useState } from 'react';
import { ArrowLeft, HandCoins, LayoutGrid, MessageSquarePlus, Search, SearchX, Send, ShoppingBag, Trash2 } from 'lucide-react';
import type { OrderItem, Product, ServiceType } from '../types';
import { useApp, useAttempt } from '../store/AppStore';
import type { SubmitOrderResult } from '../simulation/orders';
import { Button } from '../components/ui/Button';
import { Alert, EmptyState, Stepper, SummaryRow } from '../components/ui/Basics';
import { Field, Input, MoneyInput } from '../components/ui/Field';
import { Modal } from '../components/ui/Modal';
import { ProductCard } from '../components/domain/Cards';
import { KitchenTicket } from '../components/domain/Tickets';
import { CATEGORIES, USERS } from '../data/catalog';
import { itemsCount, itemsSubtotal, openOrderForTable, orderTotal, serviceLabel } from '../lib/calc';
import { cn, fmtMoney, fmtOrderNumber, parseAmount, round2 } from '../lib/format';
import { navigate } from '../lib/router';

type Draft = Record<string, { qty: number; note: string }>;

const normalize = (text: string) => text.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

function PrintResult({ result, onTables }: { result: SubmitOrderResult; onTables: () => void }) {
  const [printing, setPrinting] = useState(true);
  useEffect(() => {
    const timer = window.setTimeout(() => setPrinting(false), 1100);
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <Modal
      title={printing ? 'Enviando a cocina' : 'Pedido enviado a cocina'}
      description={`Pedido ${fmtOrderNumber(result.order.number)} · ${serviceLabel(result.order)}`}
      onClose={onTables}
      footer={
        <Button size="lg" variant="primary" icon={LayoutGrid} onClick={onTables}>
          Volver a mesas
        </Button>
      }
    >
      <div className="mb-4" aria-live="polite">
        {printing ? (
          <Alert tone="info">
            Enviando el ticket a la impresora de cocina…
          </Alert>
        ) : (
          <Alert tone="success">
            <span className="font-medium">Ticket impreso en cocina (simulación).</span>
          </Alert>
        )}
      </div>
      <KitchenTicket order={result.order} items={result.sentItems} date={result.sentAt} isAddition={result.isAddition} />
    </Modal>
  );
}

/**
 * Interfaz de toma de pedidos. No es una sección propia: se abre desde una mesa
 * (?mesa=), desde «Pedido a domicilio» (?servicio=domicilio) o desde una cuenta abierta (?pedido=).
 */
export function TakeOrderPage({ params }: { params: Record<string, string> }) {
  const { state, actions } = useApp();
  const attempt = useAttempt();
  const isAdmin = state.role === 'admin';

  const paramOrder = params.pedido ? state.orders.find((o) => o.id === params.pedido && o.status === 'abierta') : undefined;
  const paramTable = state.tables.find((t) => t.id === params.mesa && t.active);
  const [lockedOrderId] = useState(paramOrder && paramOrder.service !== 'mesa' ? paramOrder.id : null);
  const [service] = useState<ServiceType>(
    paramOrder?.service ?? (params.servicio === 'domicilio' ? 'domicilio' : 'mesa'),
  );
  const [tableId] = useState(paramOrder?.tableId ?? paramTable?.id ?? '');
  const [customer, setCustomer] = useState('');
  const [shippingText, setShippingText] = useState('');
  const [draft, setDraft] = useState<Draft>({});
  const [category, setCategory] = useState('todos');
  const [search, setSearch] = useState('');
  const [openNotes, setOpenNotes] = useState<Record<string, boolean>>({});
  const [reviewing, setReviewing] = useState(false);
  const [mobilePanel, setMobilePanel] = useState(false);
  const [sent, setSent] = useState<SubmitOrderResult | null>(null);

  const existing = lockedOrderId
    ? state.orders.find((o) => o.id === lockedOrderId && o.status === 'abierta')
    : service === 'mesa' && tableId
      ? openOrderForTable(state, tableId)
      : undefined;
  const table = state.tables.find((t) => t.id === tableId);

  const products = state.products.filter((p) => p.active);
  const query = normalize(search.trim());
  const visible = products.filter((p) => (category === 'todos' || p.categoryId === category) && (!query || normalize(p.name).includes(query)));

  const lines = Object.entries(draft)
    .map(([productId, line]) => ({ product: state.products.find((p) => p.id === productId), ...line }))
    .filter((l): l is { product: Product; qty: number; note: string } => Boolean(l.product) && l.qty > 0);
  const items: OrderItem[] = lines.map((l) => ({ productId: l.product.id, name: l.product.name, price: l.product.price, qty: l.qty, note: l.note }));

  const shippingValue = shippingText.trim() === '' ? 0 : parseAmount(shippingText);
  const shippingError = service === 'domicilio' && !existing && (Number.isNaN(shippingValue) || shippingValue < 0) ? 'Ingrese un costo de envío válido.' : null;
  const shipping = existing ? existing.shipping : service === 'domicilio' && !shippingError ? shippingValue : 0;
  const draftSubtotal = itemsSubtotal(items);
  const total = existing ? round2(orderTotal(existing) + draftSubtotal) : round2(draftSubtotal + shipping);
  const count = itemsCount(items);

  // Sin mesa válida ni pedido a domicilio no hay nada que tomar: se vuelve a Mesas.
  const invalidEntry = service === 'mesa' && !table;
  useEffect(() => {
    if (invalidEntry) navigate('mesas');
  }, [invalidEntry]);
  const missingAddress = service === 'domicilio' && !existing && customer.trim().length < 3;
  const canReview = count > 0 && !missingAddress && !shippingError;
  const destination = existing ? serviceLabel(existing) : service === 'mesa' ? table?.name ?? 'Mesa' : 'Domicilio';

  const setQty = (product: Product, qty: number) => {
    const capped = product.trackStock ? Math.min(qty, product.stock) : qty;
    setDraft((current) => {
      const next = { ...current };
      if (capped <= 0) delete next[product.id];
      else next[product.id] = { qty: capped, note: current[product.id]?.note ?? '' };
      return next;
    });
  };
  const setNote = (productId: string, note: string) => setDraft((current) => ({ ...current, [productId]: { ...current[productId], note } }));

  const confirm = () => {
    const result = attempt(() =>
      actions.submitOrder({ orderId: existing?.id ?? null, service, tableId: tableId || null, customer, shipping, items, user: USERS[state.role] }),
    );
    if (result.ok) {
      setReviewing(false);
      setMobilePanel(false);
      setDraft({});
      setSent(result.value);
    }
  };

  const totals = (
    <div className="flex flex-col gap-2">
      {existing && <SummaryRow label="Ya en la cuenta" value={fmtMoney(orderTotal(existing))} muted />}
      <SummaryRow label={existing ? 'Por agregar' : 'Subtotal'} value={fmtMoney(draftSubtotal)} />
      {!existing && service === 'domicilio' && <SummaryRow label="Envío" value={fmtMoney(shipping)} />}
      <div className="mt-1 border-t border-line pt-3">
        <SummaryRow label={existing ? 'Total de la cuenta' : 'Total'} value={<span className="text-xl">{fmtMoney(total)}</span>} strong />
      </div>
    </div>
  );

  const panel = (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto">
        {existing && (
          <div className="border-b border-line px-5 py-4">
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted">Ya enviado a cocina</p>
            <ul className="flex flex-col gap-1.5">
              {existing.items.map((item, index) => (
                <li key={`${item.productId}-${index}`} className="flex justify-between gap-3 text-sm text-muted">
                  <span className="min-w-0">
                    {item.qty}× {item.name}
                  </span>
                  <span className="shrink-0 tabular-nums">{fmtMoney(item.qty * item.price)}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
        {lines.length === 0 ? (
          <EmptyState icon={ShoppingBag} title={existing ? 'Sin productos por agregar' : 'El pedido está vacío'} description="Toque un producto del catálogo para agregarlo." />
        ) : (
          <ul className="divide-y divide-line">
            {lines.map(({ product, qty, note }) => {
              const showNote = openNotes[product.id] || note !== '';
              return (
                <li key={product.id} className="flex flex-col gap-3 px-5 py-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium leading-snug text-ink">{product.name}</p>
                      <p className="text-sm text-muted">{fmtMoney(product.price)} c/u</p>
                    </div>
                    <span className="shrink-0 text-sm font-semibold tabular-nums text-ink">{fmtMoney(product.price * qty)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-36">
                      <Stepper value={qty} onChange={(value) => setQty(product, value)} max={product.trackStock ? product.stock : undefined} label={product.name} />
                    </div>
                    {!showNote && (
                      <Button variant="ghost" icon={MessageSquarePlus} onClick={() => setOpenNotes({ ...openNotes, [product.id]: true })}>
                        Nota
                      </Button>
                    )}
                    <button type="button" onClick={() => setQty(product, 0)} aria-label={`Quitar ${product.name} del pedido`} className="ml-auto grid size-11 place-items-center rounded-lg text-muted hover:bg-bad-soft hover:text-bad">
                      <Trash2 className="size-5" aria-hidden />
                    </button>
                  </div>
                  {showNote && <Input value={note} onChange={(e) => setNote(product.id, e.target.value)} placeholder="Observación para cocina, ej. sin cebolla" aria-label={`Observación para ${product.name}`} maxLength={80} />}
                </li>
              );
            })}
          </ul>
        )}
      </div>
      <div className="flex shrink-0 flex-col gap-4 border-t border-line px-5 py-4">
        {totals}
        {missingAddress && count > 0 && <p className="text-sm text-warn">Ingrese la dirección de entrega para continuar.</p>}
        <Button variant="primary" size="lg" full icon={Send} disabled={!canReview} onClick={() => setReviewing(true)}>
          Revisar pedido
        </Button>
        {existing && isAdmin && count === 0 && (
          <Button size="lg" full icon={HandCoins} onClick={() => navigate('cobro', { pedido: existing.id })}>
            Cobrar cuenta
          </Button>
        )}
      </div>
    </div>
  );

  if (invalidEntry) return null;

  return (
    <div className="pb-24 lg:pb-0">
      <div className="mb-6 flex flex-wrap items-center gap-x-4 gap-y-3">
        <Button icon={ArrowLeft} onClick={() => navigate('mesas')}>
          Mesas
        </Button>
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight text-ink">{existing ? serviceLabel(existing) : service === 'mesa' ? table?.name : 'Pedido a domicilio'}</h1>
          <p className="text-sm text-muted">{existing ? `Pedido ${fmtOrderNumber(existing.number)} · cuenta abierta de ${fmtMoney(orderTotal(existing))}` : 'Nuevo pedido'}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_340px] xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="flex min-w-0 flex-col gap-5">
          {service === 'domicilio' && !existing && (
            <section className="rounded-xl border border-line bg-white p-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-[minmax(0,1fr)_180px]">
              <Field label="Cliente y dirección de entrega">
                <Input value={customer} onChange={(e) => setCustomer(e.target.value)} placeholder="Nombre, colonia y referencia" className="h-12" maxLength={100} />
              </Field>
              <Field label="Costo de envío" error={shippingError}>
                <MoneyInput value={shippingText} onChange={(e) => setShippingText(e.target.value)} invalid={Boolean(shippingError)} className="h-12" />
              </Field>
            </div>
            </section>
          )}

          <div className="relative">
            <Search className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-muted" aria-hidden />
            <Input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar producto por nombre" aria-label="Buscar producto" className="h-12 pl-12 text-base" />
          </div>

          <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:flex-wrap sm:px-0" role="tablist" aria-label="Categorías">
            {[{ id: 'todos', name: 'Todos' }, ...CATEGORIES].map((c) => (
              <button
                key={c.id}
                type="button"
                role="tab"
                aria-selected={category === c.id}
                onClick={() => setCategory(c.id)}
                className={cn(
                  'h-11 shrink-0 whitespace-nowrap rounded-lg border px-4 text-sm font-medium transition-colors',
                  category === c.id ? 'border-carbon bg-carbon text-white' : 'border-line bg-white text-ink hover:bg-marfil',
                )}
              >
                {c.name}
              </button>
            ))}
          </div>

          {visible.length === 0 ? (
            <div className="rounded-xl border border-line bg-white">
              <EmptyState icon={SearchX} title="Sin resultados" description="Ningún producto coincide con la búsqueda en esta categoría." />
            </div>
          ) : (
            <div className="@container">
              <div className="grid grid-cols-2 gap-3 @xl:grid-cols-3 @4xl:grid-cols-4">
              {visible.map((product) => (
                <ProductCard key={product.id} product={product} qty={draft[product.id]?.qty ?? 0} onChange={(qty) => setQty(product, qty)} />
              ))}
              </div>
            </div>
          )}
        </div>

        <aside className="sticky top-22 hidden max-h-[calc(100dvh-7rem)] flex-col self-start rounded-xl border border-line bg-white lg:flex">
          <header className="shrink-0 border-b border-line px-5 py-4">
            <h2 className="text-base font-semibold text-ink">Pedido · {destination}</h2>
            <p className="text-sm text-muted">{count === 0 ? 'Sin productos nuevos' : `${count} ${count === 1 ? 'producto nuevo' : 'productos nuevos'}`}</p>
          </header>
          {panel}
        </aside>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-white p-3 lg:hidden">
        <Button variant="primary" size="lg" full onClick={() => setMobilePanel(true)}>
          <ShoppingBag className="size-5" aria-hidden />
          Ver pedido
          <span className="rounded bg-white/20 px-2 py-0.5 text-sm tabular-nums">{count}</span>
          <span className="ml-auto tabular-nums">{fmtMoney(total)}</span>
        </Button>
      </div>

      {mobilePanel && !reviewing && (
        <Modal title={`Pedido · ${destination}`} onClose={() => setMobilePanel(false)}>
          <div className="-mx-5 -my-5 flex max-h-[70dvh] flex-col">{panel}</div>
        </Modal>
      )}

      {reviewing && (
        <Modal
          title="Revisar pedido"
          description={`${destination}${existing ? ` · se agrega al pedido ${fmtOrderNumber(existing.number)}` : ''}`}
          onClose={() => setReviewing(false)}
          footer={
            <>
              <Button size="lg" onClick={() => setReviewing(false)}>
                Seguir editando
              </Button>
              <Button size="lg" variant="primary" icon={Send} onClick={confirm}>
                Confirmar y enviar a cocina
              </Button>
            </>
          }
        >
          {service === 'domicilio' && !existing && <p className="mb-4 text-sm text-muted">Entrega: {customer}</p>}
          <ul className="mb-5 divide-y divide-line rounded-lg border border-line">
            {items.map((item) => (
              <li key={item.productId} className="flex items-start justify-between gap-4 px-4 py-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-ink">
                    <span className="mr-2 tabular-nums">{item.qty}×</span>
                    {item.name}
                  </p>
                  {item.note.trim() && <p className="mt-0.5 text-sm text-muted">Nota: {item.note}</p>}
                </div>
                <span className="shrink-0 text-sm tabular-nums text-ink">{fmtMoney(item.qty * item.price)}</span>
              </li>
            ))}
          </ul>
          {totals}
        </Modal>
      )}

      {sent && <PrintResult result={sent} onTables={() => navigate('mesas')} />}
    </div>
  );
}
