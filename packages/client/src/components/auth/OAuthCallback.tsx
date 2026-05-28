import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { handleCallback } from '../../api/auth';
import { useAuthStore } from '../../store/authStore';
import { LoadingSpinner } from '../shared/LoadingSpinner';

export function OAuthCallback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const setAuth = useAuthStore((s) => s.setAuth);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const code = searchParams.get('code');
    if (!code) {
      setError('No authorization code received');
      return;
    }

    handleCallback(code)
      .then(({ token, user }) => {
        setAuth(user, token);
        navigate('/', { replace: true });
      })
      .catch((err) => {
        setError(err?.response?.data?.message || 'Authentication failed');
        setTimeout(() => navigate('/login', { replace: true }), 3000);
      });
  }, [searchParams, setAuth, navigate]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50">
      {error ? (
        <div className="text-center">
          <p className="mb-2 text-lg font-medium text-red-600">Authentication Failed</p>
          <p className="text-sm text-gray-500">{error}</p>
          <p className="mt-2 text-xs text-gray-400">Redirecting to login...</p>
        </div>
      ) : (
        <div className="text-center">
          <LoadingSpinner size="lg" className="mx-auto mb-4" />
          <p className="text-lg font-medium text-gray-700">Signing you in...</p>
          <p className="text-sm text-gray-500">Please wait while we complete authentication.</p>
        </div>
      )}
    </div>
  );
}
