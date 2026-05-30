import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useRepo } from '../../hooks/useRepos';
import { useCurrentScore } from '../../hooks/useScores';
import { useQuery } from '@tanstack/react-query';
import { getRecommendations } from '../../api/recommendations';
import { getRepoVulnerabilities } from '../../api/scores';
import { RepoHeader } from './RepoHeader';
import { TabNav } from './TabNav';
import { DecayGraph } from './DecayGraph';
import { ScoreBreakdown } from './ScoreBreakdown';
import { DependencyTable } from './DependencyTable';
import { VulnerabilityPanel } from './VulnerabilityPanel';
import { EolTimeline } from './EolTimeline';
import { HealthHeatmap } from './HealthHeatmap';
import { RecommendationsPanel } from './RecommendationsPanel';
import { LicensePanel } from './LicensePanel';
import { DependencyTree } from './DependencyTree';
import { LoadingSpinner } from '../shared/LoadingSpinner';
import type { TabId } from '../../types';

const tabs: { id: TabId; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'dependencies', label: 'Dependencies' },
  { id: 'tree', label: 'Dep Tree' },
  { id: 'vulnerabilities', label: 'Vulnerabilities' },
  { id: 'recommendations', label: 'Recommendations' },
  { id: 'licenses', label: 'Licenses' },
];

export function RepoDetailPage() {
  const { repoId } = useParams<{ repoId: string }>();
  const { data: repo, isLoading: repoLoading, isError: repoError } = useRepo(repoId!);
  const { data: score, isLoading: scoreLoading, isError: scoreError } = useCurrentScore(repoId!);
  const [activeTab, setActiveTab] = useState<TabId>('overview');

  const { data: recommendations } = useQuery({
    queryKey: ['recommendations', repoId],
    queryFn: () => getRecommendations(repoId!),
    enabled: !!repoId,
  });

  const { data: vulnerabilities } = useQuery({
    queryKey: ['vulnerabilities', repoId],
    queryFn: () => getRepoVulnerabilities(repoId!),
    enabled: !!repoId,
  });

  if (repoLoading && !repoError) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (!repo) {
    return <div className="text-center text-gray-500">Repository not found</div>;
  }

  const tabsWithCounts = tabs.map((t) => ({
    ...t,
    count:
      t.id === 'dependencies'
        ? score?.totalDependencies
        : t.id === 'vulnerabilities'
          ? vulnerabilities?.length ?? score?.vulnerableCount
          : t.id === 'recommendations'
            ? recommendations?.length
            : undefined,
  }));

  return (
    <div className="space-y-6">
      <RepoHeader repo={repo} score={score ?? null} />
      <TabNav tabs={tabsWithCounts} activeTab={activeTab} onTabChange={(id) => setActiveTab(id as TabId)} />

      {activeTab === 'overview' && (
        <div className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <DecayGraph repoId={repo.id} />
            </div>
            <div>
              <ScoreBreakdown score={score ?? null} />
            </div>
          </div>
          <EolTimeline repoId={repo.id} />
          <HealthHeatmap repoId={repo.id} />
        </div>
      )}

      {activeTab === 'dependencies' && <DependencyTable repoId={repo.id} />}

      {activeTab === 'tree' && <DependencyTree repoId={repo.id} />}

      {activeTab === 'vulnerabilities' && <VulnerabilityPanel repoId={repo.id} />}

      {activeTab === 'recommendations' && (
        <RecommendationsPanel recommendations={recommendations || []} />
      )}

      {activeTab === 'licenses' && <LicensePanel repoId={repo.id} />}
    </div>
  );
}
