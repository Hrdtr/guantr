# API: `Guantr.prototype.can`

The `can` method checks whether a specific action is permitted on a given resource instance. It evaluates both `allow` and `deny` rules, including any applicable `matchCondition` against the resource instance and the evaluation context.

> For an abstract check that ignores conditions and deny rules, see [`can.abstract`](./can.abstract).

## Signature

```ts
can(
  action: string,
  resource: [resourceKey: string, resourceInstance: object],
): Promise<boolean>;
```

## Parameters

- **`action`**: (`string`) The action being checked (e.g. `'read'`, `'update'`, `'delete'`).
- **`resource`**: A tuple `[resourceKey, resourceInstance]`:
  - `resourceKey`: (`string`) The resource type key (e.g. `'post'`, `'user'`).
  - `resourceInstance`: (`object`) The specific resource instance to evaluate conditions against (e.g. `{ id: 1, status: 'draft', ownerId: 'user-123' }`).

## Returns

- `Promise<boolean>` — `true` if the action is allowed, `false` otherwise.

## Evaluation algorithm

1. **Resolve context.** The `context` option is resolved (if a function, it is called and awaited; if a plain object, it is used directly).
2. **Query rules.** All rules matching the given `action` and `resourceKey` are retrieved from storage.
3. **No rules → `false`.** If no rules exist for the pair, return `false`.
4. **Unconditional deny → `false` (early exit).** If any rule has `effect: 'deny'` with `matchCondition` being `null` or `undefined`, return `false` immediately.
5. **Iterate rules.** For each remaining rule:
   - If `matchCondition` is absent (`null`/`undefined`) and `effect` is `'allow'`: record a satisfied allow.
   - If `matchCondition` is present: evaluate it against the `resourceInstance` and resolved context.
     - Condition matches + `effect: 'allow'` → satisfied allow.
     - Condition matches + `effect: 'deny'` → unsatisfied (deny wins).
     - Condition does not match → the rule is not triggered.
   - The iteration count is tracked. If it exceeds `maxRuleIterations`, a `GuantrCircuitBreakerError` is thrown.
6. **Final result.** Return `true` if at least one allow was satisfied AND no deny was triggered. Otherwise `false`.

## Caching behavior

When the storage adapter provides a `cache`, results are cached with the key pattern:

```text
can/${action}:${resourceKey}:${stableStringify(resourceInstance)}:${stableStringify(context)}
```

The serializer used is `stableStringify`, not `JSON.stringify`. Unlike `JSON.stringify`, `stableStringify`:

- **Sorts object keys** for consistent output regardless of insertion order.
- **Converts `Date`** to ISO strings.
- **Converts `BigInt`** to its string representation.
- **Throws on `Map` and `Set`** (with a descriptive path) rather than silently producing `{}`.
- **Detects circular references** and throws a `TypeError`.

This guarantees deterministic cache keys regardless of property order, object constructor, or value types, which is essential for reliable cache lookups across different evaluation paths (`can()`, `can.all`, `can.any` all share the same key scheme).

| Scenario                                  | Behavior                                           |
| ----------------------------------------- | -------------------------------------------------- |
| Cache hit                                 | Cached boolean is returned immediately             |
| Cache miss                                | Full evaluation performed, result written to cache |
| Cache error (get)                         | Error swallowed; falls back to full evaluation     |
| Cache error (set)                         | Error swallowed; result returned uncached          |
| No cache (`storage.cache` is `undefined`) | No caching at all                                  |

The cache is cleared when `setRules()` is called.

## Examples

### Basic example

Given these rules:

```ts
await guantr.setRules((allow, deny) => {
  allow('read', 'article');
  deny('read', [
    'article',
    ({ eq, resource, literal }) => eq(resource('status'), literal('archived')),
  ]);
  allow('edit', [
    'article',
    ({ eq, resource, context }) => eq(resource('ownerId'), context('userId')),
  ]);
});
```

```ts
const activeArticle = { id: 1, status: 'published', ownerId: 'user-123' };
const archivedArticle = { id: 2, status: 'archived', ownerId: 'user-123' };
// Assume context: { userId: 'user-123' }

await guantr.can('read', ['article', activeArticle]); // true
await guantr.can('read', ['article', archivedArticle]); // false (deny matches)
await guantr.can('edit', ['article', activeArticle]); // true (owner)
await guantr.can('edit', ['article', { id: 3, ownerId: 'other', status: 'published' }]);
// false (allow condition does not match)
```

### Unconditional deny

An unconditional deny rule guarantees `false` regardless of any allow rules:

```ts
await guantr.setRules((allow, deny) => {
  allow('read', 'post');
  deny('read', 'post'); // unconditional deny — matchCondition omitted
});

await guantr.can('read', ['post', { id: 1 }]); // false
```

### No rules defined

```ts
await guantr.can('read', ['post', { id: 1 }]); // false
```

### With null matchCondition

```ts
await guantr.setRules([
  { effect: 'allow', action: 'read', resource: 'post', matchCondition: null },
]);

await guantr.can('read', ['post', { id: 1 }]); // true (treated as unconditional)
```

## Error handling

- `GuantrCircuitBreakerError` — Thrown when the number of rules evaluated exceeds `maxRuleIterations`.
- `GuantrInvalidConditionKeyError` — Thrown when a condition references a field that does not exist on the resource instance (unless a `null`/`undefined` literal opt-out is used).

```ts
try {
  await guantr.can('read', ['post', { id: 1 }]);
} catch (e) {
  if (e instanceof GuantrCircuitBreakerError) {
    console.log(`Circuit breaker: ${e.action}, ${e.resource}, limit: ${e.limit}`);
  }
}
```

## See also

- [`cannot()`](./cannot) — Logical negation of `can`.
- [`can.abstract`](./can.abstract) — Abstract check (ignores conditions and deny rules).
- [`can.all`](./can.all) — Batch check: all must pass.
- [`can.any`](./can.any) — Batch check: any must pass.
- [Error Classes](../error-classes) — `GuantrCircuitBreakerError`, `GuantrInvalidConditionKeyError`.
