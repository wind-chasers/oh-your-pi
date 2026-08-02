import { createContext, useContext, PropsWithChildren, useState } from 'react';
import { unit } from './unit';
import type { Unit, Change, Equal, Selector, Select } from './unit';

const UNIT = Symbol("UNIT");

type AnyAtom<T = any> = ValueAtom<T> | DeriveAtom<T, any> | ComputedAtom<T>;
type Query = <T>(atom: AnyAtom<T>) => Unit<T>;
type UseValue = <T>(atom: AnyAtom<T>) => T;
type Derivative = Record<string, (...args: any[]) => unknown>;
type Init<T> = T | (() => T);
type Derive<T, A extends Derivative> = (unit: Unit<T>, use: UseAtom) => A;

interface UseAtom {
	<T>(atom: ComputedAtom<T>): T;
	<T, A extends Derivative>(atom: DeriveAtom<T, A>): [T, A];
	<T>(atom: ValueAtom<T>): [T, Change<T>];
}
export interface ValueAtom<T> {
  [UNIT]: (query: Query) => [Unit<T>, Change<T>];
  use: () => [T, Change<T>];
  useSet: () => Change<T>;
  useValue: () => T;
  select: Select<T>;
}
export interface DeriveAtom<T, A extends Derivative> {
  [UNIT]: (query: Query, use: UseAtom) => [Unit<T>, A];
  use: () => [T, A];
  useDerived: () => A;
  useValue: () => T;
  select: Select<T>;
}
export interface ComputedAtom<T> {
  [UNIT]: (query: Query) => [Unit<T>, null];
  use: () => T;
  select: Select<T>;
}

export interface Define {
  value<T>(init: Init<T>, equal?: Equal<T>): ValueAtom<T>;
  derive<T, A extends Derivative>(init: Init<T>, derive: Derive<T, A>, equal?: Equal<T>): DeriveAtom<T, A>;
  computed<T>(compute: (use: UseValue) => T, equal?: Equal<T>): ComputedAtom<T>;
}

export type { Unit, UseAtom, UseValue, Derivative, Derive };

export function local() {
  const Context = createContext<Query | null>(null);
  function useQuery<T>(atom: AnyAtom<T>) {
    const query = useContext(Context);
    if (query) return query(atom);
    throw new Error("Local atom must be used within its Provider");
  }

  const _q2u_ = new WeakMap<Query, UseAtom>();
  function build() {
    const map = new WeakMap<AnyAtom, [Unit<any>, Derivative | Change<any> | null]>();
    function ensure(atom: AnyAtom) {
      let state = map.get(atom);
      if (state) return state;
      state = atom[UNIT](query, use);
      return map.set(atom, state), state;
    }
    function use(atom: AnyAtom) {
      const [state, side] = ensure(atom);
      return side ? [state.get(), side] : state.get();
    }
    const query: Query = (a) => ensure(a)[0];
    return _q2u_.set(query, use), query;
  }

  const define: Define = {
    value<T>(init: Init<T>, equal?: Equal<T>) {
      const atom: ValueAtom<T> = {
        [UNIT]: () => {
          const state = unit(typeof init === "function" ? (init as () => T)() : init, equal);
          return [state, state.set];
        },
        use: () => {
          const { use, change } = useQuery(atom);
          return [use(), change];
        },
        useSet: () => useQuery(atom).change,
        useValue: () => useQuery(atom).use(),
        select<U>(selector: Selector<T, U>, equal?: Equal<U>) {
          return () => useQuery(atom).select(selector, equal)();
        },
      };
      return atom;
    },

    derive<T, A extends Derivative>(init: Init<T>, derive: Derive<T, A>, equal?: Equal<T>) {
      const map = new WeakMap<Unit<T>, A>();
      const atom: DeriveAtom<T, A> = {
        [UNIT]: (_query, use) => {
          const state = unit(typeof init === "function" ? (init as () => T)() : init, equal);
          const derivative = derive(state, use);
          map.set(state, derivative);
          return [state, derivative];
        },
        use: () => {
          const state = useQuery(atom);
          return [state.use(), map.get(state)!];
        },
        useDerived: () => map.get(useQuery(atom))!,
        useValue: () => useQuery(atom).use(),
        select<U>(selector: Selector<T, U>, equal?: Equal<U>) {
          return () => useQuery(atom).select(selector, equal)();
        },
      };
      return atom;
    },

    computed<T>(compute: (use: UseValue) => T, equal?: Equal<T>) {
      const atom: ComputedAtom<T> = {
        [UNIT]: (query) => {
          let deps = new Set<AnyAtom>();
          let use = (a: AnyAtom) => (deps.add(a), query(a).get());
          const state = unit(compute(use), equal);
          use = (a: AnyAtom) => query(a).get();
          const update = () => state.change(compute(use));
          deps.forEach((a) => query(a).listen(update));
          return [state, null];
        },
        use: () => useQuery(atom).use(),
        select<U>(selector: Selector<T, U>, equal?: Equal<U>) {
          return () => useQuery(atom).select(selector, equal)();
        },
      };
      return atom;
    },
  };

  function mutate<T extends Function>(init: (use: UseAtom) => T) {
    const _q2m_ = new WeakMap<Query, T>();
    return {
      use(): T {
        const query = useContext(Context);
        if (!query) throw new Error("Local atom must be used within its Provider");
        let fn = _q2m_.get(query);
        if (fn) return fn;
        fn = init(_q2u_.get(query)!);
        return (_q2m_.set(query, fn), fn);
      },
    };
  }

  function Provider({ children }: PropsWithChildren<{}>) {
    const [value] = useState(build);
    return <Context.Provider value={value}>{children}</Context.Provider>;
  }

  return [Provider, define, mutate] as const;
}
