import React from 'react';
import { Spinner } from '../Shared/Spinner';

interface Viz2DProps {
  svgContent: string | undefined;
  isLoading: boolean;
  error: Error | null;
}

export const Viz2D: React.FC<Viz2DProps> = ({ svgContent, isLoading, error }) => {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Spinner />
      </div>
    );
  }

  if (error) {
    return <div className="text-red-500">Error loading 2D visualization: {error.message}</div>;
  }

  if (!svgContent) {
    return <div className="text-gray-400">No 2D visualization available.</div>;
  }

  // Check if content is base64 encoded image or SVG/HTML
  const isBase64Image = svgContent && !svgContent.trim().startsWith('<');
  
  if (isBase64Image) {
    return (
      <div className="w-full h-full bg-white rounded-lg p-4 flex items-center justify-center">
        <img 
          src={`data:image/png;base64,${svgContent}`} 
          alt="2D Molecule Structure"
          className="max-w-full max-h-full object-contain"
        />
      </div>
    );
  }

  return (
    <div
      className="w-full h-full bg-white rounded-lg p-4"
      dangerouslySetInnerHTML={{ __html: svgContent }}
    />
  );
};