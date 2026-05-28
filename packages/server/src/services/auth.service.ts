import axios from 'axios';
import jwt from 'jsonwebtoken';
import { config } from '../config/index';
import { User, IUserDocument } from '../models/User';
import { encrypt } from '../utils/encryption';
import { logger } from '../utils/logger';
import { AppError } from '../middleware/errorHandler.middleware';

interface GitHubTokenResponse {
  access_token: string;
  token_type: string;
  scope: string;
  refresh_token?: string;
}

interface GitHubUserResponse {
  id: number;
  login: string;
  name: string | null;
  avatar_url: string;
  email: string | null;
}

export async function exchangeCodeForToken(code: string): Promise<GitHubTokenResponse> {
  try {
    const response = await axios.post<GitHubTokenResponse>(
      'https://github.com/login/oauth/access_token',
      {
        client_id: config.GITHUB_CLIENT_ID,
        client_secret: config.GITHUB_CLIENT_SECRET,
        code,
      },
      {
        headers: { Accept: 'application/json' },
        timeout: 10000,
      },
    );

    if (!response.data.access_token) {
      throw new AppError('Failed to obtain access token from GitHub', 401, 'GITHUB_AUTH_FAILED');
    }

    return response.data;
  } catch (err) {
    if (err instanceof AppError) throw err;
    logger.error({ err }, 'GitHub token exchange failed');
    throw new AppError('GitHub authentication failed', 502, 'GITHUB_AUTH_FAILED');
  }
}

export async function getGitHubUser(accessToken: string): Promise<GitHubUserResponse> {
  try {
    const response = await axios.get<GitHubUserResponse>('https://api.github.com/user', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/vnd.github+json',
      },
      timeout: 10000,
    });

    return response.data;
  } catch (err) {
    logger.error({ err }, 'Failed to fetch GitHub user');
    throw new AppError('Failed to fetch GitHub user profile', 502, 'GITHUB_USER_FETCH_FAILED');
  }
}

export async function findOrCreateUser(
  githubUser: GitHubUserResponse,
  accessToken: string,
  refreshToken?: string,
): Promise<IUserDocument> {
  const encryptedAccessToken = encrypt(accessToken);
  const encryptedRefreshToken = refreshToken ? encrypt(refreshToken) : undefined;

  try {
    // Use findOneAndUpdate with upsert for atomicity (avoids race conditions on concurrent logins)
    const user = await User.findOneAndUpdate(
      { githubId: githubUser.id },
      {
        $set: {
          githubLogin: githubUser.login,
          displayName: githubUser.name || githubUser.login,
          avatarUrl: githubUser.avatar_url,
          email: githubUser.email || '',
          accessToken: encryptedAccessToken,
          ...(encryptedRefreshToken && { refreshToken: encryptedRefreshToken }),
        },
        $setOnInsert: {
          githubId: githubUser.id,
          plan: 'free',
        },
      },
      { upsert: true, new: true, runValidators: true },
    );

    if (!user) {
      throw new AppError('Failed to create or update user', 500, 'USER_UPSERT_FAILED');
    }

    return user;
  } catch (err) {
    if (err instanceof AppError) throw err;
    logger.error({ err, githubId: githubUser.id }, 'User upsert failed');
    throw new AppError('Failed to create or update user account', 500, 'USER_UPSERT_FAILED');
  }
}

export function generateJWT(userId: string): string {
  return jwt.sign({ sub: userId }, config.JWT_SECRET, {
    expiresIn: config.JWT_EXPIRES_IN,
  });
}

export function verifyJWT(token: string): { sub: string; iat: number; exp: number } {
  try {
    return jwt.verify(token, config.JWT_SECRET) as { sub: string; iat: number; exp: number };
  } catch (err) {
    if (err instanceof jwt.TokenExpiredError) {
      throw new AppError('Token has expired', 401, 'TOKEN_EXPIRED');
    }
    throw new AppError('Invalid token', 401, 'TOKEN_INVALID');
  }
}
