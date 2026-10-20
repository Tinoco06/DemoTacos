import { useState } from 'react';
import { History, Pencil, Plus, Search, Tag } from 'lucide-react';
import type { CategoryId, Fulfillment, PriceChange, Product } from '../types';
import { useApp, useAttempt } from '../store/AppStore';
import { Button } from '../components/ui/Button';
import { Alert, Badge, Card, EmptyState, PageHeader } from '../components/ui/Basics';
import { DataTable, type Column } from '../components/ui/DataTable';
import { Checkbox, Field, Input, MoneyInput, Select } from '../components/ui/Field';
import { Modal } from '../components/ui/Modal';
import { CATEGORIES, categoryName, USERS } from '../data/catalog';
import { fmtDateTime, fmtMoney, parseAmount } from '../lib/format';

function ProductModal({ product, onClose }: { product: Product | null; onClose: () => void }) {
  const { state, actions } = useApp();
  const attempt = useAttempt();
  const [name, setName] = useState(product?.name ?? '');
  const [categoryId, setCategoryId] = useState<CategoryId>(product?.categoryId ?? 'mexicano');
  const [priceText, setPriceText] = useState(product ? product.price.toFixed(2) : '');
  const [active, setActive] = useState(product?.active ?? true);
  const [fulfillment, setFulfillment] = useState<Fulfillment>(product?.fulfillment ?? 'PREPARADO');
  const [trackStock, setTrackStock] = useState(product?.trackStock ?? false);
  const [stockText, setStockText] = useState('0');
  const [minText, setMinText] = useState(String(product?.minStock ?? 0));
  const [submitted, setSubmitted] = useState(false);

  const price = parseAmount(priceText);
  const isInt = (text: string) => /^\d+$/.test(text.trim());
  const errors = {
    name: name.trim().length < 2 ? 'Ingrese el nombre del producto.' : null,
    price: !(price > 0) ? 'Ingrese un precio mayor que cero.' : null,
    stock: trackStock && !product && !isInt(stockText) ? 'Ingrese un número entero.' : null,
    min: trackStock && !isInt(minText) ? 'Ingrese un número entero.' : null,
  };
  const valid = Object.values(errors).every((e) => !e);
  const priceChanged = product && price > 0 && price !== product.price;

  const save = () => {
    setSubmitted(true);
    if (!valid) return;
    const input = { id: product?.id ?? null, name, categoryId, price, active, fulfillment, trackStock, stock: Number(stockText) || 0, minStock: Number(minText) || 0, user: USERS[state.role] };
    if (attempt(() => actions.saveProduct(input), product ? 'Producto actualizado.' : 'Producto creado.').ok) onClose();
  };

  return (
    <Modal
      title={product ? 'Editar producto' : 'Nuevo producto'}
      description={product ? undefined : 'Se identificará como producto de demostración.'}
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>Cancelar</Button>
          <Button variant="primary" onClick={save}>
            Guardar producto
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
        <Field label="Nombre" error={submitted ? errors.name : null} className="sm:col-span-2">
          <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={60} autoFocus invalid={submitted && Boolean(errors.name)} />
        </Field>
        <Field label="Categoría">
          <Select value={categoryId} onChange={(e) => setCategoryId(e.target.value as CategoryId)}>
            {CATEGORIES.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Precio" error={submitted ? errors.price : null}>
          <MoneyInput value={priceText} onChange={(e) => setPriceText(e.target.value)} invalid={submitted && Boolean(errors.price)} />
        </Field>
        {priceChanged && (
          <div className="sm:col-span-2">
            <Alert tone="info">
              El precio cambia de {fmtMoney(product.price)} a {fmtMoney(price)}. El cambio quedará en el historial de precios y no afecta las cuentas ya abiertas.
            </Alert>
          </div>
        )}
        <Field label="Tipo de entrega" hint={fulfillment === 'PREPARADO' ? 'Queda pendiente hasta que el mesero lo envía a cocina.' : 'Se suma a la cuenta al instante, sin ticket de cocina.'} className="sm:col-span-2">
          <Select value={fulfillment} onChange={(e) => setFulfillment(e.target.value as Fulfillment)}>
            <option value="PREPARADO">Preparado en cocina</option>
            <option value="DIRECTO">Entrega directa</option>
          </Select>
        </Field>
        <div className="flex flex-col gap-3 sm:col-span-2">
          <Checkbox label="Controlar existencias" hint="Actívelo en bebidas. Los platos y los cubetazos no descuentan inventario." checked={trackStock} onChange={(e) => setTrackStock(e.target.checked)} />
          <Checkbox label="Producto activo" hint="Los productos inactivos no aparecen al tomar pedidos." checked={active} onChange={(e) => setActive(e.target.checked)} />
        </div>
        {trackStock && !product && (
          <Field label="Stock inicial" error={submitted ? errors.stock : null}>
            <Input inputMode="numeric" value={stockText} onChange={(e) => setStockText(e.target.value)} className="text-right tabular-nums" />
          </Field>
        )}
        {trackStock && (
          <Field label="Stock mínimo" hint="Por debajo de este valor se avisa stock bajo." error={submitted ? errors.min : null}>
            <Input inputMode="numeric" value={minText} onChange={(e) => setMinText(e.target.value)} className="text-right tabular-nums" />
          </Field>
        )}
        <button type="submit" hidden />
      </form>
    </Modal>
  );
}

export function ProductsPage() {
  const { state, actions } = useApp();
  const attempt = useAttempt();
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('todas');
  const [status, setStatus] = useState('todos');
  const [editing, setEditing] = useState<Product | 'nuevo' | null>(null);

  const query = search.trim().toLowerCase();
  const rows = state.products
    .filter((p) => !query || p.name.toLowerCase().includes(query))
    .filter((p) => category === 'todas' || p.categoryId === category)
    .filter((p) => status === 'todos' || (status === 'activos' ? p.active : !p.active));
  const hasProvisional = state.products.some((p) => p.provisional);

  const columns: Column<Product>[] = [
    {
      key: 'producto',
      header: 'Producto',
      render: (p) => (
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-medium">{p.name}</span>
          {p.provisional && <Badge tone="warning">Precio por confirmar</Badge>}
          {p.demo && <Badge tone="info">Demostración</Badge>}
        </div>
      ),
    },
    { key: 'categoria', header: 'Categoría', render: (p) => categoryName(p.categoryId) },
    { key: 'precio', header: 'Precio', align: 'right', render: (p) => <span className="font-semibold">{fmtMoney(p.price)}</span> },
    { key: 'entrega', header: 'Entrega', render: (p) => (p.fulfillment === 'PREPARADO' ? 'Cocina' : 'Directa') },
    { key: 'stock', header: 'Control de stock', render: (p) => (p.trackStock ? `Sí · ${p.stock} en existencia` : 'No') },
    { key: 'estado', header: 'Estado', render: (p) => <Badge tone={p.active ? 'success' : 'neutral'}>{p.active ? 'Activo' : 'Inactivo'}</Badge> },
    {
      key: 'acciones',
      header: 'Acciones',
      align: 'right',
      render: (p) => (
        <div className="flex justify-end gap-2">
          <Button size="sm" icon={Pencil} onClick={() => setEditing(p)}>
            Editar
          </Button>
          <Button size="sm" className="w-28" onClick={() => attempt(() => actions.setProductActive({ id: p.id, active: !p.active }), p.active ? `${p.name} desactivado.` : `${p.name} activado.`)}>
            {p.active ? 'Desactivar' : 'Activar'}
          </Button>
        </div>
      ),
    },
  ];

  const historyColumns: Column<PriceChange>[] = [
    { key: 'fecha', header: 'Fecha', render: (c) => <span className="whitespace-nowrap">{fmtDateTime(c.date)}</span> },
    { key: 'producto', header: 'Producto', render: (c) => <span className="font-medium">{c.productName}</span> },
    { key: 'anterior', header: 'Precio anterior', align: 'right', render: (c) => <span className="text-muted">{fmtMoney(c.oldPrice)}</span> },
    { key: 'nuevo', header: 'Precio nuevo', align: 'right', render: (c) => <span className="font-semibold">{fmtMoney(c.newPrice)}</span> },
    { key: 'usuario', header: 'Usuario', render: (c) => c.user },
  ];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Productos y precios"
        description={`${state.products.filter((p) => p.active).length} productos activos de ${state.products.length}`}
        actions={
          <Button variant="primary" icon={Plus} onClick={() => setEditing('nuevo')}>
            Nuevo producto
          </Button>
        }
      />

      {hasProvisional && <Alert tone="warning">Los precios del menú catracho se tomaron de etiquetas manuscritas y son provisionales. Al editar el precio de un producto, queda confirmado.</Alert>}

      <Card>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Field label="Buscar">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden />
              <Input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Nombre del producto" className="pl-9" />
            </div>
          </Field>
          <Field label="Categoría">
            <Select value={category} onChange={(e) => setCategory(e.target.value)}>
              <option value="todas">Todas las categorías</option>
              {CATEGORIES.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Estado">
            <Select value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="todos">Todos</option>
              <option value="activos">Activos</option>
              <option value="inactivos">Inactivos</option>
            </Select>
          </Field>
        </div>
      </Card>

      <Card flush>
        <DataTable columns={columns} rows={rows} rowKey={(p) => p.id} minWidth={980} empty={<EmptyState icon={Tag} title="Sin productos" description="Ningún producto coincide con los filtros." />} />
      </Card>

      <Card title="Historial de cambios de precio" flush>
        <DataTable columns={historyColumns} rows={state.priceHistory} rowKey={(c) => c.id} minWidth={680} empty={<EmptyState icon={History} title="Sin cambios de precio registrados" />} />
      </Card>

      {editing && <ProductModal product={editing === 'nuevo' ? null : editing} onClose={() => setEditing(null)} />}
    </div>
  );
}
