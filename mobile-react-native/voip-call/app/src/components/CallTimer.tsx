import { useEffect, useState } from 'react';
import { Text, type StyleProp, type TextStyle } from 'react-native';

function formatDuration(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60)
    .toString()
    .padStart(2, '0');
  const s = (totalSeconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

function useElapsed(startedAt: number | null): number {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    if (!startedAt) {
      setElapsed(0);
      return;
    }
    const tick = () => setElapsed(Math.floor((Date.now() - startedAt) / 1000));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [startedAt]);
  return elapsed;
}

type CallTimerProps = {
  startedAt: number | null;
  style?: StyleProp<TextStyle>;
};

export function CallTimer({ startedAt, style }: CallTimerProps) {
  const elapsed = useElapsed(startedAt);
  return <Text style={style}>{formatDuration(elapsed)}</Text>;
}
