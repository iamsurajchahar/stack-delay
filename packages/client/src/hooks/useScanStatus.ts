import { useEffect, useState, useCallback, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { triggerScan } from '../api/scans';

interface ScanProgress {
  status: 'idle' | 'pending' | 'scanning' | 'enriching' | 'scoring' | 'completed' | 'failed';
  progress: number;
  error: string | null;
}

export function useScanStatus(repoId: string) {
  const [state, setState] = useState<ScanProgress>({
    status: 'idle',
    progress: 0,
    error: null,
  });
  const socketRef = useRef<Socket | null>(null);
  const qc = useQueryClient();

  useEffect(() => {
    if (!repoId) return;

    const socket = io(window.location.origin, {
      path: '/api/ws',
      transports: ['websocket', 'polling'],
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      socket.emit('subscribe:scan', repoId);
    });

    socket.on('scan:progress', (data: { repoId: string; status: string; progress: number }) => {
      if (data.repoId === repoId) {
        setState({
          status: data.status as ScanProgress['status'],
          progress: data.progress,
          error: null,
        });
      }
    });

    socket.on('scan:completed', (data: { repoId: string }) => {
      if (data.repoId === repoId) {
        setState({ status: 'completed', progress: 100, error: null });
        qc.invalidateQueries({ queryKey: ['repos', repoId] });
        qc.invalidateQueries({ queryKey: ['scores', repoId] });
      }
    });

    socket.on('scan:failed', (data: { repoId: string; error: string }) => {
      if (data.repoId === repoId) {
        setState({ status: 'failed', progress: 0, error: data.error });
      }
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [repoId, qc]);

  const startScan = useMutation({
    mutationFn: () => triggerScan(repoId),
    onMutate: () => {
      setState({ status: 'pending', progress: 0, error: null });
    },
    onError: (err: Error) => {
      setState({ status: 'failed', progress: 0, error: err.message });
    },
  });

  const reset = useCallback(() => {
    setState({ status: 'idle', progress: 0, error: null });
  }, []);

  return {
    ...state,
    isScanning: !['idle', 'completed', 'failed'].includes(state.status),
    startScan: startScan.mutate,
    reset,
  };
}
