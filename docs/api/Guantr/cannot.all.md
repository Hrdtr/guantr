# API: `Guantr.prototype.cannot.all`

The `cannot.all` sub-method performs a **batch permission check** — it returns `true` only if **every** check in the array is denied. It is the logical negation of [`can.any`](./can.any).

> **Use this for decisions that need to verify a set of actions are all unavailable** (e.g. "should we hide the entire management section?").

## Signature

```ts
cannot.all(
  checks: Array<[action: string, resource: [resourceKey: string, resourceInstance: object]]>,
): Promise<boolean>;
```

## Parameters

- **`checks`**: An array of check tuples. Each tuple is `[action, [resourceKey, resourceInstance]]`.

## Returns

- `Promise<boolean>`:
  - `true` if **every** check is denied.
  - `false` as soon as **any** check is granted (short-circuits).
  - `true` for an **empty array** (vacuous truth).

## Implementation

```ts
cannot.all(checks) === !(await can.any(checks));
```

This means:

- If any check is granted → `can.any` returns `true` → `cannot.all` returns `false`.
- If no check is granted → `can.any` returns `false` → `cannot.all` returns `true`.

## How it works

1. Resolves context **once** and shares it across all checks.
2. Delegates to `can.any` — if any check passes, returns `false`; otherwise returns `true`.
3. Short-circuits when a check is granted (via `can.any`'s short-circuit on first `true`).

## Empty array behavior

Returns `true` (vacuous truth — all zero checks are denied):

```ts
await guantr.cannot.all([]); // true
```

## Context sharing

Context is resolved once, then shared across all checks through the underlying `can.any` call.

## Examples

### Basic usage

```ts
// Verify that a user cannot perform any destructive action
const cannotDestroy = await guantr.cannot.all([
  ['delete', ['post', post]],
  ['archive', ['post', post]],
  ['ban', ['user', user]],
]);
// true only if ALL actions are denied
```

### With no rules (implicitly denied)

```ts
// No rules exist → all permissions are implicitly denied
const result = await guantr.cannot.all([
  ['delete', ['post', { id: 1 }]],
  ['archive', ['post', { id: 1 }]],
]);
// true (both are implicitly denied)
```

### Short-circuit: any check is allowed

```ts
// user can read, so not all are denied
const result = await guantr.cannot.all([
  ['read', ['post', post]], // allowed → short-circuit, return false
  ['delete', ['post', post]], // never evaluated
  ['archive', ['post', post]], // never evaluated
]);
// false
```

### UI pattern: hide a section entirely

```ts
const shouldHide = await guantr.cannot.all([
  ['read', ['dashboard', {}]],
  ['viewReports', ['dashboard', {}]],
  ['manageUsers', ['dashboard', {}]],
]);

if (shouldHide) {
  // Don't render the dashboard section at all
}
```

## See also

- [`cannot.any`](./cannot.any) — Check if **any** permission is denied.
- [`can.all`](./can.all) — Check if **all** permissions are granted.
- [`can.any`](./can.any) — Check if **any** permission is granted.
- [`cannot`](./cannot) — Single permission check.
