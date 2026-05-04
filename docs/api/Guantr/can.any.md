# API: `Guantr.prototype.can.any`

The `can.any` sub-method performs a **batch permission check** — it returns `true` if **any** of the specified permissions is granted. It resolves the context once and shares it across every check, and short-circuits on the first `true` result.

> **Use this for UI decisions** that depend on at least one permission (e.g. "should we show the interaction buttons?"). For single permission checks, use [`can(action, [resourceKey, instance])`](./can).

## Signature

```ts
guantr.can.any(
  checks: Array<[action, [resourceKey, resourceInstance]]>,
): Promise<boolean>
```

### Type signature (with Meta)

```ts
// With typed Meta, each check tuple is narrowed to the resource map:
guantr.can.any([
  [action: PostAction, resource: ['post', Post]],
  [action: UserAction, resource: ['user', User]],
  // ...
])
```

## Parameters

- `checks`: An array of check tuples. Each tuple is:
  - `action`: (`string`) The action being checked (e.g. `'read'`, `'update'`).
  - `resource`: (`[string, object]`) A tuple of `[resourceKey, resourceInstance]` (e.g. `['post', { id: 1, status: 'draft' }]`).

## Returns

- `Promise<boolean>`: Resolves to:
  - `true` as soon as **any** check is granted (short-circuits).
  - `false` if **no** check is granted.

## How it Works

1. **Resolves context once** — the `getContext` function is called a single time and the result is shared across all checks.
2. Iterates through the checks in order.
3. For each check, performs the same evaluation as [`can()`](./can): queries relevant rules, evaluates conditions against the resource instance and resolved context, and checks for matching allow/deny rules.
4. **Short-circuits** on the first `true` — remaining checks are not evaluated.
5. Returns `true` if any check passed, `false` otherwise.

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
// → true if at least ONE action is allowed
```

### With overlapping allow/deny rules

```ts
// Even if a specific action is denied, other actions may still be allowed
const canDoSomething = await guantr.can.any([
  ['delete', ['post', { status: 'published' }]], // denied
  ['read', ['post', { status: 'published' }]], // allowed → short-circuits here
]);
// → true
```

### With shared context

```ts
const guantr = await createGuantr({
  getContext: () => ({ userId: 1 }),
});

const post = { id: 1, authorId: 1 };
// getContext is called only once for the batch
const result = await guantr.can.any([
  ['update', ['post', post]],
  ['delete', ['post', post]],
]);
```

### Empty checks array

Returns `false` (vacuous false — no check in an empty set can pass).

```ts
await guantr.can.any([]); // → false
```

## Short-circuit Behavior

`can.any` stops evaluating as soon as any check returns `true`. This means:

- Place the most likely-to-pass check first for best performance.
- Side effects in later checks (if any) will not occur if an earlier check passes.

## See Also

- [`can.all`](./can.all) — check if ALL permissions are granted
- [`cannot.all`](./cannot.all) — check if ALL permissions are denied
- [`cannot.any`](./cannot.any) — check if ANY permission is denied
- [`can`](./can) — single permission check
