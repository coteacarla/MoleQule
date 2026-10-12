import { useState } from 'react';
import { Button } from '../Shared/Button';
import { Input } from '../Shared/Input';
import { Spinner } from '../Shared/Spinner';
import { showToast } from '../Shared/Toast';
import { processSQD } from '../../api/endpoints';
import type { JobData, SQDOptions, EigenstateOptions, SQDProcessResponse } from '../../api/models';

interface SQDProcessorProps {
  job: JobData;
}

export const SQDProcessor = ({ job }: SQDProcessorProps) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [results, setResults] = useState<SQDProcessResponse | null>(null);
  const [showConfig, setShowConfig] = useState(false);
  
  // SQD Options
  const [sqdOptions, setSqdOptions] = useState<SQDOptions>({
    energy_tol: 1e-3,
    occupancies_tol: 1e-3,
    max_iterations: 5,
  });
  
  // Eigenstate Options
  const [eigenstateOptions, setEigenstateOptions] = useState<EigenstateOptions>({
    num_batches: 3,
    samples_per_batch: 300,
    symmetrize_spin: true,
    carryover_threshold: 1e-4,
    max_cycle: 200,
    spin_sq: 0.0,
  });
  
  const [exactEnergy, setExactEnergy] = useState<string>('');

  // Debug logging
  if (results) {
    console.log('[SQDProcessor] Current results state:', results);
  }

  const handleProcess = async () => {
    if (!job.session_id) {
      showToast.error('Job has no associated session ID');
      return;
    }

    if (!job.result?.counts) {
      showToast.error('Job has no measurement results');
      return;
    }

    try {
      setIsProcessing(true);
      
      console.log('[SQDProcessor] Starting SQD processing for job:', job.job_id);
      
      const response = await processSQD({
        job_id: job.job_id,
        session_id: job.session_id,
        counts: job.result.counts,
        exact_energy: exactEnergy ? parseFloat(exactEnergy) : undefined,
        sqd_options: sqdOptions,
        eigenstate_options: eigenstateOptions,
      });

      console.log('[SQDProcessor] SQD response received:', response);
      console.log('[SQDProcessor] Response status:', response?.status);
      console.log('[SQDProcessor] Has results:', !!response?.results);
      console.log('[SQDProcessor] Has plots:', !!response?.plots);
      
      setResults(response);
      showToast.success('SQD processing completed successfully!');
    } catch (error: any) {
      console.error('SQD processing error:', error);
      const errorMessage = error?.response?.data?.error || error?.message || 'Unknown error';
      showToast.error(`SQD processing failed: ${errorMessage}`);
      
      // Also log the full error for debugging
      if (error?.response?.data) {
        console.error('Backend error details:', error.response.data);
      }
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-xl shadow-lg border border-gray-700 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-bold text-primary-400">
            SQD Post-Processing
          </h3>
          <Button
            onClick={() => setShowConfig(!showConfig)}
            className="text-sm bg-gray-700 hover:bg-gray-600"
          >
            {showConfig ? 'Hide' : 'Show'} Configuration
          </Button>
        </div>

        {showConfig && (
          <div className="space-y-6 mb-6">
            {/* SQD Options */}
            <div className="bg-gray-700/30 rounded-lg p-4">
              <h4 className="text-lg font-semibold text-primary-300 mb-3">
                SQD Options
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Input
                  label="Energy Tolerance"
                  type="number"
                  step="0.0001"
                  value={sqdOptions.energy_tol}
                  onChange={(e) => setSqdOptions({
                    ...sqdOptions,
                    energy_tol: parseFloat(e.target.value) || 1e-3
                  })}
                  placeholder="1e-3"
                />
                <Input
                  label="Occupancies Tolerance"
                  type="number"
                  step="0.0001"
                  value={sqdOptions.occupancies_tol}
                  onChange={(e) => setSqdOptions({
                    ...sqdOptions,
                    occupancies_tol: parseFloat(e.target.value) || 1e-3
                  })}
                  placeholder="1e-3"
                />
                <Input
                  label="Max Iterations"
                  type="number"
                  value={sqdOptions.max_iterations}
                  onChange={(e) => setSqdOptions({
                    ...sqdOptions,
                    max_iterations: parseInt(e.target.value) || 5
                  })}
                  placeholder="5"
                />
              </div>
            </div>

            {/* Eigenstate Solver Options */}
            <div className="bg-gray-700/30 rounded-lg p-4">
              <h4 className="text-lg font-semibold text-primary-300 mb-3">
                Eigenstate Solver Options
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Input
                  label="Num Batches"
                  type="number"
                  value={eigenstateOptions.num_batches}
                  onChange={(e) => setEigenstateOptions({
                    ...eigenstateOptions,
                    num_batches: parseInt(e.target.value) || 3
                  })}
                  placeholder="3"
                />
                <Input
                  label="Samples per Batch"
                  type="number"
                  value={eigenstateOptions.samples_per_batch}
                  onChange={(e) => setEigenstateOptions({
                    ...eigenstateOptions,
                    samples_per_batch: parseInt(e.target.value) || 300
                  })}
                  placeholder="300"
                />
                <Input
                  label="Max Cycle"
                  type="number"
                  value={eigenstateOptions.max_cycle}
                  onChange={(e) => setEigenstateOptions({
                    ...eigenstateOptions,
                    max_cycle: parseInt(e.target.value) || 200
                  })}
                  placeholder="200"
                />
                <Input
                  label="Carryover Threshold"
                  type="number"
                  step="0.0001"
                  value={eigenstateOptions.carryover_threshold}
                  onChange={(e) => setEigenstateOptions({
                    ...eigenstateOptions,
                    carryover_threshold: parseFloat(e.target.value) || 1e-4
                  })}
                  placeholder="1e-4"
                />
                <Input
                  label="Spin Squared"
                  type="number"
                  step="0.1"
                  value={eigenstateOptions.spin_sq}
                  onChange={(e) => setEigenstateOptions({
                    ...eigenstateOptions,
                    spin_sq: parseFloat(e.target.value) || 0.0
                  })}
                  placeholder="0.0"
                />
                <div className="flex items-center pt-6">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={eigenstateOptions.symmetrize_spin}
                      onChange={(e) => setEigenstateOptions({
                        ...eigenstateOptions,
                        symmetrize_spin: e.target.checked
                      })}
                      className="w-4 h-4"
                    />
                    <span className="text-sm text-gray-300">Symmetrize Spin</span>
                  </label>
                </div>
              </div>
            </div>

            {/* Optional Exact Energy */}
            <div className="bg-gray-700/30 rounded-lg p-4">
              <h4 className="text-lg font-semibold text-primary-300 mb-3">
                Optional: Reference Energy
              </h4>
              <Input
                label="Exact Energy (for comparison - leave empty if not available)"
                type="number"
                step="0.0001"
                value={exactEnergy}
                onChange={(e) => setExactEnergy(e.target.value)}
                placeholder="e.g., -1.137"
              />
            </div>
          </div>
        )}

        <Button
          onClick={handleProcess}
          disabled={isProcessing || !job.session_id}
          className="w-full bg-green-600 hover:bg-green-700"
        >
          {isProcessing ? (
            <span className="flex items-center justify-center gap-2">
              <Spinner /> Processing SQD...
            </span>
          ) : (
            'Run SQD Post-Processing'
          )}
        </Button>
      </div>

      {/* Results Display */}
      {results && (
        <div className="space-y-4">
          {/* Energy Results */}
          <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-xl shadow-lg border border-gray-700 p-6">
            <h3 className="text-xl font-bold text-primary-400 mb-4">
              SQD Results
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-gray-700/30 rounded-lg p-4">
                <p className="text-sm text-gray-400 mb-1">Final Energy</p>
                <p className="text-2xl font-bold text-white">
                  {results.results.final_energy.toFixed(6)} Ha
                </p>
              </div>
              <div className="bg-gray-700/30 rounded-lg p-4">
                <p className="text-sm text-gray-400 mb-1">Electronic Energy</p>
                <p className="text-2xl font-bold text-white">
                  {results.results.electronic_energy.toFixed(6)} Ha
                </p>
              </div>
              <div className="bg-gray-700/30 rounded-lg p-4">
                <p className="text-sm text-gray-400 mb-1">Nuclear Repulsion</p>
                <p className="text-2xl font-bold text-white">
                  {results.results.nuclear_repulsion_energy.toFixed(6)} Ha
                </p>
              </div>
              <div className="bg-gray-700/30 rounded-lg p-4">
                <p className="text-sm text-gray-400 mb-1">Iterations</p>
                <p className="text-2xl font-bold text-white">
                  {results.results.num_iterations}
                  <span className="text-sm ml-2">
                    {results.results.converged ? '(Converged)' : '(Max reached)'}
                  </span>
                </p>
              </div>
              {results.results.exact_energy && (
                <div className="bg-gray-700/30 rounded-lg p-4 md:col-span-2">
                  <p className="text-sm text-gray-400 mb-1">Energy Error</p>
                  <p className="text-2xl font-bold text-yellow-400">
                    {results.results.energy_error?.toExponential(4)} Ha
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Plots */}
          <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-xl shadow-lg border border-gray-700 p-6">
            <h3 className="text-xl font-bold text-primary-400 mb-4">
              Visualizations
            </h3>
            
            {/* Combined Plot */}
            <div className="mb-6">
              <img
                src={`data:image/png;base64,${results.plots.combined}`}
                alt="SQD Results"
                className="w-full rounded-lg border border-gray-600"
              />
            </div>

            {/* Individual Plots in Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {results.plots.energy_error && (
                <div>
                  <h4 className="text-sm font-semibold text-gray-300 mb-2">
                    Energy Error
                  </h4>
                  <img
                    src={`data:image/png;base64,${results.plots.energy_error}`}
                    alt="Energy Error"
                    className="w-full rounded-lg border border-gray-600"
                  />
                </div>
              )}
              <div>
                <h4 className="text-sm font-semibold text-gray-300 mb-2">
                  Orbital Occupancy
                </h4>
                <img
                  src={`data:image/png;base64,${results.plots.orbital_occupancy}`}
                  alt="Orbital Occupancy"
                  className="w-full rounded-lg border border-gray-600"
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
