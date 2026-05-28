import apiClient from './client';
import type { IPackage, IHealthSnapshot, IVulnerability } from '@stack-decay/shared';

export async function getPackage(ecosystem: string, name: string): Promise<IPackage> {
  const { data } = await apiClient.get(`/packages/${ecosystem}/${encodeURIComponent(name)}`);
  return data;
}

export async function getHealthHistory(
  ecosystem: string,
  name: string,
): Promise<IHealthSnapshot[]> {
  const { data } = await apiClient.get(`/packages/${ecosystem}/${encodeURIComponent(name)}/health`);
  return data;
}

export async function getVulnerabilities(
  ecosystem: string,
  name: string,
): Promise<IVulnerability[]> {
  const { data } = await apiClient.get(`/packages/${ecosystem}/${encodeURIComponent(name)}/vulnerabilities`);
  return data;
}
