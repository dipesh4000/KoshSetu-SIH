// Routes.
//
// A protected route renders nothing until the session check has answered, so
// authorized data never flashes before the check completes. Capability gates
// here are presentational; the API enforces the same rules again.

import { Navigate, Route, Routes, useLocation } from "react-router-dom";

import { AppShell } from "./components/app-shell/AppShell";
import { Alert, LoadingBlock } from "./components/ui/primitives";
import { useSession } from "./lib/auth/session";
import { HelpPage } from "./pages/HelpPage";
import { LoginPage } from "./pages/LoginPage";
import { NotFoundPage } from "./pages/NotFoundPage";
import { AdminOverviewPage } from "./pages/admin/AdminOverviewPage";
import { RuleVersionsPage } from "./pages/admin/RuleVersionsPage";
import { InstitutionActivityPage } from "./pages/institution/ActivityPage";
import { InstitutionDocumentsPage } from "./pages/institution/DocumentsPage";
import { InstitutionFdrListPage } from "./pages/institution/FdrListPage";
import { InstitutionOverviewPage } from "./pages/institution/OverviewPage";
import { InstitutionReleasesPage } from "./pages/institution/ReleasesPage";
import { RenewalsPage } from "./pages/institution/RenewalsPage";
import { SubmissionWizardPage } from "./pages/institution/SubmissionWizardPage";
import { AuditExplorerPage } from "./pages/official/AuditExplorerPage";
import { ExceptionsPage } from "./pages/official/ExceptionsPage";
import { FdrDetailPage } from "./pages/official/FdrDetailPage";
import { MaturityCentrePage } from "./pages/official/MaturityCentrePage";
import { OfficialFdrListPage } from "./pages/official/FdrListPage";
import { OfficialOverviewPage } from "./pages/official/OverviewPage";
import { NotificationsPage } from "./pages/NotificationsPage";
import { ReleaseCasePage } from "./pages/official/ReleaseCasePage";
import { ReleaseCentrePage } from "./pages/official/ReleaseCentrePage";
import { ReportsPage } from "./pages/official/ReportsPage";
import { WorkQueuePage } from "./pages/official/WorkQueuePage";

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
          <Protected>
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
    </Routes>
  );
}
