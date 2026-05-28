import { useNavigate } from 'react-router-dom';
import type { IRepository } from '../../types';
import { ScoreBadge } from './ScoreBadge';
import { TrendSparkline } from './TrendSparkline';
import { formatRelative } from '../../utils/formatDate';
import { getScoreColor } from '../../utils/scoreColors';
import { clsx } from 'clsx';

interface RepoCardProps {
  repo: IRepository;
}

export function RepoCard({ repo }: RepoCardProps) {
  const navigate = useNavigate();

  return (
    <button
      onClick={() => navigate(`/repos/${repo.id}`)}
      className="card text-left transition-all hover:shadow-md hover:border-blue-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 overflow-hidden">
          <p className="truncate text-sm font-semibold text-gray-900">{repo.fullName}</p>
          <div className="mt-1 flex items-center gap-2">
            {repo.language && (
              <span className="badge bg-gray-100 text-gray-600">{repo.language}</span>
            )}
            <span className="badge bg-gray-100 text-gray-600">{repo.scanFrequency}</span>
          </div>
        </div>
        <ScoreBadge grade={repo.latestGrade || '?'} size="md" />
      </div>

      <div className="mt-4 flex items-end justify-between">
        <div>
          <p className={clsx('text-2xl font-bold', repo.latestScore != null ? getScoreColor(repo.latestScore) : 'text-gray-300')}>
            {repo.latestScore != null ? Math.round(repo.latestScore) : '--'}
          </p>
          <p className="text-xs text-gray-500">
            Scanned {formatRelative(repo.lastScannedAt)}
          </p>
        </div>
        <TrendSparkline repoId={repo.id} width={80} height={32} />
      </div>
    </button>
  );
}
