import { useSyncExternalStore } from "react";

export type Listen<T> = (cb: (data: T) => void) => VoidFunction;
export type Reduce<T> = (data: T) => T;
export type Change<T> = (ch: Reduce<T> | T) => void;
export type Equal<T> = (prev: T, next: T) => boolean;
export type Selector<T, U> = (value: T) => U;
export type Select<T> = <U>(selector: Selector<T, U>, equal?: Equal<U>) => (() => U);

export interface Unit<T> {
  get: () => T;
  set: Change<T>;
  change: Change<T>;
  listen: Listen<T>;
  use: () => T;
  select: Select<T>;
}

export function unit<T>(
  val: T,
  equal: Equal<T> = Object.is,
): Unit<T> {
  const listener = new Set<(val: T) => void>();
  const change: Change<T> = (ch) => {
    const next = (typeof ch === 'function') ? (ch as Reduce<T>)(val) : ch;
    if (equal(val, next)) return;
    val = next;
    listener.forEach(call => call(next));
  };
  const listen: Listen<T> = (call) => {
    listener.add(call);
    return () => listener.delete(call);
  };
  const get = () => val;
  const set = change;
  const use = () => useSyncExternalStore(listen, get, get);

  const cache = new WeakMap<Selector<T, any>, any>();
  function select<U>(selector: (value: T) => U, equal: Equal<U> = Object.is): (() => U) {
    let fn = cache.get(selector);
    if (fn) return fn;
    let value = selector(get());
    listen((data) => {
      const next = selector(data);
      if (!equal(value, next)) value = next;
    });
    const getter = () => value;
    fn = () => useSyncExternalStore(listen, getter, getter);
    return (cache.set(selector, fn), fn);
  }

  return { get, set, change, listen, use, select };
}
