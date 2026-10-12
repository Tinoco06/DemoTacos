import { useEffect } from 'react';
import { AppProvider, useApp } from './store/AppStore';
import { ToastProvider } from './components/ui/Toast';
import { AdminLayout, WaiterLayout } from './components/layout/Layouts';
import { homeFor, navFor } from './lib/nav';
import { navigate, useRoute, type PageId } from './lib/router';
import { DashboardPage } from './pages/DashboardPage';
import { TablesPage } from './pages/TablesPage';
import { TakeOrderPage } from './pages/TakeOrderPage';
import { OrdersPage } from './pages/OrdersPage';
import { CheckoutPage } from './pages/CheckoutPage';
import { InventoryPage } from './pages/InventoryPage';
import { CashPage } from './pages/CashPage';
import { ExpensesPage } from './pages/ExpensesPage';
import { ReportsPage } from './pages/ReportsPage';
import { ProductsPage } from './pages/ProductsPage';
import { ClientsPage } from './pages/ClientsPage';

function Shell() {
  const { state } = useApp();
  const route = useRoute();
  // La toma de pedidos no es una sección del menú: solo se abre desde una mesa, un domicilio o una cuenta abierta.
  const orderEntry = route.page === 'pedido' && Boolean(route.params.mesa || route.params.pedido || route.params.servicio === 'domicilio');
  const allowed = orderEntry || navFor(state.role).some((item) => item.id === route.page);
  const page = (allowed ? route.page : homeFor(state.role)) as PageId;

  useEffect(() => {
    if (!allowed) navigate(homeFor(state.role));
  }, [allowed, state.role]);

  const content = (() => {
    switch (page) {
      case 'panel':
        return <DashboardPage />;
      case 'mesas':
        return <TablesPage />;
      case 'pedido':
        return <TakeOrderPage key={route.key} params={route.params} />;
      case 'pedidos':
        return <OrdersPage />;
      case 'cobro':
        return <CheckoutPage key={route.key} params={route.params} />;
      case 'inventario':
        return <InventoryPage />;
      case 'caja':
        return <CashPage />;
      case 'gastos':
        return <ExpensesPage />;
      case 'reportes':
        return <ReportsPage />;
      case 'productos':
        return <ProductsPage />;
      case 'clientes':
        return <ClientsPage />;
    }
  })();

  const Layout = state.role === 'admin' ? AdminLayout : WaiterLayout;
  return <Layout page={page === 'pedido' ? 'mesas' : page}>{content}</Layout>;
}

export default function App() {
  return (
    <ToastProvider>
      <AppProvider>
        <Shell />
      </AppProvider>
    </ToastProvider>
  );
}
