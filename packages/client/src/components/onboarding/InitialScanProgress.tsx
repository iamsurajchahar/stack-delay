import { useEffect, useRef, useState } from 'react';
import { CheckCircle, Loader2, AlertCircle } from 'lucide-react';
import { getLatestScan } from '../../api/scans';

interface Props {
  repoIds: string[];
  repos?: any[];
  onComplete: () => void;
}

interface ScanState {
  repoId: string;
  name: string;
  status: 'pending' | 'scanning' | 'enriching' | 'scoring' | 'completed' | 'failed';
  progress: number;
  dependencyCount: number;
}

/** Fallback bar position for servers that don't report a progress percentage. */
const STATUS_PROGRESS: Record<string, number> = {
  pending: 10,
  scanning: 30,
  enriching: 55,
  scoring: 80,
  completed: 100,
  failed: 0,
};

const POLL_INTERVAL_MS = 1500;

export function InitialScanProgress({ repoIds, repos, onComplete }: Props) {
  const [scans, setScans] = useState<ScanState[]>(
    repoIds.map((id, i) => ({
      repoId: id,
      name: repos?.[i]?.full_name || repos?.[i]?.name || `Repository ${i + 1}`,
      status: 'pending',
      progress: 10,
      dependencyCount: 0,
    }))
  );
  const intervalsRef = useRef<ReturnType<typeof setInterval>[]>([]);

  const allComplete = scans.length > 0 && scans.every((s) => s.status === 'completed' || s.status === 'failed');
  const completedCount = scans.filter((s) => s.status === 'completed').length;

  useEffect(() => {
    // Poll real scan status from the server for each repo
    const intervals: ReturnType<typeof setInterval>[] = [];

    repoIds.forEach((repoId, idx) => {
      const interval = setInterval(async () => {
        try {
          const scan = await getLatestScan(repoId);
          if (!scan) return;

          const status = scan.status as ScanState['status'];
          // The server reports a real percentage while enriching; fall back to
          // the coarse per-status positions if it isn't there.
          const reported = typeof scan.progress === 'number' ? scan.progress : 0;
          const progress = reported > 0 ? reported : STATUS_PROGRESS[status] ?? 10;
          const dependencyCount = scan.dependencyCount ?? 0;

          setScans((prev) =>
            prev.map((s, i) =>
              i === idx
                ? {
                    ...s,
                    status,
                    dependencyCount,
                    // Never let the bar jump backwards between polls
                    progress: status === 'failed' ? 0 : Math.max(s.progress, progress),
                  }
                : s
            )
          );

          if (status === 'completed' || status === 'failed') {
            clearInterval(interval);
          }
        } catch {
          // Silently continue polling on transient errors
        }
      }, POLL_INTERVAL_MS);

      intervals.push(interval);
    });

    intervalsRef.current = intervals;
    return () => intervals.forEach(clearInterval);
  }, [repoIds]);

  const statusLabel = (scan: ScanState): string => {
    switch (scan.status) {
      case 'pending':
        return 'Waiting...';
      case 'scanning':
        return 'Scanning manifests...';
      case 'enriching':
        return scan.dependencyCount > 0
          ? `Checking ${scan.dependencyCount} dependencies...`
          : 'Enriching dependencies...';
      case 'scoring':
        return 'Computing scores...';
      case 'completed':
        return 'Complete';
      case 'failed':
        return 'Failed';
      default:
        return '';
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-gray-900 dark:text-white">Initial Scan</h2>
        <p className="text-sm text-gray-500 mt-1 dark:text-gray-400">
          Scanning {repoIds.length} {repoIds.length === 1 ? 'repository' : 'repositories'}. This may take a few minutes.
        </p>
      </div>

      <div className="space-y-3">
        {scans.map((scan) => (
          <div key={scan.repoId} className="border border-gray-200 rounded-lg p-4 dark:border-gray-700">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-900 dark:text-white">{scan.name}</span>
              <div className="flex items-center gap-2">
                {scan.status === 'completed' ? (
                  <CheckCircle className="w-4 h-4 text-green-500" />
                ) : scan.status === 'failed' ? (
                  <AlertCircle className="w-4 h-4 text-red-500" />
                ) : (
                  <Loader2 className="w-4 h-4 text-indigo-500 animate-spin" />
                )}
                <span className="text-xs text-gray-500 dark:text-gray-400">{statusLabel(scan)}</span>
              </div>
            </div>
            <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden dark:bg-gray-700">
              <div
                className={`h-2 rounded-full transition-all duration-500 ${
                  scan.status === 'completed'
                    ? 'bg-green-500'
                    : scan.status === 'failed'
                      ? 'bg-red-500'
                      : 'bg-indigo-500'
                }`}
                style={{ width: `${scan.progress}%` }}
              />
            </div>
          </div>
        ))}
      </div>

      <div className="text-center text-sm text-gray-500 dark:text-gray-400">
        {completedCount} of {scans.length} complete
      </div>

      {allComplete && (
        <div className="flex justify-center pt-4">
          <button
            onClick={onComplete}
            className="px-8 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium transition-colors"
          >
            Go to Dashboard
          </button>
        </div>
      )}
    </div>
  );
}
