import { useEffect, useRef, useState, type ReactNode } from 'react';
import { cn } from '../../lib/format';

export interface Column<T> {
  key: string;
  header: string;
  align?: 'left' | 'right';
  render: (row: T) => ReactNode;
  /** Clases para la columna completa (encabezado y celdas), p. ej. para ocultarla en pantallas angostas. */
  className?: string;
  /** Columna fija al borde derecho cuando la tabla no cabe (acciones como «Cobrar»). */
  sticky?: boolean;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  empty?: ReactNode;
  minWidth?: number;
  /** Clases adicionales para resaltar filas concretas. */
  rowClassName?: (row: T) => string | undefined;
}

/** Indica si la tabla desborda su contenedor horizontalmente. */
function useHorizontalOverflow(active: boolean) {
  const ref = useRef<HTMLDivElement>(null);
  const [overflowing, setOverflowing] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!active || !el) return;
    const check = () => setOverflowing(el.scrollWidth > el.clientWidth + 1);
    check();
    const observer = new ResizeObserver(check);
    observer.observe(el);
    if (el.firstElementChild) observer.observe(el.firstElementChild);
    return () => observer.disconnect();
  }, [active]);
  return { ref, overflowing };
}

/**
 * Tabla legible con desplazamiento horizontal propio en pantallas angostas.
 * Las columnas `sticky` quedan visibles al borde derecho mientras la tabla se desplaza.
 */
export function DataTable<T>({ columns, rows, rowKey, empty, minWidth = 640, rowClassName }: DataTableProps<T>) {
  const showTable = rows.length > 0 || !empty;
  const { ref, overflowing } = useHorizontalOverflow(showTable);
  if (!showTable) return <>{empty}</>;

  // La sombra separa la columna fija solo cuando de verdad hay contenido desplazándose debajo.
  const stickyCell = cn('sticky right-0 z-[1] bg-inherit', overflowing && 'shadow-[-6px_0_8px_-6px_rgba(37,35,35,0.22)]');

  return (
    <div ref={ref} className="overflow-x-auto">
      <table className="w-full border-collapse text-sm" style={{ minWidth }}>
        <thead>
          <tr className="border-b border-line bg-white">
            {columns.map((column) => (
              <th
                key={column.key}
                scope="col"
                className={cn(
                  'px-3 py-3 text-xs font-medium uppercase tracking-wide text-muted xl:whitespace-nowrap xl:px-5',
                  column.align === 'right' ? 'text-right' : 'text-left',
                  column.sticky && stickyCell,
                  column.className,
                )}
              >
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={rowKey(row)} className={cn('border-b border-line bg-white last:border-b-0', rowClassName?.(row))}>
              {columns.map((column) => (
                <td
                  key={column.key}
                  className={cn(
                    'px-3 py-3.5 align-middle text-ink xl:px-5',
                    column.align === 'right' && 'whitespace-nowrap text-right tabular-nums',
                    column.sticky && stickyCell,
                    column.className,
                  )}
                >
                  {column.render(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
