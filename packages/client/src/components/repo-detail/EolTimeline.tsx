import { useQuery } from '@tanstack/react-query';
import { getLatestScan } from '../../api/scans';
import { formatShort } from '../../utils/formatDate';
import { clsx } from 'clsx';
import { Clock } from 'lucide-react';
import { EmptyState } from '../shared/EmptyState';

interface EolTimelineProps {
  repoId: string;
}

interface EolEntry {
  name: string;
  eolDate: Date;
  daysUntilEol: number;
}

function getEolBarColor(days: number): string {
  if (days < 0) return 'bg-gray-900';
  if (days < 90) return 'bg-red-500';
  if (days < 180) return 'bg-orange-500';
  if (days < 365) return 'bg-yellow-500';
  return 'bg-green-500';
}

function getEolLabel(days: number): string {
  if (days < 0) return 'Past EOL';
  if (days < 90) return `${days}d remaining`;
  if (days < 365) return `${Math.round(days / 30)}mo remaining`;
  return `${(days / 365).toFixed(1)}yr remaining`;
}

export function EolTimeline({ repoId }: EolTimelineProps) {
  // In production, this data would come from a dedicated endpoint
  // For now we display the component structure with placeholder logic
  const entries: EolEntry[] = [];

  if (entries.length === 0) {
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

  const maxDays = Math.max(...entries.map((e) => Math.abs(e.daysUntilEol)), 365);

  return (
    <div className="card">
      <h3 className="mb-4 text-base font-semibold text-gray-900">EOL Timeline</h3>
      <div className="space-y-3">
        {entries.map((entry) => {
          const widthPercent = Math.min((Math.abs(entry.daysUntilEol) / maxDays) * 100, 100);
          return (
            <div key={entry.name} className="flex items-center gap-4">
              <div className="w-32 flex-shrink-0 text-right text-sm font-medium text-gray-700">
                {entry.name}
              </div>
              <div className="flex-1">
                <div className="relative h-6 w-full overflow-hidden rounded-full bg-gray-100">
                  <div
                    className={clsx(
                      'h-full rounded-full transition-all duration-500',
                      getEolBarColor(entry.daysUntilEol),
                    )}
                    style={{ width: `${widthPercent}%` }}
                  />
                </div>
              </div>
              <div className="w-32 flex-shrink-0 text-sm text-gray-500">
                <div>{formatShort(entry.eolDate)}</div>
                <div
                  className={clsx(
                    'text-xs font-medium',
                    entry.daysUntilEol < 0 && 'text-gray-900',
                    entry.daysUntilEol >= 0 && entry.daysUntilEol < 90 && 'text-red-600',
                    entry.daysUntilEol >= 90 && entry.daysUntilEol < 180 && 'text-orange-600',
                    entry.daysUntilEol >= 180 && entry.daysUntilEol < 365 && 'text-yellow-600',
                    entry.daysUntilEol >= 365 && 'text-green-600',
                  )}
                >
                  {getEolLabel(entry.daysUntilEol)}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
