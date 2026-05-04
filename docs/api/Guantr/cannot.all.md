# API: `Guantr.prototype.cannot.all`

The `cannot.all` sub-method performs a **batch permission check** — it returns `true` only if **all** of the specified permissions are denied. It resolves the context once and shares it across every check. It is the logical negation of [`can.any`](./can.any): `cannot.all(checks) === !can.any(checks)`.

> **Use this for UI decisions** that need to verify a set of actions are all unavailable (e.g. "should we hide the entire management section?"). For single permission checks, use [`cannot(action, [resourceKey, instance])`](./cannot).

## Signature

```ts
guantr.cannot.all(
  checks: Array<[action, [resourceKey, resourceInstance]]>,
): Promise<boolean>
```

### Type signature (with Meta)

```ts
// With typed Meta, each check tuple is narrowed to the resource map:
guantr.cannot.all([
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
  - `true` if **every** check in the array is denied.
  - `false` as soon as **any** check is granted (short-circuits).

## How it Works

`cannot.all` is implemented as `!can.any(checks)`. It:

1. Resolves context once.
2. Delegates to `can.any` — if any check is granted, `can.any` returns `true`, so `cannot.all` returns `false`.
3. If no check is granted, `can.any` returns `false`, so `cannot.all` returns `true`.

## Examples

### Basic usage

```ts
// Verify that a user cannot perform any destructive action
const cannotDestroy = await guantr.cannot.all([
  ['delete', ['post', post]],
  ['archive', ['post', post]],
  ['ban', ['user', user]],
]);
// → true only if ALL actions are denied
```

### With no rules (implicitly denied)

```ts
// When no rules exist, all permissions are implicitly denied
const result = await guantr.cannot.all([
  ['delete', ['post', { id: 1 }]],
  ['archive', ['post', { id: 1 }]],
]);
// → true (both are implicitly denied)
```

### Empty checks array

Returns `true` (vacuous truth — all zero checks are denied).

```ts
await guantr.cannot.all([]); // → true
```

## See Also

- [`cannot.any`](./cannot.any) — check if ANY permission is denied
- [`can.all`](./can.all) — check if ALL permissions are granted
- [`can.any`](./can.any) — check if ANY permission is granted
- [`cannot`](./cannot) — single permission check
