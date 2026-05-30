import { Gauge, FolderGit2, ShieldAlert, Clock } from 'lucide-react';
import { clsx } from 'clsx';
import type { DashboardSummary } from '../../api/dashboard';
import { getScoreColor } from '../../utils/scoreColors';

interface SummaryCardsProps {
  summary?: DashboardSummary;
}

export function SummaryCards({ summary }: SummaryCardsProps) {
  const avgScore = summary?.averageScore ?? null;
  const cards = [
    {
      label: 'Average Score',
      value: avgScore !== null ? Math.round(avgScore) : '--',
      icon: Gauge,
      colorClass: avgScore !== null ? getScoreColor(avgScore) : 'text-gray-400',
      bgClass: 'bg-blue-50',
      iconColor: 'text-blue-600',
    },
    {
      label: 'Repos Monitored',
      value: summary?.totalRepos ?? '--',
      icon: FolderGit2,
      colorClass: 'text-gray-900',
      bgClass: 'bg-purple-50',
      iconColor: 'text-purple-600',
    },
    {
      label: 'Total Scans',
      value: summary?.totalScans ?? '--',
      icon: ShieldAlert,
      colorClass: 'text-gray-900',
      bgClass: 'bg-green-50',
      iconColor: 'text-green-600',
    },
    {
      label: 'Active Scans',
      value: summary?.activeScans ?? '--',
      icon: Clock,
      colorClass:
        summary && summary.activeScans > 0 ? 'text-orange-600' : 'text-gray-900',
      bgClass: summary && summary.activeScans > 0 ? 'bg-orange-50' : 'bg-green-50',
      iconColor:
        summary && summary.activeScans > 0 ? 'text-orange-600' : 'text-green-600',
    },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {cards.map(({ label, value, icon: Icon, colorClass, bgClass, iconColor }) => (
        <div key={label} className="card flex items-center gap-4">
          <div className={clsx('flex h-12 w-12 items-center justify-center rounded-xl', bgClass)}>
            <Icon className={clsx('h-6 w-6', iconColor)} />
          </div>
          <div>
            <p className="text-sm text-gray-500">{label}</p>
            <div className="flex items-baseline gap-1.5">
              <p className={clsx('text-2xl font-bold', colorClass)}>{value}</p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
