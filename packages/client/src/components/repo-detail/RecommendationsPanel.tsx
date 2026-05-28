import { ArrowUp, RefreshCw, Trash2, Lightbulb } from 'lucide-react';
import { clsx } from 'clsx';
import { getPriorityColor } from '../../utils/scoreColors';
import { EmptyState } from '../shared/EmptyState';
import type { IRecommendation } from '../../types';

interface RecommendationsPanelProps {
  recommendations: IRecommendation[];
}

const typeIcons = {
  upgrade: ArrowUp,
  replace: RefreshCw,
  remove: Trash2,
};

export function RecommendationsPanel({ recommendations }: RecommendationsPanelProps) {
  if (recommendations.length === 0) {
    return (
      <EmptyState
        icon={Lightbulb}
        title="No recommendations"
        description="Your stack is looking good! No actionable improvements found right now."
      />
    );
  }

  const sorted = [...recommendations].sort((a, b) => {
    const order = { critical: 0, high: 1, medium: 2, low: 3 };
    return (order[a.priority] ?? 4) - (order[b.priority] ?? 4);
  });

  return (
    <div className="space-y-4">
      {sorted.map((rec) => {
        const Icon = typeIcons[rec.type] || Lightbulb;
        return (
          <div key={rec.id} className="card">
            <div className="flex items-start gap-4">
              <div
                className={clsx(
                  'flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl',
                  rec.type === 'upgrade' && 'bg-blue-50 text-blue-600',
                  rec.type === 'replace' && 'bg-purple-50 text-purple-600',
                  rec.type === 'remove' && 'bg-red-50 text-red-600',
                )}
              >
                <Icon className="h-5 w-5" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className={clsx('badge border', getPriorityColor(rec.priority))}>
                    {rec.priority}
                  </span>
                  <h4 className="text-sm font-semibold text-gray-900">{rec.title}</h4>
                </div>
                <p className="mt-1 text-sm text-gray-600">{rec.description}</p>
                <div className="mt-2 flex flex-wrap items-center gap-4 text-xs">
                  {rec.currentVersion && rec.suggestedVersion && (
                    <span className="text-gray-500">
                      {rec.currentVersion} → {rec.suggestedVersion}
                    </span>
                  )}
                  {rec.alternativePackage && (
                    <span className="text-gray-500">
                      Alternative: <span className="font-medium">{rec.alternativePackage}</span>
                    </span>
                  )}
                  {rec.scoreImpact > 0 && (
                    <span className="font-semibold text-green-600">
                      +{rec.scoreImpact} points
                    </span>
                  )}
                  {rec.migrationUrl && (
                    <a
                      href={rec.migrationUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-medium text-blue-600 hover:text-blue-700"
                    >
                      Migration Guide
                    </a>
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
