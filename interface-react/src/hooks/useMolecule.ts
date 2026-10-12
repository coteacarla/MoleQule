import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import {
  buildMolecule,
  runScf,
  setupActiveSpace,
  computeIntegrals,
  buildCircuit,
  transpileCircuit,
} from '../api/endpoints';
import { useUIStore } from '../store/uiStore';
import { showToast } from '../components/Shared/Toast';
import type { MoleculeBuildRequest, ActiveSpaceSetupRequest, TranspileCircuitRequest } from '../api/models';
import type { ActiveSpaceConfig } from '../components/Molecule/ActiveSpaceConfigurator';

export const useMoleculeWorkflow = () => {
  const { currentSessionId, setCurrentSessionId } = useUIStore();
  const queryClient = useQueryClient();

  const { data: scfData } = useQuery({
    queryKey: ['workflow', currentSessionId, 'scf'],
    enabled: false, // Don't auto-fetch, only get from cache
    staleTime: Infinity, // Never mark as stale
  });

  const { data: activeSpaceData } = useQuery({
    queryKey: ['workflow', currentSessionId, 'activeSpace'],
    enabled: false,
    staleTime: Infinity,
  });

  const { data: integralsData } = useQuery({
    queryKey: ['workflow', currentSessionId, 'integrals'],
    enabled: false,
    staleTime: Infinity,
  });

  const { data: circuitData } = useQuery({
    queryKey: ['workflow', currentSessionId, 'circuit'],
    enabled: false,
    staleTime: Infinity,
  });

  const { data: transpileData } = useQuery({
    queryKey: ['workflow', currentSessionId, 'transpile'],
    enabled: false,
    staleTime: Infinity,
  });

  const buildMoleculeMutation = useMutation({
    mutationFn: (request: MoleculeBuildRequest) => buildMolecule(request),
    onSuccess: (data) => {
      setCurrentSessionId(data.session_id);
      showToast.success(`Molecule built: ${data.natom} atoms, ${data.nbasis} basis functions`);
    },
    onError: (error: Error) => {
      showToast.error(`Failed to build molecule: ${error.message}`);
    },
  });

  const runScfMutation = useMutation({
    mutationFn: () => runScf({ session_id: currentSessionId }),
    onSuccess: (data) => {
      // Cache the SCF data so it persists across tabs
      queryClient.setQueryData(['workflow', currentSessionId, 'scf'], data);
      
      const energy = data.energy || data.scf_energy;
      if (energy !== undefined) {
        showToast.success(`SCF completed: Energy = ${energy.toFixed(6)} Ha`);
      } else {
        showToast.success('SCF calculation completed');
      }
    },
    onError: (error: Error) => {
      showToast.error(`SCF failed: ${error.message}`);
    },
  });

  const setupActiveSpaceMutation = useMutation({
    mutationFn: (config: ActiveSpaceConfig) => {
      // Convert frontend config to backend request format
      const request: ActiveSpaceSetupRequest = {
        session_id: currentSessionId,
        mode: config.mode,
        nelec_mode: 'manual',
        manual_nelec: [config.n_alpha, config.n_beta],
      };

      // Add mode-specific parameters
      if (config.mode === 'homo_lumo') {
        request.n_below_homo = config.n_below_homo;
        request.n_above_lumo = config.n_above_lumo;
      } else if (config.mode === 'range') {
        request.act_start = config.act_start;
        request.act_stop = config.act_stop;
      } else if (config.mode === 'explicit') {
        request.explicit_orbs = config.explicit_orbs;
      }

      return setupActiveSpace(request);
    },
    onSuccess: (data) => {
      // Cache the active space data
      queryClient.setQueryData(['workflow', currentSessionId, 'activeSpace'], data);
      
      const totalElectrons = data.total_electrons || data.n_electrons;
      showToast.success(`Active space set: ${data.num_orbitals} orbitals, ${totalElectrons} electrons (α=${data.n_alpha}, β=${data.n_beta})`);
    },
    onError: (error: Error) => {
      showToast.error(`Active space setup failed: ${error.message}`);
    },
  });

  const computeIntegralsMutation = useMutation({
    mutationFn: (params?: { max_iter?: number; molecule_name?: string }) => 
      computeIntegrals(currentSessionId, params?.max_iter, params?.molecule_name),
    onSuccess: (data) => {
      // Cache the integrals data
      queryClient.setQueryData(['workflow', currentSessionId, 'integrals'], data);
      
      if (data.ccsd_energy) {
        showToast.success(`Integrals computed & saved to CELL3: CCSD Energy = ${data.ccsd_energy.toFixed(6)} Ha`);
      } else {
        showToast.success('Integrals computed & saved to CELL3');
      }
    },
    onError: (error: Error) => {
      console.error('[useMolecule] Integrals error:', error);
      const errorMsg = error.message || '';
      console.error('[useMolecule] Error message:', errorMsg);
      
      if (errorMsg.includes('Chunk shape') || errorMsg.includes('virtual orbital')) {
        showToast.error(
          'Integrals failed: Active space has no virtual orbitals. ' +
          'Reconfigure active space with fewer electrons or more orbitals.'
        );
      } else if (errorMsg.toLowerCase().includes('singular')) {
        showToast.error(
          'CCSD failed: Singular matrix error. ' +
          'Try using more electrons, or select orbitals closer to HOMO/LUMO (use Style C mode).'
        );
      } else {
        showToast.error(`Integrals computation failed: ${error.message}`);
      }
    },
  });

  const buildCircuitMutation = useMutation({
    mutationFn: () => buildCircuit(currentSessionId),
    onSuccess: (data) => {
      // Cache the circuit data
      queryClient.setQueryData(['workflow', currentSessionId, 'circuit'], data);
      
      showToast.success(`Circuit built: ${data.num_qubits} qubits, depth ${data.depth}`);
    },
    onError: (error: Error) => {
      showToast.error(`Circuit building failed: ${error.message}`);
    },
  });

  const transpileCircuitMutation = useMutation({
    mutationFn: (request: TranspileCircuitRequest) => transpileCircuit(request),
    onSuccess: (data) => {
      // Cache the transpile data
      queryClient.setQueryData(['workflow', currentSessionId, 'transpile'], data);
      
      showToast.success(`Circuit transpiled: ${data.num_qubits} qubits, depth ${data.depth}`);
    },
    onError: (error: Error) => {
      showToast.error(`Transpilation failed: ${error.message}`);
    },
  });

  return {
    buildMolecule: buildMoleculeMutation,
    runScf: runScfMutation,
    setupActiveSpace: setupActiveSpaceMutation,
    computeIntegrals: computeIntegralsMutation,
    buildCircuit: buildCircuitMutation,
    transpileCircuit: transpileCircuitMutation,
    currentSessionId,
    // Return cached data so it persists across tabs
    scfData,
    activeSpaceData,
    integralsData,
    circuitData,
    transpileData,
  };
};