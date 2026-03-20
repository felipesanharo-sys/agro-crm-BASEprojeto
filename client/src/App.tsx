import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import DashboardLayout from "./components/DashboardLayout";
import Home from "./pages/Home";
import DashboardPage from "./pages/DashboardPage";
import ClientsPage from "./pages/ClientsPage";
import HistoryPage from "./pages/HistoryPage";
import ProductsPage from "./pages/ProductsPage";
import UploadPage from "./pages/UploadPage";
import ManagerPage from "./pages/ManagerPage";
import InvitePage from "./pages/InvitePage";
import SettingsPage from "./pages/SettingsPage";
import UsersPage from "./pages/UsersPage";
import NotificationsPage from "./pages/NotificationsPage";
import AceleracaoPage from "./pages/AceleracaoTab";

function Router() {
  return (
    <Switch>
      <Route path="/invite/:token" component={InvitePage} />
      <Route>
        <DashboardLayout>
          <Switch>
            <Route path="/" component={Home} />
            <Route path="/dashboard" component={DashboardPage} />
            <Route path="/clientes" component={ClientsPage} />
            <Route path="/historico" component={HistoryPage} />
            <Route path="/produtos" component={ProductsPage} />
            <Route path="/aceleracao" component={AceleracaoPage} />
            <Route path="/upload" component={UploadPage} />
            <Route path="/convites" component={ManagerPage} />
            <Route path="/usuarios" component={UsersPage} />
            <Route path="/configuracoes" component={SettingsPage} />
            <Route path="/notificacoes" component={NotificationsPage} />
            <Route path="/404" component={NotFound} />
            <Route component={NotFound} />
          </Switch>
        </DashboardLayout>
      </Route>
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
