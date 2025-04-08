# API: `createGuantr`

The `createGuantr` function is the primary factory for creating instances of the `Guantr` class. It's designed to be flexible, allowing initialization with optional rules, context providers, and custom storage adapters.

## Importing

```ts
import { createGuantr } from 'guantr';
import type { GuantrMeta, GuantrRule, GuantrOptions } from 'guantr'; // Import relevant types
```

## Function Signatures

`createGuantr` is asynchronous and has several overload signatures for convenience:

```ts
// Initialize with options (including context and storage)
declare function createGuantr<Meta extends GuantrMeta<any> | undefined = undefined, Context extends Record<string, unknown> = Record<string, unknown>>(
  options?: GuantrOptions<Context>
): Promise<Guantr<Meta, Context>>;

// Initialize with rules array and optionally options
declare function createGuantr<Meta extends GuantrMeta<any> | undefined = undefined, Context extends Record<string, unknown> = Record<string, unknown>>(
  rules: GuantrRule<Meta, Context>[],
  options?: GuantrOptions<Context>
): Promise<Guantr<Meta, Context>>;

// Initialize with rules callback and optionally options
declare function createGuantr<Meta extends GuantrMeta<any> | undefined = undefined, Context extends Record<string, unknown> = Record<string, unknown>>(
  setRulesCallback: SetRulesCallback<Meta, Context>,
  options?: GuantrOptions<Context>
): Promise<Guantr<Meta, Context>>;

// Initialize with no arguments (uses defaults)
declare function createGuantr<Meta extends GuantrMeta<any> | undefined = undefined, Context extends Record<string, unknown> = Record<string, unknown>>(
): Promise<Guantr<Meta, Context>>;
```

## Generics

* `Meta`: (Optional) Extends `GuantrMeta`. Provides strong typing for resources, actions, models, and context if defined. Enhances type safety during rule definition and checks.
* `Context`: (Optional) Extends `Record<string, unknown>`. Defines the shape of the context object returned by `getContext`. Defaults to `Record<string, unknown>`.

## Parameters

* `setRulesOrOptions` / `rules` / `setRulesCallback`: (Optional) The initial rules definition. Can be:
    * An array of `GuantrRule` objects.
    * An asynchronous callback function `(allow, deny) => void` for defining rules programmatically (see `setRules` documentation).
    * Omitted, in which case initialization uses only options or defaults.
* `options`: (Optional) A `GuantrOptions` object containing:
    * `storage`: An instance implementing the `Storage` interface (from `guantr/storage`). Defaults to `InMemoryStorage`.
    * `getContext`: An asynchronous function `() => Context | PromiseLike<Context>` that returns the context object used when evaluating rules with `$ctx` operands. Defaults to a function returning an empty object.



## Returns

* `Promise<Guantr<Meta, Context>>`: A promise that resolves to a fully initialized `Guantr` instance.

## Examples

**Basic Initialization**

```ts
const guantr = await createGuantr();
// Uses InMemoryStorage, no initial rules, no context
```

**With Initial Rules (Array)**

```ts
const initialRules: GuantrRule[] = [
  { effect: 'allow', action: 'read', resource: 'publicInfo', condition: null }
];
const guantrWithRules = await createGuantr(initialRules);
```

**With Initial Rules (Callback)**

```ts
const guantrWithCallback = await createGuantr(async (allow, deny) => {
  allow('read', 'publicInfo');
});
```

**With Custom Storage and Context**

```ts
import { MyCustomStorage } from './my-storage-adapter';
import { getCurrentUser } from './auth';

type MyContext = { userId: string | null };

const guantrWithOptions = await createGuantr<MyMeta, MyContext>({
  storage: new MyCustomStorage(),
  getContext: async () => {
    const user = await getCurrentUser();
    return { userId: user?.id ?? null };
  }
});
```

**With Rules and Options**

```ts
const guantrCombo = await createGuantr<MyMeta, MyContext>(
  async (allow, deny) => { // Rules callback
    allow('read', 'publicInfo');
  },
  { // Options object
    storage: new MyCustomStorage(),
    getContext: async () => ({ userId: null })
  }
);
```
