import { useQuery } from '@tanstack/react-query';
import { listBackends, getBackendDetails } from '../api/endpoints';
import { useUIStore } from '../store/uiStore';

export const useBackends = (forceUpdate: boolean = false) => {
  const { activeUserId } = useUIStore();
  
  return useQuery({
    queryKey: ['backends', forceUpdate, activeUserId],
    queryFn: () => listBackends(forceUpdate),
    refetchInterval: 30000,
    enabled: !!activeUserId,
  });
};

export const useBackendDetails = (backendName: string | null) => {
  const { activeUserId } = useUIStore();
  
  return useQuery({
    queryKey: ['backend-details', backendName, activeUserId],
    queryFn: () => getBackendDetails(backendName!),
    enabled: !!backendName && !!activeUserId,
  });
};