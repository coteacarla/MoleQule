import React, { Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Sphere, Cylinder } from '@react-three/drei';
import type { Atom, Bond } from '../../api/models';
import { Spinner } from '../Shared/Spinner';
import * as THREE from 'three';

interface Viz3DProps {
  atoms: Atom[];
  bonds: Bond[];
  isLoading: boolean;
  error: Error | null;
}

const AtomSphere: React.FC<{ atom: Atom }> = ({ atom }) => {
  const colorMap: { [key: string]: string } = {
    H: 'white',
    C: 'gray',
    N: 'blue',
    O: 'red',
    F: 'green',
    S: 'yellow',
  };
  return (
    <Sphere args={[0.3]} position={[atom.x, atom.y, atom.z]}>
      <meshStandardMaterial color={colorMap[atom.element] || 'pink'} />
    </Sphere>
  );
};

const BondLine: React.FC<{ bond: Bond; atoms: Atom[] }> = ({ bond, atoms }) => {
  console.log('BondLine render - bond:', bond);
  
  const start = atoms[bond.atom1];
  const end = atoms[bond.atom2];
  
  console.log('BondLine - start:', start, 'end:', end);
  
  // Validate that both atoms exist
  if (!start || !end) {
    console.log('BondLine - Invalid bond, start or end is undefined');
    return null;
  }
  
  // Calculate bond position and rotation
  const startVec = new THREE.Vector3(start.x, start.y, start.z);
  const endVec = new THREE.Vector3(end.x, end.y, end.z);
  const direction = new THREE.Vector3().subVectors(endVec, startVec);
  const length = direction.length();
  const midpoint = new THREE.Vector3().addVectors(startVec, endVec).multiplyScalar(0.5);
  
  console.log('BondLine - Creating cylinder with length:', length, 'at:', midpoint);
  
  // Create quaternion for rotation
  const axis = new THREE.Vector3(0, 1, 0);
  const quaternion = new THREE.Quaternion().setFromUnitVectors(axis, direction.normalize());
  
  return (
    <Cylinder
      args={[0.1, 0.1, length, 16]}
      position={[midpoint.x, midpoint.y, midpoint.z]}
      quaternion={quaternion}
    >
      <meshStandardMaterial 
        color="#333333" 
        metalness={0.3}
        roughness={0.5}
      />
    </Cylinder>
  );
};

export const Viz3D: React.FC<Viz3DProps> = ({ atoms, bonds, isLoading, error }) => {
  // Debug logging
  React.useEffect(() => {
    if (atoms && bonds) {
      console.log('Viz3D - Atoms:', atoms.length);
      console.log('Viz3D - Bonds:', bonds.length);
      console.log('Viz3D - First bond:', bonds[0]);
    }
  }, [atoms, bonds]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Spinner />
      </div>
    );
  }

  if (error) {
    return <div className="text-red-500">Error loading 3D visualization: {error.message}</div>;
  }

  if (!atoms || atoms.length === 0) {
    return <div className="text-gray-400">Build a molecule to see 3D visualization.</div>;
  }

  return (
    <Canvas 
      camera={{ position: [0, 0, 10], fov: 50 }}
      style={{ background: '#ffffffff' }}
    >
      <Suspense fallback={<Spinner />}>
        <ambientLight intensity={0.5} />
        <pointLight position={[10, 10, 10]} />
        {atoms.map((atom, i) => (
          <AtomSphere key={i} atom={atom} />
        ))}
        {bonds && bonds.length > 0 && bonds.map((bond, i) => (
          <BondLine key={i} bond={bond} atoms={atoms} />
        ))}
        <OrbitControls />
      </Suspense>
    </Canvas>
  );
};