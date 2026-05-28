export type {
  IUser,
  IRepository,
  IScan,
  IManifest,
  IDependencyEntry,
  IPackage,
  IHealthSnapshot,
  IVulnerability,
  IDependencyScore,
  IRepoScoreSnapshot,
  IAlertRule,
  INotification,
  IWebhookEndpoint,
  IRecommendation,
} from '@stack-decay/shared';

export { Ecosystem } from '@stack-decay/shared';

export interface FilterState {
  search: string;
  ecosystems: string[];
  grades: string[];
  sortBy: SortOption;
  sortDir: 'asc' | 'desc';
}

export type SortOption = 'score' | 'name' | 'lastScanned';

export type TabId = 'overview' | 'dependencies' | 'vulnerabilities' | 'recommendations';

export type DepTabId = 'maintenance' | 'community' | 'vulnerabilities' | 'alternatives';
