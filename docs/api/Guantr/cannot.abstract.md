# API: `Guantr.prototype.cannot.abstract`

The `cannot.abstract` sub-method is the logical negation of [`can.abstract`](./can.abstract). It returns `true` if **no** `allow` rule exists for the given action and resource key.

> **Use this for UI hints** (e.g. "should I hide the Delete button?"), not for access control decisions.

## Signature

```ts
guantr.cannot.abstract(
  action: string, // or specific action type from Meta
  resource: string, // or typed resource key from Meta
): Promise<boolean>
```

## Parameters

- `action`: (`string`) The action being checked (e.g. `'read'`, `'delete'`).
- `resource`: (`string`) The resource key to check (e.g. `'post'`, `'user'`).

## Returns

- `Promise<boolean>`: Resolves to `true` if no `allow` rule is found for the action + resource pair. Returns `false` if at least one `allow` rule exists.

Equivalent to `!await guantr.can.abstract(action, resource)`.

## Examples

```ts
// No 'delete' allow rule defined at all
const hideDeleteButton = await guantr.cannot.abstract('delete', 'post');
// -> true (no allow rule — hide the button)

// An 'update' allow rule exists (even with conditions)
const showEditButton = !(await guantr.cannot.abstract('update', 'post'));
// -> true (allow rule exists — show the button)
```

See also: [`can.abstract`](./can.abstract), [`cannot`](./cannot), [Concepts: Abstract vs Resource-Aware Checks](../guides/abstract-vs-resource-aware).
