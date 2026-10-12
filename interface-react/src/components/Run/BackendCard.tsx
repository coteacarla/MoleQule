import type { Backend } from '../../api/models';
import { clsx } from 'clsx';

interface BackendCardProps {
  backend: Backend;
  isSelected: boolean;
  onSelect: () => void;
}

export const BackendCard: React.FC<BackendCardProps> = ({ backend, isSelected, onSelect }) => {
  const statusColor = backend.operational ? 'text-green-400' : 'text-red-400';

  return (
    <div
      onClick={onSelect}
      className={clsx(
        'card-hover p-4 flex flex-col justify-between',
        isSelected && 'border-primary-500 ring-2 ring-primary-500'
      )}
    >
      <div>
        <h3 className="font-bold text-lg truncate">{backend.name}</h3>
        <p className={clsx('text-sm font-semibold', statusColor)}>
          {backend.operational ? 'Operational' : 'Not Operational'}
        </p>
      </div>
      <div className="mt-4 text-sm text-gray-300 space-y-1">
        <p>Qubits: {backend.num_qubits}</p>
        <p>Pending Jobs: {backend.pending_jobs}</p>
        {backend.avg_gate_error && (
          <p>Gate Error: {(backend.avg_gate_error * 100).toFixed(3)}%</p>
        )}
      </div>
    </div>
  );
};