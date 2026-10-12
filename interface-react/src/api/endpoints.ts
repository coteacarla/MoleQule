import { apiClient } from './client';
import type {
  MoleculeBuildRequest,
  MoleculeBuildResponse,
  ScfRunRequest,
  ScfRunResponse,
  ActiveSpaceSetupRequest,
  ActiveSpaceSetupResponse,
  IntegralsComputeResponse,
  CircuitBuildResponse,
  TranspileCircuitRequest,
  TranspileCircuitResponse,
  Viz2DRequest,
  Viz2DResponse,
  Viz3DResponse,
  CredentialsSaveRequest,
  CredentialsSaveResponse,
  CredentialsLoadResponse,
  BackendsListResponse,
  Backend,
  JobSubmitRequest,
  JobSubmitResponse,
  JobStatus,
  JobListResponse,
  JobCheckResponse,
  HealthResponse,
  JobVisualizationResponse,
} from './models';

// Health
export const getHealth = async (): Promise<HealthResponse> => {
  const { data } = await apiClient.get<HealthResponse>('/health');
  return data;
};

// Job Visualizations
export const getJobVisualization = async (jobId: string): Promise<JobVisualizationResponse> => {
  const { data } = await apiClient.get<JobVisualizationResponse>(`/api/v1/jobs/visualize/${jobId}`);
  return data;
};

// Molecule
export const buildMolecule = async (
  request: MoleculeBuildRequest
): Promise<MoleculeBuildResponse> => {
  const { data } = await apiClient.post<MoleculeBuildResponse>(
    '/api/v1/molecule/build',
    request
  );
  return data;
};

// SCF
export const runScf = async (request: ScfRunRequest): Promise<ScfRunResponse> => {
  // SCF can take time for larger molecules
  const { data } = await apiClient.post<ScfRunResponse>(
    '/api/v1/scf/run',
    request,
    { timeout: 120000 } // 2 minutes
  );
  return data;
};

// Active Space
export const setupActiveSpace = async (
  request: ActiveSpaceSetupRequest
): Promise<ActiveSpaceSetupResponse> => {
  const { data } = await apiClient.post<ActiveSpaceSetupResponse>('/api/v1/active-space/setup', request);
  return data;
};

// Integrals (CELL3)
export const computeIntegrals = async (
  session_id: string,
  max_iter?: number,
  molecule_name?: string
): Promise<IntegralsComputeResponse> => {
  // Integrals computation can take time for larger molecules
  const { data } = await apiClient.post('/api/v1/integrals/compute', 
    { 
      session_id,
      max_iter: max_iter || 200,
      molecule_name
    },
    { timeout: 120000 } // 2 minutes
  );
  return data;
};

export const restoreIntegrals = async (
  session_id: string,
  molecule_name: string,
  basis: string
): Promise<IntegralsComputeResponse> => {
  const { data } = await apiClient.post('/api/v1/integrals/restore', {
    session_id,
    molecule_name,
    basis
  });
  return data;
};

// Circuit
export const buildCircuit = async (
  session_id: string,
  n_reps: number = 1
): Promise<CircuitBuildResponse> => {
  // Circuit building can take a VERY long time (JAX compilation, VQE setup, etc.)
  // Use extended timeout of 15 minutes for complex molecules
  const { data } = await apiClient.post('/api/v1/circuit/build', 
    { session_id, n_reps },
    { timeout: 900000 } // 15 minutes
  );
  return data;
};

export const restoreCircuit = async (
  session_id: string,
  molecule_name: string,
  basis: string
): Promise<CircuitBuildResponse> => {
  const { data } = await apiClient.post('/api/v1/circuit/restore', {
    session_id,
    molecule_name,
    basis
  });
  return data;
};

export const transpileCircuit = async (
  request: TranspileCircuitRequest
): Promise<TranspileCircuitResponse> => {
  const { data} = await apiClient.post<TranspileCircuitResponse>(
    '/api/v1/circuit/transpile',
    request
  );
  return data;
};

// Visualization
export const visualizeMolecule2D = async (
  request: Viz2DRequest
): Promise<Viz2DResponse> => {
  const { data } = await apiClient.post<Viz2DResponse>(
    '/api/v1/visualization/molecule/2d',
    request
  );
  return data;
};

export const visualizeMolecule3D = async (
  xyz_data: string
): Promise<Viz3DResponse> => {
  const { data } = await apiClient.post<Viz3DResponse>(
    '/api/v1/visualization/molecule/3d',
    { xyz_data }
  );
  return data;
};

// Credentials
export const saveCredentials = async (
  request: CredentialsSaveRequest
): Promise<CredentialsSaveResponse> => {
  const { data } = await apiClient.post<CredentialsSaveResponse>('/api/v1/credentials/save', request);
  return data;
};

export const loadCredentials = async (
  user_id: string
): Promise<CredentialsLoadResponse> => {
  const { data } = await apiClient.get<CredentialsLoadResponse>(
    '/api/v1/credentials/load',
    { params: { user_id } }
  );
  return data;
};

export const getCredentials = async (
  user_id: string
): Promise<{ status: string; user_id: string; crn: string; has_token: boolean }> => {
  const { data } = await apiClient.get(
    '/api/v1/credentials/get',
    { params: { user_id } }
  );
  return data;
};

export const updateCredentials = async (
  request: { old_user_id: string; new_user_id?: string; crn?: string }
): Promise<{ status: string; user_id: string }> => {
  const { data } = await apiClient.post('/api/v1/credentials/update', request);
  return data;
};

export const deleteCredentials = async (user_id: string): Promise<{ status: string }> => {
  const { data } = await apiClient.post('/api/v1/credentials/delete', { user_id });
  return data;
};

// Backends
export const listBackends = async (
  force_update: boolean = false
): Promise<BackendsListResponse> => {
  const { data } = await apiClient.get<BackendsListResponse>('/api/v1/backends/list', {
    params: { force_update },
  });
  return data;
};

export const getOptimalBackend = async (
  min_qubits: number = 0
): Promise<{ status: string; optimal_backend: Backend | null }> => {
  const { data } = await apiClient.get('/api/v1/backends/optimal', {
    params: { min_qubits },
  });
  return data;
};

export const getBackendDetails = async (
  backend_name: string
): Promise<{ backend: Backend }> => {
  const { data } = await apiClient.get(`/api/v1/backends/details/${backend_name}`);
  return data;
};

// Jobs
export const submitJob = async (
  request: JobSubmitRequest
): Promise<JobSubmitResponse> => {
  const { data } = await apiClient.post<JobSubmitResponse>('/api/v1/jobs/submit', request);
  return data;
};

export const retrieveJobs = async (session_id?: string): Promise<JobStatus[]> => {
  if (!session_id) {
    return [];
  }
  
  try {
    const { data } = await apiClient.get('/api/v1/jobs/retrieve', {
      params: { session_id },
    });
    // Backend returns a single job object, not an array
    // Wrap it in an array for consistency
    return data ? [data] : [];
  } catch (error: any) {
    // If 404, it means no job exists yet - return empty array
    if (error?.response?.status === 404) {
      return [];
    }
    throw error;
  }
};

export const getJobStatus = async (session_id: string): Promise<JobStatus> => {
  const { data } = await apiClient.get('/api/v1/jobs/status', {
    params: { session_id },
  });
  return data;
};

export const listJobs = async (user_id: string): Promise<JobListResponse> => {
  const { data } = await apiClient.get<JobListResponse>('/api/v1/jobs/list', {
    params: { user_id },
  });
  return data;
};

export const checkJobStatus = async (job_id: string, user_id: string): Promise<JobCheckResponse> => {
  const { data } = await apiClient.get<JobCheckResponse>(`/api/v1/jobs/check/${job_id}`, {
    params: { user_id },
  });
  return data;
};

export const deleteJob = async (job_id: string): Promise<{ status: string; message: string }> => {
  const { data } = await apiClient.delete(`/api/v1/jobs/delete/${job_id}`);
  return data;
};

// Sessions
export const listSessions = async (): Promise<string[]> => {
  const { data } = await apiClient.get('/api/v1/session/list');
  return data.sessions || [];
};

export const getSessionInfo = async (session_id: string): Promise<any> => {
  const { data } = await apiClient.get('/api/v1/session/info', {
    params: { session_id },
  });
  return data;
};

// SQD
export const processSQD = async (
  request: import('./models').SQDProcessRequest
): Promise<import('./models').SQDProcessResponse> => {
  const { data } = await apiClient.post<import('./models').SQDProcessResponse>(
    '/api/v1/sqd/process',
    request
  );
  return data;
};