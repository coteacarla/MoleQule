import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { JobData } from '../../api/models';
import { useQuery } from '@tanstack/react-query';
import { getJobVisualization } from '../../api/endpoints';
import { Spinner } from '../Shared/Spinner';
import { Button } from '../Shared/Button';
import { useHistoryStore } from '../../store/historyStore';
import { useUIStore } from '../../store/uiStore';
import { SQDProcessor } from './SQDProcessor';

interface JobResultsVisualizationProps {
  job: JobData;
}

export const JobResultsVisualization: React.FC<JobResultsVisualizationProps> = ({ job }) => {
  const [hoveredPlot, setHoveredPlot] = useState<string | null>(null);
  const navigate = useNavigate();
  const { addEntry, findEntryByMolecule } = useHistoryStore();
  const { setPendingHistoryLoad } = useUIStore();

  console.log('[JobResultsVisualization] Rendering for job:', job.job_id);

  const { data, isLoading, error } = useQuery({
    queryKey: ['job-visualization', job.job_id],
    queryFn: async () => {
      console.log('[JobResultsVisualization] Fetching visualization for job:', job.job_id);
      try {
        const result = await getJobVisualization(job.job_id);
        console.log('[JobResultsVisualization] Visualization data received:', result);
        return result;
      } catch (err) {
        console.error('[JobResultsVisualization] Error fetching visualization:', err);
        throw err;
      }
    },
    enabled: !!job.job_id,
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
    retry: 2,
    refetchOnMount: false, // Don't refetch on component mount if data exists
    refetchOnWindowFocus: false, // Don't refetch when window regains focus
  });

  console.log('[JobResultsVisualization] Query state:', { isLoading, hasData: !!data, hasError: !!error });

  const downloadImage = (imageData: string, filename: string) => {
    const link = document.createElement('a');
    link.href = imageData;
    link.download = filename;
    link.click();
  };

  const handleEditMolecule = () => {
    if (job.molecule_data && job.molecule_data.xyz_data) {
      const xyzData = job.molecule_data.xyz_data;
      const basis = job.molecule_data.basis || '6-31g';
      
      // Check if an entry with this molecule already exists
      let existingEntry = findEntryByMolecule(xyzData, basis);
      
      // If no existing entry, create a new one
      if (!existingEntry) {
        const historyEntry = {
          name: job.molecule_data.name || 'From Job',
          xyzData: xyzData,
          basis: basis,
          charge: job.molecule_data.charge || 0,
          spin: job.molecule_data.spin || 0,
        };
        
        addEntry(historyEntry);
        
        // Find the newly added entry
        existingEntry = findEntryByMolecule(xyzData, basis);
      }
      
      if (existingEntry) {
        // Set as pending load so MoleculeTab will automatically load it
        setPendingHistoryLoad(existingEntry.id);
      }

      // Navigate to molecule tab
      navigate('/molecule');
    }
  };

  if (isLoading) {
    return <Spinner />;
  }

  if (error) {
    return <p className="text-red-500">Failed to load visualization.</p>;
  }

  if (!data) {
    return <p>No visualization available.</p>;
  }

  // Handle both old format (plots directly on data) and new format (nested in visualizations)
  const plots = data.visualizations || data;
  
  // Debug logging
  console.log('[JobResultsVisualization] Data structure:', { 
    hasVisualizations: !!data.visualizations,
    hasDirectPlots: !!data.histogram,
    plotKeys: Object.keys(plots || {}),
    generationTime: data.generation_time
  });

  const PlotContainer = ({ title, imageData, plotKey }: { title: string; imageData: string; plotKey: string }) => (
    <div 
      className="relative"
      onMouseEnter={() => setHoveredPlot(plotKey)}
      onMouseLeave={() => setHoveredPlot(null)}
    >
      <h5 className="text-base font-semibold mb-3">{title}</h5>
      <div className="relative inline-block">
        <img src={imageData} alt={title} className="max-w-full h-auto" />
        {hoveredPlot === plotKey && (
          <div className="absolute top-2 right-2">
            <Button
              onClick={() => downloadImage(imageData, `${job.job_id}_${plotKey}.png`)}
              variant="secondary"
              className="px-3 py-2 text-sm font-semibold bg-gray-800 hover:bg-gray-700 shadow-lg text-white border border-gray-600"
            >
              Download
            </Button>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="space-y-8 pb-8">
      {/* Molecule Information Section */}
      {job.molecule_data && job.molecule_data.xyz_data && (
        <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-xl font-bold text-white">Molecule Information</h4>
            <Button
              onClick={handleEditMolecule}
              variant="secondary"
              className="px-4 py-2"
            >
              Edit Molecule
            </Button>
          </div>
          <div className="grid grid-cols-2 gap-4 text-sm">
            {job.molecule_data.name && (
              <div>
                <p className="text-gray-400">Name:</p>
                <p className="text-white font-semibold">{job.molecule_data.name}</p>
              </div>
            )}
            {job.molecule_data.basis && (
              <div>
                <p className="text-gray-400">Basis Set:</p>
                <p className="text-white font-semibold">{job.molecule_data.basis}</p>
              </div>
            )}
            {job.molecule_data.charge !== undefined && (
              <div>
                <p className="text-gray-400">Charge:</p>
                <p className="text-white font-semibold">{job.molecule_data.charge}</p>
              </div>
            )}
            {job.molecule_data.spin !== undefined && (
              <div>
                <p className="text-gray-400">Spin:</p>
                <p className="text-white font-semibold">{job.molecule_data.spin}</p>
              </div>
            )}
          </div>
        </div>
      )}
      
      {/* Visualization Plots */}
      {plots && (
        <>
          {plots.histogram && <PlotContainer title="Histogram" imageData={plots.histogram} plotKey="histogram" />}
          {plots.qsphere && <PlotContainer title="Q-Sphere" imageData={plots.qsphere} plotKey="qsphere" />}
          {plots.state_city && <PlotContainer title="State City" imageData={plots.state_city} plotKey="state_city" />}
          {plots.bloch_multivector && <PlotContainer title="Bloch Multivector" imageData={plots.bloch_multivector} plotKey="bloch_multivector" />}
          {plots.hinton && <PlotContainer title="Hinton Plot" imageData={plots.hinton} plotKey="hinton" />}
        </>
      )}
      
      {/* SQD Post-Processing Section */}
      {job.result && (
        <div className="border-t border-gray-700 pt-8 mt-8">
          <h4 className="text-2xl font-bold text-primary-300 mb-6">
            Post-Process with SQD
          </h4>
          <SQDProcessor job={job} />
        </div>
      )}
    </div>
  );
};
