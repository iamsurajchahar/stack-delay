import { useNavigate } from 'react-router-dom';
import { Github, BarChart3, Shield, Bell } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { githubLogin } from '../../api/auth';
import { useEffect, useState } from 'react';

export function LoginPage() {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isAuthenticated) navigate('/', { replace: true });
  }, [isAuthenticated, navigate]);

  const handleLogin = async () => {
    setLoading(true);
    try {
      const { url } = await githubLogin();
      window.location.href = url;
    } catch {
      setLoading(false);
    }
  };

  const features = [
    {
      icon: BarChart3,
      title: 'Monitor',
      description: 'Track the health and freshness of every dependency across all your repos.',
    },
    {
      icon: Shield,
      title: 'Score',
      description: 'Get a composite decay score based on maintenance, security, community, and more.',
    },
    {
      icon: Bell,
      title: 'Alert',
      description: 'Set rules to get notified when scores drop, CVEs appear, or EOL dates approach.',
    },
  ];

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 px-4">
      <div className="w-full max-w-md">
        {/* Logo & Tagline */}
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-600 shadow-lg shadow-blue-600/30">
            <BarChart3 className="h-8 w-8 text-white" />
          </div>
          <h1 className="mb-2 text-3xl font-bold text-white">Stack Decay Score</h1>
          <p className="text-lg text-blue-200">Score your stack's health</p>
        </div>

        {/* Login Card */}
        <div className="rounded-2xl border border-white/10 bg-white/5 p-8 backdrop-blur-sm">
          <button
            onClick={handleLogin}
            disabled={loading}
            className="flex w-full items-center justify-center gap-3 rounded-xl bg-white px-6 py-4 text-base font-semibold text-gray-900 shadow-sm transition-all hover:bg-gray-100 disabled:opacity-50"
          >
            <Github className="h-6 w-6" />
            {loading ? 'Redirecting...' : 'Sign in with GitHub'}
          </button>
          <p className="mt-4 text-center text-xs text-gray-400">
            We only request read access to your repositories.
          </p>
        </div>

        {/* Feature highlights */}
        <div className="mt-10 grid grid-cols-3 gap-4">
          {features.map(({ icon: Icon, title, description }) => (
            <div key={title} className="rounded-xl border border-white/10 bg-white/5 p-4 text-center backdrop-blur-sm">
              <Icon className="mx-auto mb-2 h-6 w-6 text-blue-400" />
              <h3 className="mb-1 text-sm font-semibold text-white">{title}</h3>
              <p className="text-xs leading-relaxed text-gray-400">{description}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
