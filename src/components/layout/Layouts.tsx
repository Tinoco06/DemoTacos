import { useState, type ReactNode } from 'react';
import { Flame, Menu, RotateCcw, X } from 'lucide-react';
import type { Role } from '../../types';
import { useApp } from '../../store/AppStore';
import { useToast } from '../ui/Toast';
import { ConfirmDialog } from '../ui/Modal';
import { Badge } from '../ui/Basics';
import { cn, fmtMoney } from '../../lib/format';
import { currentSession, sessionSummary } from '../../lib/calc';
import { homeFor, NAV, navFor, type NavItem } from '../../lib/nav';
import { navigate, type PageId } from '../../lib/router';

function Brand({ compact }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-frambuesa text-white">
        <Flame className="size-5" aria-hidden />
      </span>
      <span className={cn('whitespace-nowrap leading-tight', compact && 'hidden min-[480px]:block')}>
        <span className="block text-base font-semibold tracking-wide text-white">TACOS GRILL</span>
        <span className="block text-xs text-crema">Sistema de gestión</span>
      </span>
    </div>
  );
}

/** Selector de perfil para la presentación. No es un mecanismo de seguridad. */
function ProfileSwitcher() {
  const { state, actions } = useApp();
  const change = (role: Role) => {
    if (role === state.role) return;
    actions.setRole(role);
    navigate(homeFor(role));
  };
  return (
    <div className="flex items-center gap-2">
      <span className="hidden text-xs text-white/60 xl:inline">Perfil de demostración</span>
      <div role="group" aria-label="Perfil de demostración" className="inline-flex rounded-lg bg-white/10 p-1">
        {(['mesero', 'admin'] as const).map((role) => (
          <button
            key={role}
            type="button"
            aria-pressed={state.role === role}
            onClick={() => change(role)}
            className={cn(
              'h-9 rounded-md px-3 text-sm font-medium transition-colors',
              state.role === role ? 'bg-white text-carbon' : 'text-white/80 hover:text-white',
            )}
          >
            {role === 'mesero' ? 'Mesero' : <><span className="sm:hidden">Admin</span><span className="hidden sm:inline">Administrador</span></>}
          </button>
        ))}
      </div>
    </div>
  );
}

function useResetDemo() {
  const { actions } = useApp();
  const toast = useToast();
  const [asking, setAsking] = useState(false);
  const dialog = asking ? (
    <ConfirmDialog
      title="Restaurar datos de demostración"
      message="Se descartarán los pedidos, cobros, gastos y demás cambios realizados durante la demostración, y el sistema volverá a los datos originales."
      confirmLabel="Restaurar datos"
      danger
      onClose={() => setAsking(false)}
      onConfirm={() => {
        actions.reset();
        setAsking(false);
        toast.success('Datos de demostración restaurados.');
      }}
    />
  ) : null;
  return { ask: () => setAsking(true), dialog };
}

function NavLink({ item, active, onNavigate }: { item: NavItem; active: boolean; onNavigate: () => void }) {
  return (
    <a
      href={`#/${item.id}`}
      onClick={onNavigate}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'flex h-11 items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors',
        active ? 'bg-frambuesa text-white' : 'text-white/75 hover:bg-white/8 hover:text-white',
      )}
    >
      <item.icon className="size-5 shrink-0" aria-hidden />
      {item.label}
    </a>
  );
}

function Sidebar({ page, onNavigate, onReset }: { page: string; onNavigate: () => void; onReset: () => void }) {
  const items = navFor('admin');
  return (
    <div className="flex h-full flex-col bg-carbon">
      <div className="flex h-16 shrink-0 items-center px-5">
        <Brand />
      </div>
      <nav className="flex-1 overflow-y-auto px-3 py-4" aria-label="Navegación principal">
        {(['Operación', 'Administración'] as const).map((group) => (
          <div key={group} className="mb-6 last:mb-0">
            <p className="mb-2 px-3 text-xs font-medium uppercase tracking-wider text-white/45">{group}</p>
            <div className="flex flex-col gap-1">
              {items.filter((i) => i.group === group).map((item) => (
                <NavLink key={item.id} item={item} active={page === item.id} onNavigate={onNavigate} />
              ))}
            </div>
          </div>
        ))}
      </nav>
      <div className="shrink-0 border-t border-white/10 p-3">
        <button type="button" onClick={onReset} className="flex h-11 w-full items-center gap-3 whitespace-nowrap rounded-lg px-3 text-left text-sm font-medium text-white/75 hover:bg-white/8 hover:text-white">
          <RotateCcw className="size-5 shrink-0" aria-hidden />
          Restaurar datos de demo
        </button>
      </div>
    </div>
  );
}

export function AdminLayout({ page, children }: { page: string; children: ReactNode }) {
  const { state } = useApp();
  const [drawer, setDrawer] = useState(false);
  const reset = useResetDemo();
  const session = currentSession(state);
  const title = NAV.find((i) => i.id === page)?.label ?? '';

  return (
    <div className="min-h-dvh lg:pl-60">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 lg:block">
        <Sidebar page={page} onNavigate={() => {}} onReset={reset.ask} />
      </aside>

      {drawer && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-carbon/55" onClick={() => setDrawer(false)} />
          <aside className="absolute inset-y-0 left-0 w-64">
            <Sidebar
              page={page}
              onNavigate={() => setDrawer(false)}
              onReset={() => {
                setDrawer(false);
                reset.ask();
              }}
            />
            <button type="button" onClick={() => setDrawer(false)} aria-label="Cerrar menú" className="absolute right-2 top-3 grid size-10 place-items-center rounded-lg text-white/80 hover:bg-white/10">
              <X className="size-5" aria-hidden />
            </button>
          </aside>
        </div>
      )}

      <header className="sticky top-0 z-20 flex h-16 items-center gap-3 bg-carbon px-4 sm:px-6 lg:px-8">
        <button type="button" onClick={() => setDrawer(true)} aria-label="Abrir menú" className="grid size-10 shrink-0 place-items-center rounded-lg text-white hover:bg-white/10 lg:hidden">
          <Menu className="size-5" aria-hidden />
        </button>
        <p className="min-w-0 flex-1 truncate text-sm font-medium text-white/80">{title}</p>
        <a href="#/caja" className="hidden items-center gap-2 rounded-lg px-2 py-1 text-sm text-white/80 hover:bg-white/10 md:flex">
          {session ? (
            <>
              <Badge tone="success">Caja abierta</Badge>
              <span className="tabular-nums">{fmtMoney(sessionSummary(state, session).expected)}</span>
            </>
          ) : (
            <Badge tone="warning">Caja cerrada</Badge>
          )}
        </a>
        <ProfileSwitcher />
      </header>

      <main className="mx-auto w-full max-w-[1360px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">{children}</main>
      {reset.dialog}
    </div>
  );
}

const WAITER_LABELS: Partial<Record<PageId, string>> = { pedidos: 'Cuentas abiertas' };

export function WaiterLayout({ page, children }: { page: string; children: ReactNode }) {
  const reset = useResetDemo();
  const items = navFor('mesero');

  const nav = (
    <nav className="flex gap-1" aria-label="Navegación del mesero">
      {items.map((item) => (
        <a
          key={item.id}
          href={`#/${item.id}`}
          aria-current={page === item.id ? 'page' : undefined}
          className={cn(
            'flex h-14 min-w-0 flex-1 flex-col items-center justify-center gap-0.5 whitespace-nowrap rounded-lg px-2 text-xs font-medium transition-colors lg:h-11 lg:flex-none lg:flex-row lg:gap-2 lg:px-4 lg:text-sm',
            page === item.id ? 'bg-frambuesa text-white' : 'text-white/75 hover:bg-white/8 hover:text-white',
          )}
        >
          <item.icon className="size-5 shrink-0" aria-hidden />
          {WAITER_LABELS[item.id] ?? item.label}
        </a>
      ))}
    </nav>
  );

  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-20 bg-carbon">
        <div className="mx-auto flex h-16 max-w-[1360px] items-center gap-4 px-4 sm:px-6">
          <Brand compact />
          <div className="ml-4 hidden flex-1 lg:block">{nav}</div>
          <div className="ml-auto flex items-center gap-2">
            <button type="button" onClick={reset.ask} title="Restaurar datos de demo" aria-label="Restaurar datos de demo" className="flex h-10 items-center gap-2 rounded-lg px-2.5 text-sm font-medium text-white/75 hover:bg-white/10 hover:text-white">
              <RotateCcw className="size-5" aria-hidden />
              <span className="hidden whitespace-nowrap xl:inline">Restaurar demo</span>
            </button>
            <ProfileSwitcher />
          </div>
        </div>
        <div className="border-t border-white/10 px-3 py-2 lg:hidden">
          <div className="mx-auto max-w-xl">{nav}</div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-[1360px] px-4 py-6 sm:px-6">{children}</main>
      {reset.dialog}
    </div>
  );
}
