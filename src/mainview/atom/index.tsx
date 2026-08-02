import { local } from './local';
import type { ValueAtom, ComputedAtom, DeriveAtom, Derivative, Derive, UseValue } from './local';

const [Provider, define, mutate] = local();

export function atom<T>(initial: (use: UseValue) => T): ComputedAtom<T>;
export function atom<T, A extends Derivative>(initial: T, derive: Derive<T, A>): DeriveAtom<T, A>;
export function atom<T>(initial: T): ValueAtom<T>;
export function atom(a: any, b?: any) {
	if (typeof a === "function") return define.computed(a);
	if (b) return define.derive(a, b);
	return define.value(a);
}

export {
	mutate,
	define,
	Provider as WithStore,
}

export * from './local';
export * from './unit';
