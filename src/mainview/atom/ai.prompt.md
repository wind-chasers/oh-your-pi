Atom 是一个精巧的状态管理方案
* 只依赖 react 本身
* 代码很少，但功能齐全
* 类型系统足够健壮
* 核心 API 只有 3 个：`atom` (定义状态)、`WithStore` (根组件 Provider) 和 `mutate` (定义一组操作)

`<WithStore>...</WithStore>` 只需要套在应用的最外层即可，此处不赘述

## 基础介绍
首先了解两个类型定义
```ts
type Reduce<T> = (data: T) => T;
type Change<T> = (ch: Reduce<T> | T) => void;
```
后文多次提到的 set 函数，类型均为 `Change<T>`, 行为与 React.useState 的 setter 一致

通过 `atom` 函数可以创建 Value Atom、Derive Atom 和 Computed Atom

### 1. Value Atom
基础的用法如下，代码中的 `set` 的类型是 `Change<T>`
```tsx
const priceAtom = atom(100);
function Component1() {
  const [price, set] = priceAtom.use();
  return <div>{price}</div>;
}
function Component2() {
  // useSet 只获取 setter，priceAtom 的值发生变化不会导致 Component2 重新渲染
  const set = priceAtom.useSet();
  return <button onClick={() => set(150)}>increase</button>;
}
```
`use()` 同时返回当前值和 setter；`useValue()` 只返回当前值。这两种调用都会订阅状态变化。`useSet()` 只返回 setter，不会建立订阅。

### 2. Derive Atom
在 Value Atom 的基础上，增加一组由状态单元派生出来的操作
```tsx
// `get` 总是返回最新值，`set` 的类型是 `Change<T>`
const priceAtom = atom(100, ({ get, set }) => {
  return {
    increase: (delta: number) => set(get() + delta),
    decrease: (delta: number) => set((prev) => prev - delta),
  };
});
function Component1() {
  const [price, actions] = priceAtom.use();
  return <div>{price}</div>;
}
function Component2() {
  // useDerived 只获取派生操作，priceAtom 的值发生变化不会导致 Component2 重新渲染
  const actions = priceAtom.useDerived();
  return <button onClick={() => actions.increase(1)}>increase</button>;
}
```
`use()` 同时返回当前值和派生操作；`useValue()` 只订阅并返回当前值；`useDerived()` 只返回派生操作，不会建立订阅。

通过 Derive Atom，可以按需把复杂操作封装成函数，方便在不同组件中复用。
派生操作可以是同步的，也可以是异步的。例如，可以从服务器拉取数据后更新 atom，从而把通用业务操作提炼为共用逻辑。

### 3. Computed Atom
这是一种只读原子，它的值是通过其他原子计算得来的
```tsx
const priceAtom = atom(100);
const taxAtom = atom(0.1);
const totalAtom = atom((use) => use(priceAtom) * (1 + use(taxAtom)));
function Component() {
  // Computed Atom 只能使用 use 获取值，没有 setter 或派生操作
  const total = totalAtom.use();
  return <div>{total}</div>;
}
```
创建 Computed Atom 时获得的 `use` 可以读取任意其它 atom（包括 Value Atom、Derive Atom 和 Computed Atom）的当前值，并自动订阅这些依赖；依赖变化时会重新计算当前 Computed Atom。

## 进阶用法

### 1. Derive Atom 也可以读取和修改其它 atom
```ts
const a = atom(1);
const b = atom(2);
const c = atom(3, ({ set }, use) => {
  function add(delta: number) {
    const [a_val, setA] = use(a);
    const [b_val, setB] = use(b);
    set(a_val + b_val + delta * 2);
    setA(a_val + delta);
    setB(b_val + delta);
  }
  return { add };
});
```

创建 Derive Atom 时还会获得一个 `use` 方法。它可以接受任意类型的 atom：
* 传入 Value Atom 时，返回 `[value, set]` 元组
* 传入 Derive Atom 时，返回 `[value, derived]` 元组
* 传入 Computed Atom 时，只返回它的值

这里的 `use` 只读取其它 atom 的最新值，不会建立订阅关系；其它 atom 的变化不会重新创建派生操作。它不是 React Hook，可以在派生操作执行期间调用。

### 2. 异步初始化
有的时候，我们希望 atom 的初始值来自服务器，但这个异步过程并不适合放在组件里执行，此时可以这么来巧妙的实现
```ts
type Product = { /* ... */ };
const productsAtom = atom([] as Product[], ({ get, set }) => {
  async function initialize() {
    set(await fetchProductsFromServer());
  }
  initialize();

  function deleteProduct(id: string) {
    set(get().filter(product => product.id !== id));
  }
  return { deleteProduct };
});
```

`initialize` 不会在定义 atom 时执行，只会在当前 Store 中第一次访问 `productsAtom` 时调用一次。访问包括：
* 被 Computed Atom 读取
* 被 Derive Atom 或 `mutate` 通过 `use` 读取
* 组件调用 `productsAtom.use()`、`useValue()` 或 `useDerived()`

依此类推，这种异步初始化的策略，也适合其它场景

### 3. 结合 immer（或mutative等） 使用
当 atom 的值是一个复杂对象时，直接修改这个对象会比较麻烦，这里以 immer 为例来简化操作

```tsx
import { produce } from 'immer';
type Product = { /* ... */ };
const productsAtom = atom([] as Product[]);
function Component() {
  const setProducts = productsAtom.useSet();
  function add(item: Product) {
    setProducts(produce((draft) => {
      draft.push(item);
    }));
  }
  return (/* ... */);
}
```

```ts
import { produce } from 'immer';
type Product = { /* ... */ };
const productsAtom = atom([] as Product[], ({ set }) => {
  function add(item: Product) {
    set(produce((draft) => {
      draft.push(item);
    }));
  }
  return { add };
});
```

### 4. 使用 mutate 定义一组操作
当我们需要对多个 atom 进行联合操作时，可以使用 mutate 定义可复用的函数
```tsx
const price1Atom = atom(100);
const price2Atom = atom(200);

const discountMutation = mutate((use) => (percent: number) => {
  const [price1, setPrice1] = use(price1Atom);
  const [price2, setPrice2] = use(price2Atom);
  setPrice1(price1 * percent);
  setPrice2(price2 * percent);
});

function Component() {
  const discount = discountMutation.use();
  return <button onClick={() => discount(0.1)}>打折</button>;
}
```
