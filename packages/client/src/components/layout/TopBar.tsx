import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Menu, Search, Plus, Bell } from 'lucide-react';

interface TopBarProps {
  onOpenSidebar: () => void;
}

const routeTitles: Record<string, string> = {
  '/': 'Dashboard',
  '/alerts': 'Alerts',
  '/settings': 'Settings',
  '/onboarding': 'Get Started',
};

function getTitle(pathname: string): string {
  if (routeTitles[pathname]) return routeTitles[pathname];
  if (pathname.startsWith('/repos/') && pathname.includes('/deps/')) return 'Dependency Detail';
  if (pathname.startsWith('/repos/')) return 'Repository';
  return 'Stack Decay Score';
}

export function TopBar({ onOpenSidebar }: TopBarProps) {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');

  return (
    <header className="flex h-16 shrink-0 items-center gap-4 border-b border-gray-200 bg-white px-4 sm:px-6 lg:px-8">
      <button
        onClick={onOpenSidebar}
        className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 lg:hidden"
      >
        <Menu className="h-5 w-5" />
      </button>

      <h1 className="text-lg font-semibold text-gray-900">{getTitle(pathname)}</h1>

      <div className="ml-auto flex items-center gap-3">
        {/* Search */}
        <div className="relative hidden sm:block">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search repos..."
            className="input w-48 pl-9 lg:w-64"
          />
        </div>

        {/* Connect Repo */}
        <button
          onClick={() => navigate('/onboarding')}
          className="btn-primary gap-1.5"
        >
          <Plus className="h-4 w-4" />
          <span className="hidden sm:inline">Connect Repo</span>
        </button>

        {/* Notifications */}
        <button
          onClick={() => navigate('/alerts')}
          className="relative rounded-lg p-2 text-gray-500 hover:bg-gray-100"
        >
          <Bell className="h-5 w-5" />
        </button>
      </div>
    </header>
  );
}
