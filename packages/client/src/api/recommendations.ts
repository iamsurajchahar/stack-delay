import apiClient from './client';
import type { IRecommendation } from '@stack-decay/shared';

export async function getRecommendations(repoId: string): Promise<IRecommendation[]> {
  const { data } = await apiClient.get(`/repos/${repoId}/recommendations`);
  return data;
}
