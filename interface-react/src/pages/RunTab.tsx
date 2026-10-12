import { BackendGrid } from '../components/Run/BackendGrid';
import { JobControls } from '../components/Run/JobControls';
import { JobsList } from '../components/Run/JobsList';
import { QPUTopology } from '../components/Run/QPUTopology';
import { CircuitMapping } from '../components/Run/CircuitMapping';
import { ResultsPanel } from '../components/Molecule/ResultsPanel';
import { JobResultsVisualization } from '../components/Run/JobResultsVisualization';
import { Button } from '../components/Shared/Button';
import { Spinner } from '../components/Shared/Spinner';
import { useMoleculeWorkflow } from '../hooks/useMolecule';
import { useUIStore } from '../store/uiStore';
import { useQuery } from '@tanstack/react-query';
import { getBackendDetails } from '../api/endpoints';
import { useState, useRef, useEffect } from 'react';
import type { JobData } from '../api/models';

function RunTab() {
  const { selectedBackend } = useUIStore();
  const {
    transpileCircuit,
    currentSessionId,
    scfData,
    activeSpaceData,
    integralsData,
    circuitData,
  } = useMoleculeWorkflow();

  const [selectedJobForVisualization, setSelectedJobForVisualization] = useState<JobData | null>(null);
  const visualizationRef = useRef<HTMLDivElement>(null);

  const { data: backendData } = useQuery({
    queryKey: ['backend-details', selectedBackend],
    queryFn: () => getBackendDetails(selectedBackend!),
    enabled: !!selectedBackend,
  });

  const handleTranspile = () => {
    if (!currentSessionId || !selectedBackend) return;
    
    transpileCircuit.mutate({
      session_id: currentSessionId,
      backend_name: selectedBackend,
      optimization_level: 3,
      use_pre_init: true,
      use_zigzag_layout: true,
    });
  };

  const handleShowVisualization = (job: JobData) => {
    setSelectedJobForVisualization(job);
  };

  useEffect(() => {
    if (selectedJobForVisualization && visualizationRef.current) {
      // Scroll with the visualization centered in view and add some padding at the bottom
      setTimeout(() => {
        visualizationRef.current?.scrollIntoView({ 
          behavior: 'smooth', 
          block: 'center' 
        });
      }, 100);
    }
  }, [selectedJobForVisualization]);

  return (
    <div className="space-y-8">
      {/* Results Panel */}
      <ResultsPanel 
        scfData={scfData}
        activeSpaceData={activeSpaceData}
        integralsData={integralsData}
        circuitData={circuitData}
      />

      {/* Backend Selection Section */}
      <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-2xl shadow-xl border border-gray-700 p-6">
        <div className="flex items-center gap-3 mb-6">
          <h1 className="text-3xl font-bold text-primary-400">
            Quantum Backends
          </h1>
        </div>
        <BackendGrid />
      </div>

      {/* QPU Topology Section */}
      {selectedBackend && (
        <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-2xl shadow-xl border border-gray-700 p-6">
          <div className="flex items-center gap-3 mb-6">
            <h1 className="text-3xl font-bold text-primary-400">
              QPU Topology - {selectedBackend}
            </h1>
          </div>
          <QPUTopology backendName={selectedBackend} />
        </div>
      )}

      {/* Transpile Circuit Section */}
      {currentSessionId && selectedBackend && (
        <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-2xl shadow-xl border border-gray-700 p-6">
          <div className="flex items-center gap-3 mb-6">
            <span className="text-3xl"></span>
            <h1 className="text-3xl font-bold text-primary-400">
              Transpile Circuit
            </h1>
          </div>
          <div className="space-y-4">
            <p className="text-gray-300">
              Transpile your circuit for <span className="font-mono text-primary-400">{selectedBackend}</span> to see the qubit mapping and optimization results.
            </p>
            <Button
              onClick={handleTranspile}
              disabled={transpileCircuit.isPending}
              className="mt-2 py-2 text-sm"
              variant="secondary"
            >
              {transpileCircuit.isPending ? (
                <span className="flex items-center justify-center gap-2">
                  <Spinner /> Transpiling...
                </span>
              ) : (
                <>Transpile Circuit for {selectedBackend}</>
              )}
            </Button>
          </div>
        </div>
      )}

      {/* Circuit Mapping Section */}
      {transpileCircuit.data?.qubit_mapping && selectedBackend && backendData && (
        <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-2xl shadow-xl border border-gray-700 p-6">
          <div className="flex items-center gap-3 mb-6">
            <span className="text-3xl"></span>
            <h1 className="text-3xl font-bold text-primary-400">
              Circuit Mapping on {selectedBackend}
            </h1>
          </div>
          <CircuitMapping
            numQubits={backendData.backend.num_qubits}
            couplingMap={backendData.backend.coupling_map || []}
            qubitErrors={backendData.backend.qubit_errors || []}
            gateErrors={backendData.backend.gate_errors || []}
            qubitMapping={transpileCircuit.data.qubit_mapping}
          />
        </div>
      )}

      {/* Job Controls and Status Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-2xl shadow-xl border border-gray-700 overflow-hidden">
          <div className="bg-gradient-to-r from-gray-700/50 to-gray-800/50 px-6 py-4 border-b border-gray-700">
            <div className="flex items-center gap-3">
              <h2 className="text-xl font-bold text-primary-400">
                Job Controls
              </h2>
            </div>
          </div>
          <div className="p-6">
            <JobControls hasTranspiled={!!transpileCircuit.data} />
          </div>
        </div>

        <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-2xl shadow-xl border border-gray-700 overflow-hidden">
          <div className="bg-gradient-to-r from-gray-700/50 to-gray-800/50 px-6 py-4 border-b border-gray-700">
            <div className="flex items-center gap-3">
              <h2 className="text-xl font-bold text-green-300">
                Job Status
              </h2>
            </div>
          </div>
          <div className="p-6">
            <JobsList onShowVisualization={handleShowVisualization} />
          </div>
        </div>
      </div>

      {/* Job Results Visualization Section */}
      {selectedJobForVisualization && (
        <div 
          ref={visualizationRef}
          className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-2xl shadow-xl border border-gray-700 p-6 min-h-[800px]"
        >
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <span className="text-3xl"></span>
              <h1 className="text-3xl font-bold text-primary-400">
                Job Results - {selectedJobForVisualization.job_id}
              </h1>
            </div>
            <Button
              onClick={() => setSelectedJobForVisualization(null)}
              variant="secondary"
              className="px-4 py-2"
            >
              ✕ Close
            </Button>
          </div>
          <div className="bg-gray-800/50 rounded-lg p-6 min-h-[850px] overflow-auto">
            <JobResultsVisualization job={selectedJobForVisualization} />
          </div>
        </div>
      )}
    </div>
  );
}

export default RunTab;