import { ExternalLink, RefreshCw } from 'lucide-react';
import type { IRepository, IRepoScoreSnapshot } from '../../types';
import { ScoreGauge } from './ScoreGauge';
import { formatRelative } from '../../utils/formatDate';
import { useScanStatus } from '../../hooks/useScanStatus';
import { clsx } from 'clsx';

interface RepoHeaderProps {
  repo: IRepository;
  score: IRepoScoreSnapshot | null;
}

export function RepoHeader({ repo, score }: RepoHeaderProps) {
  const { isScanning, status, startScan } = useScanStatus(repo.id);

  return (
    <div className="card flex flex-col gap-6 sm:flex-row sm:items-center">
      <ScoreGauge score={score?.compositeScore ?? null} grade={score?.grade ?? null} size={96} />
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <h2 className="text-xl font-bold text-gray-900">{repo.fullName}</h2>
          <a
            href={`https://github.com/${repo.fullName}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-gray-400 hover:text-gray-600"
          >
            <ExternalLink className="h-4 w-4" />
          </a>
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-gray-500">
          <span>Scanned {formatRelative(repo.lastScannedAt)}</span>
          <span className="text-gray-300">|</span>
          <span className="badge bg-gray-100 text-gray-600">{repo.scanFrequency}</span>
          {repo.language && <span className="badge bg-blue-50 text-blue-700">{repo.language}</span>}
          {repo.isPrivate && <span className="badge bg-yellow-50 text-yellow-700">Private</span>}
        </div>
        {score && (
          <div className="mt-2 flex gap-4 text-xs text-gray-500">
            <span>{score.totalDependencies} dependencies</span>
            <span>{score.vulnerableCount} vulnerable</span>
            <span>{score.deprecatedCount} deprecated</span>
            <span>{score.outdatedCount} outdated</span>
          </div>
        )}
      </div>
      <button
        onClick={() => startScan()}
        disabled={isScanning}
        className={clsx('btn-primary gap-2 self-start', isScanning && 'opacity-50')}
      >
        <RefreshCw className={clsx('h-4 w-4', isScanning && 'animate-spin')} />
        {isScanning ? `${status}...` : 'Scan Now'}
      </button>
    </div>
  );
}
