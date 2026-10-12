import { clsx } from 'clsx';

interface ResultsPanelProps {
  scfData?: any;
  activeSpaceData?: any;
  integralsData?: any;
  circuitData?: any;
  circuitFromHistory?: boolean;
}

export const ResultsPanel = ({ scfData, activeSpaceData, integralsData, circuitData, circuitFromHistory }: ResultsPanelProps) => {
  const hasAnyResults = scfData || activeSpaceData || integralsData || circuitData;

  if (!hasAnyResults) {
    return null;
  }

  return (
    <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-2xl shadow-xl border border-gray-700 overflow-hidden">
      <div className="bg-gradient-to-r from-gray-700/50 to-gray-800/50 px-6 py-4 border-b border-gray-700">
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-bold text-primary-400">
            Calculation Results
          </h2>
        </div>
      </div>
      
      <div className="p-6 space-y-6">
        {/* SCF Results */}
        {scfData && (
          <div className="bg-gray-700/50 rounded-lg p-4 border border-gray-600">
            <div className="flex items-center gap-2 mb-3">
              <h3 className="font-bold text-lg text-primary-300">SCF Calculation</h3>
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="bg-gray-800/50 p-3 rounded">
                <div className="text-gray-400 text-xs">Energy (Hartree)</div>
                <div className="font-mono text-lg text-green-400">
                  {scfData.energy?.toFixed(6) || scfData.scf_energy?.toFixed(6) || 'N/A'}
                </div>
              </div>
              <div className="bg-gray-800/50 p-3 rounded">
                <div className="text-gray-400 text-xs">Converged</div>
                <div className={clsx(
                  "font-semibold text-lg",
                  scfData.converged ? "text-green-400" : "text-red-400"
                )}>
                  {scfData.converged ? 'Yes' : 'No'}
                </div>
              </div>
              {scfData.iterations && (
                <div className="bg-gray-800/50 p-3 rounded">
                  <div className="text-gray-400 text-xs">Iterations</div>
                  <div className="font-mono text-lg">{scfData.iterations}</div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Active Space Results */}
        {activeSpaceData && (
          <div className="bg-gray-700/50 rounded-lg p-4 border border-gray-600">
            <div className="flex items-center gap-2 mb-3">
              <h3 className="font-bold text-lg text-primary-300">Active Space</h3>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
              <div className="bg-gray-800/50 p-3 rounded">
                <div className="text-gray-400 text-xs">Orbitals</div>
                <div className="font-mono text-lg text-blue-400">
                  {activeSpaceData.num_orbitals || 'N/A'}
                </div>
              </div>
              <div className="bg-gray-800/50 p-3 rounded">
                <div className="text-gray-400 text-xs">Electrons</div>
                <div className="font-mono text-lg text-blue-400">
                  {activeSpaceData.n_electrons || 
                   (activeSpaceData.n_alpha && activeSpaceData.n_beta 
                     ? `${activeSpaceData.n_alpha + activeSpaceData.n_beta}` 
                     : 'N/A')}
                </div>
              </div>
              <div className="bg-gray-800/50 p-3 rounded">
                <div className="text-gray-400 text-xs">Mode</div>
                <div className="font-mono text-lg capitalize">{activeSpaceData.mode || 'auto'}</div>
              </div>
              {activeSpaceData.n_alpha !== undefined && (
                <div className="bg-gray-800/50 p-3 rounded">
                  <div className="text-gray-400 text-xs">Alpha Electrons</div>
                  <div className="font-mono text-lg text-blue-300">{activeSpaceData.n_alpha}</div>
                </div>
              )}
              {activeSpaceData.n_beta !== undefined && (
                <div className="bg-gray-800/50 p-3 rounded">
                  <div className="text-gray-400 text-xs">Beta Electrons</div>
                  <div className="font-mono text-lg text-purple-300">{activeSpaceData.n_beta}</div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Integrals Results */}
        {integralsData && (
          <div className="bg-gray-700/50 rounded-lg p-4 border border-gray-600">
            <div className="flex items-center gap-2 mb-3">
              <h3 className="font-bold text-lg text-primary-300">Integrals & CCSD</h3>
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              {integralsData.ccsd_energy && (
                <div className="bg-gray-800/50 p-3 rounded">
                  <div className="text-gray-400 text-xs">CCSD Energy (Hartree)</div>
                  <div className="font-mono text-lg text-green-400">
                    {integralsData.ccsd_energy.toFixed(6)}
                  </div>
                </div>
              )}
              {integralsData.converged !== undefined && (
                <div className="bg-gray-800/50 p-3 rounded">
                  <div className="text-gray-400 text-xs">CCSD Converged</div>
                  <div className={clsx(
                    "font-semibold text-lg",
                    integralsData.converged ? "text-green-400" : "text-red-400"
                  )}>
                    {integralsData.converged ? 'Yes' : 'No'}
                  </div>
                </div>
              )}
              {!integralsData.converged && integralsData.ccsd_log && (
                <div className="col-span-2 bg-yellow-900/20 border border-yellow-700/50 rounded p-3">
                  <div className="text-yellow-300 text-sm font-semibold mb-2">
                    CCSD Convergence Warning
                  </div>
                  <details className="text-xs">
                    <summary className="cursor-pointer text-yellow-400 hover:text-yellow-300 mb-2">
                      View CCSD Log
                    </summary>
                    <pre className="bg-gray-900/50 p-3 rounded text-gray-300 whitespace-pre-wrap font-mono text-xs mt-2">
                      {integralsData.ccsd_log}
                    </pre>
                  </details>
                </div>
              )}
              {integralsData.num_integrals && (
                <div className="bg-gray-800/50 p-3 rounded">
                  <div className="text-gray-400 text-xs">Number of Integrals</div>
                  <div className="font-mono text-lg">{integralsData.num_integrals}</div>
                </div>
              )}
              <div className="bg-gray-800/50 p-3 rounded col-span-2">
                <div className="text-gray-400 text-xs mb-1">Status</div>
                <div className="text-sm text-green-300">
                  Integrals computed and transformed successfully
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Circuit Results */}
        {circuitData && (
          <div className="bg-gray-700/50 rounded-lg p-4 border border-gray-600">
            <div className="flex items-center gap-2 mb-3">
              <h3 className="font-bold text-lg text-primary-300">Quantum Circuit</h3>
            </div>
            {/* If circuitData came from history, offer download/restore actions */}
            {circuitFromHistory && (
              <div className="flex items-center gap-2 mb-3">
                <button
                  onClick={() => {
                    try {
                      const payload = JSON.stringify(circuitData, null, 2);
                      const blob = new Blob([payload], { type: 'application/json' });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = `circuit_result_${new Date().toISOString()}.json`;
                      document.body.appendChild(a);
                      a.click();
                      a.remove();
                      URL.revokeObjectURL(url);
                    } catch (e) {
                      console.error('Failed to download saved circuit', e);
                    }
                  }}
                  className="text-sm bg-primary-600 hover:bg-primary-500 text-white px-3 py-1 rounded"
                >
                  Download saved circuit
                </button>
              </div>
            )}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
              <div className="bg-gray-800/50 p-3 rounded">
                <div className="text-gray-400 text-xs">Qubits</div>
                <div className="font-mono text-xl text-purple-400">
                  {circuitData.num_qubits || 'N/A'}
                </div>
              </div>
              <div className="bg-gray-800/50 p-3 rounded">
                <div className="text-gray-400 text-xs">Depth</div>
                <div className="font-mono text-xl text-purple-400">
                  {circuitData.depth || 'N/A'}
                </div>
              </div>
              <div className="bg-gray-800/50 p-3 rounded">
                <div className="text-gray-400 text-xs">Repetitions</div>
                <div className="font-mono text-xl">{circuitData.n_reps || 1}</div>
              </div>
            </div>
            
            {circuitData.gate_counts && (
              <div className="mt-3 bg-gray-800/50 p-3 rounded">
                <div className="text-gray-400 text-xs mb-2">Gate Counts</div>
                <div className="grid grid-cols-3 md:grid-cols-4 gap-2 text-xs">
                  {Object.entries(circuitData.gate_counts).map(([gate, count]) => (
                    <div key={gate} className="flex justify-between items-center bg-gray-700/50 px-2 py-1 rounded">
                      <span className="font-mono text-gray-300 uppercase">{gate}</span>
                      <span className="font-bold text-primary-400">{count as number}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            <div className="mt-3 bg-green-900/20 border border-green-700/30 p-3 rounded">
              <div className="text-sm text-green-300">
                Circuit built successfully - Ready for quantum execution
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
