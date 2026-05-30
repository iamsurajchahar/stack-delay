import { useQuery } from '@tanstack/react-query';
import { getRepoEol } from '../../api/scores';
import { clsx } from 'clsx';
import { Clock, AlertTriangle, CheckCircle, XCircle } from 'lucide-react';
import { EmptyState } from '../shared/EmptyState';
import { LoadingSpinner } from '../shared/LoadingSpinner';

interface EolTimelineProps {
  repoId: string;
}

function getEolBarColor(days: number | null, isEol: boolean): string {
  if (isEol || (days !== null && days < 0)) return 'bg-gray-900';
  if (days === null) return 'bg-green-500';
  if (days < 90) return 'bg-red-500';
  if (days < 180) return 'bg-orange-500';
  if (days < 365) return 'bg-yellow-500';
  return 'bg-green-500';
}

function getEolLabel(days: number | null, isEol: boolean): string {
  if (isEol && days !== null && days < 0) return `EOL ${Math.abs(days)}d ago`;
  if (isEol) return 'End of Life';
  if (days === null) return 'No EOL date';
  if (days < 0) return `Past EOL (${Math.abs(days)}d ago)`;
  if (days < 90) return `${days}d remaining`;
  if (days < 365) return `${Math.round(days / 30)}mo remaining`;
  return `${(days / 365).toFixed(1)}yr remaining`;
}

function getStatusIcon(days: number | null, isEol: boolean) {
  if (isEol || (days !== null && days < 0)) return <XCircle className="h-4 w-4 text-gray-900" />;
  if (days !== null && days < 180) return <AlertTriangle className="h-4 w-4 text-orange-500" />;
  return <CheckCircle className="h-4 w-4 text-green-500" />;
}

export function EolTimeline({ repoId }: EolTimelineProps) {
  const { data: entries, isLoading } = useQuery({
    queryKey: ['eol', repoId],
    queryFn: () => getRepoEol(repoId),
    enabled: !!repoId,
    staleTime: 5 * 60 * 1000, // Cache for 5 min since EOL data doesn't change often
  });

  if (isLoading) {
    return (
      <div className="card">
        <h3 className="mb-4 text-base font-semibold text-gray-900">EOL Timeline</h3>
        <div className="flex h-24 items-center justify-center">
          <LoadingSpinner />
        </div>
      </div>
    );
  }

  if (!entries || entries.length === 0) {
    return (
      <div className="card">
        <h3 className="mb-4 text-base font-semibold text-gray-900">EOL Timeline</h3>
        <EmptyState
          icon={Clock}
          title="No EOL data available"
          description="Runtime and framework EOL dates will appear here once detected."
        />
      </div>
    );
  }

  const maxDays = Math.max(
    ...entries.map((e) => Math.abs(e.daysUntilEol ?? 0)),
    365,
  );

  return (
    <div className="card">
      <h3 className="mb-4 text-base font-semibold text-gray-900">EOL Timeline</h3>
      <div className="space-y-3">
        {entries.map((entry) => {
          const absDays = Math.abs(entry.daysUntilEol ?? 0);
          const widthPercent = Math.min((absDays / maxDays) * 100, 100);
          return (
            <div key={entry.product} className="flex items-center gap-4">
              <div className="w-28 flex-shrink-0 text-right">
                <div className="flex items-center justify-end gap-1.5">
                  {getStatusIcon(entry.daysUntilEol, entry.isEol)}
                  <span className="text-sm font-medium text-gray-700">{entry.name}</span>
                </div>
                {entry.latestVersion && (
                  <span className="text-xs text-gray-400">v{entry.latestVersion}</span>
                )}
              </div>
              <div className="flex-1">
                <div className="relative h-6 w-full overflow-hidden rounded-full bg-gray-100">
                  <div
                    className={clsx(
                      'h-full rounded-full transition-all duration-500',
                      getEolBarColor(entry.daysUntilEol, entry.isEol),
                    )}
                    style={{ width: `${Math.max(widthPercent, 5)}%` }}
                  />
                </div>
              </div>
              <div className="w-36 flex-shrink-0 text-sm text-gray-500">
                {entry.eolDate && (
                  <div>{new Date(entry.eolDate).toLocaleDateString()}</div>
                )}
                <div
                  className={clsx(
                    'text-xs font-medium',
                    entry.isEol && 'text-gray-900',
                    !entry.isEol && entry.daysUntilEol !== null && entry.daysUntilEol < 90 && 'text-red-600',
                    !entry.isEol && entry.daysUntilEol !== null && entry.daysUntilEol >= 90 && entry.daysUntilEol < 180 && 'text-orange-600',
                    !entry.isEol && entry.daysUntilEol !== null && entry.daysUntilEol >= 180 && entry.daysUntilEol < 365 && 'text-yellow-600',
                    !entry.isEol && (entry.daysUntilEol === null || entry.daysUntilEol >= 365) && 'text-green-600',
                  )}
                >
                  {getEolLabel(entry.daysUntilEol, entry.isEol)}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
