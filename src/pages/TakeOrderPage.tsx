import { useEffect, useState } from 'react';
import { ArrowLeft, HandCoins, LayoutGrid, MessageSquarePlus, Search, SearchX, Send, ShoppingBag, Trash2 } from 'lucide-react';
import type { OrderItem, Product, ServiceType } from '../types';
import { useApp, useAttempt } from '../store/AppStore';
import { useToast } from '../components/ui/Toast';
import type { SubmitOrderResult } from '../simulation/orders';
import { Button } from '../components/ui/Button';
import { Alert, Badge, EmptyState, Stepper, SummaryRow } from '../components/ui/Basics';
import { Field, Input, MoneyInput } from '../components/ui/Field';
import { ConfirmDialog, Modal } from '../components/ui/Modal';
import { ProductCard } from '../components/domain/Cards';
import { KitchenTicket } from '../components/domain/Tickets';
import { CATEGORIES, categoryName, USERS } from '../data/catalog';
import { currentSession, itemsCount, itemsSubtotal, openOrderForTable, orderTotal, serviceLabel } from '../lib/calc';
import { cn, fmtMoney, fmtOrderNumber, parseAmount } from '../lib/format';
import { navigate } from '../lib/router';

/** Comidas seleccionadas que todavía no se han enviado a cocina. Viven solo en esta pantalla. */
type Pending = Record<string, { qty: number; note: string }>;

const normalize = (text: string) => text.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

function KitchenSent({ result, onContinue, onTables }: { result: SubmitOrderResult; onContinue: () => void; onTables: () => void }) {
  const [printing, setPrinting] = useState(true);
  useEffect(() => {
    const timer = window.setTimeout(() => setPrinting(false), 1100);
    return () => window.clearTimeout(timer);
  }, []);
  const { order, operation } = result;

  return (
    <Modal
      title={printing ? 'Enviando a cocina' : 'Comidas enviadas a cocina'}
      description={`Pedido ${fmtOrderNumber(order.number)} · ${serviceLabel(order)} · cuenta de ${fmtMoney(orderTotal(order))}`}
      onClose={onContinue}
      footer={
        <>
          <Button size="lg" onClick={onContinue}>
            Seguir agregando
          </Button>
          <Button size="lg" variant="primary" icon={LayoutGrid} onClick={onTables}>
            Volver a mesas
          </Button>
        </>
      }
    >
      <div className="mb-4" aria-live="polite">
        {printing ? (
          <Alert tone="info">Enviando el ticket a la impresora de cocina…</Alert>
        ) : (
          <Alert tone="success">
            <span className="font-medium">Ticket impreso en cocina (simulación).</span> Envío {operation.number} por {fmtMoney(itemsSubtotal(operation.items))}.
          </Alert>
        )}
      </div>
      <KitchenTicket order={order} operation={operation} />
    </Modal>
  );
}

/**
 * Interfaz de toma de pedidos. No es una sección propia: se abre desde una mesa
 * (?mesa=), desde «Pedido a domicilio» (?servicio=domicilio) o desde una cuenta abierta (?pedido=).
 *
 * Las bebidas y demás productos de entrega directa se suman a la cuenta al tocarlos.
 * Las comidas quedan pendientes hasta que el mesero pulsa «Enviar comidas a cocina».
 */
export function TakeOrderPage({ params }: { params: Record<string, string> }) {
  const { state, actions } = useApp();
  const attempt = useAttempt();
  const toast = useToast();
  const isAdmin = state.role === 'admin';

  const paramOrder = params.pedido ? state.orders.find((o) => o.id === params.pedido && o.status === 'abierta') : undefined;
  const paramTable = state.tables.find((t) => t.id === params.mesa && t.active);
  const [service] = useState<ServiceType>(paramOrder?.service ?? (params.servicio === 'domicilio' ? 'domicilio' : 'mesa'));
  const [tableId] = useState(paramOrder?.tableId ?? paramTable?.id ?? '');
  const [orderId, setOrderId] = useState<string | null>(paramOrder?.id ?? null);
  const [customer, setCustomer] = useState('');
  const [shippingText, setShippingText] = useState('');
  const [pending, setPending] = useState<Pending>({});
  const [category, setCategory] = useState('todos');
  const [search, setSearch] = useState('');
  const [openNotes, setOpenNotes] = useState<Record<string, boolean>>({});
  const [mobilePanel, setMobilePanel] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [sent, setSent] = useState<SubmitOrderResult | null>(null);

  const table = state.tables.find((t) => t.id === tableId);
  const existing =
    (orderId ? state.orders.find((o) => o.id === orderId && o.status === 'abierta') : undefined) ??
    (service === 'mesa' && tableId ? openOrderForTable(state, tableId) : undefined);

  const products = state.products.filter((p) => p.active);
  const query = normalize(search.trim());
  const visible = products.filter((p) => (category === 'todos' || p.categoryId === category) && (!query || normalize(p.name).includes(query)));

  const lines = Object.entries(pending)
    .map(([productId, line]) => ({ product: state.products.find((p) => p.id === productId), ...line }))
    .filter((l): l is { product: Product; qty: number; note: string } => Boolean(l.product) && l.qty > 0);
  const pendingItems: OrderItem[] = lines.map((l) => ({ productId: l.product.id, name: l.product.name, price: l.product.price, qty: l.qty, note: l.note, fulfillment: l.product.fulfillment }));
  const pendingTotal = itemsSubtotal(pendingItems);
  const pendingCount = itemsCount(pendingItems);
  const confirmedTotal = existing ? orderTotal(existing) : 0;
  const inAccount = (productId: string) => existing?.items.filter((i) => i.productId === productId).reduce((n, i) => n + i.qty, 0) ?? 0;

  const shippingValue = shippingText.trim() === '' ? 0 : parseAmount(shippingText);
  const shippingError = service === 'domicilio' && !existing && (Number.isNaN(shippingValue) || shippingValue < 0) ? 'Ingrese un costo de envío válido.' : null;
  const shipping = existing ? existing.shipping : service === 'domicilio' && !shippingError ? shippingValue : 0;
  const missingAddress = service === 'domicilio' && !existing && customer.trim().length < 3;
  const deliveryBlocked = missingAddress || Boolean(shippingError);
  const destination = existing ? serviceLabel(existing) : service === 'mesa' ? table?.name ?? 'Mesa' : 'Domicilio';

  // Sin mesa válida ni pedido a domicilio no hay nada que tomar: se vuelve a Mesas.
  const invalidEntry = service === 'mesa' && !table;
  const cashOpen = Boolean(currentSession(state));
  useEffect(() => {
    if (invalidEntry) navigate('mesas');
  }, [invalidEntry]);

  const setQty = (product: Product, qty: number) => {
    const capped = product.trackStock ? Math.min(qty, product.stock) : qty;
    setPending((current) => {
      const next = { ...current };
      if (capped <= 0) delete next[product.id];
      else next[product.id] = { qty: capped, note: current[product.id]?.note ?? '' };
      return next;
    });
  };
  const setNote = (productId: string, note: string) => setPending((current) => ({ ...current, [productId]: { ...current[productId], note } }));

  const submit = (kind: 'cocina' | 'directo', items: OrderItem[], success?: string) => {
    if (deliveryBlocked) {
      toast.error('Ingrese la dirección de entrega y un costo de envío válido para abrir la cuenta.');
      return null;
    }
    const result = attempt(
      () => actions.submitOrder({ kind, orderId: existing?.id ?? null, service, tableId: tableId || null, customer, shipping, items, user: USERS[state.role] }),
      success,
    );
    if (!result.ok) return null;
    setOrderId(result.value.order.id);
    return result.value;
  };

  /** Entrega directa: una unidad entra a la cuenta en el momento, sin confirmación ni ticket de cocina. */
  const addDirect = (product: Product) =>
    submit('directo', [{ productId: product.id, name: product.name, price: product.price, qty: 1, note: '', fulfillment: product.fulfillment }], `${product.name}: 1 unidad agregada a la cuenta.`);

  const sendToKitchen = () => {
    if (pendingCount === 0) return;
    const result = submit('cocina', pendingItems);
    if (result) {
      setPending({});
      setOpenNotes({});
      setMobilePanel(false);
      setSent(result);
    }
  };

  const goBack = () => (pendingCount > 0 ? setLeaving(true) : navigate('mesas'));

  const panel = (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto">
        <section className="px-5 py-4" aria-label="Productos en la cuenta">
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted">En la cuenta</p>
          {!existing || existing.items.length === 0 ? (
            <p className="text-sm text-muted">La cuenta todavía no tiene productos confirmados.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {existing.items.map((item, index) => (
                <li key={`${item.productId}-${index}`} className="flex items-start justify-between gap-3 text-sm">
                  <span className="min-w-0 text-ink">
                    <span className="mr-1.5 font-semibold tabular-nums">{item.qty}×</span>
                    {item.name}
                    {item.note && <span className="block text-muted">Nota: {item.note}</span>}
                  </span>
                  <span className="flex shrink-0 items-center gap-2">
                    {item.fulfillment === 'DIRECTO' && <Badge tone="info">Directo</Badge>}
                    <span className="tabular-nums text-ink">{fmtMoney(item.qty * item.price)}</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="border-t border-line" aria-label="Comidas pendientes de enviar a cocina">
          <div className={cn('flex items-center justify-between gap-3 px-5 py-3', pendingCount > 0 ? 'bg-warn-soft' : 'bg-marfil')}>
            <p className="text-xs font-medium uppercase tracking-wide text-ink">Comidas por enviar a cocina</p>
            {pendingCount > 0 && <Badge tone="warning">Sin enviar</Badge>}
          </div>
          {lines.length === 0 ? (
            <p className="px-5 py-4 text-sm text-muted">Las comidas que seleccione quedarán aquí hasta que las envíe a cocina. Las bebidas se suman a la cuenta al instante.</p>
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
                      <button type="button" onClick={() => setQty(product, 0)} aria-label={`Quitar ${product.name} de los pendientes`} className="ml-auto grid size-11 place-items-center rounded-lg text-muted hover:bg-bad-soft hover:text-bad">
                        <Trash2 className="size-5" aria-hidden />
                      </button>
                    </div>
                    {showNote && <Input value={note} onChange={(e) => setNote(product.id, e.target.value)} placeholder="Observación para cocina, ej. sin cebolla" aria-label={`Observación para ${product.name}`} maxLength={80} />}
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>

      <div className="flex shrink-0 flex-col gap-3 border-t border-line px-5 py-4">
        {shipping > 0 && <SummaryRow label={existing ? 'Envío (incluido)' : 'Envío'} value={fmtMoney(shipping)} muted />}
        <SummaryRow label="Cuenta confirmada" value={<span className="text-xl">{fmtMoney(confirmedTotal)}</span>} strong />
        <div className={cn('flex items-baseline justify-between gap-4 text-sm', pendingCount > 0 ? 'font-medium text-warn' : 'text-muted')}>
          <span>Pendiente de enviar</span>
          <span className="tabular-nums">{fmtMoney(pendingTotal)}</span>
        </div>
        {pendingCount > 0 && (
          <Button variant="primary" size="lg" full icon={Send} onClick={sendToKitchen}>
            Enviar comidas a cocina
          </Button>
        )}
        {pendingCount > 0 && deliveryBlocked && <p className="text-sm text-warn">Ingrese la dirección de entrega y el costo de envío para continuar.</p>}
        {existing && isAdmin && pendingCount === 0 && (
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
        <Button icon={ArrowLeft} onClick={goBack}>
          Mesas
        </Button>
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight text-ink">{existing ? serviceLabel(existing) : service === 'mesa' ? table?.name : 'Pedido a domicilio'}</h1>
          <p className="text-sm text-muted">{existing ? `Pedido ${fmtOrderNumber(existing.number)} · cuenta abierta de ${fmtMoney(confirmedTotal)}` : 'Cuenta nueva'}</p>
        </div>
      </div>

      {!cashOpen && (
        <div className="mb-6">
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
            <span className="font-semibold">La caja está cerrada.</span> No se pueden registrar pedidos hasta realizar la apertura{isAdmin ? '.' : '. Pida al administrador que abra la caja.'}
          </Alert>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_340px] xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="flex min-w-0 flex-col gap-6">
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

          <div className="flex flex-col gap-5">
            <div className="relative">
              <Search className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-muted" aria-hidden />
              <Input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar producto por nombre" aria-label="Buscar producto" className="h-12 pl-12 text-base" />
            </div>

            <div>
              <p id="categorias" className="mb-2 text-xs font-medium uppercase tracking-wide text-muted">
                Categorías
              </p>
              {/* Teléfono y tablet (también apaisada): una fila desplazable. PC desde 1280 px: filas compactas. */}
              <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 xl:mx-0 xl:flex-wrap xl:gap-1.5 xl:overflow-visible xl:px-0" role="tablist" aria-labelledby="categorias">
                {[{ id: 'todos', name: 'Todos' }, ...CATEGORIES].map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    role="tab"
                    aria-selected={category === c.id}
                    onClick={() => setCategory(c.id)}
                    className={cn(
                      'h-11 shrink-0 whitespace-nowrap rounded-full px-4 text-[13px] font-medium transition-colors xl:px-3',
                      category === c.id ? 'bg-frambuesa text-white' : 'bg-carbon/6 text-muted hover:bg-carbon/10 hover:text-ink',
                    )}
                  >
                    {c.name}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <section aria-labelledby="productos" className="flex flex-col gap-4 border-t border-line pt-6">
            <header className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
              <h2 id="productos" className="text-lg font-semibold text-ink">
                Productos
              </h2>
              <p className="text-sm text-muted">
                {query ? `Resultados de «${search.trim()}»` : category === 'todos' ? 'Todo el menú' : categoryName(category)} · {visible.length} {visible.length === 1 ? 'producto' : 'productos'}
              </p>
            </header>

            {visible.length === 0 ? (
              <div className="rounded-xl border border-line bg-white">
                <EmptyState icon={SearchX} title="Sin resultados" description="Ningún producto coincide con la búsqueda en esta categoría." />
              </div>
            ) : (
              <div className="@container">
                <div className="grid grid-cols-2 gap-3 @xl:grid-cols-3 @4xl:grid-cols-4">
                  {visible.map((product) => (
                    <ProductCard
                      key={product.id}
                      product={product}
                      pendingQty={pending[product.id]?.qty ?? 0}
                      disabled={!cashOpen}
                      accountQty={inAccount(product.id)}
                      onPendingChange={(qty) => setQty(product, qty)}
                      onAddDirect={() => addDirect(product)}
                    />
                  ))}
                </div>
              </div>
            )}
          </section>
        </div>

        <aside className="sticky top-22 hidden max-h-[calc(100dvh-7rem)] flex-col self-start rounded-xl border border-line bg-white lg:flex">
          <header className="shrink-0 border-b border-line px-5 py-4">
            <h2 className="text-base font-semibold text-ink">Cuenta · {destination}</h2>
            <p className="text-sm text-muted">{pendingCount === 0 ? 'Sin comidas pendientes de envío' : `${pendingCount} ${pendingCount === 1 ? 'comida pendiente' : 'comidas pendientes'} de envío`}</p>
          </header>
          {panel}
        </aside>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-white p-3 lg:hidden">
        <Button variant="primary" size="lg" full onClick={() => setMobilePanel(true)}>
          <ShoppingBag className="size-5" aria-hidden />
          Ver cuenta
          {pendingCount > 0 && <span className="rounded bg-white/20 px-2 py-0.5 text-sm tabular-nums">{pendingCount} por enviar</span>}
          <span className="ml-auto tabular-nums">{fmtMoney(confirmedTotal)}</span>
        </Button>
      </div>

      {mobilePanel && (
        <Modal title={`Cuenta · ${destination}`} onClose={() => setMobilePanel(false)}>
          <div className="-mx-5 -my-5 flex max-h-[70dvh] flex-col">{panel}</div>
        </Modal>
      )}

      {sent && <KitchenSent result={sent} onContinue={() => setSent(null)} onTables={() => navigate('mesas')} />}

      {leaving && (
        <ConfirmDialog
          title="Hay comidas sin enviar"
          message={`Tiene ${pendingCount} ${pendingCount === 1 ? 'comida pendiente' : 'comidas pendientes'} por ${fmtMoney(pendingTotal)} que no se han enviado a cocina. Si sale ahora, se descartarán y no se sumarán a la cuenta.`}
          confirmLabel="Salir y descartar"
          danger
          onClose={() => setLeaving(false)}
          onConfirm={() => navigate('mesas')}
        />
      )}
    </div>
  );
}
