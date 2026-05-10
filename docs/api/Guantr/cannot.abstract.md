---
description: 'Reference for cannot.abstract — the logical negation of can.abstract. Returns true if no allow rule exists for the given action and resource key.'
---

# API: `Guantr.prototype.cannot.abstract`

The `cannot.abstract` sub-method is the logical negation of [`can.abstract`](./can.abstract). It returns `true` if **no** `allow` rule exists for the given action and resource key.

> **Use this for UI decisions** (e.g. "should I hide the Delete button?"), not for access control.

## Signature

```ts
cannot.abstract(
  action: string,
  resource: string,
): Promise<boolean>;
```

## Parameters

- **`action`**: (`string`) The action being checked (e.g. `'read'`, `'delete'`).
- **`resource`**: (`string`) The resource key to check (e.g. `'post'`, `'user'`).

## Returns

- `Promise<boolean>` — `true` if no `allow` rule exists for the action + resource pair. `false` if at least one `allow` rule exists.

## Implementation

```ts
cannot.abstract(action, resource) === !(await can.abstract(action, resource));
```

Like `can.abstract`, conditions and deny rules are ignored. Only the presence of an `allow` rule matters.

## Caching

Delegates to `can.abstract`, so results are cached under the key `can.abstract/${action}:${resource}`. A cached `true` from `can.abstract` means `cannot.abstract` returns `false`, and vice versa.

## Examples

### No allow rule defined

```ts
// No 'delete' allow rule exists
await guantr.cannot.abstract('delete', 'post'); // true (hide delete button)
```

### An allow rule exists

```ts
await guantr.setRules((allow) => {
  allow('read', 'post'); // unconditional allow
});

await guantr.cannot.abstract('read', 'post'); // false (show button — allow rule exists)
```

### Conditional allow rule

```ts
await guantr.setRules((allow) => {
  allow('update', [
    'post',
    ({ eq, resource, context }) => eq(resource('authorId'), context('userId')),
  ]);
});

// An allow rule exists even though it's conditional
await guantr.cannot.abstract('update', 'post'); // false (show edit button)
```

### Common UI pattern

```ts
const showReadButton = !(await guantr.cannot.abstract('read', 'post'));
const hideDeleteButton = await guantr.cannot.abstract('delete', 'post');
```

## Migration from v1.x

In guantr v1.x, `cannot(action, resourceKeyString)` performed an abstract check. This overload was **deprecated** in v1.1.0 and **removed** in v2.0.0:

```ts
// v1.x (removed in v2.0.0)
await guantr.cannot('read', 'post');

// v2+ — use cannot.abstract for abstract checks
await guantr.cannot.abstract('read', 'post');

// v2+ — use the tuple form for full evaluation
await guantr.cannot('read', ['post', postInstance]);
```

## See also

- [`can.abstract`](./can.abstract) — Positive abstract check.
- [`cannot()`](./cannot) — Full evaluation with conditions and deny rules.
- [`cannot.all`](./cannot.all) — Batch check: all must be implicitly denied.
- [`cannot.any`](./cannot.any) — Batch check: any must be implicitly denied.
