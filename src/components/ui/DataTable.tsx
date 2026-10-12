import type { ReactNode } from 'react';
import { cn } from '../../lib/format';

export interface Column<T> {
  key: string;
  header: string;
  align?: 'left' | 'right';
  render: (row: T) => ReactNode;
  className?: string;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  empty?: ReactNode;
  minWidth?: number;
}

/** Tabla legible con desplazamiento horizontal propio en pantallas angostas. */
export function DataTable<T>({ columns, rows, rowKey, empty, minWidth = 640 }: DataTableProps<T>) {
  if (rows.length === 0 && empty) return <>{empty}</>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm" style={{ minWidth }}>
        <thead>
          <tr className="border-b border-line">
            {columns.map((column) => (
              <th key={column.key} scope="col" className={cn('whitespace-nowrap px-5 py-3 text-xs font-medium uppercase tracking-wide text-muted', column.align === 'right' ? 'text-right' : 'text-left')}>
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={rowKey(row)} className="border-b border-line last:border-b-0">
              {columns.map((column) => (
                <td key={column.key} className={cn('px-5 py-3.5 align-middle text-ink', column.align === 'right' && 'text-right tabular-nums', column.className)}>
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
