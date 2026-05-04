# API: `Guantr.prototype.can.all`

The `can.all` sub-method performs a **batch permission check** — it returns `true` only if **all** of the specified permissions are granted. It resolves the context once and shares it across every check, and short-circuits on the first `false` result.

> **Use this for UI decisions** that depend on multiple permissions (e.g. "should the user see the full management toolbar?"). For single permission checks, use [`can(action, [resourceKey, instance])`](./can).

## Signature

```ts
guantr.can.all(
  checks: Array<[action, [resourceKey, resourceInstance]]>,
): Promise<boolean>
```

### Type signature (with Meta)

```ts
// With typed Meta, each check tuple is narrowed to the resource map:
guantr.can.all([
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
  - `true` if **every** check in the array is granted.
  - `false` as soon as **any** check is denied (short-circuits).

## How it Works

1. **Resolves context once** — the `getContext` function is called a single time and the result is shared across all checks.
2. Iterates through the checks in order.
3. For each check, performs the same evaluation as [`can()`](./can): queries relevant rules, evaluates conditions against the resource instance and resolved context, and checks for matching allow/deny rules.
4. **Short-circuits** on the first `false` — remaining checks are not evaluated.
5. Returns `true` if all checks passed, `false` otherwise.

## Examples

### Basic usage

```ts
const post = { id: 1, title: 'Hello', status: 'draft' };

// Check if user can manage this post
const canManage = await guantr.can.all([
  ['read', ['post', post]],
  ['update', ['post', post]],
  ['delete', ['post', post]],
]);
// → true only if ALL three actions are allowed on this post
```

### With shared context

```ts
// Context is resolved once — not once per check
const guantr = await createGuantr({
  getContext: () => ({ userId: 1 }),
});

const myPost = { id: 1, authorId: 1, status: 'draft' };
const result = await guantr.can.all([
  ['update', ['post', myPost]],
  ['delete', ['post', myPost]],
]);
// getContext is called only once
```

### Mixed resource keys

```ts
const result = await guantr.can.all([
  ['read', ['post', { id: 1 }]],
  ['read', ['user', { id: 1 }]],
]);
```

### Empty checks array

Returns `true` (vacuous truth — all zero checks pass).

```ts
await guantr.can.all([]); // → true
```

## Short-circuit Behavior

`can.all` stops evaluating as soon as any check returns `false`. This means:

- Earlier checks should be the cheapest/quickest to evaluate for best performance.
- Side effects in later checks (if any) will not occur if an earlier check fails.

## See Also

- [`can.any`](./can.any) — check if ANY permission is granted
- [`cannot.all`](./cannot.all) — check if ALL permissions are denied
- [`cannot.any`](./cannot.any) — check if ANY permission is denied
- [`can`](./can) — single permission check
