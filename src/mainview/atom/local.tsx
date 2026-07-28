import { createContext, useContext, useMemo } from "react";
import type { PropsWithChildren } from "react";
import { unit, type Change, type Unit } from "./unit";

export function local<T, A extends { [k: string]: Function }>(
  initVal: T | (() => T),
  makeActions: (get: () => T, set: Change<T>) => A,
  equal?: ((prev: T, next: T) => boolean),
) {
  const Context = createContext<Unit<T> | null>(null);

  function build() {
    const init = typeof initVal === "function" ? (initVal as () => T)() : initVal;
    return unit(init, equal);
  }

  function Provider({ children }: PropsWithChildren<{}>) {
    const value = useMemo(build, []);
    return <Context.Provider value={value}>{children}</Context.Provider>;
  }

  function useState() {
    const state = useContext(Context);
    if (state) return state;
    throw new Error("Local context must be used within a Provider");
  }

  function useData() {
    return useState().use();
  }

  const lazyMap = new WeakMap<Unit<T>, A>();
  function lazy(state: Unit<T>) {
    let actions = lazyMap.get(state);
    if (!actions) {
      actions = makeActions(state.get, state.set);
      lazyMap.set(state, actions);
    }
    return actions;
  }

  function useChange() {
    return lazy(useState());
  }

  function use() {
    const state = useState();
    const actions = lazy(state);
    return [state.use(), actions] as const;
  }

  const atom = { useData, useChange, use };

  return [Provider, atom] as const;
}
