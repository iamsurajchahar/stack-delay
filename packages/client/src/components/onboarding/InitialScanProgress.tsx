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
}

const STATUS_PROGRESS: Record<string, number> = {
  pending: 10,
  scanning: 30,
  enriching: 55,
  scoring: 80,
  completed: 100,
  failed: 0,
};

export function InitialScanProgress({ repoIds, repos, onComplete }: Props) {
  const [scans, setScans] = useState<ScanState[]>(
    repoIds.map((id, i) => ({
      repoId: id,
      name: repos?.[i]?.full_name || repos?.[i]?.name || `Repository ${i + 1}`,
      status: 'pending',
      progress: 10,
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
          const progress = STATUS_PROGRESS[status] ?? 10;

          setScans((prev) =>
            prev.map((s, i) =>
              i === idx ? { ...s, status, progress } : s
            )
          );

          if (status === 'completed' || status === 'failed') {
            clearInterval(interval);
          }
        } catch {
          // Silently continue polling on transient errors
        }
      }, 2500);

      intervals.push(interval);
    });

    intervalsRef.current = intervals;
    return () => intervals.forEach(clearInterval);
  }, [repoIds]);

  const statusLabels: Record<string, string> = {
    pending: 'Waiting...',
    scanning: 'Scanning manifests...',
    enriching: 'Enriching dependencies...',
    scoring: 'Computing scores...',
    completed: 'Complete',
    failed: 'Failed',
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-gray-900">Initial Scan</h2>
        <p className="text-sm text-gray-500 mt-1">
          Scanning {repoIds.length} {repoIds.length === 1 ? 'repository' : 'repositories'}. This may take a few minutes.
        </p>
      </div>

      <div className="space-y-3">
        {scans.map((scan) => (
          <div key={scan.repoId} className="border rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-900">{scan.name}</span>
              <div className="flex items-center gap-2">
                {scan.status === 'completed' ? (
                  <CheckCircle className="w-4 h-4 text-green-500" />
                ) : scan.status === 'failed' ? (
                  <AlertCircle className="w-4 h-4 text-red-500" />
                ) : scan.status !== 'pending' ? (
                  <Loader2 className="w-4 h-4 text-indigo-500 animate-spin" />
                ) : null}
                <span className="text-xs text-gray-500">{statusLabels[scan.status]}</span>
              </div>
            </div>
            <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
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

      <div className="text-center text-sm text-gray-500">
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
