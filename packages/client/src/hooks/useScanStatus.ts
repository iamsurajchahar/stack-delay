import { useState, useCallback, useRef, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { triggerScan, getScan } from '../api/scans';

interface ScanProgress {
  status: 'idle' | 'pending' | 'scanning' | 'enriching' | 'scoring' | 'completed' | 'failed';
  progress: number;
  error: string | null;
}

const STATUS_PROGRESS: Record<string, number> = {
  pending: 10,
  scanning: 30,
  enriching: 55,
  scoring: 80,
  completed: 100,
  failed: 0,
};

export function useScanStatus(repoId: string) {
  const [state, setState] = useState<ScanProgress>({
    status: 'idle',
    progress: 0,
    error: null,
  });
  const qc = useQueryClient();
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const scanIdRef = useRef<string | null>(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, []);

  const startPolling = useCallback((scanId: string) => {
    scanIdRef.current = scanId;

    // Poll the real scan status from the server
    pollingRef.current = setInterval(async () => {
      try {
        const scan = await getScan(repoId, scanId);
        if (!scan) return;

        const scanStatus = scan.status as ScanProgress['status'];
        // Prefer the real percentage the server reports while enriching
        const reported = typeof scan.progress === 'number' ? scan.progress : 0;
        const progress = reported > 0 ? reported : STATUS_PROGRESS[scanStatus] ?? 0;

        setState({ status: scanStatus, progress, error: null });

        if (scanStatus === 'completed') {
          if (pollingRef.current) clearInterval(pollingRef.current);

          // Refresh all related data
          qc.invalidateQueries({ queryKey: ['repos'] });
          qc.invalidateQueries({ queryKey: ['repos', repoId] });
          qc.invalidateQueries({ queryKey: ['scores', repoId] });
          qc.invalidateQueries({ queryKey: ['recommendations', repoId] });
          qc.invalidateQueries({ queryKey: ['dashboard'] });

          // Reset to idle after a moment
          setTimeout(() => {
            setState({ status: 'idle', progress: 0, error: null });
          }, 3000);
        } else if (scanStatus === 'failed') {
          if (pollingRef.current) clearInterval(pollingRef.current);
          setState({
            status: 'failed',
            progress: 0,
            error: scan.errorMessage || 'Scan failed',
          });
        }
      } catch {
        // Silently continue polling on transient errors
      }
    }, 3000);
  }, [repoId, qc]);

  const startScan = useMutation({
    mutationFn: () => triggerScan(repoId),
    onMutate: () => {
      setState({ status: 'pending', progress: 10, error: null });
    },
    onSuccess: (scan: any) => {
      const id = scan?.id || scan?._id || '';
      startPolling(id);
    },
    onError: (err: any) => {
      setState({
        status: 'failed',
        progress: 0,
        error: err?.response?.data?.message || err.message || 'Scan failed',
      });
    },
  });

  const reset = useCallback(() => {
    if (pollingRef.current) clearInterval(pollingRef.current);
    setState({ status: 'idle', progress: 0, error: null });
  }, []);

  return {
    ...state,
    isScanning: !['idle', 'completed', 'failed'].includes(state.status),
    startScan: startScan.mutate,
    reset,
  };
}
