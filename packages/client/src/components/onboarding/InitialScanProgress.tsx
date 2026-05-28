import { useEffect, useState } from 'react';
import { CheckCircle, Loader2, AlertCircle } from 'lucide-react';

interface Props {
  repoIds: string[];
  onComplete: () => void;
}

interface ScanState {
  repoId: string;
  status: 'pending' | 'scanning' | 'enriching' | 'scoring' | 'completed' | 'failed';
  progress: number;
}

export function InitialScanProgress({ repoIds, onComplete }: Props) {
  const [scans, setScans] = useState<ScanState[]>(
    repoIds.map((id) => ({ repoId: id, status: 'pending', progress: 0 }))
  );

  const allComplete = scans.every((s) => s.status === 'completed' || s.status === 'failed');
  const completedCount = scans.filter((s) => s.status === 'completed').length;

  // Simulate scan progress (in production, this would use WebSocket)
  useEffect(() => {
    const statusFlow: ScanState['status'][] = ['scanning', 'enriching', 'scoring', 'completed'];
    const intervals: NodeJS.Timeout[] = [];

    scans.forEach((scan, idx) => {
      let step = 0;
      const interval = setInterval(() => {
        if (step < statusFlow.length) {
          setScans((prev) =>
            prev.map((s, i) =>
              i === idx
                ? { ...s, status: statusFlow[step], progress: ((step + 1) / statusFlow.length) * 100 }
                : s
            )
          );
          step++;
        } else {
          clearInterval(interval);
        }
      }, 2000 + idx * 800); // Stagger scans
      intervals.push(interval);
    });

    return () => intervals.forEach(clearInterval);
  }, []);

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
          Scanning {repoIds.length} repositories. This may take a few minutes.
        </p>
      </div>

      <div className="space-y-3">
        {scans.map((scan, i) => (
          <div key={scan.repoId} className="border rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-900">Repository {i + 1}</span>
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
            <div className="w-full bg-gray-100 rounded-full h-2">
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
