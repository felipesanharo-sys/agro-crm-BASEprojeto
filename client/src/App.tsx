import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import DashboardLayout from "./components/DashboardLayout";
import Home from "./pages/Home";
import ClientsPage from "./pages/ClientsPage";
import ProductsPage from "./pages/ProductsPage";
import UploadPage from "./pages/UploadPage";
import NotificationsPage from "./pages/NotificationsPage";
import SettingsPage from "./pages/SettingsPage";
import HistoryPage from "./pages/HistoryPage";
import AceleracaoPage from "./pages/AceleracaoPage";
import UsersPage from "./pages/UsersPage";
import InvitePage from "./pages/InvitePage";
import { usePageTracker } from "./hooks/usePageTracker";

function DashboardRoutes() {
  usePageTracker();
  return (
    <DashboardLayout>
      <Switch>
        <Route path="/" component={Home} />
        <Route path="/clientes" component={ClientsPage} />
        <Route path="/produtos" component={ProductsPage} />
        <Route path="/historico" component={HistoryPage} />
        <Route path="/aceleracao" component={AceleracaoPage} />
        <Route path="/upload" component={UploadPage} />
        <Route path="/notificacoes" component={NotificationsPage} />
        <Route path="/configuracoes" component={SettingsPage} />
        <Route path="/usuarios" component={UsersPage} />
        <Route path="/404" component={NotFound} />
        <Route component={NotFound} />
      </Switch>
    </DashboardLayout>
  );
}

function Router() {
  return (
    <Switch>
      <Route path="/convite/:token" component={InvitePage} />
      <Route component={DashboardRoutes} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <Toaster richColors position="top-right" />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
