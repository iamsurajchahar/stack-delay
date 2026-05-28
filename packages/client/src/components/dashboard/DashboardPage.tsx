import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getSummary, getTrends } from '../../api/dashboard';
import { useRepos } from '../../hooks/useRepos';
import { SummaryCards } from './SummaryCards';
import { FilterBar } from './FilterBar';
import { RepoCard } from './RepoCard';
import { CrossRepoTrendChart } from './CrossRepoTrendChart';
import { LoadingSpinner } from '../shared/LoadingSpinner';
import { EmptyState } from '../shared/EmptyState';
import { GitFork } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { FilterState } from '../../types';
import { getGrade } from '@stack-decay/shared';

export function DashboardPage() {
  const navigate = useNavigate();
  const { data: summary, isLoading: summaryLoading } = useQuery({
    queryKey: ['dashboard', 'summary'],
    queryFn: getSummary,
  });
  const { data: trends } = useQuery({
    queryKey: ['dashboard', 'trends'],
    queryFn: getTrends,
  });
  const { data: repos, isLoading: reposLoading } = useRepos();

  const [filters, setFilters] = useState<FilterState>({
    search: '',
    ecosystems: [],
    grades: [],
    sortBy: 'score',
    sortDir: 'desc',
  });

  const filteredRepos = (repos || [])
    .filter((r) => {
      if (filters.search && !r.fullName.toLowerCase().includes(filters.search.toLowerCase())) return false;
      if (filters.grades.length > 0 && r.latestGrade && !filters.grades.includes(r.latestGrade)) return false;
      return true;
    })
    .sort((a, b) => {
      const dir = filters.sortDir === 'asc' ? 1 : -1;
      switch (filters.sortBy) {
        case 'score':
          return ((a.latestScore ?? 0) - (b.latestScore ?? 0)) * dir;
        case 'name':
          return a.fullName.localeCompare(b.fullName) * dir;
        case 'lastScanned':
          return (
            (new Date(a.lastScannedAt || 0).getTime() - new Date(b.lastScannedAt || 0).getTime()) *
            dir
          );
        default:
          return 0;
      }
    });

  if (summaryLoading || reposLoading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (!repos || repos.length === 0) {
    return (
      <EmptyState
        icon={GitFork}
        title="No repositories connected"
        description="Connect your first GitHub repository to start monitoring your stack's health."
        actionLabel="Connect Repository"
        onAction={() => navigate('/onboarding')}
      />
    );
  }

  return (
    <div className="space-y-6">
      <SummaryCards summary={summary} />
      <FilterBar filters={filters} onFilterChange={setFilters} />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {filteredRepos.map((repo) => (
          <RepoCard key={repo.id} repo={repo} />
        ))}
      </div>
      {filteredRepos.length === 0 && (
        <EmptyState title="No repos match filters" description="Try adjusting your search or filter criteria." />
      )}
      {trends && trends.length > 1 && <CrossRepoTrendChart data={trends} />}
    </div>
  );
}
