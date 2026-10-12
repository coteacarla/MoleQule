export const parseXYZ = (content: string): { atoms: number; xyz: string } | null => {
  const lines = content.trim().split('\n');
  
  // XYZ format: first line is atom count, second is comment, rest are atoms
  if (lines.length < 3) return null;
  
  const atomCount = parseInt(lines[0].trim());
  if (isNaN(atomCount)) return null;
  
  const xyz = lines.slice(2).join('\n');
  
  return { atoms: atomCount, xyz };
};

export const validateXYZ = (xyz: string): boolean => {
  const lines = xyz.trim().split('\n');
  
  return lines.every((line) => {
    const parts = line.trim().split(/\s+/);
    // Element symbol + 3 coordinates
    return parts.length === 4 && !isNaN(parseFloat(parts[1]));
  });
};