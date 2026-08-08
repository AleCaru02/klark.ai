import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { CookieConsent } from "@/components/CookieConsent";
import { AppErrorBoundary } from "@/components/system/AppErrorBoundary";
import { RouteLoading } from "@/components/system/RouteLoading";
import { usePageMeta } from "@/hooks/usePageMeta";

const DashboardLayout = lazy(() =>
  import("@/components/layouts/DashboardLayout").then((module) => ({ default: module.DashboardLayout })),
);
const AdminLayout = lazy(() =>
  import("@/components/layouts/AdminLayout").then((module) => ({ default: module.AdminLayout })),
);

const Index = lazy(() => import("./pages/Index"));
const Login = lazy(() => import("./pages/Login"));
const ForgotPassword = lazy(() => import("./pages/ForgotPassword"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const PricingPage = lazy(() => import("./pages/Pricing"));
const Presentazione = lazy(() => import("./pages/Presentazione"));
const ServiceAssessment = lazy(() => import("./pages/ServiceAssessment"));
const OperationalDemo = lazy(() => import("./pages/OperationalDemo"));
const ServiceCharter = lazy(() => import("./pages/ServiceCharter"));
const SectorLanding = lazy(() => import("./pages/SectorLanding"));
const Technology = lazy(() => import("./pages/Technology"));
const Checkout = lazy(() => import("./pages/Checkout"));
const NotFound = lazy(() => import("./pages/NotFound"));
const Privacy = lazy(() => import("./pages/Privacy"));
const Terms = lazy(() => import("./pages/Terms"));
const Cookies = lazy(() => import("./pages/Cookies"));

const Overview = lazy(() => import("./pages/app/Overview"));
const Onboarding = lazy(() => import("./pages/app/Onboarding"));
const AutomationStudio = lazy(() => import("./pages/app/AutomationStudio"));
const SiteChatbotRuntimeGuard = lazy(() => import("./pages/app/SiteChatbotRuntimeGuard"));
const Secretary = lazy(() => import("./pages/app/Secretary"));
const WhatsApp = lazy(() => import("./pages/app/WhatsApp"));
const Training = lazy(() => import("./pages/app/Training"));
const Appointments = lazy(() => import("./pages/app/Appointments"));
const Logs = lazy(() => import("./pages/app/Logs"));
const Tests = lazy(() => import("./pages/app/Tests"));
const Billing = lazy(() => import("./pages/app/Billing"));
const Referral = lazy(() => import("./pages/app/Referral"));
const Integrations = lazy(() => import("./pages/app/Integrations"));
const CRMSheets = lazy(() => import("./pages/app/CRMSheets"));
const MetaLeadAds = lazy(() => import("./pages/app/MetaLeadAds"));
const RetrySettings = lazy(() => import("./pages/app/RetrySettings"));
const Settings = lazy(() => import("./pages/app/Settings"));
const CalendarPage = lazy(() => import("./pages/app/CalendarPage"));
const FollowupEngine = lazy(() => import("./pages/app/FollowupEngine"));
const IntegrationSettings = lazy(() => import("./pages/app/IntegrationSettings"));
const GoogleCalendarDebug = lazy(() => import("./pages/app/GoogleCalendarDebug"));
const PipelineConfig = lazy(() => import("./pages/app/PipelineConfig"));
const Availability = lazy(() => import("./pages/app/Availability"));
const ServiceValue = lazy(() => import("./pages/app/ServiceValue"));
const Handoffs = lazy(() => import("./pages/app/Handoffs"));
const QualityCenter = lazy(() => import("./pages/app/QualityCenter"));
const KnowledgeGovernance = lazy(() => import("./pages/app/KnowledgeGovernance"));

const AdminDashboard = lazy(() => import("./pages/admin/Dashboard"));
const AdminDemoRequests = lazy(() => import("./pages/admin/DemoRequests"));
const TenantDetail = lazy(() => import("./pages/admin/TenantDetail"));
const Provisioning = lazy(() => import("./pages/admin/Provisioning"));
const CreateUser = lazy(() => import("./pages/admin/CreateUser"));
const Usage = lazy(() => import("./pages/admin/Usage"));
const AppointmentControl = lazy(() => import("./pages/admin/AppointmentControl"));
const SystemTests = lazy(() => import("./pages/admin/SystemTests"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, retry: 1, refetchOnWindowFocus: false },
    mutations: { retry: 0 },
  },
});

function PageMetaUpdater() {
  usePageMeta();
  return null;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <AppErrorBoundary>
          <BrowserRouter>
            <PageMetaUpdater />
            <Suspense fallback={<RouteLoading />}>
              <Routes>
                <Route path="/" element={<Index />} />
                <Route path="/login" element={<Login />} />
                <Route path="/forgot-password" element={<ForgotPassword />} />
                <Route path="/reset-password" element={<ResetPassword />} />
                <Route path="/pricing" element={<PricingPage />} />
                <Route path="/presentazione" element={<Presentazione />} />
                <Route path="/analisi-flusso" element={<ServiceAssessment />} />
                <Route path="/demo-operativa" element={<OperationalDemo />} />
                <Route path="/carta-servizio" element={<ServiceCharter />} />
                <Route path="/tecnologia" element={<Technology />} />
                <Route path="/settori/:sector" element={<SectorLanding />} />
                <Route path="/checkout" element={<Checkout />} />
                <Route path="/privacy" element={<Privacy />} />
                <Route path="/terms" element={<Terms />} />
                <Route path="/cookies" element={<Cookies />} />

                <Route
                  path="/app"
                  element={
                    <ProtectedRoute>
                      <DashboardLayout />
                    </ProtectedRoute>
                  }
                >
                  <Route index element={<Overview />} />
                  <Route path="service-value" element={<ServiceValue />} />
                  <Route path="handoffs" element={<Handoffs />} />
                  <Route path="quality" element={<QualityCenter />} />
                  <Route path="knowledge-governance" element={<KnowledgeGovernance />} />
                  <Route path="onboarding" element={<Onboarding />} />
                  <Route path="automation-studio" element={<AutomationStudio />} />
                  <Route path="site-chatbot" element={<SiteChatbotRuntimeGuard />} />
                  <Route path="secretary" element={<Secretary />} />
                  <Route path="whatsapp" element={<WhatsApp />} />
                  <Route path="training" element={<Training />} />
                  <Route path="prompt" element={<Navigate to="/app/training" replace />} />
                  <Route path="appointments" element={<Appointments />} />
                  <Route path="crm" element={<CRMSheets />} />
                  <Route path="logs" element={<Logs />} />
                  <Route path="tests" element={<Tests />} />
                  <Route path="billing" element={<Billing />} />
                  <Route path="referral" element={<Referral />} />
                  <Route path="integrations" element={<Integrations />} />
                  <Route path="integrations/meta-leadads" element={<MetaLeadAds />} />
                  <Route path="integrations/google-calendar" element={<GoogleCalendarDebug />} />
                  <Route path="retry-settings" element={<RetrySettings />} />
                  <Route path="settings" element={<Settings />} />
                  <Route path="calendar" element={<CalendarPage />} />
                  <Route path="calendar/availability" element={<Availability />} />
                  <Route path="followup-engine" element={<FollowupEngine />} />
                  <Route path="integration-settings" element={<IntegrationSettings />} />
                  <Route path="pipeline-config" element={<PipelineConfig />} />
                </Route>

                <Route
                  path="/admin"
                  element={
                    <ProtectedRoute requireAdmin>
                      <AdminLayout />
                    </ProtectedRoute>
                  }
                >
                  <Route index element={<AdminDashboard />} />
                  <Route path="demo-requests" element={<AdminDemoRequests />} />
                  <Route path="tenants/:id" element={<TenantDetail />} />
                  <Route path="provisioning" element={<Provisioning />} />
                  <Route path="create-user" element={<CreateUser />} />
                  <Route path="usage" element={<Usage />} />
                  <Route path="appointments" element={<AppointmentControl />} />
                  <Route path="tests" element={<SystemTests />} />
                </Route>

                <Route path="*" element={<NotFound />} />
              </Routes>
            </Suspense>
            <CookieConsent />
          </BrowserRouter>
        </AppErrorBoundary>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;