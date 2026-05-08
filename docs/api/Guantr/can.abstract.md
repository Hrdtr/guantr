# API: `Guantr.prototype.can.abstract`

The `can.abstract` sub-method performs an **abstract permission check** — it returns `true` if any `allow` rule exists for the given action and resource key, **without evaluating conditions or considering deny rules**.

> **Use this for UI decisions** (e.g. "should I show the Edit button?"), not for access control. For a full evaluation against a resource instance, use [`can(action, [resourceKey, instance])`](./can).

## Signature

```ts
can.abstract(
  action: string,
  resource: string,
): Promise<boolean>;
```

## Parameters

- **`action`**: (`string`) The action being checked (e.g. `'read'`, `'update'`).
- **`resource`**: (`string`) The resource key to check (e.g. `'post'`, `'user'`).

Unlike `can()`, the resource is just a plain string (the key), not a tuple with an instance.

## Returns

- `Promise<boolean>` — `true` if at least one `allow` rule exists for the action + resource pair. `false` if no allow rules are found.

## What it ignores

| Aspect                              | Considered?                                         |
| ----------------------------------- | --------------------------------------------------- |
| Allow rules (any `effect: 'allow'`) | ✅ Checked                                          |
| Deny rules (`effect: 'deny'`)       | ❌ Ignored                                          |
| Conditions (`matchCondition`)       | ❌ Ignored — rules with conditions count as present |

The method answers: **"Has any permission been granted at all for this resource type?"** rather than "is this specific instance accessible right now?"

## Evaluation

1. Queries storage for all rules matching the given `action` and `resource` key.
2. Returns `true` if **any** rule with `effect: 'allow'` is found.
3. Returns `false` if no allow rules exist (regardless of deny rules or conditions).

## Caching behavior

When the storage adapter provides a `cache`, results are cached with the key pattern:

```text
can.abstract/${action}:${resource}
```

Cache misses/errors follow the same tolerance pattern as `can()`: errors from `cache.get` are swallowed (fall back to direct evaluation), errors from `cache.set` are swallowed (result returned uncached).

## Examples

```ts
await guantr.setRules((allow, deny) => {
  allow('read', 'post'); // unconditional allow
  deny('read', ['post', ({ eq, resource, literal }) => eq(resource('published'), literal(false))]); // conditional deny
  allow('update', [
    'post',
    ({ eq, resource, context }) => eq(resource('authorId'), context('userId')),
  ]); // conditional allow
});
```

```ts
// Abstract — deny rule is ignored, condition is ignored
await guantr.can.abstract('read', 'post'); // true (allow rule exists)

// Full evaluation against a specific instance
const draftPost = { id: 1, published: false, title: 'Draft' };
await guantr.can('read', ['post', draftPost]); // false (deny matches this instance)
```

### Conditional rule still counts as present

```ts
// No unconditional 'update' allow, only conditional
await guantr.can.abstract('update', 'post'); // true (the conditional allow counts)

// But the actual instance might not match the condition:
await guantr.can('update', ['post', { id: 1, authorId: 'other' }]);
// false — condition not satisfied
```

### No allow rules at all

```ts
await guantr.can.abstract('delete', 'post'); // false (no 'delete' allow rule exists)
```

## Contrast with `can()`

| Behaviour                  | `can.abstract(action, 'resource')`   | `can(action, ['resource', instance])`              |
| -------------------------- | ------------------------------------ | -------------------------------------------------- |
| Checks allow rules         | ✅                                   | ✅                                                 |
| Evaluates conditions       | ❌                                   | ✅                                                 |
| Considers deny rules       | ❌                                   | ✅                                                 |
| Requires resource instance | ❌ (key only)                        | ✅                                                 |
| Caching key                | `can.abstract/${action}:${resource}` | `can/${action}:${resource}:${instance}:${context}` |
| Recommended use            | UI hints, layout decisions           | Access control, authorization gating               |

## Migration from v1.x

In guantr v1.x, `can(action, resourceKeyString)` performed an abstract check. This overload was **deprecated** in v1.1.0 and **removed** in v2.0.0. Replace with `can.abstract`:

```ts
// v1.x (removed in v2.0.0)
await guantr.can('read', 'post');

// v2+ — use can.abstract for abstract checks
await guantr.can.abstract('read', 'post');

// v2+ — use the tuple form for full evaluation
await guantr.can('read', ['post', postInstance]);
```

## See also

- [`cannot.abstract`](./cannot.abstract) — Negated abstract check.
- [`can()`](./can) — Full evaluation with conditions and deny rules.
- [`can.all`](./can.all) — Batch abstract-equivalent: all must have an allow rule.
- [`can.any`](./can.any) — Batch abstract-equivalent: any must have an allow rule.
