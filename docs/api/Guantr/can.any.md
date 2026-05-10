---
description: 'Reference for can.any — batch permission check that returns true if any check in the array is granted. Context is resolved once and shared across all checks.'
---

# API: `Guantr.prototype.can.any`

The `can.any` sub-method performs a **batch permission check** — it returns `true` if **any** check in the array is granted. It resolves the evaluation context once and shares it across all checks, and short-circuits on the first `true` result.

> **Use this for decisions that require at least one permission** (e.g. "should we show the interaction bar?").

## Signature

```ts
can.any(
  checks: Array<[action: string, resource: [resourceKey: string, resourceInstance: object]]>,
): Promise<boolean>;
```

## Parameters

- **`checks`**: An array of check tuples. Each tuple is `[action, [resourceKey, resourceInstance]]`:
  - `action`: (`string`) The action being checked.
  - `resource`: A tuple `[string, object]` of resource key and resource instance.

## Returns

- `Promise<boolean>`:
  - `true` as soon as **any** check is granted (short-circuits).
  - `false` if **no** check is granted.
  - `false` for an **empty array** (vacuous false — no check in an empty set can pass).

## How it works

1. **Resolves context once.** The `context` option is resolved once and its result is shared across every check in the array.
2. Iterates through the checks **in order**.
3. For each check, performs the same evaluation as [`can()`](./can): queries relevant rules, evaluates conditions against the resource instance and shared context.
4. **Short-circuits on the first `true`.** Remaining checks are not evaluated.
5. Returns `false` if no check passed.

## Empty array behavior

An empty array of checks always returns `false` (vacuous false):

```ts
await guantr.can.any([]); // false
```

## Context sharing

The context is resolved exactly once per `can.any()` call, not once per individual check.

```ts
const guantr = await createGuantr({
  context: async () => {
    console.log('context called');
    return { userId: 1 };
  },
});

await guantr.can.any([
  ['read', ['post', { id: 1 }]],
  ['comment', ['post', { id: 1 }]],
]);
// "context called" logged only once
```

## Caching

Individual check results within a `can.any` call are **not** independently cached — the raw evaluation path is called directly without consulting the cache. Subsequent individual `can()` calls may still hit the cache.

## Short-circuit behavior

Because `can.any` stops on the first `true`:

- Place the most likely-to-pass checks first for best performance.
- If you expect most checks to be denied, expect near-full iteration.
- Later checks might never run — avoid side effects in check definitions.

## Examples

### Basic usage

```ts
const post = { id: 1, title: 'Hello', status: 'published' };

// Check if user can interact with this post in any way
const canInteract = await guantr.can.any([
  ['read', ['post', post]],
  ['comment', ['post', post]],
  ['share', ['post', post]],
]);
// true if at least ONE action is allowed
```

### Short-circuit: first passing check

```ts
// 'read' is allowed, so 'delete' and 'archive' are never evaluated
const result = await guantr.can.any([
  ['delete', ['post', post]], // false → continue
  ['read', ['post', post]], // true → short-circuit, return true
  ['archive', ['post', post]], // never evaluated
]);
// true
```

### When no rules exist

```ts
await guantr.can.any([
  ['read', ['post', { id: 1 }]],
  ['comment', ['post', { id: 1 }]],
]);
// false — no rules exist, all checks fail
```

### With overlapping allow/deny

```ts
// Even if 'delete' is denied, 'read' may still be allowed
const result = await guantr.can.any([
  ['delete', ['post', { status: 'published' }]], // denied
  ['read', ['post', { status: 'published' }]], // allowed → true
]);
// true
```

### Mixed resource keys

```ts
const result = await guantr.can.any([
  ['read', ['post', { id: 1 }]],
  ['read', ['document', { id: 5 }]],
]);
```

## See also

- [`can.all`](./can.all) — Check if **all** permissions are granted.
- [`cannot.all`](./cannot.all) — Check if **all** permissions are denied (`!can.any()`).
- [`cannot.any`](./cannot.any) — Check if **any** permission is denied (`!can.all()`).
- [`can`](./can) — Single permission check.
