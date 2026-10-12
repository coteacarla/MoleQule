// Molecule
export interface MoleculeBuildRequest {
  xyz_data: string;
  basis: string;
  charge: number;
  spin: number;
  session_id: string;
}

export interface MoleculeBuildResponse {
  status: 'success' | 'error';
  session_id: string;
  natom: number;
  nbasis: number;
  nelectron: number;
  error?: string;
}

// SCF
export interface ScfRunRequest {
  session_id: string;
}

export interface ScfRunResponse {
  status: 'success' | 'error';
  energy?: number;
  scf_energy?: number;
  converged?: boolean;
  iterations?: number;
  mo_energy?: number[];
  mo_occ?: number[];
  error?: string;
}

// Active Space
export interface ActiveSpaceSetupRequest {
  session_id: string;
  molecule_name?: string;
  mode: 'homo_lumo' | 'range' | 'explicit';
  // HOMO/LUMO mode (Style C)
  n_below_homo?: number;
  n_above_lumo?: number;
  // Range mode (Style A)
  act_start?: number;
  act_stop?: number;
  // Explicit mode (Style B)
  explicit_orbs?: number[];
  // Electron configuration (always manual now)
  nelec_mode: 'manual';
  manual_nelec: [number, number]; // [n_alpha, n_beta]
}

export interface ActiveSpaceSetupResponse {
  status: 'success' | 'error';
  num_orbitals?: number;
  n_electrons?: number;  // deprecated, use total_electrons
  total_electrons?: number;
  n_alpha?: number;
  n_beta?: number;
  active_orbs?: number[];
  active_orbital_indices?: number[];
  mo_energy_window?: [number, number];
  mode?: string;
  error?: string;
}

// Integrals
export interface IntegralsComputeRequest {
  session_id: string;
  molecule_name?: string;
  max_iter?: number;  // Maximum CCSD iterations (default: 200)
}

export interface IntegralsComputeResponse {
  status: 'success' | 'error';
  ccsd_energy?: number;
  converged?: boolean;
  ccsd_log?: string;  // CCSD convergence log (populated when not converged)
  num_integrals?: number;
  error?: string;
}

export interface CircuitBuildRequest {
  session_id: string;
  n_reps?: number;
}

export interface CircuitBuildResponse {
  status: 'success' | 'error';
  num_qubits?: number;
  depth?: number;
  n_reps?: number;
  gate_counts?: Record<string, number>;
  error?: string;
}

export interface TranspileCircuitRequest {
  session_id: string;
  backend_name: string;
  optimization_level?: number;
  use_pre_init?: boolean;
  use_zigzag_layout?: boolean;
}

export interface TranspileCircuitResponse {
  status: 'success' | 'error';
  num_qubits?: number;
  depth?: number;
  gate_counts?: Record<string, number>;
  optimization_level?: number;
  used_pre_init?: boolean;
  used_zigzag_layout?: boolean;
  num_alpha_beta_qubits?: number;
  initial_layout?: number[];
  qubit_mapping?: Record<number, number>;
  error?: string;
  message?: string;
}

export interface Viz2DRequest {
  xyz_data: string;
  format?: 'png' | 'svg';
}

export interface Viz2DResponse {
  status: 'success' | 'error';
  image?: string;
  image_base64?: string;
  filename?: string;
  filepath?: string;
  error?: string;
}

export interface Atom {
  element: string;
  x: number;
  y: number;
  z: number;
}

export interface Bond {
  atom1: number;
  atom2: number;
  order?: number;
}

export interface Viz3DResponse {
  status: 'success' | 'error';
  atoms?: Atom[];
  bonds?: Bond[];
  error?: string;
}

export interface CredentialsSaveRequest {
  token: string;
  crn: string;
  user_id: string;
}

export interface CredentialsSaveResponse {
  status: string;
  message: string;
  user_id: string;
  backend_monitor_initialized: boolean;
}

export interface CredentialsLoadResponse {
  user_id: string;
  token: string;
  crn: string;
}

export interface Backend {
  name: string;
  num_qubits: number;
  operational: boolean;
  pending_jobs: number;
  status_msg?: string;
  avg_readout_error?: number;
  avg_gate_error?: number;
  coupling_map?: number[][];
  qubit_errors?: Array<{
    qubit: number;
    readout_error: number;
  }>;
  gate_errors?: Array<{
    gate: string;
    qubits: number[];
    error: number;
  }>;
}

export interface BackendDetailsResponse {
  status: 'success' | 'error';
  backend: Backend;
  error?: string;
}

export interface BackendsListResponse {
  status: 'success' | 'error';
  backends: Backend[];
  count: number;
  last_update?: string;
  error?: string;
}

export interface JobSubmitRequest {
  session_id: string;
  backend_name: string;
  shots: number;
  job_id?: string;
  // Molecule information to save with job
  molecule_data?: {
    name?: string;
    xyz_data?: string;
    basis?: string;
    charge?: number;
    spin?: number;
  };
}

export interface JobSubmitResponse {
  status: 'success' | 'error';
  job_id?: string;
  session_id?: string;
  backend_name?: string;
  job_status?: string;
  message?: string;
  error?: string;
}

export interface JobData {
  job_id: string;
  session_id: string;
  backend_name: string;
  shots: number;
  user_id: string;
  status: 'QUEUED' | 'RUNNING' | 'DONE' | 'ERROR' | 'CANCELLED';
  timestamp?: string;
  result?: {
    counts?: Record<string, number>;
    metadata?: Record<string, any>;
  };
  // Molecule information
  molecule_data?: {
    name?: string;
    xyz_data?: string;
    basis?: string;
    charge?: number;
    spin?: number;
  };
}

export interface JobStatus {
  job_id: string;
  status: 'QUEUED' | 'RUNNING' | 'DONE' | 'ERROR' | 'CANCELLED';
  backend?: string;
  shots?: number;
  result?: any;
}

export interface JobListResponse {
  status: 'success' | 'error';
  jobs: JobData[];
  error?: string;
}

export interface JobCheckResponse {
  status: 'success' | 'error';
  job_id: string;
  job_status: string;
  job_data?: JobData;
  error?: string;
}

export interface JobVisualizationResponse {
  status?: string;
  generation_time?: number;
  visualizations?: {
    histogram?: string;
    qsphere?: string;
    state_city?: string;
    bloch_multivector?: string;
    hinton?: string;
  };
  // Also support old format for backward compatibility
  histogram?: string;
  qsphere?: string;
  state_city?: string;
  bloch_multivector?: string;
  hinton?: string;
}

// Health
export interface HealthResponse {
  status: 'ok';
  service?: string;
  credentials?: {
    configured: boolean;
    saved_users: string[];
    active_user: string | null;
  };
  backend_monitor_initialized?: boolean;
  backend_monitor?: {
    running: boolean;
    last_update: string | null;
    backends_count: number;
  };
}

// SQD Types
export interface SQDOptions {
  energy_tol: number;
  occupancies_tol: number;
  max_iterations: number;
}

export interface EigenstateOptions {
  num_batches: number;
  samples_per_batch: number;
  symmetrize_spin: boolean;
  carryover_threshold: number;
  max_cycle: number;
  spin_sq: number;
}

export interface SQDProcessRequest {
  job_id: string;
  session_id: string;
  counts: Record<string, number>;
  exact_energy?: number;
  sqd_options?: Partial<SQDOptions>;
  eigenstate_options?: Partial<EigenstateOptions>;
}

export interface SQDResults {
  final_energy: number;
  nuclear_repulsion_energy: number;
  electronic_energy: number;
  num_iterations: number;
  orbital_occupancies: number[][];
  converged: boolean;
  exact_energy?: number;
  energy_error?: number;
}

export interface SQDPlots {
  energy_error?: string;
  orbital_occupancy: string;
  combined: string;
}

export interface SQDProcessResponse {
  status: 'success' | 'error';
  job_id: string;
  session_id: string;
  results: SQDResults;
  plots: SQDPlots;
  parameters_used: {
    sqd_options: SQDOptions;
    eigenstate_options: EigenstateOptions;
  };
  error?: string;
}
