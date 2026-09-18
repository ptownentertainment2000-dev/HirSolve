export type SecuritySignal = {
  type: 'risk' | 'device' | 'location' | 'velocity';
  score: number;
  details: Record<string, unknown>;
};

export const security = {
  name: 'security',
  summarizeSignals: (signals: SecuritySignal[]) => signals.reduce((total, signal) => total + signal.score, 0),
};
