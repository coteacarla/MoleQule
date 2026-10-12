import React, { useState, useEffect, useRef } from 'react';
import { useHistoryStore, type HistoryEntry } from '../../store/historyStore';
import { Button } from '../Shared/Button';

interface HistoryBarProps {
  onLoadEntry: (entry: HistoryEntry) => void;
  className?: string;
}

export const HistoryBar: React.FC<HistoryBarProps> = ({ onLoadEntry, className = '' }) => {
  const { entries, removeEntry, clearHistory } = useHistoryStore();
  const [isExpanded, setIsExpanded] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const historyRef = useRef<HTMLDivElement>(null);

  // Close history when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (historyRef.current && !historyRef.current.contains(event.target as Node)) {
        setIsExpanded(false);
      }
    };

    if (isExpanded) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [isExpanded]);

  const filteredEntries = entries.filter((entry) =>
    entry.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    entry.basis.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  const getStatusIcon = (entry: HistoryEntry) => {
    if (entry.circuitBuilt) return '●';
    if (entry.integralsComputed) return '●';
    if (entry.activeSpaceConfigured) return '●';
    if (entry.scfCompleted) return '●';
    return '○';
  };

  if (!isExpanded) {
    return (
      <div className={`fixed right-0 top-1/2 -translate-y-1/2 z-[60] ${className}`}>
        <button
          onClick={() => setIsExpanded(true)}
          className="bg-gray-800 border-l-4 border-primary-500 rounded-l-lg px-3 py-6 shadow-xl hover:bg-gray-700 transition-all group"
          title="Open History"
        >
          <div className="flex flex-col items-center gap-2">
            <span className="text-xs text-gray-400" style={{ writingMode: 'vertical-rl' }}>
              History
            </span>
            {entries.length > 0 && (
              <span className="bg-primary-500 text-white text-xs rounded-full w-6 h-6 flex items-center justify-center font-bold">
                {entries.length}
              </span>
            )}
          </div>
        </button>
      </div>
    );
  }

  return (
    <div 
      ref={historyRef} 
      className={`fixed right-0 top-0 bottom-0 w-96 bg-gray-900 border-l border-gray-700 shadow-2xl z-[60] flex flex-col ${className}`}
      onWheel={(e) => e.stopPropagation()}
    >
      {/* Header */}
      <div className="bg-gradient-to-r from-primary-900/50 to-primary-800/30 border-b border-gray-700 p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-bold text-primary-300">Configuration History</h2>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                // Export filtered entries
                const payload = JSON.stringify(filteredEntries.length ? filteredEntries : entries, null, 2);
                const blob = new Blob([payload], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `history_export_${new Date().toISOString()}.json`;
                document.body.appendChild(a);
                a.click();
                a.remove();
                URL.revokeObjectURL(url);
              }}
              className="text-gray-400 hover:text-white transition-colors p-1 mr-2"
              title="Export History"
            >
              <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v12m0 0l4-4m-4 4l-4-4M21 21H3" />
              </svg>
            </button>
            <button
              onClick={() => setIsExpanded(false)}
              className="text-gray-400 hover:text-white transition-colors p-1"
              title="Close"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
        
        {/* Search */}
        <input
          type="text"
          placeholder="Search configurations..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-sm focus:outline-none focus:border-primary-500 transition-colors"
        />
        
        <div className="flex items-center justify-between mt-3 text-xs text-gray-400">
          <span>{filteredEntries.length} configuration{filteredEntries.length !== 1 ? 's' : ''}</span>
          {entries.length > 0 && (
            <button
              onClick={() => {
                if (window.confirm('Clear all history?')) {
                  clearHistory();
                }
              }}
              className="text-red-400 hover:text-red-300 transition-colors"
            >
              Clear All
            </button>
          )}
        </div>
      </div>

      {/* History List */}
      <div 
        className="flex-1 p-4 space-y-3 overflow-y-auto"
        style={{
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
        }}
      >
        {/* Hide webkit scrollbar */}
        <style>{`
          div::-webkit-scrollbar {
            display: none;
          }
        `}</style>
        {filteredEntries.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <p className="text-sm">
              {searchQuery ? 'No matching configurations' : 'No saved configurations yet'}
            </p>
            <p className="text-xs mt-2">
              Build molecules to start tracking your work
            </p>
          </div>
        ) : (
          filteredEntries.map((entry) => (
            <div
              key={entry.id}
              className="bg-gray-800 border border-gray-700 rounded-lg p-4 hover:border-primary-500/50 transition-all group"
            >
              {/* Entry Header */}
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <span className="text-xl" title="Status">
                    {getStatusIcon(entry)}
                  </span>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-white truncate" title={entry.name}>
                      {entry.name}
                    </h3>
                    <p className="text-xs text-gray-400">{formatDate(entry.timestamp)}</p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    if (window.confirm(`Delete "${entry.name}"?`)) {
                      removeEntry(entry.id);
                    }
                  }}
                  className="text-gray-500 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100 p-1"
                  title="Delete"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>

              {/* Entry Details */}
              <div className="space-y-1 text-xs mb-3">
                <div className="flex items-center justify-between">
                  <span className="text-gray-400">Basis Set:</span>
                  <span className="font-mono text-primary-300">{entry.basis}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-400">Charge/Spin:</span>
                  <span className="text-gray-300">{entry.charge} / {entry.spin}</span>
                </div>
                {entry.activeSpace && (
                  <div className="flex items-center justify-between">
                    <span className="text-gray-400">Active Space:</span>
                    <span className="text-yellow-300">
                      {entry.activeSpace.mode === 'range' && 'Range'}
                      {entry.activeSpace.mode === 'explicit' && 'Explicit'}
                      {entry.activeSpace.mode === 'homo_lumo' && 'HOMO/LUMO'}
                      {' '}({entry.activeSpace.n_alpha + entry.activeSpace.n_beta}e)
                    </span>
                  </div>
                )}
                {entry.scfEnergy !== undefined && (
                  <div className="flex items-center justify-between">
                    <span className="text-gray-400">SCF Energy:</span>
                    <span className="font-mono text-green-300">{entry.scfEnergy.toFixed(4)} Ha</span>
                  </div>
                )}
                {entry.ccsdEnergy !== undefined && (
                  <div className="flex items-center justify-between">
                    <span className="text-gray-400">CCSD Energy:</span>
                    <span className="font-mono text-blue-300">{entry.ccsdEnergy.toFixed(4)} Ha</span>
                  </div>
                )}
              </div>

              {/* Workflow Progress */}
              <div className="flex items-center gap-1 mb-3">
                <div className={`h-1.5 flex-1 rounded-full ${entry.scfCompleted ? 'bg-purple-500' : 'bg-gray-700'}`} title="SCF" />
                <div className={`h-1.5 flex-1 rounded-full ${entry.activeSpaceConfigured ? 'bg-yellow-500' : 'bg-gray-700'}`} title="Active Space" />
                <div className={`h-1.5 flex-1 rounded-full ${entry.integralsComputed ? 'bg-blue-500' : 'bg-gray-700'}`} title="Integrals" />
                <div className={`h-1.5 flex-1 rounded-full ${entry.circuitBuilt ? 'bg-green-500' : 'bg-gray-700'}`} title="Circuit" />
              </div>

              {/* Load Button */}
              <Button
                onClick={() => onLoadEntry(entry)}
                className="w-full text-sm py-2"
                variant="secondary"
              >
                <span className="flex items-center justify-center gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                  </svg>
                  Load Configuration
                </span>
              </Button>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
