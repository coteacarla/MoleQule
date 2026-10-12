import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface HistoryEntry {
  id: string;
  timestamp: number;
  name: string;
  
  // Molecule data
  xyzData: string;
  basis: string;
  charge: number;
  spin: number;
  
  // Active Space configuration (optional)
  activeSpace?: {
    mode: 'range' | 'explicit' | 'homo_lumo';
    n_alpha: number;
    n_beta: number;
    // Mode-specific params
    n_below_homo?: number;
    n_above_lumo?: number;
    act_start?: number;
    act_stop?: number;
    explicit_orbs?: number[];
  };
  
  // Workflow state
  scfCompleted?: boolean;
  activeSpaceConfigured?: boolean;
  integralsComputed?: boolean;
  circuitBuilt?: boolean;
  
  // Computation parameters
  maxIterCCSD?: number;  // Maximum CCSD iterations
  
  // Results (optional)
  scfEnergy?: number;
  ccsdEnergy?: number;
  numQubits?: number;
  circuitDepth?: number;
  // Full circuit result (optional) - stored so we don't need to rebuild
  circuitResult?: {
    num_qubits?: number;
    depth?: number;
    gate_counts?: Record<string, number>;
    metadata?: Record<string, any>;
  };
}

interface HistoryState {
  entries: HistoryEntry[];
  maxEntries: number;
  
  // Actions
  addEntry: (entry: Omit<HistoryEntry, 'id' | 'timestamp'>) => void;
  removeEntry: (id: string) => void;
  clearHistory: () => void;
  updateEntry: (id: string, updates: Partial<HistoryEntry>) => void;
  getEntry: (id: string) => HistoryEntry | undefined;
  // convenience: find most recent entry matching xyz + basis
  findEntryByMolecule: (xyzData: string, basis: string) => HistoryEntry | undefined;
}

export const useHistoryStore = create<HistoryState>()(
  persist(
    (set, get) => ({
      entries: [],
      maxEntries: 50, // Keep last 50 configurations
      
      addEntry: (entry) => {
        const id = `hist_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const timestamp = Date.now();
        
        set((state) => {
          const newEntry = { ...entry, id, timestamp };
          const updatedEntries = [newEntry, ...state.entries].slice(0, state.maxEntries);
          return { entries: updatedEntries };
        });
      },
      
      removeEntry: (id) => {
        set((state) => ({
          entries: state.entries.filter((e) => e.id !== id),
        }));
      },
      
      clearHistory: () => set({ entries: [] }),
      
      updateEntry: (id, updates) => {
        set((state) => ({
          entries: state.entries.map((e) =>
            e.id === id ? { ...e, ...updates } : e
          ),
        }));
      },
      
      getEntry: (id) => {
        return get().entries.find((e) => e.id === id);
      },
      
      findEntryByMolecule: (xyzData, basis) => {
        const entries = get().entries;
        return entries.find((e) => e.xyzData === xyzData && e.basis === basis);
      },
    }),
    {
      name: 'quantum-chemistry-history',
      version: 1,
    }
  )
);
