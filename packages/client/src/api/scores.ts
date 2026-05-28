import apiClient from './client';
import type { IRepoScoreSnapshot, IDependencyScore } from '@stack-decay/shared';

interface ScoreHistoryParams {
  from?: string;
  to?: string;
  limit?: number;
}

interface DependencyScoresParams {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortDir?: 'asc' | 'desc';
  ecosystem?: string;
  search?: string;
}

export async function getCurrentScore(repoId: string): Promise<IRepoScoreSnapshot> {
  const { data } = await apiClient.get(`/repos/${repoId}/scores/current`);
  return data;
}

export async function getScoreHistory(
  repoId: string,
  params?: ScoreHistoryParams,
): Promise<IRepoScoreSnapshot[]> {
  const { data } = await apiClient.get(`/repos/${repoId}/scores/history`, { params });
  return data;
}

export async function getDependencyScores(
  repoId: string,
  params?: DependencyScoresParams,
): Promise<{ items: (IDependencyScore & { name: string; ecosystem: string; version: string })[]; total: number }> {
  const { data } = await apiClient.get(`/repos/${repoId}/scores/dependencies`, { params });
  return data;
}
