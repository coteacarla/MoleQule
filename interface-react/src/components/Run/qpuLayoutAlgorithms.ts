export type Position = { x: number; y: number };
export type PositionMap = Map<number, Position>;

interface LayoutConfig {
  width: number;
  height: number;
  minDistance: number;
  maxDistance: number;
  idealDistance: number;
  padding: number;
}

const DEFAULT_CONFIG: LayoutConfig = {
  width: 1000,
  height: 800,
  minDistance: 60,
  maxDistance: 180,
  idealDistance: 100,
  padding: 100,
};

export const calculateForceDirectedPositions = (
  numQubits: number,
  couplingMap: number[][],
  config: Partial<LayoutConfig> = {}
): PositionMap => {
  const { width, height, minDistance, maxDistance, idealDistance, padding } = {
    ...DEFAULT_CONFIG,
    ...config,
  };

  const positions = new Map<number, Position>();
  const centerX = width / 2;
  const centerY = height / 2;

  for (let i = 0; i < numQubits; i++) {
    const angle = (2 * Math.PI * i) / numQubits;
    const radius = Math.min(width, height) * 0.35;
    const jitter = (Math.random() - 0.5) * 20;
    positions.set(i, {
      x: centerX + radius * Math.cos(angle) + jitter,
      y: centerY + radius * Math.sin(angle) + jitter,
    });
  }

  const connections = new Map<number, Set<number>>();
  for (let i = 0; i < numQubits; i++) {
    connections.set(i, new Set());
  }
  for (const [q1, q2] of couplingMap) {
    connections.get(q1)?.add(q2);
    connections.get(q2)?.add(q1);
  }

  const iterations = 200;

  for (let iter = 0; iter < iterations; iter++) {
    const forces = new Map<number, Position>();

    for (let i = 0; i < numQubits; i++) {
      forces.set(i, { x: 0, y: 0 });
    }

    for (let i = 0; i < numQubits; i++) {
      for (let j = i + 1; j < numQubits; j++) {
        const pos1 = positions.get(i)!;
        const pos2 = positions.get(j)!;
        const dx = pos1.x - pos2.x;
        const dy = pos1.y - pos2.y;
        const distSq = dx * dx + dy * dy;
        const dist = Math.sqrt(distSq) || 1;

        let repulsion = 8000 / distSq;
        if (dist < minDistance) repulsion *= 3;

        const fx = (dx / dist) * repulsion;
        const fy = (dy / dist) * repulsion;

        const f1 = forces.get(i)!;
        const f2 = forces.get(j)!;
        f1.x += fx;
        f1.y += fy;
        f2.x -= fx;
        f2.y -= fy;
      }
    }

    for (const [q1, q2] of couplingMap) {
      const pos1 = positions.get(q1)!;
      const pos2 = positions.get(q2)!;
      const dx = pos1.x - pos2.x;
      const dy = pos1.y - pos2.y;
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;

      const displacement = dist - idealDistance;
      const force = displacement * 0.05;

      let multiplier = 1;
      if (dist > maxDistance) multiplier = 2;

      const fx = (dx / dist) * force * multiplier;
      const fy = (dy / dist) * force * multiplier;

      const f1 = forces.get(q1)!;
      const f2 = forces.get(q2)!;
      f1.x -= fx;
      f1.y -= fy;
      f2.x += fx;
      f2.y += fy;
    }

    const cooling = 1 - iter / iterations;
    const maxMove = 10 * cooling;

    for (let i = 0; i < numQubits; i++) {
      const pos = positions.get(i)!;
      const force = forces.get(i)!;
      const mag = Math.sqrt(force.x * force.x + force.y * force.y) || 1;

      const movement = Math.min(mag, maxMove);

      pos.x += (force.x / mag) * movement;
      pos.y += (force.y / mag) * movement;

      pos.x = Math.max(padding, Math.min(width - padding, pos.x));
      pos.y = Math.max(padding, Math.min(height - padding, pos.y));
    }

    for (let i = 0; i < numQubits; i++) {
      for (let j = i + 1; j < numQubits; j++) {
        const pos1 = positions.get(i)!;
        const pos2 = positions.get(j)!;
        const dx = pos1.x - pos2.x;
        const dy = pos1.y - pos2.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;

        if (dist < minDistance) {
          const overlap = minDistance - dist;
          const moveX = (dx / dist) * (overlap / 2);
          const moveY = (dy / dist) * (overlap / 2);

          pos1.x += moveX;
          pos1.y += moveY;
          pos2.x -= moveX;
          pos2.y -= moveY;
        }
      }
    }
  }

  return positions;
};

const doSegmentsIntersect = (
  p1: Position,
  p2: Position,
  p3: Position,
  p4: Position
): boolean => {
  const ccw = (a: Position, b: Position, c: Position) => {
    return (c.y - a.y) * (b.x - a.x) > (b.y - a.y) * (c.x - a.x);
  };

  return (
    ccw(p1, p3, p4) !== ccw(p2, p3, p4) && ccw(p1, p2, p3) !== ccw(p1, p2, p4)
  );
};

const countCrossings = (positions: PositionMap, edges: number[][]): number => {
  let crossings = 0;
  for (let i = 0; i < edges.length; i++) {
    for (let j = i + 1; j < edges.length; j++) {
      const [a1, a2] = edges[i];
      const [b1, b2] = edges[j];

      if (a1 === b1 || a1 === b2 || a2 === b1 || a2 === b2) continue;

      const p1 = positions.get(a1)!;
      const p2 = positions.get(a2)!;
      const p3 = positions.get(b1)!;
      const p4 = positions.get(b2)!;

      if (doSegmentsIntersect(p1, p2, p3, p4)) {
        crossings++;
      }
    }
  }
  return crossings;
};

export const calculatePlanarPositions = (
  numQubits: number,
  couplingMap: number[][],
  config: Partial<LayoutConfig> = {}
): PositionMap => {
  const { width, height, padding } = { ...DEFAULT_CONFIG, ...config };

  const positions = calculateForceDirectedPositions(numQubits, couplingMap, config);

  if (couplingMap.length === 0 || numQubits === 0) return positions;

  const adjacency = new Map<number, number[]>();
  for (let i = 0; i < numQubits; i++) {
    adjacency.set(i, []);
  }
  for (const [q1, q2] of couplingMap) {
    adjacency.get(q1)!.push(q2);
    adjacency.get(q2)!.push(q1);
  }

  const iterations = Math.min(150, numQubits * 3);

  for (let iter = 0; iter < iterations; iter++) {
    const currentCrossings = countCrossings(positions, couplingMap);
    if (currentCrossings === 0) break;

    const temperature = 1 - iter / iterations;

    for (let i = 0; i < numQubits; i++) {
      const originalPos = { ...positions.get(i)! };
      const bestPos = { ...originalPos };
      let bestCrossings = currentCrossings;

      const attempts = Math.min(4, Math.max(2, Math.floor(5 * temperature)));
      for (let attempt = 0; attempt < attempts; attempt++) {
        const angle = Math.random() * 2 * Math.PI;
        const distance = 30 * temperature;
        const newX = originalPos.x + Math.cos(angle) * distance;
        const newY = originalPos.y + Math.sin(angle) * distance;

        if (
          newX < padding ||
          newX > width - padding ||
          newY < padding ||
          newY > height - padding
        )
          continue;

        positions.set(i, { x: newX, y: newY });
        const newCrossings = countCrossings(positions, couplingMap);

        if (newCrossings < bestCrossings) {
          bestPos.x = newX;
          bestPos.y = newY;
          bestCrossings = newCrossings;
        }
      }

      positions.set(i, bestPos);
    }

    if (iter % 30 === 0) {
      const spread = 100 * temperature;
      for (let i = 0; i < numQubits; i++) {
        const pos = positions.get(i)!;
        let fx = 0,
          fy = 0;

        for (let j = 0; j < numQubits; j++) {
          if (i === j) continue;
          const other = positions.get(j)!;
          const dx = pos.x - other.x;
          const dy = pos.y - other.y;
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;

          if (dist < spread) {
            fx += (dx / dist) * (spread - dist) * 0.1;
            fy += (dy / dist) * (spread - dist) * 0.1;
          }
        }

        pos.x = Math.max(padding, Math.min(width - padding, pos.x + fx));
        pos.y = Math.max(padding, Math.min(height - padding, pos.y + fy));
      }
    }
  }

  return positions;
};
