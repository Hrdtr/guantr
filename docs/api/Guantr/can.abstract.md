# API: `Guantr.prototype.can.abstract`

The `can.abstract` sub-method performs an **abstract permission check** — it returns `true` if _any_ `allow` rule exists for the given action and resource key, **without evaluating conditions or deny rules**.

> **Use this for UI hints** (e.g. "should I show the Edit button?"), not for access control decisions. For a full evaluation against a resource instance, use [`can(action, [resourceKey, instance])`](./can).

## Signature

```ts
guantr.can.abstract(
  action: string, // or specific action type from Meta
  resource: string, // or typed resource key from Meta
): Promise<boolean>
```

## Parameters

- `action`: (`string`) The action being checked (e.g. `'read'`, `'update'`).
- `resource`: (`string`) The resource key to check (e.g. `'post'`, `'user'`).

## Returns

- `Promise<boolean>`: Resolves to `true` if at least one `allow` rule exists for the action + resource pair. Returns `false` if no `allow` rule is found.

## How it Works

1. Retrieves all rules relevant to the given `action` and `resource` key using `queryRules` from the storage adapter.
2. Returns `true` if **any** rule with `effect: 'allow'` is present — regardless of conditions or deny rules.

This is intentionally simpler than `can()`: it answers "has any permission been granted at all for this resource type?" rather than "is this specific instance accessible right now?".

## Examples

```ts
// Rules:
// allow('read', 'post')                                — unconditional allow
// deny('read', ['post', { published: ['eq', false] }]) — deny unpublished posts

// Abstract check — ignores the deny rule entirely
const showEditButton = await guantr.can.abstract('read', 'post');
// -> true (an allow rule exists)

// Full evaluation against a specific instance
const unpublishedPost = { id: 1, published: false, title: 'Draft' };
const canRead = await guantr.can('read', ['post', unpublishedPost]);
// -> false (the deny rule matches this instance)
```

## Contrast with `can()`

| Behaviour            | `can(action, 'resource')` _(deprecated)_ | `can.abstract(action, 'resource')` | `can(action, ['resource', instance])` |
| -------------------- | ---------------------------------------- | ---------------------------------- | ------------------------------------- |
| Checks allow rules   | ✅                                       | ✅                                 | ✅                                    |
| Evaluates conditions | ❌                                       | ❌                                 | ✅                                    |
| Evaluates deny rules | ❌                                       | ❌                                 | ✅                                    |
| Recommended for      | — _(use can.abstract)_                   | UI hints                           | Access control                        |

## Migration from `can()` string-mode

```ts
// Before (v1.0.x) — implicit, easy to misuse
await guantr.can('read', 'post');

// After (v1.1.0) — explicit intent
await guantr.can.abstract('read', 'post');
```

See also: [`cannot.abstract`](./cannot.abstract), [`can`](./can), [Concepts: Abstract vs Resource-Aware Checks](../guides/abstract-vs-resource-aware).
