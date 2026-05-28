import apiClient from './client';
import type { IRepository } from '@stack-decay/shared';

interface AvailableRepo {
  githubRepoId: number;
  fullName: string;
  owner: string;
  name: string;
  isPrivate: boolean;
  language: string;
  defaultBranch: string;
  stargazersCount: number;
  updatedAt: string;
}

interface ConnectRepoData {
  githubRepoId: number;
  fullName: string;
  owner: string;
  name: string;
  defaultBranch: string;
  isPrivate: boolean;
  language: string;
  scanFrequency?: 'manual' | 'daily' | 'weekly' | 'monthly';
}

export async function listRepos(): Promise<IRepository[]> {
  const { data } = await apiClient.get('/repos');
  return data;
}

export async function listAvailable(): Promise<AvailableRepo[]> {
  const { data } = await apiClient.get('/repos/available');
  return data;
}

export async function connectRepo(payload: ConnectRepoData): Promise<IRepository> {
  const { data } = await apiClient.post('/repos', payload);
  return data;
}

export async function getRepo(id: string): Promise<IRepository> {
  const { data } = await apiClient.get(`/repos/${id}`);
  return data;
}

export async function updateRepo(id: string, payload: Partial<IRepository>): Promise<IRepository> {
  const { data } = await apiClient.patch(`/repos/${id}`, payload);
  return data;
}

export async function deleteRepo(id: string): Promise<void> {
  await apiClient.delete(`/repos/${id}`);
}
