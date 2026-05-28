import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { listRepos, getRepo, connectRepo, deleteRepo, listAvailable } from '../api/repos';

export function useRepos() {
  return useQuery({
    queryKey: ['repos'],
    queryFn: listRepos,
  });
}

export function useRepo(id: string) {
  return useQuery({
    queryKey: ['repos', id],
    queryFn: () => getRepo(id),
    enabled: !!id,
  });
}

export function useAvailableRepos() {
  return useQuery({
    queryKey: ['repos', 'available'],
    queryFn: listAvailable,
  });
}

export function useConnectRepo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: connectRepo,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['repos'] });
    },
  });
}

export function useDeleteRepo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: deleteRepo,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['repos'] });
    },
  });
}
