import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { CircleAlert, CircleCheck, Info } from 'lucide-react';
import { cn } from '../../lib/format';

type Tone = 'success' | 'error' | 'info';
interface ToastItem {
  id: number;
  tone: Tone;
  text: string;
}

interface ToastApi {
  success(text: string): void;
  error(text: string): void;
  info(text: string): void;
}

const ToastContext = createContext<ToastApi | null>(null);
let nextId = 1;

const ICONS = { success: CircleCheck, error: CircleAlert, info: Info };
const TONES: Record<Tone, string> = {
  success: 'text-ok',
  error: 'text-bad',
  info: 'text-azul',
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);

  const push = useCallback((tone: Tone, text: string) => {
    const id = nextId++;
    setItems((list) => [...list.slice(-2), { id, tone, text }]);
    window.setTimeout(() => setItems((list) => list.filter((t) => t.id !== id)), tone === 'error' ? 5000 : 3200);
  }, []);

  const api = useMemo<ToastApi>(
    () => ({
      success: (text) => push('success', text),
      error: (text) => push('error', text),
      info: (text) => push('info', text),
    }),
    [push],
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="pointer-events-none fixed inset-x-4 top-4 z-[70] flex flex-col items-center gap-2 sm:left-auto sm:right-6 sm:items-end" aria-live="polite">
        {items.map((item) => {
          const Icon = ICONS[item.tone];
          return (
            <div key={item.id} role="status" className="pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-lg border border-line bg-white px-4 py-3 text-sm shadow-md">
              <Icon className={cn('mt-0.5 size-5 shrink-0', TONES[item.tone])} aria-hidden />
              <span className="text-ink">{item.text}</span>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const api = useContext(ToastContext);
  if (!api) throw new Error('useToast debe usarse dentro de ToastProvider');
  return api;
}
