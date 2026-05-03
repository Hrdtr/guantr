# API: `Guantr` Constructor

The `Guantr` class can be instantiated directly using the `new` keyword as an alternative to the `createGuantr()` factory function. This provides the same underlying instance but requires calling `setRules()` separately if you have initial rules.

## Importing

```ts
import { Guantr } from 'guantr';
import type { GuantrMeta, GuantrOptions } from 'guantr';
```

## Constructor Signature

```ts
class Guantr<
  Meta extends GuantrMeta<GuantrResourceMap> | undefined = undefined,
  Context extends Record<string, unknown> = Record<string, unknown>,
> {
  constructor(options?: GuantrOptions<Context>);
}
```

## Generics

- `Meta`: (Optional) Extends `GuantrMeta`. Provides strong typing for resources, actions, models, and context.
- `Context`: (Optional) Extends `Record<string, unknown>`. Defines the shape of the context object returned by `getContext`. Defaults to `Record<string, unknown>`.

## Parameters

- `options`: (Optional) A `GuantrOptions` object containing:
  - `storage`: An instance implementing the `Storage` interface. Defaults to `InMemoryStorage`.
  - `getContext`: An asynchronous function `() => Context | PromiseLike<Context>` that returns the context object. Defaults to a function returning an empty object.
  - `maxRuleIterations`: Maximum number of rule iterations before the circuit breaker trips. Defaults to `1000`.
  - `strict`: Enable strict validation mode. Defaults to `false`. See [Strict Mode](/advanced-usage/strict-mode).

## Returns

- A `Guantr<Meta, Context>` instance.

## Comparison with `createGuantr()`

| Feature               | `new Guantr(options)`           | `createGuantr(options)`             |
| --------------------- | ------------------------------- | ----------------------------------- |
| Initial rules         | ❌ Must call `setRules()` after | ✅ Can pass rules as first argument |
| Rules callback syntax | ❌ Not supported directly       | ✅ Supported                        |
| Storage & context     | ✅ Via `options`                | ✅ Via `options`                    |
| Type inference        | ✅ Full generic support         | ✅ Full generic support             |

**When to use `new Guantr()`:**

- You need to defer rule setting until later, or set rules conditionally.
- You're building a custom abstraction that wraps the `Guantr` class.
- You prefer explicit constructor-based instantiation.

**When to use `createGuantr()`:**

- You want to set initial rules in a single call (most common case).
- You prefer the callback-based rule definition syntax.
- You want the simplest, most concise setup.

## Examples

**Basic instantiation (no rules, no context):**

```ts
import { Guantr } from 'guantr';

const guantr = new Guantr();

// Set rules later
await guantr.setRules((allow, deny) => {
  allow('read', 'article');
});
```

**With custom storage and context:**

```ts
import { Guantr } from 'guantr';
import { MyCustomStorage } from './my-storage-adapter';

type MyContext = { userId: string | null };

const guantr = new Guantr<MyMeta, MyContext>({
  storage: new MyCustomStorage(),
  getContext: async () => {
    const user = await getCurrentUser();
    return { userId: user?.id ?? null };
  },
});
```

**With strict mode and custom maxRuleIterations:**

```ts
const guantr = new Guantr({
  strict: true,
  maxRuleIterations: 500,
});
```

## See Also

- [`createGuantr()`](/api/createGuantr) — The recommended factory function for most use cases.
- [`.setRules()`](/api/Guantr/setRules) — Method to set rules after instantiation.
- [Strict Mode](/advanced-usage/strict-mode) — Details on strict validation.
