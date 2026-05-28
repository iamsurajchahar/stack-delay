import { Express } from 'express';
import authRoutes from './auth.routes';
import reposRoutes from './repos.routes';
import scansRoutes from './scans.routes';
import scoresRoutes from './scores.routes';
import dependenciesRoutes from './dependencies.routes';
import alertsRoutes from './alerts.routes';
import recommendationsRoutes from './recommendations.routes';
import dashboardRoutes from './dashboard.routes';

export function mountRoutes(app: Express): void {
  app.use('/api/auth', authRoutes);
  app.use('/api/repos', reposRoutes);
  app.use('/api/repos/:repoId/scans', scansRoutes);
  app.use('/api/repos/:repoId/scores', scoresRoutes);
  app.use('/api/repos/:repoId/recommendations', recommendationsRoutes);
  app.use('/api/packages', dependenciesRoutes);
  app.use('/api/alerts', alertsRoutes);
  app.use('/api/dashboard', dashboardRoutes);

  // Health check endpoint
  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });
}
