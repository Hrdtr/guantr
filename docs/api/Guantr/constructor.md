---
description: 'Reference for the Guantr constructor — direct instantiation with new Guantr() as an alternative to createGuantr(). Accepts options but requires a separate setRules() call.'
---

# API: `Guantr` Constructor

The `Guantr` class can be instantiated directly with `new` as an alternative to `createGuantr()`. The constructor accepts options (storage, context, circuit breaker) but does not accept initial rules — you must call `setRules()` separately after construction.

## Importing

```ts
import { Guantr } from 'guantr';
import type { GuantrMeta, GuantrOptions } from 'guantr';
```

## Constructor Signature

```ts
class Guantr<Meta> {
  constructor(options?: GuantrOptions<GuantrContextFromMeta<Meta>>);
}
```

## Generics

- **`Meta`**: (Optional) The same `GuantrMeta<ResourceMap, Context>` type passed to all Guantr APIs. When omitted, untyped mode is used.

## Parameters

- **`options`**: (Optional) A `GuantrOptions` object.

| Property            | Type                                                 | Default           | Description                                                                                                              |
| ------------------- | ---------------------------------------------------- | ----------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `context`           | `Context \| (() => Context \| PromiseLike<Context>)` | `{}`              | Evaluation context (static object) or a function that resolves it on each check.                                         |
| `storage`           | `Storage`                                            | `InMemoryStorage` | Custom storage adapter.                                                                                                  |
| `maxRuleIterations` | `number`                                             | `1000`            | Maximum rule evaluations per check. Must be a positive integer; a `TypeError` is thrown at construction time if invalid. |

## Returns

- `Guantr<Meta>` — A new instance with the configured storage, context provider, and circuit breaker limit. The instance `can` and `cannot` callables are immediately usable (though no rules are set yet).

## Comparison with `createGuantr`

| Feature              | `new Guantr(options)`                   | `createGuantr(options)`          |
| -------------------- | --------------------------------------- | -------------------------------- |
| Initial rules        | Must call `setRules()` separately       | Can pass rules as first argument |
| Rule callback syntax | Not directly — use `setRules(callback)` | Supported as first argument      |
| Rule array syntax    | Not directly — use `setRules(array)`    | Supported as first argument      |
| Storage & context    | Via `options`                           | Via `options`                    |
| Type inference       | Full generic support                    | Full generic support             |
| Return               | Synchronous                             | `Promise<Guantr<Meta>>`          |

The `createGuantr` factory is equivalent to `new Guantr(options)` followed by `setRules(rules)` when rules are provided. Use `new Guantr()` when you always intend to call `setRules()` later and don't need the convenience of inline rule definition.

## Examples

### Basic instantiation

```ts
import { Guantr } from 'guantr';

const guantr = new Guantr();

await guantr.setRules((allow, deny) => {
  allow('read', 'article');
});
```

### With custom storage and context

```ts
const guantr = new Guantr<MyMeta>({
  storage: new MyCustomStorage(),
  context: async () => {
    const user = await getCurrentUser();
    return { userId: user?.id ?? null };
  },
});

await guantr.setRules([{ effect: 'allow', action: 'read', resource: 'post' }]);
```

### With custom circuit breaker limit

```ts
const guantr = new Guantr({
  maxRuleIterations: 500,
});
```

### Invalid maxRuleIterations

```ts
// Throws TypeError: "maxRuleIterations must be a positive integer"
new Guantr({ maxRuleIterations: 0 });
new Guantr({ maxRuleIterations: -1 });
new Guantr({ maxRuleIterations: 1.5 });
```

## See also

- [`createGuantr()`](../createGuantr) — Recommended factory function with rule initialization support.
- [`setRules()`](./setRules) — Set rules after construction.
- [`can()`](./can) — Permission checking.
