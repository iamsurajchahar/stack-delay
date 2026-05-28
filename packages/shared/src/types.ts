export interface IUser {
  id: string;
  githubId: number;
  githubLogin: string;
  displayName: string;
  avatarUrl: string;
  email: string;
  plan: 'free' | 'pro' | 'team';
  createdAt: Date;
  updatedAt: Date;
}

export interface IRepository {
  id: string;
  userId: string;
  githubRepoId: number;
  owner: string;
  name: string;
  fullName: string;
  defaultBranch: string;
  isPrivate: boolean;
  language: string;
  latestScore: number | null;
  latestGrade: string | null;
  lastScannedAt: Date | null;
  scanFrequency: 'manual' | 'daily' | 'weekly' | 'monthly';
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface IScan {
  id: string;
  repositoryId: string;
  status: 'pending' | 'scanning' | 'enriching' | 'scoring' | 'completed' | 'failed';
  triggeredBy: 'manual' | 'scheduled' | 'webhook';
  commitSha: string;
  manifestCount: number;
  dependencyCount: number;
  aggregateScore: number | null;
  aggregateGrade: string | null;
  errorMessage: string | null;
  manifests: IManifest[];
  startedAt: Date | null;
  completedAt: Date | null;
  createdAt: Date;
}

export interface IManifest {
  filePath: string;
  ecosystem: string;
  dependencies: IDependencyEntry[];
}

export interface IDependencyEntry {
  packageId: string;
  name: string;
  versionConstraint: string;
  resolvedVersion: string;
  isDev: boolean;
  isDirect: boolean;
  depth: number;
}

export interface IPackage {
  id: string;
  ecosystem: string;
  name: string;
  registryUrl: string;
  homepageUrl: string | null;
  repoUrl: string | null;
  license: string | null;
  latestVersion: string;
  description: string | null;
  latestHealth: IHealthSnapshot | null;
  vulnerabilities: IVulnerability[];
  lastEnrichedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface IHealthSnapshot {
  snapshotDate: Date;
  maintenance: {
    commitsLast90d: number;
    releasesLastYear: number;
    daysSinceLastRelease: number;
    openIssuesCount: number;
    closedIssuesLast90d: number;
    openPrCount: number;
    avgIssueCloseDays: number;
  };
  community: {
    starsCount: number;
    starsGrowth30d: number;
    forksCount: number;
    contributorCount: number;
    dependentReposCount: number;
    downloadsLastWeek: number;
  };
  vulnerability: {
    openCveCount: number;
    totalCveCount: number;
    criticalCveCount: number;
    highCveCount: number;
    avgFixTimeDays: number;
  };
  eol: {
    runtimeEolDate?: Date;
    frameworkEolDate?: Date;
    isDeprecated: boolean;
    isArchived: boolean;
  };
  license: {
    spdx: string;
    riskTier: 'low' | 'medium' | 'high' | 'unknown';
  };
}

export interface IVulnerability {
  id: string;
  source: 'osv' | 'nvd' | 'github_advisory';
  sourceId: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  cvssScore: number | null;
  summary: string;
  affectedVersions: string;
  fixedVersion: string | null;
  publishedAt: Date;
  withdrawnAt: Date | null;
  url: string;
}

export interface IDependencyScore {
  id: string;
  scanId: string;
  packageId: string;
  maintenanceScore: number;
  communityScore: number;
  vulnerabilityScore: number;
  eolScore: number;
  licenseScore: number;
  compositeScore: number;
  grade: string;
  scoringVersion: string;
}

export interface IRepoScoreSnapshot {
  id: string;
  repositoryId: string;
  scanId: string;
  snapshotDate: Date;
  compositeScore: number;
  grade: string;
  maintenanceAvg: number;
  communityAvg: number;
  vulnerabilityAvg: number;
  eolAvg: number;
  licenseAvg: number;
  totalDependencies: number;
  vulnerableCount: number;
  deprecatedCount: number;
  outdatedCount: number;
}

export interface IAlertRule {
  id: string;
  userId: string;
  repositoryId?: string;
  ruleType: 'score_drop' | 'eol_approaching' | 'new_cve' | 'grade_change' | 'deprecated_dep';
  thresholdValue?: number;
  thresholdDays?: number;
  channels: string[];
  isEnabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface INotification {
  id: string;
  userId: string;
  alertRuleId?: string;
  channel: 'email' | 'webhook' | 'slack';
  subject: string;
  body: string;
  status: 'pending' | 'sent' | 'failed';
  sentAt?: Date;
  errorMessage?: string;
  createdAt: Date;
}

export interface IWebhookEndpoint {
  id: string;
  userId: string;
  url: string;
  events: string[];
  isActive: boolean;
  lastTriggeredAt?: Date;
  createdAt: Date;
}

export interface IRecommendation {
  id: string;
  repositoryId: string;
  packageId: string;
  type: 'upgrade' | 'replace' | 'remove';
  priority: 'critical' | 'high' | 'medium' | 'low';
  title: string;
  description: string;
  currentVersion?: string;
  suggestedVersion?: string;
  alternativePackage?: string;
  scoreImpact: number;
  migrationUrl?: string;
}
