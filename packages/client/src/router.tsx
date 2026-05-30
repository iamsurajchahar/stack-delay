import { Routes, Route } from 'react-router-dom';
import { AppShell } from './components/layout/AppShell';
import { ProtectedRoute } from './components/layout/ProtectedRoute';
import { LoginPage } from './components/auth/LoginPage';
import { OAuthCallback } from './components/auth/OAuthCallback';
import { DashboardPage } from './components/dashboard/DashboardPage';
import { RepoDetailPage } from './components/repo-detail/RepoDetailPage';
import { DepDetailPage } from './components/dependency-detail/DepDetailPage';
import { AlertsPage } from './components/alerts/AlertsPage';
import { SettingsPage } from './components/settings/SettingsPage';
import { OnboardingFlow } from './components/onboarding/OnboardingFlow';
import { ComparePage } from './components/compare/ComparePage';
import { TeamDashboardPage } from './components/team/TeamDashboardPage';

export function AppRouter() {
  return (
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
  );
}
