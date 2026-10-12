import { useSyncExternalStore } from 'react';

/* Navegación mínima basada en el hash de la URL: no requiere servidor ni bibliotecas. */

export type PageId =
  | 'panel'
  | 'mesas'
  | 'pedido'
  | 'pedidos'
  | 'cobro'
  | 'inventario'
  | 'caja'
  | 'gastos'
  | 'reportes'
  | 'productos'
  | 'clientes';

export interface Route {
  page: string;
  params: Record<string, string>;
  key: string;
}

const subscribe = (notify: () => void) => {
  window.addEventListener('hashchange', notify);
  return () => window.removeEventListener('hashchange', notify);
};

const getHash = () => window.location.hash;

function parse(hash: string): Route {
  const [path, query = ''] = hash.replace(/^#\/?/, '').split('?');
  return { page: path, params: Object.fromEntries(new URLSearchParams(query)), key: hash };
}

export function useRoute(): Route {
  return parse(useSyncExternalStore(subscribe, getHash));
}

export function navigate(page: PageId, params: Record<string, string> = {}) {
  const query = new URLSearchParams(params).toString();
  window.location.hash = `/${page}${query ? `?${query}` : ''}`;
  window.scrollTo(0, 0);
}
