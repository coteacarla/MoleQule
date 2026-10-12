import React, { useState, useCallback, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import { useMoleculeWorkflow } from '../../hooks/useMolecule';
import { Button } from '../Shared/Button';
import { Spinner } from '../Shared/Spinner';
import { showToast } from '../Shared/Toast';
import { parseXYZ, validateXYZ } from '../../utils/xyzParser';
import { hashString } from '../../utils/hash';
import { useUIStore } from '../../store/uiStore';
import { useHistoryStore, type HistoryEntry } from '../../store/historyStore';
import { BasisSetSelector } from './BasisSetSelector';
import { ActiveSpaceConfigurator, type ActiveSpaceConfig } from './ActiveSpaceConfigurator';

interface MoleculeEditorProps {
  onMoleculeBuild?: (xyz: string) => void;
  loadedEntry?: HistoryEntry | null;
  sessionRecreated?: boolean;
  // Optional: allow parent to pass workflow hooks to share state
  workflowHooks?: ReturnType<typeof useMoleculeWorkflow>;
}

export const MoleculeEditor: React.FC<MoleculeEditorProps> = ({ 
  onMoleculeBuild, 
  loadedEntry, 
  sessionRecreated,
  workflowHooks,
}) => {
  const [xyzData, setXyzData] = useState('');
  const [basis, setBasis] = useState('6-31g');
  const [charge] = useState(0);
  const [spin] = useState(0);
  const [activeSpaceConfig, setActiveSpaceConfig] = useState<ActiveSpaceConfig | null>(null);
  const [moleculeName, setMoleculeName] = useState('');
  const [maxIterCCSD, setMaxIterCCSD] = useState(200);
  
  // Track simulated completion states from loaded history
  const [simulatedStates, setSimulatedStates] = useState({
    moleculeBuilt: false,
    scfCompleted: false,
    activeSpaceConfigured: false,
    integralsComputed: false,
    circuitBuilt: false,
  });
  
  const [isLoadedFromHistory, setIsLoadedFromHistory] = useState(false);
  // Track if active space was explicitly reconfigured after loading from history
  const [activeSpaceReconfigured, setActiveSpaceReconfigured] = useState(false);
  // Track the actual backend active space configuration for validation
  const [backendActiveSpace, setBackendActiveSpace] = useState<{
    numOrbitals: number;
    totalElectrons: number;
  } | null>(null);

  // Load entry from history
  useEffect(() => {
    if (loadedEntry) {
      setXyzData(loadedEntry.xyzData);
      setBasis(loadedEntry.basis);
      setMoleculeName(loadedEntry.name);
      if (loadedEntry.activeSpace) {
        setActiveSpaceConfig(loadedEntry.activeSpace);
      }
      if (loadedEntry.maxIterCCSD) {
        setMaxIterCCSD(loadedEntry.maxIterCCSD);
      }
      
      // Set simulated completion states based on loaded entry
      setSimulatedStates({
        moleculeBuilt: true,
        scfCompleted: loadedEntry.scfCompleted || false,
        activeSpaceConfigured: loadedEntry.activeSpaceConfigured || false,
        integralsComputed: loadedEntry.integralsComputed || false,
        circuitBuilt: loadedEntry.circuitBuilt || false,
      });
      
      setIsLoadedFromHistory(true);
      setActiveSpaceReconfigured(false); // Reset when loading from history
      showToast.success(`Loaded: ${loadedEntry.name}`);
    }
  }, [loadedEntry]);

  // When session is recreated from history, clear the warning banner
  useEffect(() => {
    if (sessionRecreated && isLoadedFromHistory) {
      setIsLoadedFromHistory(false);
    }
  }, [sessionRecreated, isLoadedFromHistory]);

  // Use provided workflow hooks or create new ones
  const localWorkflowHooks = useMoleculeWorkflow();
  const {
    buildMolecule,
    runScf,
    setupActiveSpace,
    computeIntegrals,
    buildCircuit,
    currentSessionId,
  } = workflowHooks || localWorkflowHooks;
  
  const { cacheXYZ, cachedXYZs, setCurrentMolecule } = useUIStore();
  const { addEntry, updateEntry, findEntryByMolecule } = useHistoryStore();
  
  // Update backend active space when setupActiveSpace succeeds (including from history restoration)
  useEffect(() => {
    if (setupActiveSpace.isSuccess && setupActiveSpace.data) {
      setBackendActiveSpace({
        numOrbitals: setupActiveSpace.data.num_orbitals || 0,
        totalElectrons: setupActiveSpace.data.total_electrons || setupActiveSpace.data.n_electrons || 0,
      });
    }
  }, [setupActiveSpace.isSuccess, setupActiveSpace.data]);

  // When a backend session is created (either by manual build or when MoleculeTab recreated
  // a session after loading history), hide the "loaded from history" banner so users can
  // proceed without seeing the warning.
  useEffect(() => {
    if ((buildMolecule as any).isSuccess && isLoadedFromHistory) {
      setIsLoadedFromHistory(false);
      showToast.success('Session recreated — you can now run pipeline steps');
    }
  }, [(buildMolecule as any).isSuccess, isLoadedFromHistory]);

  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      const file = acceptedFiles[0];
      if (file) {
        const content = await file.text();
        const hash = await hashString(content);
        
        // Extract filename without extension as molecule name
        const filename = file.name.replace(/\.xyz$/i, '');
        setMoleculeName(filename);

        if (cachedXYZs[hash]) {
          setXyzData(cachedXYZs[hash].xyz);
          showToast.success('Loaded molecule from cache.');
          return;
        }

        const parsed = parseXYZ(content);
        if (parsed && validateXYZ(parsed.xyz)) {
          setXyzData(parsed.xyz);
          cacheXYZ(hash, parsed.xyz, hash);
          showToast.success('Molecule file loaded and validated.');
        } else {
          showToast.error('Invalid .xyz file format.');
        }
      }
    },
    [cacheXYZ, cachedXYZs]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'text/plain': ['.xyz'] },
  });

  const handleBuildMolecule = () => {
    if (!xyzData) {
      showToast.error('XYZ data is required.');
      return;
    }
    
    // Reset simulated states when building a new molecule manually
    setSimulatedStates({
      moleculeBuilt: false,
      scfCompleted: false,
      activeSpaceConfigured: false,
      integralsComputed: false,
      circuitBuilt: false,
    });
    
    setIsLoadedFromHistory(false);
    
    // Generate a unique session ID
    const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const name = moleculeName || `Molecule ${new Date().toLocaleTimeString()}`;
    
    buildMolecule.mutate({
      xyz_data: xyzData,
      basis,
      charge: 0,
      spin: 0,
      session_id: sessionId,
    }, {
      onSuccess: () => {
        // Save to history
        addEntry({
          name,
          xyzData,
          basis,
          charge: 0,
          spin: 0,
          scfCompleted: false,
        });
        
        // Save molecule data to UI store for job submission
        setCurrentMolecule({
          name,
          xyzData,
          basis,
          charge: 0,
          spin: 0,
        });
        
        if (onMoleculeBuild) {
          onMoleculeBuild(xyzData);
        }
      },
    });
  };

  const handleActiveSpaceConfigure = (config: ActiveSpaceConfig) => {
    setActiveSpaceConfig(config);
    setActiveSpaceReconfigured(true); // Mark that active space was explicitly configured
    setupActiveSpace.mutate(config, {
      onSuccess: (data) => {
        // Store backend active space configuration for validation
        setBackendActiveSpace({
          numOrbitals: data.num_orbitals || 0,
          totalElectrons: data.total_electrons || data.n_electrons || 0,
        });
        
        // Update history with active space config
        addEntry({
          name: moleculeName || `Molecule ${new Date().toLocaleTimeString()}`,
          xyzData,
          basis,
          charge: 0,
          spin: 0,
          scfCompleted: runScf.isSuccess,
          activeSpaceConfigured: true,
          activeSpace: {
            mode: config.mode,
            n_alpha: config.n_alpha,
            n_beta: config.n_beta,
            n_below_homo: config.n_below_homo,
            n_above_lumo: config.n_above_lumo,
            act_start: config.act_start,
            act_stop: config.act_stop,
            explicit_orbs: config.explicit_orbs,
          },
          scfEnergy: runScf.data?.scf_energy || runScf.data?.energy,
        });
      },
    });
  };

  // Save circuit result into history so user doesn't need to rebuild later
  const handleBuildCircuit = () => {
    // call mutation and save result on success
    buildCircuit.mutate(undefined, {
      onSuccess: (data: any) => {
        try {
          const match = findEntryByMolecule(xyzData, basis);
          const circuitResult = {
            num_qubits: data.num_qubits,
            depth: data.depth,
            gate_counts: data.gate_counts,
            metadata: { n_reps: data.n_reps },
          };

          if (match) {
            updateEntry(match.id, {
              circuitBuilt: true,
              circuitResult,
              numQubits: data.num_qubits,
              circuitDepth: data.depth,
            });
          } else {
            // If no matching history entry, add a new one with circuit result
            addEntry({
              name: moleculeName || `Molecule ${new Date().toLocaleTimeString()}`,
              xyzData,
              basis,
              charge: 0,
              spin: 0,
              scfCompleted: runScf.isSuccess,
              activeSpaceConfigured: setupActiveSpace.isSuccess,
              integralsComputed: computeIntegrals.isSuccess,
              circuitBuilt: true,
              circuitResult,
              scfEnergy: runScf.data?.scf_energy || runScf.data?.energy,
              ccsdEnergy: computeIntegrals.data?.ccsd_energy,
              numQubits: data.num_qubits,
              circuitDepth: data.depth,
            });
          }

          showToast.success('Circuit built and saved to history');
        } catch (e) {
          console.error('Failed to save circuit to history', e);
        }
      },
      onError: (err: any) => {
        showToast.error(`Circuit build failed: ${err?.message || err}`);
      },
    });
  };

  return (
    <div className="card space-y-6">
      <div className="flex flex-col items-center mb-6">
        <h2 className="text-2xl font-bold text-primary-400">Define Molecule</h2>
      </div>

      <div className="flex justify-center mb-6">
        <div
          {...getRootProps()}
          className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all w-full max-w-xl ${
            isDragActive ? 'border-primary-500 bg-primary-900/20 scale-105' : 'border-gray-600 hover:border-primary-500/50 hover:bg-gray-800/50'
          } shadow-lg`}
        >
          <input {...getInputProps()} />
          <div className="flex flex-col items-center gap-3">
            <div className="w-16 h-16 mx-auto">
              <svg viewBox="0 0 24 24" className="w-full h-full text-gray-600" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
              </svg>
            </div>
            {isDragActive ? (
              <p className="text-lg text-primary-400 font-medium">Drop your molecule file here...</p>
            ) : (
              <>
                <p className="text-base font-medium">Drag & drop a .xyz file here</p>
                <Button variant="secondary" className="mt-2 py-2 text-sm">
                  Click to browse
                </Button>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-300">
            Configuration Name (optional)
            {moleculeName && (
              <span className="ml-2 text-xs text-green-400">• Auto-filled from file</span>
            )}
          </label>
          <input
            type="text"
            value={moleculeName}
            onChange={(e) => setMoleculeName(e.target.value)}
            placeholder="Auto-fills from .xyz filename, or enter custom name"
            className="input-field w-full"
          />
        </div>

        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-300">Or paste XYZ data:</label>
          <textarea
            value={xyzData}
            onChange={(e) => setXyzData(e.target.value)}
            placeholder="H 0.0 0.0 0.0&#10;H 0.0 0.0 0.74"
            className="input-field w-full h-48 font-mono text-sm resize-none"
          />
        </div>

        <div className="grid grid-cols-1 gap-4">
          <BasisSetSelector
            value={basis}
            onChange={setBasis}
            disabled={buildMolecule.isPending}
          />
        </div>

        <div className="flex items-center justify-between pt-4 border-t border-gray-700">
        <div className="flex items-center space-x-4">
          <Button onClick={handleBuildMolecule} disabled={buildMolecule.isPending || !xyzData}
           className="
                        inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium
                        border border-gray-500
                        bg-green-400 text-white hover:bg-green-500
                        disabled:border-gray-600 disabled:bg-gray-700 disabled:text-gray-300 disabled:cursor-not-allowed
                        transition-colors"
          >
            {buildMolecule.isPending ? (
              <span className="flex items-center gap-2">
                <Spinner />
                Building...
              </span>
            ) : (
              <span className="flex items-center gap-2">
                 Build Molecule
              </span>
            )}
          </Button>
          {(buildMolecule.isSuccess || simulatedStates.moleculeBuilt) && (
            <div className="flex items-center gap-2 text-green-300">
              <span className="text-sm">Molecule built successfully</span>
            </div>
          )}
        </div>
        {currentSessionId && (
          <div className="text-xs">
            <span className="text-gray-500">Session:</span>
            <span className="ml-2 font-mono text-gray-400">{currentSessionId}</span>
          </div>
        )}
      </div>
      </div>

      {(buildMolecule.isSuccess || simulatedStates.moleculeBuilt) && (
        <div className="space-y-4 pt-6 border-t border-gray-700">
          <div className="flex items-center gap-3">
            <h3 className="text-xl font-bold text-primary-400">Quantum Pipeline</h3>
          </div>
          
          {/* Warning banner for loaded history - hide once session is recreated */}
          {isLoadedFromHistory && !sessionRecreated && (
            <div className="bg-yellow-900/20 border border-yellow-500/50 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <div className="flex-1">
                  <h4 className="font-medium text-yellow-300 mb-1">Configuration Loaded from History</h4>
                  <p className="text-sm text-yellow-200/80 mb-3">
                    This is a saved configuration. To run calculations, please rebuild the molecule first by clicking the "Build Molecule" button above.
                  </p>
                  <p className="text-xs text-yellow-200/60">
                    The workflow steps below are shown for reference based on your previous session.
                  </p>
                </div>
              </div>
            </div>
          )}
          
          {/* Step 1: Run SCF */}
          <div className="space-y-3">
            <Button 
              onClick={() => runScf.mutate()} 
              disabled={runScf.isPending || (isLoadedFromHistory && !sessionRecreated)}
              variant="secondary"
              className="w-full flex items-center justify-center gap-2 h-16"
            >
              {runScf.isPending ? <Spinner /> : (
                <span className="text-lg font-medium">Run SCF Calculation</span>
              )}
            </Button>
            {(runScf.isSuccess || simulatedStates.scfCompleted) && (
              <div className="text-sm text-green-400 flex items-center gap-2">
                <span>SCF calculation completed successfully</span>
              </div>
            )}
          </div>

          {/* Step 2: Configure Active Space (shown after SCF completes) */}
          {(runScf.isSuccess || simulatedStates.scfCompleted) && (
            <div className="pt-4">
              <ActiveSpaceConfigurator
                onConfigure={handleActiveSpaceConfigure}
                disabled={setupActiveSpace.isPending || (isLoadedFromHistory && !sessionRecreated)}
              />
              {(setupActiveSpace.isSuccess || simulatedStates.activeSpaceConfigured) && (
                <div className="mt-3 text-sm text-green-400 flex items-center gap-2">
                  <span>Active space configured successfully</span>
                </div>
              )}
            </div>
          )}

          {/* Step 3 & 4: Compute Integrals and Build Circuit (shown after Active Space) */}
          {(setupActiveSpace.isSuccess || simulatedStates.activeSpaceConfigured) && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-4">
              {/* Warning if loaded from history and active space not reconfigured */}
              {isLoadedFromHistory && sessionRecreated && !activeSpaceReconfigured && (
                <div className="col-span-full bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3 mb-2">
                  <div className="flex items-start gap-2">
                    <div className="flex-1">
                      <p className="text-yellow-200 text-sm font-medium">Active Space Needs Reconfiguration</p>
                      <p className="text-yellow-200/70 text-xs mt-1">
                        Click "Configure Active Space" above to apply the current settings before computing integrals.
                      </p>
                    </div>
                  </div>
                </div>
              )}
              
              {/* Warning if active space has no virtual orbitals */}
              {backendActiveSpace && backendActiveSpace.totalElectrons >= 2 * backendActiveSpace.numOrbitals && (
                <div className="col-span-full bg-red-500/10 border border-red-500/30 rounded-lg p-3 mb-2">
                  <div className="flex items-start gap-2">
                    <div className="flex-1">
                      <p className="text-red-200 text-sm font-medium">Invalid Active Space Configuration</p>
                      <p className="text-red-200/70 text-xs mt-1">
                        Current: {backendActiveSpace.totalElectrons} electrons in {backendActiveSpace.numOrbitals} orbitals (max capacity: {2 * backendActiveSpace.numOrbitals} electrons).
                        CCSD requires at least 1 virtual orbital. Please reconfigure with fewer electrons or more orbitals.
                      </p>
                    </div>
                  </div>
                </div>
              )}
              
              {/* Additional warning about SCF occupancies */}
              <div className="col-span-full bg-blue-500/10 border border-blue-500/30 rounded-lg p-3 mb-2">
                <div className="flex items-start gap-2">
                  <div className="flex-1">
                    <p className="text-blue-200 text-sm font-medium">Important: Virtual Orbitals Required</p>
                    <p className="text-blue-200/70 text-xs mt-1">
                      CCSD needs at least 1 <strong>unoccupied</strong> orbital in your active space based on SCF results.
                      If you get errors, try: (1) Increase orbital range (e.g., [0, 15) instead of [0, 10)), or (2) Use fewer electrons, or (3) Select orbitals that include LUMOs.
                    </p>
                  </div>
                </div>
              </div>
              
              {/* CCSD Max Iterations Input */}
              <div className="col-span-full">
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  CCSD Max Iterations
                </label>
                <input
                  type="number"
                  min="50"
                  max="500"
                  step="50"
                  value={maxIterCCSD}
                  onChange={(e) => setMaxIterCCSD(parseInt(e.target.value) || 200)}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="200"
                />
                <p className="text-xs text-gray-400 mt-1">
                  Number of iterations for CCSD convergence (default: 200)
                </p>
              </div>
              
              <Button 
                onClick={() => {
                  // Validate before computing
                  console.log('[MoleculeEditor] Compute Integrals clicked');
                  console.log('[MoleculeEditor] backendActiveSpace:', backendActiveSpace);
                  console.log('[MoleculeEditor] isLoadedFromHistory:', isLoadedFromHistory);
                  console.log('[MoleculeEditor] sessionRecreated:', sessionRecreated);
                  console.log('[MoleculeEditor] activeSpaceReconfigured:', activeSpaceReconfigured);
                  
                  if (backendActiveSpace) {
                    const hasVirtual = backendActiveSpace.totalElectrons < 2 * backendActiveSpace.numOrbitals;
                    console.log('[MoleculeEditor] Virtual orbitals check:', {
                      totalElectrons: backendActiveSpace.totalElectrons,
                      numOrbitals: backendActiveSpace.numOrbitals,
                      maxCapacity: 2 * backendActiveSpace.numOrbitals,
                      hasVirtual
                    });
                    
                    if (!hasVirtual) {
                      showToast.error('Cannot compute integrals: No virtual orbitals. Reconfigure active space first.');
                      return;
                    }
                  } else {
                    console.warn('[MoleculeEditor] backendActiveSpace is null - validation skipped!');
                  }
                  
                  console.log('[MoleculeEditor] Validation passed, calling computeIntegrals...');
                  computeIntegrals.mutate({ 
                    max_iter: maxIterCCSD,
                    molecule_name: moleculeName || undefined 
                  }, {
                    onSuccess: () => {
                      // Update history to mark integrals as computed
                      const match = findEntryByMolecule(xyzData, basis);
                      if (match) {
                        updateEntry(match.id, { 
                          integralsComputed: true,
                          maxIterCCSD: maxIterCCSD 
                        });
                      } else {
                        addEntry({
                          name: moleculeName || `Molecule ${new Date().toLocaleTimeString()}`,
                          xyzData,
                          basis,
                          charge: 0,
                          spin: 0,
                          scfCompleted: runScf.isSuccess,
                          activeSpaceConfigured: setupActiveSpace.isSuccess,
                          integralsComputed: true,
                          maxIterCCSD: maxIterCCSD,
                          activeSpace: activeSpaceConfig ? {
                            mode: activeSpaceConfig.mode,
                            n_alpha: activeSpaceConfig.n_alpha,
                            n_beta: activeSpaceConfig.n_beta,
                            n_below_homo: activeSpaceConfig.n_below_homo,
                            n_above_lumo: activeSpaceConfig.n_above_lumo,
                            act_start: activeSpaceConfig.act_start,
                            act_stop: activeSpaceConfig.act_stop,
                            explicit_orbs: activeSpaceConfig.explicit_orbs,
                          } : undefined,
                          scfEnergy: runScf.data?.scf_energy || runScf.data?.energy,
                        });
                      }
                    }
                  });
                }} 
                disabled={
                  computeIntegrals.isPending || 
                  (isLoadedFromHistory && !sessionRecreated) ||
                  (isLoadedFromHistory && sessionRecreated && !activeSpaceReconfigured) ||
                  (backendActiveSpace !== null && backendActiveSpace.totalElectrons >= 2 * backendActiveSpace.numOrbitals)
                }
                variant="secondary"
                className="flex flex-col items-center justify-center gap-2 h-24"
              >
                {computeIntegrals.isPending ? <Spinner /> : (
                  <span className="text-sm font-medium">Compute Integrals (CELL3)</span>
                )}
              </Button>
              <Button 
                onClick={handleBuildCircuit} 
                disabled={
                  buildCircuit.isPending || 
                  (isLoadedFromHistory && !sessionRecreated) ||
                  (isLoadedFromHistory && sessionRecreated && !activeSpaceReconfigured) ||
                  (!computeIntegrals.isSuccess && !simulatedStates.integralsComputed)
                }
                variant="secondary"
                className="flex flex-col items-center justify-center gap-2 h-24"
              >
                {buildCircuit.isPending ? <Spinner /> : (
                  <span className="text-sm font-medium">Build Circuit</span>
                )}
              </Button>
            </div>
          </>
          )}
          
          {/* Status indicators */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs pt-4">
            <div className={`p-2 rounded-lg ${(runScf.isSuccess || simulatedStates.scfCompleted) ? 'bg-green-900/30 text-green-300' : 'bg-gray-800 text-gray-500'}`}>
              {(runScf.isSuccess || simulatedStates.scfCompleted) ? 'SCF Complete' : 'SCF Pending'}
            </div>
            <div className={`p-2 rounded-lg ${(setupActiveSpace.isSuccess || simulatedStates.activeSpaceConfigured) ? 'bg-green-900/30 text-green-300' : 'bg-gray-800 text-gray-500'}`}>
              {(setupActiveSpace.isSuccess || simulatedStates.activeSpaceConfigured) ? 'Active Space Set' : 'Active Space Pending'}
            </div>
            <div className={`p-2 rounded-lg ${(computeIntegrals.isSuccess || simulatedStates.integralsComputed) ? 'bg-green-900/30 text-green-300' : 'bg-gray-800 text-gray-500'}`}>
              {(computeIntegrals.isSuccess || simulatedStates.integralsComputed) ? 'Integrals Computed' : 'Integrals Pending'}
            </div>
            <div className={`p-2 rounded-lg ${(buildCircuit.isSuccess || simulatedStates.circuitBuilt) ? 'bg-green-900/30 text-green-300' : 'bg-gray-800 text-gray-500'}`}>
              {(buildCircuit.isSuccess || simulatedStates.circuitBuilt) ? 'Circuit Ready' : 'Circuit Pending'}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};