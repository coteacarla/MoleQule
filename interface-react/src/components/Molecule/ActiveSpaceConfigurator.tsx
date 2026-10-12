import React, { useState } from 'react';
import { Input } from '../Shared/Input';
import { Button } from '../Shared/Button';

export type ActiveSpaceMode = 'range' | 'explicit' | 'homo_lumo';

interface ActiveSpaceConfiguratorProps {
  onConfigure: (config: ActiveSpaceConfig) => void;
  disabled?: boolean;
}

export interface ActiveSpaceConfig {
  mode: ActiveSpaceMode;
  // For HOMO/LUMO mode (Style C)
  n_below_homo?: number;
  n_above_lumo?: number;
  // For range mode (Style A)
  act_start?: number;
  act_stop?: number;
  // For explicit mode (Style B)
  explicit_orbs?: number[];
  // Electron configuration (always manual)
  n_alpha: number;
  n_beta: number;
}

export const ActiveSpaceConfigurator: React.FC<ActiveSpaceConfiguratorProps> = ({
  onConfigure,
  disabled = false,
}) => {
  const [mode, setMode] = useState<ActiveSpaceMode>('range');
  
  // HOMO/LUMO parameters (Style C)
  const [nBelowHomo, setNBelowHomo] = useState(2);
  const [nAboveLumo, setNAboveLumo] = useState(2);
  
  // Range parameters (Style A)
  const [actStart, setActStart] = useState(0);
  const [actStop, setActStop] = useState(10);
  
  // Explicit orbitals (Style B)
  const [explicitOrbs, setExplicitOrbs] = useState('0,1,2,3');
  
  // Electron configuration
  const [nAlpha, setNAlpha] = useState(5);
  const [nBeta, setNBeta] = useState(5);

  const getNumOrbitals = (): number => {
    if (mode === 'range') {
      return Math.max(0, actStop - actStart);
    } else if (mode === 'explicit') {
      return explicitOrbs.split(',').map((s) => s.trim()).filter((s) => s && !isNaN(parseInt(s))).length;
    } else if (mode === 'homo_lumo') {
      return nBelowHomo + nAboveLumo;
    }
    return 0;
  };

  const getValidationError = (): string | null => {
    const totalElectrons = nAlpha + nBeta;
    const numOrbitals = getNumOrbitals();
    
    if (numOrbitals <= 0) {
      return 'Active space must contain at least 1 orbital';
    }
    
    if (totalElectrons > 2 * numOrbitals) {
      return `Too many electrons (${totalElectrons}) for ${numOrbitals} orbitals. Maximum: ${2 * numOrbitals} electrons`;
    }
    
    if (totalElectrons <= 0) {
      return 'Must have at least 1 electron in active space';
    }
    
    // Warning: CCSD requires at least one virtual orbital
    // This means we need: totalElectrons < 2 * numOrbitals
    if (totalElectrons >= 2 * numOrbitals) {
      return `Active space has no virtual orbitals. CCSD requires at least one virtual orbital. Reduce electrons or increase orbitals.`;
    }
    
    if (mode === 'range' && actStart >= actStop) {
      return 'Start index must be less than stop index';
    }
    
    if (mode === 'explicit' && numOrbitals === 0) {
      return 'Must specify at least one orbital index';
    }
    
    return null;
  };

  const handleConfigure = () => {
    const validationError = getValidationError();
    if (validationError) {
      alert(validationError);
      return;
    }

    const config: ActiveSpaceConfig = {
      mode,
      n_alpha: nAlpha,
      n_beta: nBeta,
    };

    // Add mode-specific parameters
    if (mode === 'homo_lumo') {
      config.n_below_homo = nBelowHomo;
      config.n_above_lumo = nAboveLumo;
    } else if (mode === 'range') {
      config.act_start = actStart;
      config.act_stop = actStop;
    } else if (mode === 'explicit') {
      config.explicit_orbs = explicitOrbs
        .split(',')
        .map((s) => parseInt(s.trim()))
        .filter((n) => !isNaN(n));
    }

    onConfigure(config);
  };

  return (
    <div className="card space-y-4">
      <div>
        <h3 className="text-lg font-bold text-primary-400">Active Space Configuration</h3>
        <p className="text-sm text-gray-400">Define the active space for quantum calculations</p>
      </div>

      {/* Active Space Mode Selection */}
      <div className="space-y-2">
        <label className="block text-sm font-medium text-gray-300">
          Selection Method
        </label>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {[
            { value: 'range', label: 'Style A: Range [start, stop)', desc: 'Contiguous index range' },
            { value: 'explicit', label: 'Style B: Explicit List', desc: 'Specific orbital indices' },
            { value: 'homo_lumo', label: 'Style C: HOMO/LUMO', desc: 'Window around frontier orbitals' },
          ].map((option) => (
            <button
              key={option.value}
              onClick={() => setMode(option.value as ActiveSpaceMode)}
              disabled={disabled}
              className={`p-3 rounded-lg border-2 transition-all text-left ${
                mode === option.value
                  ? 'border-primary-500 bg-primary-900/30'
                  : 'border-gray-600 hover:border-gray-500 bg-gray-800/50'
              } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
            >
              <div className="font-medium text-sm">{option.label}</div>
              <div className="text-xs text-gray-400 mt-1">{option.desc}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Mode-specific parameters */}
      {mode === 'range' && (
        <div className="space-y-3 p-4 bg-gray-800/50 rounded-lg border border-gray-700">
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Start Index (inclusive)"
              type="number"
              value={actStart}
              onChange={(e) => setActStart(parseInt(e.target.value))}
              disabled={disabled}
              min={0}
            />
            <Input
              label="Stop Index (exclusive)"
              type="number"
              value={actStop}
              onChange={(e) => setActStop(parseInt(e.target.value))}
              disabled={disabled}
              min={0}
            />
          </div>
          <div className="text-xs text-gray-400">
            Range: [{actStart}, {actStop}) = {Math.max(0, actStop - actStart)} orbitals
          </div>
        </div>
      )}

      {mode === 'explicit' && (
        <div className="space-y-3 p-4 bg-gray-800/50 rounded-lg border border-gray-700">
          <Input
            label="Orbital Indices (comma-separated)"
            value={explicitOrbs}
            onChange={(e) => setExplicitOrbs(e.target.value)}
            disabled={disabled}
            placeholder="e.g., 0,1,2,5,8,10"
          />
          <div className="text-xs text-gray-400">
            Selected: {explicitOrbs.split(',').map((s) => s.trim()).filter((s) => s).length} orbitals
          </div>
        </div>
      )}

      {mode === 'homo_lumo' && (
        <div className="space-y-3 p-4 bg-gray-800/50 rounded-lg border border-gray-700">
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Orbitals Below HOMO"
              type="number"
              value={nBelowHomo}
              onChange={(e) => setNBelowHomo(parseInt(e.target.value))}
              disabled={disabled}
              min={0}
            />
            <Input
              label="Orbitals Above LUMO"
              type="number"
              value={nAboveLumo}
              onChange={(e) => setNAboveLumo(parseInt(e.target.value))}
              disabled={disabled}
              min={0}
            />
          </div>
          <div className="text-xs text-gray-400">
            Total: {nBelowHomo + nAboveLumo} orbitals
          </div>
        </div>
      )}

      {/* Electron Configuration - Always visible below */}
      <div className="space-y-3 p-4 bg-gray-800/50 rounded-lg border border-gray-700">
        <div className="text-sm font-medium text-gray-300">Electron Configuration</div>
        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Alpha Electrons"
            type="number"
            value={nAlpha}
            onChange={(e) => setNAlpha(parseInt(e.target.value))}
            disabled={disabled}
            min={0}
          />
          <Input
            label="Beta Electrons"
            type="number"
            value={nBeta}
            onChange={(e) => setNBeta(parseInt(e.target.value))}
            disabled={disabled}
            min={0}
          />
        </div>
        <div className="text-xs text-gray-400">
          Total: {nAlpha + nBeta} electrons (α: {nAlpha}, β: {nBeta})
        </div>
        <div className="text-xs text-gray-400">
          Max electrons for {getNumOrbitals()} orbitals: {2 * getNumOrbitals()}
        </div>
        <div className="text-xs text-blue-400 bg-blue-900/20 border border-blue-500/50 rounded px-3 py-2">
          Note: CCSD requires at least one virtual (unoccupied) orbital. 
          Keep total electrons less than 2 × number of orbitals.
        </div>
        {getValidationError() && (
          <div className="text-xs text-red-400 bg-red-900/20 border border-red-500/50 rounded px-3 py-2">
            {getValidationError()}
          </div>
        )}
      </div>

      {/* Configure Button */}
      <Button
        onClick={handleConfigure}
        disabled={disabled || getValidationError() !== null}
        className="w-full"
      >
        Configure Active Space
      </Button>
    </div>
  );
};
