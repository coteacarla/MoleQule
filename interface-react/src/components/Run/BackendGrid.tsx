import { useBackends } from '../../hooks/useBackends';
import { useUIStore } from '../../store/uiStore';
import { BackendCard } from './BackendCard';
import { Spinner } from '../Shared/Spinner';
import { showToast } from '../Shared/Toast';
import { Button } from '../Shared/Button';
import { getOptimalBackend } from '../../api/endpoints';
import { useState } from 'react';

export const BackendGrid: React.FC = () => {
  const { data, isLoading, error, refetch, isFetching } = useBackends();
  const { selectedBackend, setSelectedBackend } = useUIStore();
  const [loadingOptimal, setLoadingOptimal] = useState(false);

  const handleSelectBackend = (backendName: string) => {
    setSelectedBackend(backendName);
    showToast.success(`Backend selected: ${backendName}`);
  };

  const handleSelectLeastBusy = async () => {
    try {
      setLoadingOptimal(true);
      const response = await getOptimalBackend(0);
      
      if (response.optimal_backend) {
        setSelectedBackend(response.optimal_backend.name);
        showToast.success(
          `Least busy backend selected: ${response.optimal_backend.name} (${response.optimal_backend.pending_jobs} jobs in queue)`
        );
      } else {
        showToast.error('No operational backends available');
      }
    } catch (err) {
      showToast.error('Failed to get least busy backend');
      console.error('Error getting optimal backend:', err);
    } finally {
      setLoadingOptimal(false);
    }
  };

  const handleRefreshBackends = async () => {
    try {
      await refetch();
      showToast.success('Backends refreshed');
    } catch (err) {
      showToast.error('Failed to refresh backends');
      console.error('Error refreshing backends:', err);
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Spinner />
      </div>
    );
  }

  if (error) {
    return <div className="text-red-500">Failed to load backends: {error.message}</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-left gap-4 mb-4">
        <Button
          onClick={handleSelectLeastBusy}
          disabled={loadingOptimal || !data?.backends.length}
          className="bg-gray-600 hover:bg-gray-700"
        >
          {loadingOptimal ? (
            <span className="flex items-center gap-2">
              <Spinner /> Select Least Busy
            </span>
          ) : (
            'Select Least Busy'
          )}
        </Button>
        <Button
          onClick={handleRefreshBackends}
          disabled={isFetching}
          className="bg-gray-600 hover:bg-gray-700"
        >
          {isFetching ? (
            <span className="flex items-center gap-2">
              <Spinner /> Refreshing
            </span>
          ) : (
            <span className="flex items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clipRule="evenodd" />
              </svg>
              Refresh
            </span>
          )}
        </Button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {data?.backends.map((backend) => (
          <BackendCard
            key={backend.name}
            backend={backend}
            isSelected={backend.name === selectedBackend}
            onSelect={() => handleSelectBackend(backend.name)}
          />
        ))}
      </div>
    </div>
  );
};