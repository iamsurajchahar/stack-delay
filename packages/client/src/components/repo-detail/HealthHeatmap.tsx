import { useQuery } from '@tanstack/react-query';
import { getDependencyScores } from '../../api/scores';
import { useNavigate } from 'react-router-dom';
import { clsx } from 'clsx';
import { Tooltip } from '../shared/Tooltip';
import { LoadingSpinner } from '../shared/LoadingSpinner';

interface HealthHeatmapProps {
  repoId: string;
}

function getHeatColor(score: number): string {
  if (score >= 80) return 'bg-green-500';
  if (score >= 60) return 'bg-green-300';
  if (score >= 40) return 'bg-yellow-400';
  if (score >= 20) return 'bg-orange-400';
  return 'bg-red-500';
}

function getHeatBorder(score: number): string {
  if (score >= 80) return 'ring-green-600';
  if (score >= 60) return 'ring-green-400';
  if (score >= 40) return 'ring-yellow-500';
  if (score >= 20) return 'ring-orange-500';
  return 'ring-red-600';
}

export function HealthHeatmap({ repoId }: HealthHeatmapProps) {
  const navigate = useNavigate();
  const { data, isLoading } = useQuery({
    queryKey: ['scores', repoId, 'dependencies', 'heatmap'],
    queryFn: () => getDependencyScores(repoId, { limit: 200 }),
    enabled: !!repoId,
  });

  if (isLoading) {
    return (
      <div className="card">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">Dependency Health Map</h3>
        <div className="flex h-32 items-center justify-center">
          <LoadingSpinner />
        </div>
      </div>
    );
  }

  const deps = data?.items || [];
  if (deps.length === 0) return null;

  // Sort by score ascending (worst first)
  const sorted = [...deps].sort((a, b) => (a.compositeScore ?? 50) - (b.compositeScore ?? 50));

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Dependency Health Map</h3>
        <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-red-500" /> Critical</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-orange-400" /> Poor</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-yellow-400" /> Fair</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-green-300" /> Good</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-green-500" /> Excellent</span>
        </div>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {sorted.map((dep) => {
          const score = dep.compositeScore ?? 50;
          return (
            <Tooltip key={dep.id} content={`${dep.name}: ${score}/100`}>
              <button
                onClick={() => navigate(`/repos/${repoId}/deps/${dep.packageId || dep.id}`)}
                className={clsx(
                  'h-8 rounded-md text-[10px] font-medium text-white px-2 truncate max-w-[120px] transition-all hover:ring-2',
                  getHeatColor(score),
                  `hover:${getHeatBorder(score)}`,
                )}
                style={{ minWidth: '2rem' }}
              >
                {dep.name}
              </button>
            </Tooltip>
          );
        })}
      </div>
    </div>
  );
}
