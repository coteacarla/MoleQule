import React from 'react';

interface BasisSetSelectorProps {
  value: string;
  onChange: (basis: string) => void;
  disabled?: boolean;
}

const COMMON_BASIS_SETS = [
  // Slater-Type Orbital (STO) basis sets
  { value: 'sto-3g', label: 'STO-3G', description: 'Minimal basis set (3 Gaussians per STO)', group: 'STO' },
  { value: 'sto-6g', label: 'STO-6G', description: 'Minimal basis set (6 Gaussians per STO)', group: 'STO' },
  
  // Pople split-valence basis sets
  { value: '3-21g', label: '3-21G', description: 'Split-valence double-zeta', group: 'Pople' },
  { value: '6-21g', label: '6-21G', description: 'Split-valence double-zeta', group: 'Pople' },
  { value: '6-31g', label: '6-31G', description: 'Standard split-valence', group: 'Pople' },
  { value: '6-31g*', label: '6-31G*', description: 'With polarization on heavy atoms (6-31G(d))', group: 'Pople' },
  { value: '6-31g**', label: '6-31G**', description: 'With polarization on all atoms (6-31G(d,p))', group: 'Pople' },
  { value: '6-311g', label: '6-311G', description: 'Triple-zeta split-valence', group: 'Pople' },
  { value: '6-311g*', label: '6-311G*', description: 'Triple-zeta with polarization on heavy atoms', group: 'Pople' },
  { value: '6-311++g**', label: '6-311++G**', description: 'Triple-zeta with diffuse and polarization', group: 'Pople' },
  
  // Ahlrichs def2 basis sets
  { value: 'def2-svp', label: 'def2-SVP', description: 'Split-valence polarization (Ahlrichs)', group: 'Def2' },
  { value: 'def2-tzvp', label: 'def2-TZVP', description: 'Triple-zeta valence polarization', group: 'Def2' },
  { value: 'def2-tzvpp', label: 'def2-TZVPP', description: 'Triple-zeta valence double polarization', group: 'Def2' },
  { value: 'def2-qzvp', label: 'def2-QZVP', description: 'Quadruple-zeta valence polarization', group: 'Def2' },
  
  // Ahlrichs basis sets (older)
  { value: 'svp', label: 'SVP', description: 'Split-valence polarization', group: 'Ahlrichs' },
  { value: 'tzvp', label: 'TZVP', description: 'Triple-zeta valence polarization', group: 'Ahlrichs' },
  { value: 'tzvpp', label: 'TZVPP', description: 'Triple-zeta valence double polarization', group: 'Ahlrichs' },
  { value: 'qzvp', label: 'QZVP', description: 'Quadruple-zeta valence polarization', group: 'Ahlrichs' },
  
  // Def basis sets (older naming)
  { value: 'def-svp', label: 'def-SVP', description: 'Original Ahlrichs SVP', group: 'Def' },
  { value: 'def-tzvp', label: 'def-TZVP', description: 'Original Ahlrichs TZVP', group: 'Def' },
];

export const BasisSetSelector: React.FC<BasisSetSelectorProps> = ({
  value,
  onChange,
  disabled = false,
}) => {
  return (
    <div>
      <label className="block text-sm mb-1 text-gray-300">
        Basis Set
      </label>
      
      <div className="space-y-2">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          className="input-field w-full basis-set-select"
        >
          <optgroup label="STO - Slater-Type Orbital">
            {COMMON_BASIS_SETS.filter(b => b.group === 'STO').map((basis) => (
              <option key={basis.value} value={basis.value}>
                {basis.label} - {basis.description}
              </option>
            ))}
          </optgroup>
          
          <optgroup label="Pople - Split-Valence">
            {COMMON_BASIS_SETS.filter(b => b.group === 'Pople').map((basis) => (
              <option key={basis.value} value={basis.value}>
                {basis.label} - {basis.description}
              </option>
            ))}
          </optgroup>
          
          <optgroup label="Def2 - Ahlrichs (Modern)">
            {COMMON_BASIS_SETS.filter(b => b.group === 'Def2').map((basis) => (
              <option key={basis.value} value={basis.value}>
                {basis.label} - {basis.description}
              </option>
            ))}
          </optgroup>
          
          <optgroup label="Ahlrichs - Standard">
            {COMMON_BASIS_SETS.filter(b => b.group === 'Ahlrichs').map((basis) => (
              <option key={basis.value} value={basis.value}>
                {basis.label} - {basis.description}
              </option>
            ))}
          </optgroup>
          
          <optgroup label="Def - Ahlrichs (Legacy)">
            {COMMON_BASIS_SETS.filter(b => b.group === 'Def').map((basis) => (
              <option key={basis.value} value={basis.value}>
                {basis.label} - {basis.description}
              </option>
            ))}
          </optgroup>
        </select>
      </div>
    </div>
  );
};
