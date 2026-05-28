import { Request, Response, NextFunction } from 'express';
import { config } from '../config/index';
import * as authService from '../services/auth.service';
import { decrypt } from '../utils/encryption';
import { AppError } from '../middleware/errorHandler.middleware';

export async function githubRedirect(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const params = new URLSearchParams({
      client_id: config.GITHUB_CLIENT_ID,
      redirect_uri: config.GITHUB_CALLBACK_URL,
      scope: 'read:user user:email repo',
      state: Math.random().toString(36).substring(2),
    });

    res.redirect(`https://github.com/login/oauth/authorize?${params.toString()}`);
  } catch (err) {
    next(err);
  }
}

export async function githubCallback(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { code } = req.query;

    if (!code || typeof code !== 'string') {
      throw new AppError('Missing authorization code', 400, 'MISSING_CODE');
    }

    // Exchange code for token
    const tokenData = await authService.exchangeCodeForToken(code);

    // Get GitHub user profile
    const githubUser = await authService.getGitHubUser(tokenData.access_token);

    // Create or update user
    const user = await authService.findOrCreateUser(
      githubUser,
      tokenData.access_token,
      tokenData.refresh_token,
    );

    // Generate JWT
    const jwt = authService.generateJWT(user._id.toString());

    // Redirect to client with token
    const redirectUrl = new URL('/auth/callback', config.CLIENT_URL);
    redirectUrl.searchParams.set('token', jwt);
    res.redirect(redirectUrl.toString());
  } catch (err) {
    next(err);
  }
}

export async function refreshToken(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { token } = req.body;

    if (!token || typeof token !== 'string') {
      throw new AppError('Token is required', 400, 'MISSING_TOKEN');
    }

    // Verify the existing token (allow expired tokens for refresh)
    let payload: { sub: string };
    try {
      payload = authService.verifyJWT(token);
    } catch (err) {
      // For refresh, we also accept expired tokens if the structure is valid
      if (err instanceof AppError && err.code === 'TOKEN_EXPIRED') {
        const decoded = JSON.parse(
          Buffer.from(token.split('.')[1], 'base64').toString(),
        );
        payload = { sub: decoded.sub };
      } else {
        throw err;
      }
    }

    const newToken = authService.generateJWT(payload.sub);

    res.json({
      status: 'success',
      data: { token: newToken },
    });
  } catch (err) {
    next(err);
  }
}

export async function logout(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    // Stateless JWT: client should discard the token.
    // If Redis-based token blacklisting is needed, it can be added here.
    res.json({
      status: 'success',
      message: 'Logged out successfully',
    });
  } catch (err) {
    next(err);
  }
}

export async function getMe(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) {
      throw new AppError('Not authenticated', 401, 'AUTH_REQUIRED');
    }

    res.json({
      status: 'success',
      data: { user: req.user.toSafeJSON() },
    });
  } catch (err) {
    next(err);
  }
}
