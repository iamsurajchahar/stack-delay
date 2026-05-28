import { useQuery } from '@tanstack/react-query';
import { getCurrentScore, getScoreHistory, getDependencyScores } from '../api/scores';

export function useCurrentScore(repoId: string) {
  return useQuery({
    queryKey: ['scores', repoId, 'current'],
    queryFn: () => getCurrentScore(repoId),
    enabled: !!repoId,
  });
}

export function useScoreHistory(repoId: string, dateRange?: { from?: string; to?: string }) {
  return useQuery({
    queryKey: ['scores', repoId, 'history', dateRange],
    queryFn: () => getScoreHistory(repoId, dateRange),
    enabled: !!repoId,
  });
}

export function useDependencyScores(repoId: string, params?: {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortDir?: 'asc' | 'desc';
  ecosystem?: string;
  search?: string;
}) {
  return useQuery({
    queryKey: ['scores', repoId, 'dependencies', params],
    queryFn: () => getDependencyScores(repoId, params),
    enabled: !!repoId,
  });
}
