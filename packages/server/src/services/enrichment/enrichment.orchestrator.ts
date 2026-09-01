import { Ecosystem, IHealthSnapshot, CACHE_TTL } from '@stack-decay/shared';
import { logger } from '../../utils/logger';
import { cacheGet, cacheSet } from '../../utils/cache';
import * as npmRegistry from './npm-registry.client';
import * as pypi from './pypi.client';
import * as rubygems from './rubygems.client';
import * as crates from './crates.client';
import * as osv from './osv.client';
import * as librariesIo from './libraries-io.client';
import * as githubAdvisory from './github-advisory.client';
import * as githubRepo from './github-repo.client';
import type { OsvVulnerability } from './osv.client';

interface EnrichmentInput {
  ecosystem: string;
  name: string;
  version?: string;
  repoUrl?: string;
  githubToken?: string;
}

/** Everything one package lookup produces, so callers never re-query a source. */
export interface EnrichmentResult {
  snapshot: IHealthSnapshot;
  vulnerabilities: OsvVulnerability[];
}

/** Raw registry payloads, kept apart from the snapshot so they can be applied in a fixed order. */
interface RegistryData {
  npmPackage?: npmRegistry.NpmPackageInfo | null;
  npmDownloads?: npmRegistry.NpmDownloadCount | null;
  pypiPackage?: pypi.PypiPackageInfo | null;
  gem?: rubygems.RubyGemInfo | null;
  crate?: crates.CrateInfo | null;
}

/** Circuit breaker state per client */
interface CircuitState {
  failureCount: number;
  lastFailureAt: number;
}

const circuitBreakers = new Map<string, CircuitState>();
const CIRCUIT_FAILURE_THRESHOLD = 5;
const CIRCUIT_RESET_INTERVAL_MS = 60000; // 60 seconds

/**
 * Check if a circuit breaker is open (should skip the client).
 */
function isCircuitOpen(clientName: string): boolean {
  const state = circuitBreakers.get(clientName);
  if (!state) return false;
  if (state.failureCount < CIRCUIT_FAILURE_THRESHOLD) return false;

  // Check if enough time has passed to try again
  if (Date.now() - state.lastFailureAt > CIRCUIT_RESET_INTERVAL_MS) {
    circuitBreakers.delete(clientName);
    return false;
  }

  return true;
}

/**
 * Record a failure for a client circuit breaker.
 */
function recordFailure(clientName: string): void {
  const state = circuitBreakers.get(clientName) || { failureCount: 0, lastFailureAt: 0 };
  state.failureCount += 1;
  state.lastFailureAt = Date.now();
  circuitBreakers.set(clientName, state);
}

/**
 * Record a success for a client, resetting its circuit breaker.
 */
function recordSuccess(clientName: string): void {
  circuitBreakers.delete(clientName);
}

/**
 * Safely call an enrichment client function with circuit breaker protection.
 */
async function safeCall<T>(
  clientName: string,
  fn: () => Promise<T | null>,
): Promise<T | null> {
  if (isCircuitOpen(clientName)) {
    logger.debug({ clientName }, 'Circuit breaker open, skipping client');
    return null;
  }

  try {
    const result = await fn();
    recordSuccess(clientName);
    return result;
  } catch (err) {
    recordFailure(clientName);
    logger.warn({ err, clientName }, 'Enrichment client call failed');
    return null;
  }
}

/**
 * Enrich a package by coordinating calls to all relevant enrichment clients.
 * Uses the cache to avoid redundant API calls.
 *
 * The independent sources (registry, OSV, Libraries.io, GitHub advisories) are
 * fetched concurrently and only then folded into the snapshot, in a fixed order,
 * so later sources still override earlier ones the way they always did.
 *
 * Returns the snapshot plus the raw vulnerability list, or null if enrichment
 * completely fails.
 */
export async function enrichPackageDetailed(
  input: EnrichmentInput,
): Promise<EnrichmentResult | null> {
  const cacheKey = `enrich:v2:${input.ecosystem}:${input.name}:${input.version || 'latest'}`;

  // Check cache first
  const cached = await cacheGet<EnrichmentResult>(cacheKey);
  if (cached) {
    logger.debug({ ecosystem: input.ecosystem, name: input.name }, 'Enrichment cache hit');
    return cached;
  }

  logger.info({ ecosystem: input.ecosystem, name: input.name }, 'Enriching package');

  const snapshot = createEmptySnapshot();

  const [registryData, vulns, libInfo, advisories] = await Promise.all([
    fetchFromRegistry(input),
    fetchVulnerabilities(input),
    fetchFromLibrariesIo(input),
    fetchFromGitHubAdvisories(input),
  ]);

  applyRegistry(input, snapshot, registryData);
  applyVulnerabilities(snapshot, vulns);
  applyLibrariesIo(snapshot, libInfo);
  applyGitHubAdvisories(snapshot, advisories);

  // Needs the repository URL the registry lookup above may have discovered,
  // so this one cannot join the batch.
  const repoStats = await fetchFromGitHubRepo(input);
  applyGitHubRepo(snapshot, repoStats);

  applyLicenseRiskTier(snapshot);

  const result: EnrichmentResult = { snapshot, vulnerabilities: vulns || [] };

  // Store in cache
  await cacheSet(cacheKey, result, CACHE_TTL.HEALTH_SNAPSHOT);

  return result;
}

/**
 * Enrich a package and return just its health snapshot.
 */
export async function enrichPackage(input: EnrichmentInput): Promise<IHealthSnapshot | null> {
  const result = await enrichPackageDetailed(input);
  return result ? result.snapshot : null;
}

function createEmptySnapshot(): IHealthSnapshot {
  return {
    snapshotDate: new Date(),
    maintenance: {
      commitsLast90d: 0,
      releasesLastYear: 0,
      daysSinceLastRelease: 0,
      openIssuesCount: 0,
      closedIssuesLast90d: 0,
      openPrCount: 0,
      avgIssueCloseDays: 0,
    },
    community: {
      starsCount: 0,
      starsGrowth30d: 0,
      forksCount: 0,
      contributorCount: 0,
      dependentReposCount: 0,
      downloadsLastWeek: 0,
    },
    vulnerability: {
      openCveCount: 0,
      totalCveCount: 0,
      criticalCveCount: 0,
      highCveCount: 0,
      avgFixTimeDays: 0,
    },
    eol: {
      isDeprecated: false,
      isArchived: false,
    },
    license: {
      spdx: '',
      riskTier: 'unknown',
    },
  };
}

async function fetchFromRegistry(input: EnrichmentInput): Promise<RegistryData> {
  switch (input.ecosystem) {
    case Ecosystem.npm: {
      const [npmPackage, npmDownloads] = await Promise.all([
        safeCall('npm-registry', () => npmRegistry.getPackageInfo(input.name)),
        safeCall('npm-downloads', () => npmRegistry.getDownloadCount(input.name)),
      ]);
      return { npmPackage, npmDownloads };
    }
    case Ecosystem.pypi: {
      const pypiPackage = await safeCall('pypi', () => pypi.getPackageInfo(input.name));
      return { pypiPackage };
    }
    case Ecosystem.rubygems: {
      const gem = await safeCall('rubygems', () => rubygems.getGemInfo(input.name));
      return { gem };
    }
    case Ecosystem.cargo: {
      const crate = await safeCall('crates', () => crates.getCrateInfo(input.name));
      return { crate };
    }
    // For go, maven, nuget, composer: we rely on Libraries.io and vulnerability data
    default:
      return {};
  }
}

function applyRegistry(
  input: EnrichmentInput,
  snapshot: IHealthSnapshot,
  data: RegistryData,
): void {
  if (data.npmPackage) {
    const pkgInfo = data.npmPackage;
    snapshot.license.spdx = pkgInfo.license || '';
    snapshot.maintenance.releasesLastYear = pkgInfo.releasesLastYear;
    snapshot.maintenance.daysSinceLastRelease = pkgInfo.daysSinceLastRelease;
    if (pkgInfo.isDeprecated) {
      snapshot.eol.isDeprecated = true;
    }
    // Capture repo URL for GitHub stats enrichment
    if (pkgInfo.repository && !input.repoUrl) {
      input.repoUrl = pkgInfo.repository;
    }
  }

  if (data.npmDownloads) {
    snapshot.community.downloadsLastWeek = data.npmDownloads.downloads;
  }

  if (data.pypiPackage) {
    snapshot.license.spdx = data.pypiPackage.license || '';
  }

  if (data.gem) {
    snapshot.license.spdx = data.gem.licenses[0] || '';
    snapshot.community.downloadsLastWeek = data.gem.downloads;
  }

  if (data.crate) {
    snapshot.license.spdx = data.crate.license || '';
    snapshot.community.downloadsLastWeek = data.crate.downloads;
  }
}

async function fetchVulnerabilities(
  input: EnrichmentInput,
): Promise<OsvVulnerability[] | null> {
  return safeCall('osv', () =>
    osv.queryVulnerabilities(input.ecosystem, input.name, input.version),
  );
}

function applyVulnerabilities(
  snapshot: IHealthSnapshot,
  vulns: OsvVulnerability[] | null,
): void {
  if (!vulns || vulns.length === 0) return;

  snapshot.vulnerability.totalCveCount = vulns.length;
  snapshot.vulnerability.openCveCount = vulns.length; // All returned vulns are assumed open

  let criticalCount = 0;
  let highCount = 0;

  for (const vuln of vulns) {
    if (vuln.severity === 'critical') criticalCount++;
    if (vuln.severity === 'high') highCount++;
  }

  snapshot.vulnerability.criticalCveCount = criticalCount;
  snapshot.vulnerability.highCveCount = highCount;
}

async function fetchFromLibrariesIo(
  input: EnrichmentInput,
): Promise<librariesIo.LibrariesIoInfo | null> {
  return safeCall('libraries-io', () =>
    librariesIo.getPackageInfo(input.ecosystem, input.name),
  );
}

function applyLibrariesIo(
  snapshot: IHealthSnapshot,
  libInfo: librariesIo.LibrariesIoInfo | null,
): void {
  if (!libInfo) return;

  snapshot.community.dependentReposCount = libInfo.dependentReposCount;

  if (libInfo.latestReleasePublishedAt) {
    const releaseDate = new Date(libInfo.latestReleasePublishedAt);
    const now = new Date();
    const daysSinceRelease = Math.floor(
      (now.getTime() - releaseDate.getTime()) / (1000 * 60 * 60 * 24),
    );
    snapshot.maintenance.daysSinceLastRelease = Math.max(0, daysSinceRelease);
  }
}

async function fetchFromGitHubAdvisories(
  input: EnrichmentInput,
): Promise<githubAdvisory.GitHubAdvisory[] | null> {
  if (!input.githubToken) return null;

  return safeCall('github-advisory', () =>
    githubAdvisory.getAdvisories(input.ecosystem, input.name, input.githubToken),
  );
}

function applyGitHubAdvisories(
  snapshot: IHealthSnapshot,
  advisories: githubAdvisory.GitHubAdvisory[] | null,
): void {
  if (!advisories || advisories.length === 0) return;

  // Merge with OSV data - avoid double counting by tracking unique IDs
  // GitHub advisories may overlap with OSV entries, so take the max
  const totalFromAdvisories = advisories.filter((a) => !a.withdrawnAt).length;

  if (totalFromAdvisories > snapshot.vulnerability.totalCveCount) {
    snapshot.vulnerability.totalCveCount = totalFromAdvisories;
    snapshot.vulnerability.openCveCount = totalFromAdvisories;
  }

  let criticalCount = 0;
  let highCount = 0;

  for (const advisory of advisories) {
    if (advisory.withdrawnAt) continue;
    if (advisory.severity === 'critical') criticalCount++;
    if (advisory.severity === 'high') highCount++;
  }

  snapshot.vulnerability.criticalCveCount = Math.max(
    snapshot.vulnerability.criticalCveCount,
    criticalCount,
  );
  snapshot.vulnerability.highCveCount = Math.max(
    snapshot.vulnerability.highCveCount,
    highCount,
  );
}

async function fetchFromGitHubRepo(
  input: EnrichmentInput,
): Promise<githubRepo.GitHubRepoStats | null> {
  // We need a repository URL to look up GitHub stats.
  // Try to get it from the repoUrl input or from npm registry data (applied above).
  const repoUrl = input.repoUrl;
  if (!repoUrl) return null;

  return safeCall('github-repo', () => githubRepo.getRepoStats(repoUrl, input.githubToken));
}

function applyGitHubRepo(
  snapshot: IHealthSnapshot,
  stats: githubRepo.GitHubRepoStats | null,
): void {
  if (!stats) return;

  // Populate community metrics
  snapshot.community.starsCount = stats.starsCount;
  snapshot.community.starsGrowth30d = stats.starsGrowth30d;
  snapshot.community.forksCount = stats.forksCount;
  snapshot.community.contributorCount = stats.contributorCount;

  // Populate maintenance metrics from GitHub
  snapshot.maintenance.commitsLast90d = stats.commitsLast90d;
  snapshot.maintenance.openIssuesCount = stats.openIssuesCount;
  snapshot.maintenance.closedIssuesLast90d = stats.closedIssuesLast90d;
  snapshot.maintenance.openPrCount = stats.openPrCount;
  snapshot.maintenance.avgIssueCloseDays = stats.avgIssueCloseDays;

  // Update archived status from GitHub
  if (stats.isArchived) {
    snapshot.eol.isArchived = true;
  }
}

/** Derive license risk tier from SPDX */
function applyLicenseRiskTier(snapshot: IHealthSnapshot): void {
  if (!snapshot.license.spdx) return;

  const spdxLower = snapshot.license.spdx.toLowerCase();
  const permissive = ['mit', 'apache-2.0', 'bsd-2-clause', 'bsd-3-clause', 'isc', 'unlicense', '0bsd', 'cc0-1.0'];
  const weakCopyleft = ['lgpl-2.1', 'lgpl-3.0', 'mpl-2.0', 'epl-2.0', 'epl-1.0'];
  const strongCopyleft = ['gpl-2.0', 'gpl-3.0', 'agpl-3.0'];

  if (permissive.some((l) => spdxLower.includes(l))) {
    snapshot.license.riskTier = 'low';
  } else if (weakCopyleft.some((l) => spdxLower.includes(l))) {
    snapshot.license.riskTier = 'medium';
  } else if (strongCopyleft.some((l) => spdxLower.includes(l))) {
    snapshot.license.riskTier = 'high';
  }
}
