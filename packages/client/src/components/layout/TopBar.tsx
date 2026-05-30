import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Menu, Search, Plus, Bell, Sun, Moon, Monitor } from 'lucide-react';
import { useThemeStore } from '../../store/themeStore';
import { GlobalSearch } from './GlobalSearch';

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

function ThemeToggle() {
  const { theme, setTheme } = useThemeStore();
  const [open, setOpen] = useState(false);

  const icons = { light: Sun, dark: Moon, system: Monitor };
  const Icon = icons[theme];

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700"
        title="Toggle theme"
      >
        <Icon className="h-5 w-5" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full z-50 mt-1 w-36 rounded-lg border border-gray-200 bg-white py-1 shadow-lg dark:border-gray-700 dark:bg-gray-800">
            {(['light', 'dark', 'system'] as const).map((t) => {
              const TIcon = icons[t];
              return (
                <button
                  key={t}
                  onClick={() => { setTheme(t); setOpen(false); }}
                  className={`flex w-full items-center gap-2 px-3 py-2 text-sm transition-colors ${
                    theme === t
                      ? 'bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400'
                      : 'text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-700'
                  }`}
                >
                  <TIcon className="h-4 w-4" />
                  {t.charAt(0).toUpperCase() + t.slice(1)}
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

export function TopBar({ onOpenSidebar }: TopBarProps) {
  const { pathname } = useLocation();
  const navigate = useNavigate();

  return (
    <header className="flex h-16 shrink-0 items-center gap-4 border-b border-gray-200 bg-white px-4 sm:px-6 lg:px-8 dark:border-gray-700 dark:bg-gray-800">
      <button
        onClick={onOpenSidebar}
        className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 lg:hidden dark:text-gray-400 dark:hover:bg-gray-700"
      >
        <Menu className="h-5 w-5" />
      </button>

      <h1 className="text-lg font-semibold text-gray-900 dark:text-white">{getTitle(pathname)}</h1>

      <div className="ml-auto flex items-center gap-3">
        {/* Search */}
        <GlobalSearch />

        {/* Connect Repo */}
        <button
          onClick={() => navigate('/onboarding')}
          className="btn-primary gap-1.5"
        >
          <Plus className="h-4 w-4" />
          <span className="hidden sm:inline">Connect Repo</span>
        </button>

        {/* Theme toggle */}
        <ThemeToggle />

        {/* Notifications */}
        <button
          onClick={() => navigate('/alerts')}
          className="relative rounded-lg p-2 text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700"
        >
          <Bell className="h-5 w-5" />
        </button>
      </div>
    </header>
  );
}
