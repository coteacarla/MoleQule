import { useMoleculeVisualization } from '../../hooks/useVisualization';
import { useMoleculeWorkflow } from '../../hooks/useMolecule';
import { useUIStore } from '../../store/uiStore';
import { Button } from './Button';
import { Spinner } from './Spinner';
import { Viz2D } from '../Molecule/Viz2D';
import { Viz3D } from '../Molecule/Viz3D';

interface WorkflowPanelProps {
  showVisualizations?: boolean;
}

export const WorkflowPanel: React.FC<WorkflowPanelProps> = ({ showVisualizations = false }) => {
  const { currentXYZ, currentSessionId } = useUIStore();
  const { viz2D, viz3D } = useMoleculeVisualization(currentXYZ, !!currentSessionId && !!currentXYZ);
  
  const {
    runScf,
    setupActiveSpace,
    computeIntegrals,
    buildCircuit,
  } = useMoleculeWorkflow();

  const getStepStatus = (step: 'scf' | 'activeSpace' | 'integrals' | 'circuit') => {
    switch (step) {
      case 'scf':
        return runScf.isSuccess ? 'success' : runScf.isPending ? 'loading' : 'idle';
      case 'activeSpace':
        return setupActiveSpace.isSuccess ? 'success' : setupActiveSpace.isPending ? 'loading' : 'idle';
      case 'integrals':
        return computeIntegrals.isSuccess ? 'success' : computeIntegrals.isPending ? 'loading' : 'idle';
      case 'circuit':
        return buildCircuit.isSuccess ? 'success' : buildCircuit.isPending ? 'loading' : 'idle';
    }
  };

  const getButtonVariant = (status: string): 'primary' | 'secondary' => {
    if (status === 'loading') return 'secondary';
    return 'primary';
  };

  const workflowSteps = [
    {
      key: 'scf' as const,
      label: 'Run SCF',
      onClick: () => runScf.mutate(),
      disabled: !currentSessionId || runScf.isPending,
    },
    {
      key: 'activeSpace' as const,
      label: 'Active Space',
      onClick: () => setupActiveSpace.mutate(),
      disabled: !currentSessionId || !runScf.isSuccess || setupActiveSpace.isPending,
    },
    {
      key: 'integrals' as const,
      label: 'Compute Integrals',
      onClick: () => computeIntegrals.mutate(),
      disabled: !currentSessionId || !setupActiveSpace.isSuccess || computeIntegrals.isPending,
    },
    {
      key: 'circuit' as const,
      label: 'Build Circuit',
      onClick: () => buildCircuit.mutate(),
      disabled: !currentSessionId || !computeIntegrals.isSuccess || buildCircuit.isPending,
    },
  ];

  if (!currentSessionId || !currentXYZ) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-400 mb-2">No active molecule</p>
        <p className="text-sm text-gray-500">Build a molecule on the Build Molecule tab first</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Workflow Steps */}
      <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700">
        <h3 className="text-lg font-bold mb-4">Workflow Steps</h3>
        <div className="grid grid-cols-2 gap-3">
          {workflowSteps.map((step) => {
            const status = getStepStatus(step.key);
            return (
              <Button
                key={step.key}
                onClick={step.onClick}
                disabled={step.disabled}
                variant={getButtonVariant(status)}
                className="flex items-center justify-center gap-2"
              >
                {status === 'loading' && <Spinner />}
                <span>{step.label}</span>
                {status === 'success' && <span className="text-green-400">✓</span>}
              </Button>
            );
          })}
        </div>
      </div>

      {/* Visualizations (optional) */}
      {showVisualizations && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* 2D */}
          <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700">
            <h4 className="text-sm font-bold mb-2 text-gray-300">2D Structure</h4>
            <div className="h-64">
              <Viz2D
                svgContent={viz2D.data?.image}
                isLoading={viz2D.isLoading}
                error={viz2D.error}
              />
            </div>
          </div>

          {/* 3D */}
          <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700">
            <h4 className="text-sm font-bold mb-2 text-gray-300">3D Model</h4>
            <div className="h-64">
              <Viz3D
                atoms={viz3D.data?.atoms || []}
                bonds={viz3D.data?.bonds || []}
                isLoading={viz3D.isLoading}
                error={viz3D.error}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
