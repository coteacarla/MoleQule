import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { submitJob, retrieveJobs, getJobStatus, listJobs, checkJobStatus, deleteJob } from '../api/endpoints';
import { useUIStore } from '../store/uiStore';
import { showToast } from '../components/Shared/Toast';
import type { JobSubmitRequest } from '../api/models';

export const useJobs = (sessionId?: string) => {
  const queryClient = useQueryClient();
  const activeUserId = useUIStore((s) => s.activeUserId);

  const { data: jobs, ...rest } = useQuery({
    queryKey: ['jobs', activeUserId, sessionId],
    queryFn: () => retrieveJobs(sessionId),
    enabled: !!activeUserId && !!sessionId,
    refetchInterval: 5000,
    retry: false,
  });

  const submitJobMutation = useMutation({
    mutationFn: (request: JobSubmitRequest) => submitJob(request),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
      queryClient.invalidateQueries({ queryKey: ['job-list'] });
      const jobId = data.job_id || 'unknown';
      showToast.success(`Job submitted successfully! Job ID: ${jobId}`);
    },
    onError: (error: any) => {
      const errorMsg = error?.response?.data?.error || error.message;
      if (errorMsg.includes('credentials')) {
        showToast.error('IBM Quantum credentials not configured. Please set up your API token first.');
      } else if (errorMsg.includes('circuit') || errorMsg.includes('transpile')) {
        showToast.error(`Circuit not ready: ${errorMsg}`);
      } else {
        showToast.error(`Failed to submit job: ${errorMsg}`);
      }
    },
  });

  return {
    jobs,
    submitJob: submitJobMutation,
    ...rest,
  };
};

export const useJobStatus = (jobId: string) => {
  return useQuery({
    queryKey: ['job-status', jobId],
    queryFn: () => getJobStatus(jobId),
    enabled: !!jobId,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status === 'RUNNING' || status === 'QUEUED' ? 2000 : false;
    },
  });
};

// New hook for listing all jobs for a user
export const useJobList = () => {
  const activeUserId = useUIStore((s) => s.activeUserId);

  return useQuery({
    queryKey: ['job-list', activeUserId],
    queryFn: () => listJobs(activeUserId!),
    enabled: !!activeUserId,
    refetchInterval: (query) => {
      const jobs = query.state.data?.jobs || [];
      // Auto-refresh every 5 seconds if any jobs are pending
      const hasPending = jobs.some(job => 
        job.status === 'QUEUED' || job.status === 'RUNNING'
      );
      return hasPending ? 5000 : false;
    },
  });
};

// Hook for checking individual job status
export const useCheckJobStatus = () => {
  const queryClient = useQueryClient();
  const activeUserId = useUIStore((s) => s.activeUserId);

  return useMutation({
    mutationFn: (jobId: string) => checkJobStatus(jobId, activeUserId!),
    onSuccess: (data) => {
      // Update the job list cache with new data if available
      if (data.job_data) {
        queryClient.setQueryData(['job-list', activeUserId], (old: any) => {
          if (!old?.jobs) return old;
          
          return {
            ...old,
            jobs: old.jobs.map((job: any) => 
              job.job_id === data.job_id ? data.job_data : job
            )
          };
        });
      }
      
      // Also invalidate to ensure fresh data
      queryClient.invalidateQueries({ queryKey: ['job-list'] });
      
      if (data.job_status === 'DONE') {
        showToast.success(`Job ${data.job_id} completed successfully!`);
      } else {
        showToast.info(`Job ${data.job_id} status: ${data.job_status}`);
      }
    },
    onError: (error: any) => {
      const errorMsg = error?.response?.data?.error || error.message;
      showToast.error(`Failed to check job status: ${errorMsg}`);
    },
  });
};

// Hook for deleting a job
export const useDeleteJob = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (jobId: string) => deleteJob(jobId),
    onSuccess: (_data, jobId) => {
      // Invalidate job list to refresh
      queryClient.invalidateQueries({ queryKey: ['job-list'] });
      showToast.success(`Job ${jobId} deleted successfully`);
    },
    onError: (error: any) => {
      const errorMsg = error?.response?.data?.error || error.message;
      showToast.error(`Failed to delete job: ${errorMsg}`);
    },
  });
};