import { useState } from 'react';
import { ArrowLeftRight, History, PackageCheck } from 'lucide-react';
import type { Product, StockMovement } from '../types';
import { useApp, useAttempt } from '../store/AppStore';
import { Button } from '../components/ui/Button';
import { Alert, Badge, Card, EmptyState, PageHeader, Segmented, SummaryRow } from '../components/ui/Basics';
import { DataTable, type Column } from '../components/ui/DataTable';
import { Field, Input } from '../components/ui/Field';
import { Modal } from '../components/ui/Modal';
import { categoryName, USERS } from '../data/catalog';
import { stockStatus } from '../lib/calc';
import { fmtDateTime } from '../lib/format';

type Filter = 'todos' | 'bajo' | 'agotado';
type MoveType = 'entrada' | 'salida' | 'ajuste';

const STATUS = {
  ok: { tone: 'success', label: 'Disponible' },
  bajo: { tone: 'warning', label: 'Stock bajo' },
  agotado: { tone: 'danger', label: 'Agotado' },
} as const;

const MOVE_LABEL: Record<StockMovement['type'], string> = { entrada: 'Entrada', salida: 'Salida', ajuste: 'Ajuste', venta: 'Venta', devolucion: 'Devolución' };

function StockModal({ product, onClose }: { product: Product; onClose: () => void }) {
  const { state, actions } = useApp();
  const attempt = useAttempt();
  const [type, setType] = useState<MoveType>('entrada');
  const [qtyText, setQtyText] = useState('');
  const [note, setNote] = useState('');

  const qty = /^\d+$/.test(qtyText.trim()) ? Number(qtyText) : NaN;
  const result = type === 'entrada' ? product.stock + qty : type === 'salida' ? product.stock - qty : qty;
  const error =
    qtyText.trim() === ''
      ? null
      : Number.isNaN(qty)
        ? 'Ingrese un número entero.'
        : type !== 'ajuste' && qty === 0
          ? 'La cantidad debe ser mayor que cero.'
          : type === 'salida' && qty > product.stock
            ? `Solo hay ${product.stock} unidades en existencia.`
            : type === 'ajuste' && qty === product.stock
              ? 'El conteo coincide con la existencia actual.'
              : null;
  const valid = qtyText.trim() !== '' && !error;

  return (
    <Modal
      title="Registrar movimiento"
      description={product.name}
      size="sm"
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>Cancelar</Button>
          <Button
            variant="primary"
            disabled={!valid}
            onClick={() => {
              if (attempt(() => actions.adjustStock({ productId: product.id, type, qty, note, user: USERS[state.role] }), 'Movimiento de inventario registrado.').ok) onClose();
            }}
          >
            Registrar
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-5">
        <Segmented
          label="Tipo de movimiento"
          full
          size="lg"
          value={type}
          onChange={setType}
          options={[
            { value: 'entrada', label: 'Entrada' },
            { value: 'salida', label: 'Salida' },
            { value: 'ajuste', label: 'Ajuste' },
          ]}
        />
        <Field
          label={type === 'ajuste' ? 'Existencia real contada' : 'Cantidad de unidades'}
          hint={type === 'entrada' ? 'Compra o reposición de producto.' : type === 'salida' ? 'Merma, quiebre o consumo interno.' : 'Corrige la existencia según el conteo físico.'}
          error={error}
        >
          <Input inputMode="numeric" value={qtyText} onChange={(e) => setQtyText(e.target.value)} placeholder="0" invalid={Boolean(error)} autoFocus className="text-right tabular-nums" />
        </Field>
        <Field label="Nota (opcional)">
          <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ej. pedido a distribuidora" maxLength={80} />
        </Field>
        <div className="flex flex-col gap-1 rounded-lg bg-marfil px-4 py-3">
          <SummaryRow label="Stock actual" value={product.stock} muted />
          <SummaryRow label="Stock resultante" value={valid ? result : '—'} strong />
        </div>
      </div>
    </Modal>
  );
}

export function InventoryPage() {
  const { state } = useApp();
  const [filter, setFilter] = useState<Filter>('todos');
  const [moving, setMoving] = useState<string | null>(null);

  const tracked = state.products.filter((p) => p.trackStock && p.active);
  const low = tracked.filter((p) => stockStatus(p) === 'bajo');
  const out = tracked.filter((p) => stockStatus(p) === 'agotado');
  const rows = filter === 'todos' ? tracked : filter === 'bajo' ? low : out;
  const movingProduct = state.products.find((p) => p.id === moving);

  const columns: Column<Product>[] = [
    {
      key: 'producto',
      header: 'Producto',
      render: (p) => (
        <div className="whitespace-nowrap">
          <p className="font-medium">{p.name}</p>
          <p className="text-muted">{categoryName(p.categoryId)}</p>
        </div>
      ),
    },
    { key: 'stock', header: 'Stock actual', align: 'right', render: (p) => <span className="text-base font-semibold">{p.stock}</span> },
    { key: 'minimo', header: 'Stock mínimo', align: 'right', render: (p) => p.minStock },
    { key: 'estado', header: 'Estado', render: (p) => <Badge tone={STATUS[stockStatus(p)].tone}>{STATUS[stockStatus(p)].label}</Badge> },
    {
      key: 'acciones',
      header: 'Acciones',
      align: 'right',
      render: (p) => (
        <Button size="sm" icon={ArrowLeftRight} onClick={() => setMoving(p.id)}>
          Registrar movimiento
        </Button>
      ),
    },
  ];

  const historyColumns: Column<StockMovement>[] = [
    { key: 'fecha', header: 'Fecha', render: (m) => <span className="whitespace-nowrap">{fmtDateTime(m.date)}</span> },
    { key: 'producto', header: 'Producto', render: (m) => m.productName },
    { key: 'tipo', header: 'Tipo', render: (m) => <Badge tone={m.type === 'entrada' || m.type === 'devolucion' ? 'success' : m.type === 'ajuste' ? 'info' : 'neutral'}>{MOVE_LABEL[m.type]}</Badge> },
    { key: 'cantidad', header: 'Cantidad', align: 'right', render: (m) => (m.delta > 0 ? `+${m.delta}` : m.delta) },
    { key: 'resultado', header: 'Stock resultante', align: 'right', render: (m) => m.resultingStock },
    { key: 'nota', header: 'Nota', render: (m) => <span className="text-muted">{m.note || '—'}</span> },
    { key: 'usuario', header: 'Usuario', render: (m) => m.user },
  ];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Inventario" description="Existencias de bebidas. Los platos y los cubetazos no descuentan inventario." />

      {(low.length > 0 || out.length > 0) && (
        <Alert tone={out.length > 0 ? 'danger' : 'warning'}>
          {out.length > 0 && (
            <>
              <strong className="font-semibold">{out.length === 1 ? '1 producto agotado' : `${out.length} productos agotados`}:</strong> {out.map((p) => p.name).join(', ')}.{' '}
            </>
          )}
          {low.length > 0 && (
            <>
              <strong className="font-semibold">{low.length === 1 ? '1 producto con stock bajo' : `${low.length} productos con stock bajo`}:</strong> {low.map((p) => p.name).join(', ')}.
            </>
          )}
        </Alert>
      )}

      <Segmented
        label="Filtro de inventario"
        value={filter}
        onChange={setFilter}
        options={[
          { value: 'todos', label: 'Todos', count: tracked.length },
          { value: 'bajo', label: 'Stock bajo', count: low.length },
          { value: 'agotado', label: 'Agotados', count: out.length },
        ]}
      />

      <Card flush>
        <DataTable columns={columns} rows={rows} rowKey={(p) => p.id} minWidth={720} empty={<EmptyState icon={PackageCheck} title="Ningún producto en este estado" description="Las existencias están por encima del mínimo configurado." />} />
      </Card>

      <Card title="Historial de movimientos" description="Últimos 30 movimientos, incluidas las ventas" flush>
        <DataTable columns={historyColumns} rows={state.stockMovements.slice(0, 30)} rowKey={(m) => m.id} minWidth={860} empty={<EmptyState icon={History} title="Sin movimientos registrados" />} />
      </Card>

      {movingProduct && <StockModal product={movingProduct} onClose={() => setMoving(null)} />}
    </div>
  );
}
