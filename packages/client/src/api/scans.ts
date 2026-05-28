import apiClient from './client';
import type { IScan } from '@stack-decay/shared';

interface ListScansParams {
  page?: number;
  limit?: number;
  status?: string;
}

export async function triggerScan(repoId: string): Promise<IScan> {
  const { data } = await apiClient.post(`/repos/${repoId}/scans`);
  return data;
}

export async function listScans(repoId: string, params?: ListScansParams): Promise<{ items: IScan[]; total: number }> {
  const { data } = await apiClient.get(`/repos/${repoId}/scans`, { params });
  return data;
}

export async function getLatestScan(repoId: string): Promise<IScan | null> {
  const { data } = await apiClient.get(`/repos/${repoId}/scans/latest`);
  return data;
}

export async function getScan(repoId: string, scanId: string): Promise<IScan> {
  const { data } = await apiClient.get(`/repos/${repoId}/scans/${scanId}`);
  return data;
}
