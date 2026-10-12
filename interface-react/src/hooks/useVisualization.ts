import { useQuery } from '@tanstack/react-query';
import { visualizeMolecule2D, visualizeMolecule3D } from '../api/endpoints';

export const useMoleculeVisualization = (xyzData: string, enabled: boolean) => {
  const viz2DQuery = useQuery({
    queryKey: ['viz2d', xyzData],
    queryFn: () => visualizeMolecule2D({ xyz_data: xyzData, format: 'svg' }),
    enabled: enabled && !!xyzData,
  });

  const viz3DQuery = useQuery({
    queryKey: ['viz3d', xyzData],
    queryFn: () => visualizeMolecule3D(xyzData),
    enabled: enabled && !!xyzData,
  });

  return {
    viz2D: viz2DQuery,
    viz3D: viz3DQuery,
  };
};