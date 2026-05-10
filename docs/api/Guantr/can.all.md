---
description: 'Reference for can.all — batch permission check that returns true only if every check in the array is granted. Context is resolved once and shared across all checks.'
---

# API: `Guantr.prototype.can.all`

The `can.all` sub-method performs a **batch permission check** — it returns `true` only if **every** check in the array is granted. It resolves the evaluation context once and shares it across all checks, and short-circuits on the first `false` result.

> **Use this for decisions that depend on multiple permissions** (e.g. "should the user see the full management toolbar?").

## Signature

```ts
can.all(
  checks: Array<[action: string, resource: [resourceKey: string, resourceInstance: object]]>,
): Promise<boolean>;
```

## Parameters

- **`checks`**: An array of check tuples. Each tuple is `[action, [resourceKey, resourceInstance]]`:
  - `action`: (`string`) The action being checked.
  - `resource`: A tuple `[string, object]` of resource key and resource instance.

## Returns

- `Promise<boolean>`:
  - `true` if **every** check is granted.
  - `false` as soon as any check is denied (short-circuits).
  - `true` for an **empty array** (vacuous truth — all zero checks pass).

## How it works

1. **Resolves context once.** The `context` option is resolved once and its result is shared across every check in the array.
2. Iterates through the checks **in order**.
3. For each check, performs the same evaluation as [`can()`](./can): queries relevant rules, evaluates conditions against the resource instance and shared context.
4. **Short-circuits on the first `false`.** Remaining checks are not evaluated.
5. Returns `true` if all checks passed.

## Empty array behavior

An empty array of checks always returns `true` (vacuous truth):

```ts
await guantr.can.all([]); // true
```

## Context sharing

The context is resolved exactly once per `can.all()` call, not once per individual check. This is more efficient than calling `can()` in a loop.

```ts
const guantr = await createGuantr({
  context: async () => {
    console.log('context called');
    return { userId: 1 };
  },
});

await guantr.can.all([
  ['read', ['post', { id: 1 }]],
  ['edit', ['post', { id: 1 }]],
  ['delete', ['post', { id: 1 }]],
]);
// "context called" logged only once
```

## Caching

Individual check results within a `can.all` call are **not** independently cached — `_evaluateCheck` is called directly without the per-check cache layer. However, subsequent `can()` calls for the same action/resource/context may hit the cache.

## Short-circuit behavior

Because `can.all` stops on the first `false`:

- Place the cheapest/fastest-to-evaluate checks first for best performance.
- Checks that are most likely to fail should come early.
- Later checks might never run — avoid side effects in check definitions.

## Examples

### Basic usage

```ts
const post = { id: 1, title: 'Hello', status: 'draft', ownerId: 'user-1' };

// Check if user has full management access
const canManage = await guantr.can.all([
  ['read', ['post', post]],
  ['update', ['post', post]],
  ['delete', ['post', post]],
]);
// true only if ALL three actions are allowed
```

### Mixed resource keys

```ts
const result = await guantr.can.all([
  ['read', ['post', { id: 1 }]],
  ['read', ['comment', { id: 5, postId: 1 }]],
  ['read', ['user', { id: 1 }]],
]);
```

### Short-circuit: first failing check

```ts
// If 'delete' is denied, 'archive' is never evaluated
const result = await guantr.can.all([
  ['read', ['post', post]], // true → continue
  ['delete', ['post', post]], // false → short-circuit, return false
  ['archive', ['post', post]], // never evaluated
]);
// false
```

### With shared context

```ts
const guantr = await createGuantr<MyMeta>({
  context: () => ({ userId: getCurrentUserId() }),
  // Called once even though we check 3 permissions
});

await guantr.can.all([
  ['update', ['post', { authorId: 1 }]],
  ['delete', ['post', { authorId: 1 }]],
]);
```

### When no rules exist

```ts
await guantr.can.all([
  ['read', ['post', { id: 1 }]],
  ['edit', ['post', { id: 1 }]],
]);
// false — all checks fail (no allow rules, implicit deny)
```

## See also

- [`can.any`](./can.any) — Check if **any** permission is granted.
- [`cannot.all`](./cannot.all) — Check if **all** permissions are denied (`!can.any()`).
- [`cannot.any`](./cannot.any) — Check if **any** permission is denied (`!can.all()`).
- [`can`](./can) — Single permission check.
