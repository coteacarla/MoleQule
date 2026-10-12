import { MoleculeEditor } from '../components/Molecule/MoleculeEditor';
import { ResultsPanel } from '../components/Molecule/ResultsPanel';
import { Toast, showToast } from '../components/Shared/Toast';
import { Viz2D } from '../components/Molecule/Viz2D';
import { Viz3D } from '../components/Molecule/Viz3D';
import { HistoryBar } from '../components/Molecule/HistoryBar';
import { useMoleculeVisualization } from '../hooks/useVisualization';
import { useMoleculeWorkflow } from '../hooks/useMolecule';
import { useUIStore } from '../store/uiStore';
import { useHistoryStore, type HistoryEntry } from '../store/historyStore';
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { restoreIntegrals, restoreCircuit } from '../api/endpoints';
import { Button } from '../components/Shared/Button';

function MoleculeTab() {
  const navigate = useNavigate();
  const { currentXYZ, setCurrentXYZ, currentSessionId, pendingHistoryLoad, setPendingHistoryLoad, setCurrentMolecule } = useUIStore();
  const { getEntry } = useHistoryStore();
  const [loadedEntry, setLoadedEntry] = useState<HistoryEntry | null>(null);
  const [sessionRecreated, setSessionRecreated] = useState(false);

  const { viz2D, viz3D } = useMoleculeVisualization(currentXYZ, !!currentSessionId && !!currentXYZ);
  
  const workflowHooks = useMoleculeWorkflow();
  const {
    runScf,
    setupActiveSpace,
    computeIntegrals,
    buildCircuit,
    buildMolecule,
    scfData,
    activeSpaceData,
    integralsData,
    circuitData,
  } = workflowHooks;

  const handleLoadHistoryEntry = (entry: HistoryEntry) => {
    // First set the loaded entry so MoleculeEditor can show the simulated states
    setLoadedEntry(entry);
    setCurrentXYZ(entry.xyzData);
    setSessionRecreated(false);

    setCurrentMolecule({
      name: entry.name,
      xyzData: entry.xyzData,
      basis: entry.basis,
      charge: entry.charge ?? 0,
      spin: entry.spin ?? 0,
    });

    // Automatically recreate backend session so user can continue immediately
    const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    buildMolecule.mutate(
      {
        xyz_data: entry.xyzData,
        basis: entry.basis,
        charge: entry.charge ?? 0,
        spin: entry.spin ?? 0,
        session_id: sessionId,
      },
      {
        onSuccess: () => {
          // Restore backend state in correct order: SCF first, then active space
          // (active space requires SCF to be completed)
          if (entry.scfCompleted) {
            runScf.mutate(undefined, {
              onSuccess: () => {
                // After SCF, restore active space if it was configured
                if (entry.activeSpace && entry.activeSpaceConfigured) {
                  setupActiveSpace.mutate(entry.activeSpace, {
                    onSuccess: async (activeSpaceResult) => {
                      // After active space, try to restore integrals from storage first
                      const activeSpace = entry.activeSpace;
                      const totalElectrons = activeSpace ? ((activeSpace.n_alpha || 0) + (activeSpace.n_beta || 0)) : 0;
                      const numOrbitals = activeSpaceResult?.num_orbitals || 0;
                      const hasVirtualOrbitals = totalElectrons < 2 * numOrbitals;
                      
                      if (entry.integralsComputed && hasVirtualOrbitals) {
                        try {
                          // Try to restore from storage (CELL3) first
                          console.log(`[RESTORE] Attempting to restore integrals from storage for ${entry.name}/${entry.basis}`);
                          const restoredIntegrals = await restoreIntegrals(sessionId, entry.name, entry.basis);
                          console.log('[RESTORE] Integrals restored from storage successfully!', restoredIntegrals);
                          showToast.success('Integrals restored from saved data');
                          
                          // If circuit was also built, try to restore it too
                          if (entry.circuitBuilt) {
                            try {
                              console.log(`[RESTORE] Attempting to restore circuit from storage`);
                              const restoredCircuit = await restoreCircuit(sessionId, entry.name, entry.basis);
                              console.log('[RESTORE] Circuit restored from storage successfully!', restoredCircuit);
                              showToast.success('Circuit restored from saved data');
                              setSessionRecreated(true);
                            } catch (circuitErr) {
                              console.log('[RESTORE] Circuit not found in storage, rebuilding...', circuitErr);
                              // If circuit restore fails, rebuild it
                              buildCircuit.mutate(undefined, {
                                onSuccess: () => {
                                  showToast.success('Circuit rebuilt successfully');
                                  setSessionRecreated(true);
                                },
                                onError: (buildErr: any) => {
                                  console.error('Failed to rebuild circuit', buildErr);
                                  showToast.warning('Circuit could not be rebuilt. Please build manually.');
                                  setSessionRecreated(true);
                                }
                              });
                            }
                          } else {
                            setSessionRecreated(true);
                          }
                        } catch (err: any) {
                          console.error('[RESTORE] Failed to restore integrals from storage:', err);
                          console.error('[RESTORE] Error details:', err.response?.data || err.message);
                          console.log('[RESTORE] Will attempt to recompute integrals...');
                          // If storage restore fails, recompute
                          computeIntegrals.mutate(undefined, {
                            onSuccess: () => {
                              // After recomputing integrals, rebuild circuit if it was built before
                              if (entry.circuitBuilt) {
                                buildCircuit.mutate(undefined, {
                                  onSuccess: () => {
                                    showToast.success('Circuit rebuilt successfully');
                                    setSessionRecreated(true);
                                  },
                                  onError: (buildErr: any) => {
                                    console.error('Failed to rebuild circuit', buildErr);
                                    showToast.warning('Circuit could not be rebuilt. Please build manually.');
                                    setSessionRecreated(true);
                                  }
                                });
                              } else {
                                setSessionRecreated(true);
                              }
                            },
                            onError: (computeErr: any) => {
                              console.error('Failed to recompute integrals', computeErr);
                              const errorMsg = computeErr?.message || 'Unknown error';
                              if (errorMsg.includes('Chunk shape') || errorMsg.includes('virtual orbital')) {
                                showToast.error(
                                  'Integrals failed: Active space has no virtual orbitals. ' +
                                  'Reduce electrons or increase orbitals, then reconfigure active space and try again.'
                                );
                              } else {
                                showToast.warning('Integrals could not be restored. Please recompute manually.');
                              }
                              setSessionRecreated(true);
                            }
                          });
                        }
                      } else {
                        if (entry.integralsComputed && !hasVirtualOrbitals) {
                          showToast.warning(
                            'Active space from history has no virtual orbitals. ' +
                            'Skipped integrals restoration. Please reconfigure active space with fewer electrons.'
                          );
                        }
                        setSessionRecreated(true);
                      }
                    },
                    onError: (err: any) => {
                      console.error('Failed to restore active space from history', err);
                      // Show toast to inform user they need to reconfigure active space
                      showToast.warning('Active space from history could not be restored. Please configure it manually.');
                      setSessionRecreated(true); // Still mark as recreated so user can proceed
                    }
                  });
                } else {
                  setSessionRecreated(true);
                }
              },
              onError: (err: any) => {
                console.error('Failed to restore SCF state from history', err);
                setSessionRecreated(true); // Still mark as recreated so user can proceed
              }
            });
          } else {
            // No additional state to restore
            setSessionRecreated(true);
          }
        },
        onError: (err: any) => {
          console.error('Failed to recreate session from history', err);
        },
      }
    );
  };

  // Check for pending history load when component mounts or when pendingHistoryLoad changes
  useEffect(() => {
    if (pendingHistoryLoad) {
      const entry = getEntry(pendingHistoryLoad);
      if (entry) {
        // Load the entry
        handleLoadHistoryEntry(entry);
      }
      // Clear the pending load
      setPendingHistoryLoad(null);
    }
  }, [pendingHistoryLoad, getEntry, setPendingHistoryLoad]);

  return (
    <div className="space-y-8">
      {/* History Bar */}
      <HistoryBar onLoadEntry={handleLoadHistoryEntry} />
      
      <MoleculeEditor 
        onMoleculeBuild={setCurrentXYZ} 
        loadedEntry={loadedEntry}
        sessionRecreated={sessionRecreated}
        workflowHooks={workflowHooks}
      />
      {/* Results Panel */}
      <ResultsPanel 
        scfData={scfData}
        activeSpaceData={activeSpaceData}
        integralsData={integralsData}
        circuitData={loadedEntry?.circuitResult ?? circuitData}
        circuitFromHistory={!!loadedEntry?.circuitResult}
      />
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 2D Visualization Card */}
        <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-2xl shadow-xl border border-gray-700 overflow-hidden">
          <div className="bg-gradient-to-r from-gray-700/50 to-gray-800/50 px-6 py-4 border-b border-gray-700">
            <div className="flex items-center gap-3">
              <h2 className="text-xl font-bold text-green-300">
                2D Structure
              </h2>
            </div>
          </div>
          <div className="p-6 h-96">
            <Viz2D
              svgContent={viz2D.data?.image_base64 || viz2D.data?.image}
              isLoading={viz2D.isLoading}
              error={viz2D.error}
            />
          </div>
        </div>

        {/* 3D Visualization Card */}
        <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-2xl shadow-xl border border-gray-700 overflow-hidden">
          <div className="bg-gradient-to-r from-gray-700/50 to-gray-800/50 px-6 py-4 border-b border-gray-700">
            <div className="flex items-center gap-3">
              <h2 className="text-xl font-bold text-green-300">
                3D Model
              </h2>
            </div>
          </div>
          <div className="p-6 h-96 bg-white">
            <Viz3D
              atoms={viz3D.data?.atoms || []}
              bonds={viz3D.data?.bonds || []}
              isLoading={viz3D.isLoading}
              error={viz3D.error}
            />
          </div>
        </div>
      </div>
      
      {/* Navigation to Run Page */}
      <div className="flex justify-center pt-6 pb-4">
        <Button
          onClick={() => navigate('/run')}
          className="mt-2 py-2 text-sm"
          variant="secondary"
        >
          → Proceed to Run & Results
        </Button>
      </div>
      
      <Toast />
    </div>
  );
}

export default MoleculeTab;