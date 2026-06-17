import { useCallback, useSyncExternalStore } from 'react';

// A @moq Signal/Getter exposes a synchronous peek and a subscribe that fires on change.
type Subscribable<T> = {
  peek(): T;
  subscribe(fn: (value: T) => void): () => void;
};

const noop = () => {};
const identity = <T>(value: T): T => value;

// Mirrors a @moq signal (or getter) into React via useSyncExternalStore, so components
// re-render on change without an effect — and without tearing under concurrent rendering.
//
// The signal may be undefined (e.g. read off an object that doesn't exist yet), in which case
// the value is undefined and nothing is subscribed. An optional `select` derives the rendered
// value from the signal — return a primitive to collapse a high-frequency signal (e.g. a frame
// timestamp) into a stable boolean so it only re-renders when that boolean flips.
export function useSignalValue<T>(signal: Subscribable<T>): T;
export function useSignalValue<T>(signal: Subscribable<T> | undefined): T | undefined;
export function useSignalValue<T, S>(signal: Subscribable<T> | undefined, select: (value: T | undefined) => S): S;
export function useSignalValue<T, S>(
  signal: Subscribable<T> | undefined,
  select: (value: T | undefined) => S = identity as (value: T | undefined) => S,
): S {
  const subscribe = useCallback((onChange: () => void) => signal?.subscribe(onChange) ?? noop, [signal]);
  const getSnapshot = useCallback(() => select(signal?.peek()), [signal, select]);

  return useSyncExternalStore(subscribe, getSnapshot);
}
