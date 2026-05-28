import apiClient from './client';
import type { IUser } from '@stack-decay/shared';

export async function githubLogin(): Promise<{ url: string }> {
  const { data } = await apiClient.get('/auth/github');
  return data;
}

export async function handleCallback(code: string): Promise<{ token: string; user: IUser }> {
  const { data } = await apiClient.post('/auth/github/callback', { code });
  return data;
}

export async function getMe(): Promise<IUser> {
  const { data } = await apiClient.get('/auth/me');
  return data;
}

export async function refreshToken(): Promise<{ token: string }> {
  const { data } = await apiClient.post('/auth/refresh');
  return data;
}

export async function logout(): Promise<void> {
  await apiClient.post('/auth/logout');
}
