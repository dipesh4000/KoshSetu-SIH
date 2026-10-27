import { lazy, Suspense } from "react";
// Routes.
//
// A protected route renders nothing until the session check has answered, so
// authorized data never flashes before the check completes. Capability gates
// here are presentational; the API enforces the same rules again.

import { Navigate, Route, Routes, useLocation } from "react-router-dom";

import { AppShell } from "./components/app-shell/AppShell";
import { Alert, LoadingBlock } from "./components/ui/primitives";
import { useSession } from "./lib/auth/session";
const HelpPage = lazy(() => import("./pages/HelpPage").then(module => ({ default: module.HelpPage })));
const LoginPage = lazy(() => import("./pages/LoginPage").then(module => ({ default: module.LoginPage })));
const NotFoundPage = lazy(() => import("./pages/NotFoundPage").then(module => ({ default: module.NotFoundPage })));
const AdminOverviewPage = lazy(() => import("./pages/admin/AdminOverviewPage").then(module => ({ default: module.AdminOverviewPage })));
const RuleVersionsPage = lazy(() => import("./pages/admin/RuleVersionsPage").then(module => ({ default: module.RuleVersionsPage })));
const InstitutionActivityPage = lazy(() => import("./pages/institution/ActivityPage").then(module => ({ default: module.InstitutionActivityPage })));
const InstitutionDocumentsPage = lazy(() => import("./pages/institution/DocumentsPage").then(module => ({ default: module.InstitutionDocumentsPage })));
const InstitutionFdrListPage = lazy(() => import("./pages/institution/FdrListPage").then(module => ({ default: module.InstitutionFdrListPage })));
const InstitutionOverviewPage = lazy(() => import("./pages/institution/OverviewPage").then(module => ({ default: module.InstitutionOverviewPage })));
const InstitutionReleasesPage = lazy(() => import("./pages/institution/ReleasesPage").then(module => ({ default: module.InstitutionReleasesPage })));
const RenewalsPage = lazy(() => import("./pages/institution/RenewalsPage").then(module => ({ default: module.RenewalsPage })));
const SubmissionWizardPage = lazy(() => import("./pages/institution/SubmissionWizardPage").then(module => ({ default: module.SubmissionWizardPage })));
const BulkImportPage = lazy(() => import("./pages/institution/BulkImportPage").then(module => ({ default: module.BulkImportPage })));
const AuditExplorerPage = lazy(() => import("./pages/official/AuditExplorerPage").then(module => ({ default: module.AuditExplorerPage })));
const ExceptionsPage = lazy(() => import("./pages/official/ExceptionsPage").then(module => ({ default: module.ExceptionsPage })));
const FdrDetailPage = lazy(() => import("./pages/official/FdrDetailPage").then(module => ({ default: module.FdrDetailPage })));
const MaturityCentrePage = lazy(() => import("./pages/official/MaturityCentrePage").then(module => ({ default: module.MaturityCentrePage })));
const OfficialFdrListPage = lazy(() => import("./pages/official/FdrListPage").then(module => ({ default: module.OfficialFdrListPage })));
const OfficialOverviewPage = lazy(() => import("./pages/official/OverviewPage").then(module => ({ default: module.OfficialOverviewPage })));
const NotificationsPage = lazy(() => import("./pages/NotificationsPage").then(module => ({ default: module.NotificationsPage })));
const ReleaseCasePage = lazy(() => import("./pages/official/ReleaseCasePage").then(module => ({ default: module.ReleaseCasePage })));
const ReleaseCentrePage = lazy(() => import("./pages/official/ReleaseCentrePage").then(module => ({ default: module.ReleaseCentrePage })));
const ReportsPage = lazy(() => import("./pages/official/ReportsPage").then(module => ({ default: module.ReportsPage })));
const AnalyticsPage = lazy(() => import("./pages/official/AnalyticsPage").then(module => ({ default: module.AnalyticsPage })));
const WorkQueuePage = lazy(() => import("./pages/official/WorkQueuePage").then(module => ({ default: module.WorkQueuePage })));

function Protected({
  children,
  capability,
  workspace,
}: {
  children: React.ReactNode;
  capability?: string;
  /** Which workspace this route belongs to. An institution user who lands on
   *  an official route is sent back to their own workspace rather than shown
   *  an officer's framing of their own data. */
  workspace?: "institution" | "official";
}) {
  const { session, isLoading } = useSession();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="mx-auto max-w-3xl p-8">
        <LoadingBlock label="Checking your session" />
      </div>
    );
  }
  if (!session) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }
  if (workspace === "institution" && session.workspace !== "institution") {
    return <Navigate to="/official/overview" replace />;
  }
  if (workspace === "official" && session.workspace === "institution") {
    return <Navigate to="/institution/overview" replace />;
  }
  if (capability && !session.capabilities.includes(capability)) {
    return (
      <AppShell>
        <Alert tone="danger" title="You do not have permission to view this page">
          Your current roles do not include the permission this page needs. Contact your
          organisation administrator if you believe this is wrong.
        </Alert>
      </AppShell>
    );
  }
  return <AppShell>{children}</AppShell>;
}

function HomeRedirect() {
  const { session, isLoading } = useSession();
  if (isLoading) {
    return (
      <div className="mx-auto max-w-3xl p-8">
        <LoadingBlock label="Checking your session" />
      </div>
    );
  }
  if (!session) return <Navigate to="/login" replace />;
  if (session.workspace === "institution") return <Navigate to="/institution/overview" replace />;
  if (session.workspace === "admin") return <Navigate to="/admin/overview" replace />;
  return <Navigate to="/official/overview" replace />;
}

export function App() {
  return (
    <Suspense fallback={<div className="p-6"><LoadingBlock label="Loading workspace" /></div>}>
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/" element={<HomeRedirect />} />

      <Route
        path="/institution/overview"
        element={
          <Protected capability="fdr:read" workspace="institution">
            <InstitutionOverviewPage />
          </Protected>
        }
      />
      <Route
        path="/institution/fdrs"
        element={
          <Protected capability="fdr:read" workspace="institution">
            <InstitutionFdrListPage />
          </Protected>
        }
      />
      <Route
        path="/institution/fdrs/new"
        element={
          <Protected capability="fdr:draft" workspace="institution">
            <SubmissionWizardPage />
          </Protected>
        }
      />
      <Route
        path="/institution/fdrs/:fdrId"
        element={
          <Protected capability="fdr:read" workspace="institution">
            <FdrDetailPage />
          </Protected>
        }
      />
      <Route path="/institution/import" element={<Protected capability="fdr:draft" workspace="institution"><BulkImportPage /></Protected>} />
      <Route
        path="/institution/renewals"
        element={
          <Protected capability="fdr:read" workspace="institution">
            <RenewalsPage />
          </Protected>
        }
      />
      <Route
        path="/institution/releases"
        element={
          <Protected capability="release:read" workspace="institution">
            <InstitutionReleasesPage />
          </Protected>
        }
      />
      <Route
        path="/institution/releases/:requestId"
        element={
          <Protected capability="release:read" workspace="institution">
            <ReleaseCasePage />
          </Protected>
        }
      />
      <Route
        path="/institution/documents"
        element={
          <Protected capability="document:read" workspace="institution">
            <InstitutionDocumentsPage />
          </Protected>
        }
      />
      <Route
        path="/institution/notifications"
        element={
          <Protected capability="notification:read" workspace="institution">
            <NotificationsPage />
          </Protected>
        }
      />
      <Route
        path="/institution/activity"
        element={
          <Protected capability="fdr:read" workspace="institution">
            <InstitutionActivityPage />
          </Protected>
        }
      />

      <Route
        path="/official/overview"
        element={
          <Protected capability="fdr:read" workspace="official">
            <OfficialOverviewPage />
          </Protected>
        }
      />
      <Route
        path="/official/queue"
        element={
          <Protected capability="fdr:review" workspace="official">
            <WorkQueuePage />
          </Protected>
        }
      />
      <Route
        path="/official/fdrs"
        element={
          <Protected capability="fdr:read_all" workspace="official">
            <OfficialFdrListPage />
          </Protected>
        }
      />
      <Route
        path="/official/fdrs/:fdrId"
        element={
          <Protected capability="fdr:read" workspace="official">
            <FdrDetailPage />
          </Protected>
        }
      />
      <Route
        path="/official/maturities"
        element={
          <Protected capability="fdr:read" workspace="official">
            <MaturityCentrePage />
          </Protected>
        }
      />
      <Route
        path="/official/releases"
        element={
          <Protected capability="release:read" workspace="official">
            <ReleaseCentrePage />
          </Protected>
        }
      />
      <Route
        path="/official/releases/:requestId"
        element={
          <Protected capability="release:read" workspace="official">
            <ReleaseCasePage />
          </Protected>
        }
      />
      <Route
        path="/official/exceptions"
        element={
          <Protected capability="finding:read" workspace="official">
            <ExceptionsPage />
          </Protected>
        }
      />
      <Route
        path="/official/reports"
        element={
          <Protected capability="report:read" workspace="official">
            <ReportsPage />
          </Protected>
        }
      />
      <Route
        path="/official/audit"
        element={
          <Protected capability="audit:read" workspace="official">
            <AuditExplorerPage />
          </Protected>
        }
      />
      <Route
        path="/official/notifications"
        element={
          <Protected capability="notification:read" workspace="official">
            <NotificationsPage />
          </Protected>
        }
      />

      <Route
        path="/admin/overview"
        element={
          <Protected capability="admin:manage">
            <AdminOverviewPage />
          </Protected>
        }
      />
      <Route
        path="/admin/rules"
        element={
          <Protected capability="finding:read">
            <RuleVersionsPage />
          </Protected>
        }
      />

      <Route
        path="/help"
        element={
          <Protected>
            <HelpPage />
          </Protected>
        }
      />
      <Route path="*" element={<NotFoundPage />} />
      <Route path="/official/analytics" element={<Protected capability="report:read" workspace="official"><AnalyticsPage /></Protected>} />
    </Routes>
    </Suspense>
  );
}
