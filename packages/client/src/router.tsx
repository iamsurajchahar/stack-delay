import { lazy, Suspense } from 'react';
import { Routes, Route } from 'react-router-dom';
import { AppShell } from './components/layout/AppShell';
import { ProtectedRoute } from './components/layout/ProtectedRoute';
import { LoginPage } from './components/auth/LoginPage';
import { OAuthCallback } from './components/auth/OAuthCallback';
import { FullPageSpinner } from './components/shared/LoadingSpinner';

// Lazy-load pages so the initial bundle stays small — heavy chart pages
// (recharts) only download when the user navigates to them
const DashboardPage = lazy(() =>
  import('./components/dashboard/DashboardPage').then((m) => ({ default: m.DashboardPage })),
);
const RepoDetailPage = lazy(() =>
  import('./components/repo-detail/RepoDetailPage').then((m) => ({ default: m.RepoDetailPage })),
);
const DepDetailPage = lazy(() =>
  import('./components/dependency-detail/DepDetailPage').then((m) => ({ default: m.DepDetailPage })),
);
const AlertsPage = lazy(() =>
  import('./components/alerts/AlertsPage').then((m) => ({ default: m.AlertsPage })),
);
const SettingsPage = lazy(() =>
  import('./components/settings/SettingsPage').then((m) => ({ default: m.SettingsPage })),
);
const OnboardingFlow = lazy(() =>
  import('./components/onboarding/OnboardingFlow').then((m) => ({ default: m.OnboardingFlow })),
);
const ComparePage = lazy(() =>
  import('./components/compare/ComparePage').then((m) => ({ default: m.ComparePage })),
);
const TeamDashboardPage = lazy(() =>
  import('./components/team/TeamDashboardPage').then((m) => ({ default: m.TeamDashboardPage })),
);

export function AppRouter() {
  return (
    <Suspense fallback={<FullPageSpinner />}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/auth/callback" element={<OAuthCallback />} />
        <Route element={<ProtectedRoute />}>
          <Route path="/onboarding" element={<OnboardingFlow />} />
          <Route element={<AppShell />}>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/repos/:repoId" element={<RepoDetailPage />} />
            <Route path="/repos/:repoId/deps/:packageId" element={<DepDetailPage />} />
            <Route path="/packages/:packageId" element={<DepDetailPage />} />
            <Route path="/alerts" element={<AlertsPage />} />
            <Route path="/compare" element={<ComparePage />} />
            <Route path="/team" element={<TeamDashboardPage />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Route>
        </Route>
      </Routes>
    </Suspense>
  );
}
