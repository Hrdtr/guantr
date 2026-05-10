---
description: 'Reference for createGuantr — the primary factory function for creating Guantr instances. Covers all four overloads, options, generics, and examples.'
---

# API: `createGuantr`

The `createGuantr` function is the primary factory for creating `Guantr` instances. It is asynchronous and supports four overloads for maximum flexibility: you can initialize with options only, with a rule array, with a rule-defining callback, or with no arguments at all.

## Importing

```ts
import { createGuantr } from 'guantr';
import type { GuantrMeta, GuantrRule, GuantrOptions } from 'guantr';
```

## Function Signatures

`createGuantr` is declared with four async overloads:

```ts
// Overload 1 — Options only (no initial rules)
async function createGuantr<Meta>(options: GuantrOptions): Promise<Guantr<Meta>>;

// Overload 2 — Callback + optional options
async function createGuantr<Meta>(
  setRules: SetRulesCallback<Meta>,
  options?: GuantrOptions,
): Promise<Guantr<Meta>>;

// Overload 3 — Rule array + optional options
async function createGuantr<Meta>(
  setRules: GuantrRule<Meta>[],
  options?: GuantrOptions,
): Promise<Guantr<Meta>>;

// Overload 4 — No arguments (bare instance)
async function createGuantr<Meta>(): Promise<Guantr<Meta>>;
```

### Overload dispatch logic

The first argument is inspected at runtime:

- If it is an **array** (overload 3) or a **function** (overload 2), it is treated as the rules argument; the second argument (if provided) becomes `options`.
- If it is an **object** (overload 1) or **omitted** (overload 4), it is treated as `options`.

When rules are provided, `setRules()` is called on the new instance immediately, meaning the instance is fully initialized before the returned promise resolves.

## Generics

- **`Meta`**: (Optional) A `GuantrMeta<ResourceMap, Context>` type object that provides strong typing for resources, actions, models, and context. When omitted, all resource keys and actions default to `string`, models default to `Record<string, unknown>`, and context defaults to `Record<string, unknown>`.

## Parameters

### `options` (`GuantrOptions`)

| Property            | Type                                                 | Default           | Description                                                                                                                                             |
| ------------------- | ---------------------------------------------------- | ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `context`           | `Context \| (() => Context \| PromiseLike<Context>)` | `{}`              | Evaluation context (static object) or a function that resolves it on each `can`/`cannot` check (once per batch for `can.all`/`can.any` etc.).           |
| `storage`           | `Storage`                                            | `InMemoryStorage` | Custom storage adapter implementing the `Storage` interface. Store rules in a database, Redis, or any backend of your choice.                           |
| `maxRuleIterations` | `number`                                             | `1000`            | Maximum number of rule evaluations per `can`/`cannot` check before the circuit breaker trips. Must be a positive integer; throws `TypeError` otherwise. |

### `setRules` (callback)

A `SetRulesCallback<Meta>` function receiving two helper functions:

```ts
type SetRulesCallback<Meta> = (
  allow: (action: string, resource: string | [string, MatchConditionFn | Condition | null]) => void,
  deny: (action: string, resource: string | [string, MatchConditionFn | Condition | null]) => void,
) => void | Promise<void>;
```

- `allow(action, resource)` — Registers an `allow` rule.
- `deny(action, resource)` — Registers a `deny` rule.

The `resource` argument can be:

- A **string** — an unconditional rule (no `matchCondition`).
- A **tuple** `[resourceKey, matchCondition]` — a conditional rule. `matchCondition` can be a builder function (`MatchConditionFn`) that immediately produces a serialized `Condition`, a pre-built `Condition` object, or `null` (which is treated as unconditional).

Both `allow` and `deny` are synchronous — they build rule objects in memory. The callback itself may be `async`.

### `setRules` (array)

An array of `GuantrRule<Meta>` objects:

```ts
type GuantrRule<Meta> = {
  resource: string;
  action: string;
  matchCondition?: MatchConditionFn | Condition | null;
  effect: 'allow' | 'deny';
};
```

When a `matchCondition` is a function (`MatchConditionFn`), it is **executed immediately** during `createGuantr` and the resulting serialized `Condition` AST is stored in its place.

## Returns

- `Promise<Guantr<Meta>>` — A fully initialized `Guantr` instance. If rules were provided, they are already stored before the promise resolves.

## Examples

### Bare instance (no rules, no options)

```ts
const guantr = await createGuantr();
// Set rules later
await guantr.setRules((allow, deny) => {
  allow('read', 'post');
});
```

### With options only

```ts
const guantr = await createGuantr<MyMeta>({
  storage: new MyCustomStorage(),
  context: async () => {
    const user = await getCurrentUser();
    return { userId: user?.id ?? null };
  },
  maxRuleIterations: 2000,
});
```

### With rule array

```ts
const guantr = await createGuantr<MyMeta>([
  { effect: 'allow', action: 'read', resource: 'post' },
  {
    effect: 'deny',
    action: 'read',
    resource: 'post',
    matchCondition: ({ eq, resource, literal }) => eq(resource('archived'), literal(true)),
  },
]);
```

### With callback + options

```ts
const guantr = await createGuantr<MyMeta>(
  async (allow, deny) => {
    allow('read', 'post');
    allow('edit', [
      'post',
      ({ eq, resource, context }) => eq(resource('ownerId'), context('userId')),
    ]);
    deny('delete', [
      'post',
      ({ eq, resource, literal }) => eq(resource('status'), literal('archived')),
    ]);
  },
  {
    storage: new MyCustomStorage(),
    context: async () => ({ userId: getCurrentUserId() }),
  },
);
```

### With a pre-built Condition object

```ts
import { createMatchConditionBuilder } from 'guantr';

const builder = createMatchConditionBuilder();
const archivedCondition = builder.eq(builder.resource('status'), builder.literal('archived'));

const guantr = await createGuantr([
  { effect: 'allow', action: 'read', resource: 'post' },
  {
    effect: 'deny',
    action: 'read',
    resource: 'post',
    matchCondition: archivedCondition, // pre-built, no function wrapper
  },
]);
```

## Circuit breaker

When `maxRuleIterations` is exceeded during a `can`/`cannot` evaluation, the check throws a `GuantrCircuitBreakerError` instead of returning `false`. This prevents unbounded rule evaluation loops.

```ts
const guantr = await createGuantr({ maxRuleIterations: 10 });
// If a check evaluates more than 10 rules, GuantrCircuitBreakerError is thrown.
```

## See also

- [`new Guantr()`](./Guantr/constructor) — Alternative direct construction.
- [`setRules()`](./Guantr/setRules) — Update rules after creation.
- [Error Classes](./error-classes) — `GuantrCircuitBreakerError` and `GuantrInvalidConditionKeyError`.
