import React, { useState, useMemo, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getBackendDetails } from '../../api/endpoints';
import {
  calculateForceDirectedPositions,
} from './qpuLayoutAlgorithms';
import { getConnectionColor, getQubitColor } from './qpuColorUtils';

interface QPUTopologyProps {
  backendName: string;
}

interface QubitError {
  qubit: number;
  readout_error: number;
}

interface GateError {
  qubits: number[];
  error: number;
}

export const QPUTopology: React.FC<QPUTopologyProps> = ({ backendName }) => {
  const [hoveredQubit, setHoveredQubit] = useState<number | null>(null);
  const [hoveredConnection, setHoveredConnection] = useState<[number, number] | null>(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });

  const { data, isLoading, error } = useQuery({
    queryKey: ['backend-details', backendName],
    queryFn: () => getBackendDetails(backendName),
    enabled: !!backendName,
    staleTime: 600000,
  });

  const backend = data?.backend;
  const numQubits = backend?.num_qubits || 0;
  const couplingMap = backend?.coupling_map || [];
  const qubitErrors = backend?.qubit_errors || [];
  const gateErrors = backend?.gate_errors || [];

  const qubitPositions = useMemo(() => {
    return calculateForceDirectedPositions(numQubits, couplingMap);
  }, [numQubits, couplingMap]);

  const getQubitError = useCallback(
    (qubitIndex: number): QubitError | undefined => {
      return qubitErrors.find((qe: QubitError) => qe.qubit === qubitIndex);
    },
    [qubitErrors]
  );

  const getGateError = useCallback(
    (q1: number, q2: number): GateError | undefined => {
      return gateErrors.find(
        (ge: GateError) =>
          ge.qubits.length === 2 &&
          ((ge.qubits[0] === q1 && ge.qubits[1] === q2) ||
            (ge.qubits[0] === q2 && ge.qubits[1] === q1))
      );
    },
    [gateErrors]
  );

  const renderHexagon = useCallback((x: number, y: number, size: number) => {
    const angle = Math.PI / 3;
    const points = [];
    for (let i = 0; i < 6; i++) {
      const px = x + size * Math.cos(angle * i - Math.PI / 6);
      const py = y + size * Math.sin(angle * i - Math.PI / 6);
      points.push(`${px},${py}`);
    }
    return `M ${points.join(' L ')} Z`;
  }, []);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500"></div>
      </div>
    );
  }

  if (error || !backend) {
    return (
      <div className="flex items-center justify-center h-96 text-gray-400">
        <p>Unable to load QPU topology</p>
      </div>
    );
  }

  const viewBoxWidth = 1200;
  const viewBoxHeight = 900;

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    setTooltipPos({
      x: e.clientX,
      y: e.clientY,
    });
  };

  return (
    <div className="flex flex-col items-center w-full">
      <svg
        viewBox={`0 0 ${viewBoxWidth} ${viewBoxHeight}`}
        className="w-full h-auto max-h-[800px] bg-gray-900 rounded-lg mx-auto"
        style={{ minHeight: '600px', maxWidth: '1200px' }}
        onMouseMove={handleMouseMove}
      >
        {couplingMap.map((connection: number[], idx: number) => {
          const [q1, q2] = connection;
          const pos1 = qubitPositions.get(q1);
          const pos2 = qubitPositions.get(q2);

          if (!pos1 || !pos2) return null;

          const gateError = getGateError(q1, q2);
          const isHovered =
            hoveredConnection?.[0] === q1 && hoveredConnection?.[1] === q2;

          return (
            <g key={`connection-${idx}`}>
              <line
                x1={pos1.x}
                y1={pos1.y}
                x2={pos2.x}
                y2={pos2.y}
                stroke="transparent"
                strokeWidth="12"
                onMouseEnter={() => setHoveredConnection([q1, q2])}
                onMouseLeave={() => setHoveredConnection(null)}
                style={{ cursor: 'pointer' }}
              />
              <line
                x1={pos1.x}
                y1={pos1.y}
                x2={pos2.x}
                y2={pos2.y}
                stroke={getConnectionColor(gateError?.error)}
                strokeWidth={isHovered ? '5' : '3'}
                opacity={isHovered ? '0.9' : '0.7'}
                pointerEvents="none"
              />
            </g>
          );
        })}

        {Array.from({ length: numQubits }, (_, i) => i).map((qubitIndex) => {
          const pos = qubitPositions.get(qubitIndex);
          if (!pos) return null;

          const qubitError = getQubitError(qubitIndex);
          const errorColor = getQubitColor(qubitError?.readout_error);
          const isHovered = hoveredQubit === qubitIndex;

          return (
            <g
              key={`qubit-${qubitIndex}`}
              onMouseEnter={() => setHoveredQubit(qubitIndex)}
              onMouseLeave={() => setHoveredQubit(null)}
              style={{ cursor: 'pointer' }}
            >
              <path
                d={renderHexagon(pos.x, pos.y, isHovered ? 28 : 24)}
                fill={errorColor}
                stroke={isHovered ? '#fff' : '#1f2937'}
                strokeWidth={isHovered ? 3 : 2}
                className="transition-all duration-200"
              />

              <text
                x={pos.x}
                y={pos.y}
                textAnchor="middle"
                dominantBaseline="central"
                fill="#000"
                fontSize={isHovered ? 16 : 14}
                fontWeight="bold"
                className="pointer-events-none transition-all duration-200"
              >
                {qubitIndex}
              </text>

              {isHovered && qubitError && (
                <path
                  d={renderHexagon(pos.x, pos.y, 36)}
                  fill="none"
                  stroke="#fff"
                  strokeWidth="2"
                  opacity="0.5"
                  className="animate-pulse"
                />
              )}
            </g>
          );
        })}
      </svg>

      {hoveredQubit !== null && (
        <div
          className="fixed bg-gray-800 border border-gray-700 rounded-lg p-4 shadow-xl max-w-xs pointer-events-none z-50"
          style={{
            left: `${tooltipPos.x + 10}px`,
            top: `${tooltipPos.y - 80}px`,
          }}
        >
          <h4 className="text-sm font-bold text-primary-400 mb-2">
            Qubit {hoveredQubit}
          </h4>
          {getQubitError(hoveredQubit) ? (
            <div className="space-y-1 text-xs">
              <div className="flex justify-between">
                <span className="text-gray-400">Readout Error:</span>
                <span className="text-white font-mono">
                  {(getQubitError(hoveredQubit)!.readout_error * 100).toFixed(3)}%
                </span>
              </div>
            </div>
          ) : (
            <p className="text-xs text-gray-400">No error data available</p>
          )}
        </div>
      )}

      {hoveredConnection && (
        <div
          className="fixed bg-gray-800 border border-gray-700 rounded-lg p-4 shadow-xl max-w-xs pointer-events-none z-50"
          style={{
            left: `${tooltipPos.x + 10}px`,
            top: `${tooltipPos.y - 80}px`,
          }}
        >
          <h4 className="text-sm font-bold text-primary-400 mb-2">
            Connection {hoveredConnection[0]} ↔ {hoveredConnection[1]}
          </h4>
          {getGateError(hoveredConnection[0], hoveredConnection[1]) ? (
            <div className="space-y-1 text-xs">
              <div className="flex justify-between">
                <span className="text-gray-400">Gate Error:</span>
                <span className="text-white font-mono">
                  {(
                    getGateError(hoveredConnection[0], hoveredConnection[1])!.error * 100
                  ).toFixed(3)}
                  %
                </span>
              </div>
            </div>
          ) : (
            <p className="text-xs text-gray-400">No error data available</p>
          )}
        </div>
      )}

      <div className="mt-4 flex flex-wrap gap-3 items-center justify-center text-xs">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded-full bg-green-400"></div>
          <span className="text-gray-300">&lt; 1% error</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded-full bg-yellow-400"></div>
          <span className="text-gray-300">1-3% error</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded-full bg-orange-400"></div>
          <span className="text-gray-300">3-5% error</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded-full bg-red-400"></div>
          <span className="text-gray-300">&gt; 5% error</span>
        </div>
      </div>

      <div className="mt-6 flex flex-row flex-wrap items-stretch justify-center gap-4 text-sm w-full">
        <div className="bg-gray-800/50 rounded-lg p-3 flex-1 text-center min-w-[120px]">
          <p className="text-gray-400 text-xs whitespace-nowrap">Total Qubits</p>
          <p className="text-2xl font-bold text-primary-400">{numQubits}</p>
        </div>
        <div className="bg-gray-800/50 rounded-lg p-3 flex-1 text-center min-w-[120px]">
          <p className="text-gray-400 text-xs whitespace-nowrap">Connections</p>
          <p className="text-2xl font-bold text-primary-400">{couplingMap.length}</p>
        </div>
        {backend.avg_readout_error !== undefined && (
          <div className="bg-gray-800/50 rounded-lg p-3 flex-1 text-center min-w-[150px]">
            <p className="text-gray-400 text-xs whitespace-nowrap">Avg Readout Error</p>
            <p className="text-xl font-bold text-yellow-400">
              {(backend.avg_readout_error * 100).toFixed(3)}%
            </p>
          </div>
        )}
        {backend.avg_gate_error !== undefined && (
          <div className="bg-gray-800/50 rounded-lg p-3 flex-1 text-center min-w-[150px]">
            <p className="text-gray-400 text-xs whitespace-nowrap">Avg Gate Error</p>
            <p className="text-xl font-bold text-orange-400">
              {(backend.avg_gate_error * 100).toFixed(3)}%
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
