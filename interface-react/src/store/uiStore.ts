import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { JobData } from '../api/models';

interface UIState {
  // User
  activeUserId: string;
  setActiveUserId: (userId: string) => void;

  // Session
  currentSessionId: string;
  setCurrentSessionId: (sessionId: string) => void;

  // Backend
  selectedBackend: string | null;
  setSelectedBackend: (backendName: string | null) => void;

  // XYZ cache (for visualization)
  cachedXYZs: Record<string, { xyz: string; hash: string }>;
  cacheXYZ: (key: string, xyz: string, hash: string) => void;

  // Current molecule XYZ (persists across tabs)
  currentXYZ: string;
  setCurrentXYZ: (xyz: string) => void;

  // Current molecule configuration (for job submission)
  currentMolecule: {
    name?: string;
    xyzData?: string;
    basis?: string;
    charge?: number;
    spin?: number;
  };
  setCurrentMolecule: (molecule: {
    name?: string;
    xyzData?: string;
    basis?: string;
    charge?: number;
    spin?: number;
  }) => void;

  // UI preferences
  sidebarCollapsed: boolean;
  toggleSidebar: () => void;

  // Active tab
  activeTab: 'molecule' | 'run';
  setActiveTab: (tab: 'molecule' | 'run') => void;

  // Selected Job
  selectedJob: JobData | null;
  setSelectedJob: (job: JobData | null) => void;

  // Pending history entry to load (for navigation from jobs)
  pendingHistoryLoad: string | null;
  setPendingHistoryLoad: (entryId: string | null) => void;
}

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      activeUserId: '',
      currentSessionId: '',
      selectedBackend: null,
      cachedXYZs: {},
      currentXYZ: '',
      currentMolecule: {},
      sidebarCollapsed: false,
      activeTab: 'molecule',
      selectedJob: null,
      pendingHistoryLoad: null,

      // Actions
      setActiveUserId: (userId) => set({ activeUserId: userId }),
      setCurrentSessionId: (sessionId) => set({ currentSessionId: sessionId }),
      setSelectedBackend: (backendName) => set({ selectedBackend: backendName }),
      cacheXYZ: (key, xyz, hash) =>
        set((state) => ({
          cachedXYZs: { ...state.cachedXYZs, [key]: { xyz, hash } },
        })),
      setCurrentXYZ: (xyz) => set({ currentXYZ: xyz }),
      setCurrentMolecule: (molecule) => set({ currentMolecule: molecule }),
      toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
      setActiveTab: (tab) => set({ activeTab: tab }),
      setSelectedJob: (job) => set({ selectedJob: job }),
      setPendingHistoryLoad: (entryId) => set({ pendingHistoryLoad: entryId }),
    }),
    {
      name: 'ui-storage',
      partialize: (state) => ({
        ...state,
        currentSessionId: '',
        selectedBackend: null,
        selectedJob: null,
        currentMolecule: {},
        pendingHistoryLoad: null,
      }),
    }
  )
);