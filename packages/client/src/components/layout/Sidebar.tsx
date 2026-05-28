import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Bell, Settings, ChevronLeft, ChevronRight, LogOut, GitFork } from 'lucide-react';
import { clsx } from 'clsx';
import { useAuth } from '../../hooks/useAuth';
import { useRepos } from '../../hooks/useRepos';

interface SidebarProps {
  collapsed: boolean;
  onToggleCollapse: () => void;
  onCloseMobile: () => void;
}

const navItems = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/alerts', icon: Bell, label: 'Alerts' },
  { to: '/settings', icon: Settings, label: 'Settings' },
];

export function Sidebar({ collapsed, onToggleCollapse, onCloseMobile }: SidebarProps) {
  const { user, logout } = useAuth();
  const { data: repos } = useRepos();

  return (
    <div className="flex h-full flex-col bg-sidebar text-white">
      {/* Header */}
      <div className="flex h-16 items-center justify-between border-b border-white/10 px-4">
        {!collapsed && (
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 text-sm font-bold">
              SD
            </div>
            <span className="text-sm font-semibold">Stack Decay</span>
          </div>
        )}
        <button
          onClick={onToggleCollapse}
          className="hidden rounded-lg p-1.5 text-gray-400 hover:bg-sidebar-hover hover:text-white lg:block"
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </button>
      </div>

      {/* Nav links */}
      <nav className="flex-1 space-y-1 px-2 py-4">
        {navItems.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            onClick={onCloseMobile}
            className={({ isActive }) =>
              clsx(
                'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-sidebar-active text-white'
                  : 'text-gray-400 hover:bg-sidebar-hover hover:text-white',
                collapsed && 'justify-center',
              )
            }
          >
            <Icon className="h-5 w-5 flex-shrink-0" />
            {!collapsed && <span>{label}</span>}
          </NavLink>
        ))}

        {/* Connected repos */}
        {!collapsed && repos && repos.length > 0 && (
          <div className="mt-6">
            <p className="mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-gray-500">
              Repositories
            </p>
            <div className="max-h-48 space-y-0.5 overflow-y-auto">
              {repos.slice(0, 10).map((repo) => (
                <NavLink
                  key={repo.id}
                  to={`/repos/${repo.id}`}
                  onClick={onCloseMobile}
                  className={({ isActive }) =>
                    clsx(
                      'flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors',
                      isActive
                        ? 'bg-sidebar-active text-white'
                        : 'text-gray-400 hover:bg-sidebar-hover hover:text-white',
                    )
                  }
                >
                  <GitFork className="h-4 w-4 flex-shrink-0" />
                  <span className="truncate">{repo.name}</span>
                  {repo.latestGrade && (
                    <span
                      className={clsx(
                        'ml-auto flex-shrink-0 rounded px-1.5 py-0.5 text-xs font-bold',
                        repo.latestGrade === 'A' && 'bg-green-600/20 text-green-400',
                        repo.latestGrade === 'B' && 'bg-blue-600/20 text-blue-400',
                        repo.latestGrade === 'C' && 'bg-yellow-600/20 text-yellow-400',
                        repo.latestGrade === 'D' && 'bg-orange-600/20 text-orange-400',
                        repo.latestGrade === 'F' && 'bg-red-600/20 text-red-400',
                      )}
                    >
                      {repo.latestGrade}
                    </span>
                  )}
                </NavLink>
              ))}
            </div>
          </div>
        )}
      </nav>

      {/* User section */}
      <div className="border-t border-white/10 p-3">
        <div className={clsx('flex items-center gap-3', collapsed && 'justify-center')}>
          {user?.avatarUrl ? (
            <img
              src={user.avatarUrl}
              alt={user.displayName}
              className="h-8 w-8 rounded-full"
            />
          ) : (
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-600 text-xs font-medium">
              {user?.displayName?.charAt(0) || '?'}
            </div>
          )}
          {!collapsed && (
            <>
              <div className="flex-1 overflow-hidden">
                <p className="truncate text-sm font-medium">{user?.displayName}</p>
                <p className="truncate text-xs text-gray-400">@{user?.githubLogin}</p>
              </div>
              <button
                onClick={logout}
                className="rounded-lg p-1.5 text-gray-400 hover:bg-sidebar-hover hover:text-white"
                title="Sign out"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
