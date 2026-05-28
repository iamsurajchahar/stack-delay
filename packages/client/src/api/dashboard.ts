import apiClient from './client';

export interface DashboardSummary {
  averageScore: number;
  averageGrade: string;
  reposMonitored: number;
  criticalVulnerabilities: number;
  eolWarnings: number;
}

export interface TrendPoint {
  date: string;
  averageScore: number;
  repoCount: number;
}

export async function getSummary(): Promise<DashboardSummary> {
  const { data } = await apiClient.get('/dashboard/summary');
  return data;
}

export async function getTrends(): Promise<TrendPoint[]> {
  const { data } = await apiClient.get('/dashboard/trends');
  return data;
}
