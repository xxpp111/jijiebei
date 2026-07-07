import { useCallback, useState } from 'react';

export function useForceRerender(): () => void {
  const [, setTick] = useState(0);
  return useCallback(() => setTick((x) => x + 1), []);
}
