---
description: "Reference for getRules — returns all permission rules currently stored in the Guantr instance's storage adapter, with caching support."
---

# API: `Guantr.prototype.getRules`

The `getRules` method returns all permission rules currently stored in the Guantr instance's storage adapter. Results are cached via the storage adapter's cache layer when available.

## Signature

```ts
async getRules(): Promise<ReadonlyArray<GuantrRule>>;
```

## Parameters

This method takes no parameters.

## Returns

- `Promise<ReadonlyArray<GuantrRule>>` — All `GuantrRule` objects currently stored.

The returned rules include serialized `matchCondition` values. Any `MatchConditionFn` originally passed to `setRules` will appear as a `Condition` object (the function was executed and replaced at rule-set time).

## Caching behavior

- If the storage adapter provides a `cache` implementation, results are cached with the key `"getRules"`.
- On cache hit, the cached result is returned immediately.
- On cache miss (or if `cache.has`/`cache.get` throw), the storage is queried directly and the result is written to the cache.
- **Cache errors are silently swallowed.** If the cache write fails, the uncached result is still returned.

The cache is cleared automatically when `setRules` is called.

## Examples

### Retrieving all rules

```ts
await guantr.setRules((allow, deny) => {
  allow('read', 'post');
  deny('read', ['post', ({ eq, resource, literal }) => eq(resource('archived'), literal(true))]);
  allow('edit', [
    'post',
    ({ eq, resource, context }) => eq(resource('ownerId'), context('userId')),
  ]);
});

const allRules = await guantr.getRules();
console.log(allRules.length); // 3

for (const rule of allRules) {
  console.log(rule.effect, rule.action, rule.resource);
  // 'allow' 'read' 'post'
  // 'deny' 'read' 'post'
  // 'allow' 'edit' 'post'
}
```

### Inspecting serialized conditions

```ts
const allRules = await guantr.getRules();

for (const rule of allRules) {
  if (rule.matchCondition) {
    // matchCondition is a Condition object, not a function
    console.log(rule.matchCondition.type); // 'condition'
    console.log(rule.matchCondition.node.type); // 'operator' or 'logical'
  }
}
```

### Checking if any rules are set

```ts
const rules = await guantr.getRules();
if (rules.length === 0) {
  console.log('No rules configured — all can() calls will return false');
}
```

## See also

- [`setRules()`](./setRules) — Set or replace all rules.
- [`relatedRulesFor()`](./relatedRulesFor) — Query rules by action/resource pair.
