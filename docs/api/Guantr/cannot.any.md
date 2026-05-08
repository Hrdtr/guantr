# API: `Guantr.prototype.cannot.any`

The `cannot.any` sub-method performs a **batch permission check** — it returns `true` if **any** check in the array is denied. It is the logical negation of [`can.all`](./can.all).

> **Use this for decisions that need to detect if at least one action is unavailable** (e.g. "should we warn the user that some features are locked?").

## Signature

```ts
cannot.any(
  checks: Array<[action: string, resource: [resourceKey: string, resourceInstance: object]]>,
): Promise<boolean>;
```

## Parameters

- **`checks`**: An array of check tuples. Each tuple is `[action, [resourceKey, resourceInstance]]`.

## Returns

- `Promise<boolean>`:
  - `true` as soon as **any** check is denied (short-circuits).
  - `false` if **no** check is denied (all are granted).
  - `false` for an **empty array** (vacuous false).

## Implementation

```ts
cannot.any(checks) === !(await can.all(checks));
```

This means:

- If all checks are granted → `can.all` returns `true` → `cannot.any` returns `false`.
- If any check is denied → `can.all` returns `false` → `cannot.any` returns `true`.

## How it works

1. Resolves context **once** and shares it across all checks.
2. Delegates to `can.all` — if any check fails, `can.all` returns `false`, so `cannot.any` returns `true`.
3. Short-circuits when a check is denied (via `can.all`'s short-circuit on first `false`).

## Empty array behavior

Returns `false` (vacuous false — no check in an empty set is denied):

```ts
await guantr.cannot.any([]); // false
```

## Context sharing

Context is resolved once, then shared across all checks through the underlying `can.all` call.

## Examples

### Basic usage

```ts
// Check if any action is denied for this user on this post
const anyRestricted = await guantr.cannot.any([
  ['delete', ['post', post]],
  ['archive', ['post', post]],
]);
// true if at least ONE action is denied
```

### With no rules (implicitly denied)

```ts
// No rules exist → all permissions are implicitly denied
// So "any denied" is true
const result = await guantr.cannot.any([
  ['delete', ['post', { id: 1 }]],
  ['archive', ['post', { id: 1 }]],
]);
// true (both are implicitly denied → "any" is true)
```

### Short-circuit: first denied check

```ts
// 'delete' is denied, so 'archive' is never evaluated
const result = await guantr.cannot.any([
  ['read', ['post', post]], // allowed → continue
  ['delete', ['post', post]], // denied → short-circuit, return true
  ['archive', ['post', post]], // never evaluated
]);
// true
```

### All allowed

```ts
// User has full access — all checks pass
const result = await guantr.cannot.any([
  ['read', ['post', post]], // allowed
  ['update', ['post', post]], // allowed
]);
// false — nothing is denied
```

### UI pattern: show a warning

```ts
const hasRestrictions = await guantr.cannot.any([
  ['delete', ['post', post]],
  ['archive', ['post', post]],
  ['pin', ['post', post]],
]);

if (hasRestrictions) {
  // Show a warning: "Some actions are restricted for this post"
}
```

## See also

- [`cannot.all`](./cannot.all) — Check if **all** permissions are denied.
- [`can.all`](./can.all) — Check if **all** permissions are granted.
- [`can.any`](./can.any) — Check if **any** permission is granted.
- [`cannot`](./cannot) — Single permission check.
