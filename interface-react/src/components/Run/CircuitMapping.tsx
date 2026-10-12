import React, { useState, useMemo, useCallback } from 'react';
import { calculateForceDirectedPositions } from './qpuLayoutAlgorithms';
import { getConnectionColor, getQubitColor } from './qpuColorUtils';

interface CircuitMappingProps {
  couplingMap: number[][];
  qubitErrors: Array<{ qubit: number; readout_error: number }>;
  gateErrors: Array<{ qubits: number[]; error: number }>;
  qubitMapping: Record<number, number>;
  numQubits: number;
}

type DisplayMode = 'original' | 'optimized';

export const CircuitMapping: React.FC<CircuitMappingProps> = ({
  couplingMap,
  qubitErrors,
  gateErrors,
  qubitMapping,
  numQubits,
}) => {
  const [hoveredQubit, setHoveredQubit] = useState<number | null>(null);
  const [hoveredConnection, setHoveredConnection] = useState<[number, number] | null>(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });
  const [displayMode, setDisplayMode] = useState<DisplayMode>('original');

  const usedPhysicalQubits = useMemo(() => {
    return new Set(Object.values(qubitMapping));
  }, [qubitMapping]);

  const usedConnections = useMemo(() => {
    const connections: Array<[number, number]> = [];
    const physicalQubits = Object.values(qubitMapping);
    
    for (const [q1, q2] of couplingMap) {
      if (physicalQubits.includes(q1) && physicalQubits.includes(q2)) {
        connections.push([q1, q2]);
      }
    }
    return connections;
  }, [couplingMap, qubitMapping]);

  const qubitPositions = useMemo(() => {
    if (displayMode === 'optimized') {
      return calculateForceDirectedPositions(
        usedPhysicalQubits.size,
        usedConnections.map(([q1, q2]) => {
          const usedArray = Array.from(usedPhysicalQubits);
          return [usedArray.indexOf(q1), usedArray.indexOf(q2)];
        })
      );
    }
    return calculateForceDirectedPositions(numQubits, couplingMap);
  }, [displayMode, numQubits, couplingMap, usedPhysicalQubits, usedConnections]);

  const getQubitError = useCallback(
    (qubitIndex: number) => {
      return qubitErrors.find((qe) => qe.qubit === qubitIndex);
    },
    [qubitErrors]
  );

  const getGateError = useCallback(
    (q1: number, q2: number) => {
      return gateErrors.find(
        (ge) =>
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

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    setTooltipPos({
      x: e.clientX,
      y: e.clientY,
    });
  };

  const viewBoxWidth = 1200;
  const viewBoxHeight = 900;

  const renderQubitsAndConnections = () => {
    if (displayMode === 'optimized') {
      const usedArray = Array.from(usedPhysicalQubits);
      
      return (
        <>
          {usedConnections.map(([q1, q2], idx) => {
            const idx1 = usedArray.indexOf(q1);
            const idx2 = usedArray.indexOf(q2);
            const pos1 = qubitPositions.get(idx1);
            const pos2 = qubitPositions.get(idx2);

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

          {usedArray.map((physicalQubit, virtualIdx) => {
            const pos = qubitPositions.get(virtualIdx);
            if (!pos) return null;

            const qubitError = getQubitError(physicalQubit);
            const errorColor = getQubitColor(qubitError?.readout_error);
            const isHovered = hoveredQubit === physicalQubit;

            const virtualQubitLabel = Object.entries(qubitMapping).find(
              ([_, phys]) => phys === physicalQubit
            )?.[0];

            return (
              <g
                key={`qubit-${physicalQubit}`}
                onMouseEnter={() => setHoveredQubit(physicalQubit)}
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
                  y={pos.y - 5}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fill="#000"
                  fontSize={isHovered ? 14 : 12}
                  fontWeight="bold"
                  className="pointer-events-none transition-all duration-200"
                >
                  {physicalQubit}
                </text>
                <text
                  x={pos.x}
                  y={pos.y + 8}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fill="#666"
                  fontSize={10}
                  className="pointer-events-none"
                >
                  (v{virtualQubitLabel})
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
        </>
      );
    }

    return (
      <>
        {couplingMap.map((connection, idx) => {
          const [q1, q2] = connection;
          const pos1 = qubitPositions.get(q1);
          const pos2 = qubitPositions.get(q2);

          if (!pos1 || !pos2) return null;

          const isUsedConnection = usedPhysicalQubits.has(q1) && usedPhysicalQubits.has(q2);
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
                onMouseEnter={() => isUsedConnection && setHoveredConnection([q1, q2])}
                onMouseLeave={() => setHoveredConnection(null)}
                style={{ cursor: isUsedConnection ? 'pointer' : 'default' }}
              />
              <line
                x1={pos1.x}
                y1={pos1.y}
                x2={pos2.x}
                y2={pos2.y}
                stroke={isUsedConnection ? getConnectionColor(gateError?.error) : '#374151'}
                strokeWidth={isHovered ? '5' : '3'}
                opacity={isUsedConnection ? (isHovered ? '0.9' : '0.7') : '0.2'}
                pointerEvents="none"
              />
            </g>
          );
        })}

        {Array.from({ length: numQubits }, (_, i) => i).map((qubitIndex) => {
          const pos = qubitPositions.get(qubitIndex);
          if (!pos) return null;

          const isUsed = usedPhysicalQubits.has(qubitIndex);
          const qubitError = getQubitError(qubitIndex);
          const errorColor = isUsed ? getQubitColor(qubitError?.readout_error) : '#4b5563';
          const isHovered = hoveredQubit === qubitIndex;

          const virtualQubitLabel = isUsed
            ? Object.entries(qubitMapping).find(([_, phys]) => phys === qubitIndex)?.[0]
            : null;

          return (
            <g
              key={`qubit-${qubitIndex}`}
              onMouseEnter={() => isUsed && setHoveredQubit(qubitIndex)}
              onMouseLeave={() => setHoveredQubit(null)}
              style={{ cursor: isUsed ? 'pointer' : 'default' }}
              opacity={isUsed ? 1 : 0.3}
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
                y={pos.y - (virtualQubitLabel ? 5 : 0)}
                textAnchor="middle"
                dominantBaseline="central"
                fill={isUsed ? '#000' : '#9ca3af'}
                fontSize={isHovered ? 14 : 12}
                fontWeight="bold"
                className="pointer-events-none transition-all duration-200"
              >
                {qubitIndex}
              </text>
              {virtualQubitLabel && (
                <text
                  x={pos.x}
                  y={pos.y + 8}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fill="#666"
                  fontSize={10}
                  className="pointer-events-none"
                >
                  (v{virtualQubitLabel})
                </text>
              )}

              {isHovered && isUsed && qubitError && (
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
      </>
    );
  };

  return (
    <div className="flex flex-col items-center w-full">
      <div className="mb-4 flex gap-2 items-center">
        <button
          onClick={() => setDisplayMode('original')}
          className={`px-4 py-2 rounded transition-colors ${
            displayMode === 'original'
              ? 'bg-primary-600 text-white'
              : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
          }`}
        >
          Full QPU Layout
        </button>
        <button
          onClick={() => setDisplayMode('optimized')}
          className={`px-4 py-2 rounded transition-colors ${
            displayMode === 'optimized'
              ? 'bg-primary-600 text-white'
              : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
          }`}
        >
          Circuit Qubits Only
        </button>
      </div>

      <svg
        viewBox={`0 0 ${viewBoxWidth} ${viewBoxHeight}`}
        className="w-full h-auto max-h-[800px] bg-gray-900 rounded-lg mx-auto"
        style={{ minHeight: '600px', maxWidth: '1200px' }}
        onMouseMove={handleMouseMove}
      >
        {renderQubitsAndConnections()}
      </svg>

      {hoveredQubit !== null && usedPhysicalQubits.has(hoveredQubit) && (
        <div
          className="fixed bg-gray-800 border border-gray-700 rounded-lg p-4 shadow-xl max-w-xs pointer-events-none z-50"
          style={{
            left: `${tooltipPos.x + 10}px`,
            top: `${tooltipPos.y - 80}px`,
          }}
        >
          <h4 className="text-sm font-bold text-primary-400 mb-2">
            Physical Qubit {hoveredQubit}
            {Object.entries(qubitMapping).find(([_, phys]) => phys === hoveredQubit) && (
              <span className="text-gray-400 ml-1">
                (Virtual {Object.entries(qubitMapping).find(([_, phys]) => phys === hoveredQubit)?.[0]})
              </span>
            )}
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
                  {(getGateError(hoveredConnection[0], hoveredConnection[1])!.error * 100).toFixed(3)}%
                </span>
              </div>
            </div>
          ) : (
            <p className="text-xs text-gray-400">No error data available</p>
          )}
        </div>
      )}

      <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
        <div className="bg-gray-800/50 rounded-lg p-3">
          <p className="text-gray-400 text-xs">Circuit Qubits</p>
          <p className="text-2xl font-bold text-primary-400">{usedPhysicalQubits.size}</p>
        </div>
        <div className="bg-gray-800/50 rounded-lg p-3">
          <p className="text-gray-400 text-xs">Circuit Connections</p>
          <p className="text-2xl font-bold text-primary-400">{usedConnections.length}</p>
        </div>
      </div>
    </div>
  );
};
