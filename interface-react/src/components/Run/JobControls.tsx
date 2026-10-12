import React, { useState } from 'react';
import { useJobs } from '../../hooks/useJobs';
import { useUIStore } from '../../store/uiStore';
import { Button } from '../Shared/Button';
import { Input } from '../Shared/Input';
import { Spinner } from '../Shared/Spinner';
import { showToast } from '../Shared/Toast';

interface JobControlsProps {
  hasTranspiled: boolean;
}

export const JobControls: React.FC<JobControlsProps> = ({ hasTranspiled }) => {
  const { currentSessionId, selectedBackend, activeUserId, currentMolecule } = useUIStore();
  const { submitJob } = useJobs(currentSessionId);
  const [shots, setShots] = useState(1024);

  const handleSubmit = async () => {
    // Check prerequisites
    if (!canSubmit) {
      const missing = getMissingRequirements();
      if (missing.length > 0) {
        showToast.error(`Cannot submit job. Missing: ${missing.join(', ')}`);
        return;
      }
    }

    if (!activeUserId) {
      showToast.error('No user selected. Please add and select a user first.');
      return;
    }
    if (!currentSessionId) {
      showToast.error('No active session. Please build a molecule first.');
      return;
    }
    if (!selectedBackend) {
      showToast.error('Please select a backend before submitting a job.');
      return;
    }
    if (!hasTranspiled) {
      showToast.error('Please transpile the circuit first using the button above.');
      return;
    }

    // Submit the job (circuit is already transpiled)
    submitJob.mutate({
      session_id: currentSessionId,
      backend_name: selectedBackend,
      shots,
      molecule_data: currentMolecule.xyzData ? {
        name: currentMolecule.name,
        xyz_data: currentMolecule.xyzData,
        basis: currentMolecule.basis,
        charge: currentMolecule.charge,
        spin: currentMolecule.spin,
      } : undefined,
    });
  };

  // Check if all prerequisites are met
  // Require transpilation before job submission for quantum hardware
  const canSubmit = currentSessionId && selectedBackend && activeUserId && hasTranspiled && !submitJob.isPending;

  // Get missing critical requirements (not workflow steps)
  const getMissingRequirements = () => {
    const missing = [];
    if (!currentSessionId) missing.push('Build molecule');
    if (!activeUserId) missing.push('Select user');
    if (!selectedBackend) missing.push('Select backend');
    if (!hasTranspiled) missing.push('Transpile circuit');
    return missing;
  };

  return (
    <div className="space-y-4">
      {/* Workflow Status */}
      {!canSubmit && (
        <div className="bg-red-900/20 border border-red-700/50 rounded-lg p-4">
          <h4 className="text-sm font-semibold text-red-400 mb-2">Cannot Submit Job</h4>
          <p className="text-xs text-gray-300 mb-2">Complete these steps first:</p>
          <ul className="text-xs text-gray-400 space-y-1 list-disc list-inside">
            {getMissingRequirements().map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ul>
        </div>
      )}

      {canSubmit && (
        <div className="bg-green-900/20 border border-green-700/50 rounded-lg p-4">
          <h4 className="text-sm font-semibold text-green-400 mb-1">Ready to Submit</h4>
          <p className="text-xs text-gray-300">All workflow steps completed!</p>
        </div>
      )}

      {/* Selected Backend Display */}
      <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700">
        <p className="text-base text-gray-400 mb-1">Selected Backend</p>
        {selectedBackend ? (
          <p className="font-mono text-primary-400 font-semibold text-lg">{selectedBackend}</p>
        ) : (
          <p className="text-gray-500 italic">No backend selected</p>
        )}
      </div>

      {/* Session Display */}
      <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700">
        <p className="text-base text-gray-400 mb-1">Active Session</p>
        {currentSessionId ? (
          <p className="font-mono text-base text-green-400">{currentSessionId}</p>
        ) : (
          <p className="text-gray-500 italic">No session - build a molecule first</p>
        )}
      </div>

      {/* User Display */}
      <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700">
        <p className="text-base text-gray-400 mb-1">Active User</p>
        {activeUserId ? (
          <p className="font-mono text-base text-green-400">{activeUserId}</p>
        ) : (
          <p className="text-red-400 italic">⚠️ No user selected - add a user first</p>
        )}
      </div>

      {/* Job Submission */}
      <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700">
        <h3 className="text-lg font-bold mb-4">Submit Job</h3>
        <div className="space-y-4">
          <Input
            label="Shots"
            type="number"
            value={shots}
            onChange={(e) => setShots(parseInt(e.target.value))}
            disabled={!canSubmit}
          />
          <Button 
            onClick={handleSubmit} 
            disabled={!canSubmit}
            className="w-full"
          >
            {submitJob.isPending ? (
              <>
                <Spinner /> Submitting...
              </>
            ) : (
              'Submit Job'
            )}
          </Button>
        </div>
        {!canSubmit && !currentSessionId && (
          <p className="text-yellow-400 mt-3 text-sm">
            ⚠️ Build a molecule in the Molecule tab first
          </p>
        )}
        {!canSubmit && currentSessionId && !activeUserId && (
          <p className="text-yellow-400 mt-3 text-sm">
            ⚠️ Please add and select a user (top-left menu) to submit jobs
          </p>
        )}
        {!canSubmit && currentSessionId && !selectedBackend && (
          <p className="text-yellow-400 mt-3 text-sm">
            ⚠️ Please select a backend above to submit jobs
          </p>
        )}
        {!canSubmit && currentSessionId && selectedBackend && activeUserId && !hasTranspiled && (
          <p className="text-yellow-400 mt-3 text-sm">
            Complete all workflow steps in the Molecule tab first
          </p>
        )}
        {submitJob.isSuccess && (
          <p className="text-green-400 mt-3 text-sm">Job submitted successfully!</p>
        )}
        {submitJob.isError && (
          <p className="text-red-400 mt-3 text-sm">Error: {submitJob.error.message}</p>
        )}
      </div>
    </div>
  );
};