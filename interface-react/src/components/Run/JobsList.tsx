import { useJobList, useCheckJobStatus, useDeleteJob } from '../../hooks/useJobs';
import { useUIStore } from '../../store/uiStore';
import { Spinner } from '../Shared/Spinner';
import { Button } from '../Shared/Button';
import { clsx } from 'clsx';
import type { JobData } from '../../api/models';

const statusStyles: Record<string, string> = {
  QUEUED: 'bg-yellow-500',
  RUNNING: 'bg-blue-500',
  DONE: 'bg-green-500',
  ERROR: 'bg-red-500',
  CANCELLED: 'bg-gray-500',
};

interface JobsListProps {
  onShowVisualization?: (job: JobData) => void;
}

export const JobsList = ({ onShowVisualization }: JobsListProps) => {
  const activeUserId = useUIStore((s) => s.activeUserId);
  const { data, isLoading, error } = useJobList();
  const checkStatus = useCheckJobStatus();
  const deleteJobMutation = useDeleteJob();

  if (!activeUserId) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-400 mb-2">No active user</p>
        <p className="text-sm text-gray-500">Select a backend to choose a user</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex justify-center">
        <Spinner />
      </div>
    );
  }

  if (error) {
    return <p className="text-red-500">Failed to load jobs: {(error as any).message}</p>;
  }

  const jobs = data?.jobs || [];

  if (jobs.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-400 mb-2">No jobs submitted yet</p>
        <p className="text-sm text-gray-500">Submit a job using the controls on the left</p>
      </div>
    );
  }

  const handleDownloadResults = (job: JobData) => {
    if (!job.result) return;
    
    const dataStr = JSON.stringify(job.result, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr);
    const exportFileDefaultName = `job_${job.job_id}_results.json`;
    
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
  };

  return (
    <div className="space-y-4 relative">
      {jobs.map((job: JobData) => {
        const isPending = job.status === 'QUEUED' || job.status === 'RUNNING';
        const isDone = job.status === 'DONE';
        const hasResults = isDone && job.result;

        return (
          <div 
            key={job.job_id} 
            className="bg-gray-700 rounded-lg overflow-hidden text-base hover:bg-gray-600 transition-colors"
          >
            <div className="p-3 flex justify-between items-center">
              <div className="flex-1">
                <p className="font-mono text-base">{job.job_id}</p>
                <p className="text-sm text-gray-400">{job.backend_name} • {job.shots} shots</p>
                {job.timestamp && (
                  <p className="text-sm text-gray-500">
                    {new Date(job.timestamp).toLocaleString()}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2">
                {(isPending || (isDone && !hasResults)) && (
                  <Button
                    onClick={() => checkStatus.mutate(job.job_id)}
                    disabled={checkStatus.isPending}
                    variant="secondary"
                    className="px-2 py-1 text-sm"
                  >
                    {checkStatus.isPending ? <Spinner /> : isDone ? 'Fetch Results' : 'Refresh'}
                  </Button>
                )}
                {hasResults && (
                  <>
                    <Button
                      onClick={() => onShowVisualization?.(job)}
                      variant="primary"
                      className="px-4 py-2 text-sm font-semibold bg-primary-500 hover:bg-primary-600 active:bg-primary-700 transition-all duration-200 transform hover:scale-105 active:scale-95 shadow-lg hover:shadow-xl"
                    >
                      Show
                    </Button>
                    <Button
                      onClick={() => handleDownloadResults(job)}
                      variant="secondary"
                      className="px-2 py-1 text-sm"
                    >
                      Download
                    </Button>
                  </>
                )}
                <span
                  className={clsx(
                    'px-2 py-1 text-sm font-bold rounded-full text-white',
                    statusStyles[job.status] || 'bg-gray-500'
                  )}
                >
                  {job.status}
                </span>
                <Button
                  onClick={() => deleteJobMutation.mutate(job.job_id)}
                  disabled={deleteJobMutation.isPending}
                  variant="secondary"
                  className="px-2 py-1 text-sm bg-gray-600 hover:bg-gray-700"
                  title="Delete job"
                >
                  {deleteJobMutation.isPending ? <Spinner /> : (
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                    </svg>
                  )}
                </Button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};
