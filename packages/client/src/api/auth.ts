import apiClient, { apiBaseUrl } from './client';
import type { IUser } from '@stack-decay/shared';

/**
 * Full URL of the server's GitHub OAuth entry point. The server answers with a
 * 302 to GitHub, so the browser navigates here directly — no XHR round-trip
 * (and no API cold-start) between the click and the GitHub consent screen.
 */
export const githubLoginUrl = `${apiBaseUrl}/auth/github`;

export async function getMe(): Promise<IUser> {
  const { data } = await apiClient.get('/auth/me');
  return data.user ?? data;
}

export async function refreshToken(token: string): Promise<{ token: string }> {
  const { data } = await apiClient.post('/auth/refresh', { token });
  return data;
}

export async function logout(): Promise<void> {
  await apiClient.delete('/auth/session');
}
