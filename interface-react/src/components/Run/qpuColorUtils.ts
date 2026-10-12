export const getConnectionColor = (error?: number): string => {
  if (!error) return '#374151';
  if (error < 0.01) return '#059669';
  if (error < 0.03) return '#d97706';
  if (error < 0.05) return '#ea580c';
  return '#dc2626';
};

export const getQubitColor = (readoutError?: number): string => {
  if (!readoutError) return '#4ade80';
  if (readoutError < 0.01) return '#4ade80';
  if (readoutError < 0.03) return '#fbbf24';
  if (readoutError < 0.05) return '#fb923c';
  return '#ef4444';
};
