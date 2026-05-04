# API: `Guantr.prototype.cannot.any`

The `cannot.any` sub-method performs a **batch permission check** — it returns `true` if **any** of the specified permissions is denied. It resolves the context once and shares it across every check. It is the logical negation of [`can.all`](./can.all): `cannot.any(checks) === !can.all(checks)`.

> **Use this for UI decisions** that need to detect if at least one action is unavailable (e.g. "should we warn the user that some features are locked?"). For single permission checks, use [`cannot(action, [resourceKey, instance])`](./cannot).

## Signature

```ts
guantr.cannot.any(
  checks: Array<[action, [resourceKey, resourceInstance]]>,
): Promise<boolean>
```

### Type signature (with Meta)

```ts
// With typed Meta, each check tuple is narrowed to the resource map:
guantr.cannot.any([
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
  - `true` as soon as **any** check is denied (short-circuits).
  - `false` if **no** check is denied (all are granted).

## How it Works

`cannot.any` is implemented as `!can.all(checks)`. It:

1. Resolves context once.
2. Delegates to `can.all` — if all checks are granted, `can.all` returns `true`, so `cannot.any` returns `false`.
3. If any check is denied, `can.all` returns `false`, so `cannot.any` returns `true`.

## Examples

### Basic usage

```ts
// Check if any action is denied for this user
const anyRestricted = await guantr.cannot.any([
  ['delete', ['post', post]],
  ['archive', ['post', post]],
]);
// → true if at least ONE action is denied
```

### With no rules (implicitly denied)

```ts
// When no rules exist, all permissions are implicitly denied
// So "any denied" is true
const result = await guantr.cannot.any([
  ['delete', ['post', { id: 1 }]],
  ['archive', ['post', { id: 1 }]],
]);
// → true (both are implicitly denied, so "any" is true)
```

### Empty checks array

Returns `false` (vacuous false — no check in an empty set is denied).

```ts
await guantr.cannot.any([]); // → false
```

## See Also

- [`cannot.all`](./cannot.all) — check if ALL permissions are denied
- [`can.all`](./can.all) — check if ALL permissions are granted
- [`can.any`](./can.any) — check if ANY permission is granted
- [`cannot`](./cannot) — single permission check
