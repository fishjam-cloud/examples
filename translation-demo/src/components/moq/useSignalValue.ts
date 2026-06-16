import { useEffect, useState } from 'react';

// A @moq Signal/Getter exposes a synchronous peek and a subscribe that fires on change.
type Subscribable<T> = {
  peek(): T;
  subscribe(fn: (value: T) => void): () => void;
};

// Mirrors a @moq signal (or getter) into React state so components re-render on change.
// The signal identity must be stable across renders (e.g. created with useState/useRef).
export const useSignalValue = <T>(signal: Subscribable<T>): T => {
  const [value, setValue] = useState<T>(() => signal.peek());

  useEffect(() => {
    // Re-sync in case the value changed between the initial peek and subscribing.
    setValue(signal.peek());
    return signal.subscribe(setValue);
  }, [signal]);

  return value;
};
