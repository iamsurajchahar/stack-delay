import { useAuth } from '../../hooks/useAuth';
import { Github, CheckCircle, RefreshCw } from 'lucide-react';

export function GitHubConnectionPanel() {
  const { user } = useAuth();

  const handleReconnect = () => {
    window.location.href = '/api/auth/github';
  };

  return (
    <div className="bg-white border rounded-xl p-6">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">GitHub Connection</h2>

      {user ? (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <img
              src={user.avatarUrl}
              alt={user.githubLogin}
              className="w-12 h-12 rounded-full"
            />
            <div>
              <div className="flex items-center gap-2">
                <span className="font-medium text-gray-900">{user.displayName || user.githubLogin}</span>
                <CheckCircle className="w-4 h-4 text-green-500" />
              </div>
              <p className="text-sm text-gray-500">@{user.githubLogin}</p>
            </div>
          </div>
          <button
            onClick={handleReconnect}
            className="flex items-center gap-2 px-3 py-2 text-sm border rounded-lg hover:bg-gray-50 transition-colors"
          >
            <RefreshCw className="w-4 h-4" /> Reconnect
          </button>
        </div>
      ) : (
        <button
          onClick={handleReconnect}
          className="flex items-center gap-2 px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors"
        >
          <Github className="w-5 h-5" /> Connect GitHub
        </button>
      )}
    </div>
  );
}
