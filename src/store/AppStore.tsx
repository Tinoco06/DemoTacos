import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { AppState, Client, Order, Role } from '../types';
import { buildSeed, STATE_VERSION } from '../data/seed';
import { SimError } from '../simulation/errors';
import * as orderSim from '../simulation/orders';
import * as ops from '../simulation/operations';
import { useToast } from '../components/ui/Toast';

const STORAGE_KEY = 'tacos-grill-demo-v1';

function loadState(): AppState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const saved = JSON.parse(raw) as AppState;
      if (saved.version === STATE_VERSION) return saved;
    }
  } catch {
    // Datos guardados ilegibles: se vuelve a los datos originales.
  }
  return buildSeed(new Date());
}

/** Operaciones disponibles para las pantallas. Equivalen a los futuros endpoints de la API. */
export interface Actions {
  setRole(role: Role): void;
  reset(): void;
  submitOrder(input: orderSim.SubmitOrderInput): orderSim.SubmitOrderResult;
  cancelOrder(input: { orderId: string; reason: string; user: string }): void;
  chargeOrder(input: orderSim.ChargeInput): Order;
  registerAbono(input: { clientId: string; amount: number; method: 'efectivo' | 'transferencia' }): void;
  adjustStock(input: ops.StockInput): void;
  openCash(input: { amount: number; user: string }): void;
  closeCash(input: { counted: number; note: string }): void;
  addCashMovement(input: { type: 'entrada' | 'salida'; amount: number; description: string }): void;
  addExpense(input: ops.ExpenseInput): void;
  deleteExpense(id: string): void;
  saveProduct(input: ops.ProductInput): void;
  setProductActive(input: { id: string; active: boolean }): void;
  saveTable(input: { id: string | null; name: string }): void;
  setTableActive(input: { id: string; active: boolean }): void;
  saveClient(input: Omit<Client, 'id'> & { id: string | null }): void;
}

interface Store {
  state: AppState;
  actions: Actions;
}

const StoreContext = createContext<Store | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppState>(loadState);
  const ref = useRef(state);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // Sin almacenamiento disponible la demo sigue funcionando en memoria.
    }
  }, [state]);

  const actions = useMemo<Actions>(() => {
    const commit = (next: AppState) => {
      ref.current = next;
      setState(next);
    };
    const apply = <I,>(fn: (s: AppState, input: I) => AppState) => (input: I) => commit(fn(ref.current, input));
    const applyWithResult = <I, R>(fn: (s: AppState, input: I) => [AppState, R]) => (input: I) => {
      const [next, result] = fn(ref.current, input);
      commit(next);
      return result;
    };
    return {
      setRole: (role) => commit({ ...ref.current, role }),
      reset: () => commit({ ...buildSeed(new Date()), role: ref.current.role }),
      submitOrder: applyWithResult(orderSim.submitOrder),
      cancelOrder: apply(orderSim.cancelOrder),
      chargeOrder: applyWithResult(orderSim.chargeOrder),
      registerAbono: apply(orderSim.registerAbono),
      adjustStock: apply(ops.adjustStock),
      openCash: apply(ops.openCash),
      closeCash: apply(ops.closeCash),
      addCashMovement: apply(ops.addCashMovement),
      addExpense: apply(ops.addExpense),
      deleteExpense: apply(ops.deleteExpense),
      saveProduct: apply(ops.saveProduct),
      setProductActive: apply(ops.setProductActive),
      saveTable: apply(ops.saveTable),
      setTableActive: apply(ops.setTableActive),
      saveClient: apply(ops.saveClient),
    };
  }, []);

  const store = useMemo(() => ({ state, actions }), [state, actions]);
  return <StoreContext.Provider value={store}>{children}</StoreContext.Provider>;
}

export function useApp(): Store {
  const store = useContext(StoreContext);
  if (!store) throw new Error('useApp debe usarse dentro de AppProvider');
  return store;
}

/**
 * Ejecuta una operación y muestra el resultado al usuario. Devuelve el valor
 * de la operación, o undefined si la validación la rechazó.
 */
export function useAttempt() {
  const toast = useToast();
  return useCallback(
    <T,>(run: () => T, success?: string): { ok: true; value: T } | { ok: false } => {
      try {
        const value = run();
        if (success) toast.success(success);
        return { ok: true, value };
      } catch (error) {
        if (!(error instanceof SimError)) throw error;
        toast.error(error.message);
        return { ok: false };
      }
    },
    [toast],
  );
}
