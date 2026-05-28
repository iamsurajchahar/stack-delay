import apiClient from './client';
import type { IAlertRule, INotification } from '@stack-decay/shared';

interface AlertHistoryParams {
  page?: number;
  limit?: number;
  channel?: string;
  status?: string;
}

export async function listRules(): Promise<IAlertRule[]> {
  const { data } = await apiClient.get('/alerts/rules');
  return data;
}

export async function createRule(payload: Omit<IAlertRule, 'id' | 'userId' | 'createdAt' | 'updatedAt'>): Promise<IAlertRule> {
  const { data } = await apiClient.post('/alerts/rules', payload);
  return data;
}

export async function updateRule(id: string, payload: Partial<IAlertRule>): Promise<IAlertRule> {
  const { data } = await apiClient.patch(`/alerts/rules/${id}`, payload);
  return data;
}

export async function deleteRule(id: string): Promise<void> {
  await apiClient.delete(`/alerts/rules/${id}`);
}

export async function getAlertHistory(params?: AlertHistoryParams): Promise<{ items: INotification[]; total: number }> {
  const { data } = await apiClient.get('/alerts/history', { params });
  return data;
}
