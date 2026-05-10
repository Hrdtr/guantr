---
description: 'Reference for relatedRulesFor — retrieves stored permission rules matching a specific action and resource key. A low-level query against the storage adapter.'
---

# API: `Guantr.prototype.relatedRulesFor`

The `relatedRulesFor` method retrieves all stored permission rules matching a specific action and resource key. This is a low-level, direct query against the storage adapter — conditions are **not evaluated** and results are **not cached**.

## Signature

```ts
async relatedRulesFor<ResourceKey>(
  action: string,
  resource: ResourceKey,
): Promise<GuantrRule[]>;
```

## Parameters

- **`action`**: (`string`) The action to filter by (e.g. `'read'`, `'update'`).
- **`resource`**: (`ResourceKey`) The resource key to filter by. `ResourceKey` is a generic type parameter representing the allowed resource keys (e.g. `'post'`, `'comment'`).

## Returns

- `Promise<GuantrRule[]>` — An array of matching `GuantrRule` objects, or an empty array if no rules exist for the given action and resource pair.

## Key behaviors

- **No condition evaluation.** Rules are returned as stored, regardless of whether their `matchCondition` would match a particular resource instance. This is a raw lookup, not a permission check.
- **No caching.** Unlike `getRules()` and `can()`/`can.abstract()`, results from `relatedRulesFor` are never cached through the storage adapter's cache layer.
- **Returns all rules**, including both `allow` and `deny` rules, with serialized `Condition` objects (if conditions were defined).

## Use cases

- **Debugging**: Inspect which rules apply to a particular action/resource combination.
- **Custom tooling**: Build admin UIs that show the full rule set for a resource type.
- **Pre-flight analysis**: Determine what conditions exist before evaluating against a specific instance.

## Examples

### Basic query

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

const readArticleRules = await guantr.relatedRulesFor('read', 'article');
console.log(readArticleRules.length); // 2

// First rule: unconditional allow
console.log(readArticleRules[0].effect); // 'allow'
console.log(readArticleRules[0].matchCondition); // undefined

// Second rule: conditional deny
console.log(readArticleRules[1].effect); // 'deny'
console.log(typeof readArticleRules[1].matchCondition); // 'object' (serialized Condition)
```

### No matching rules

```ts
const rules = await guantr.relatedRulesFor('delete', 'article');
console.log(rules); // [] — no rules defined for delete/article
```

### Distinction from `can()`

```ts
// relatedRulesFor returns ALL rules for the pair, unevaluated
const allRules = await guantr.relatedRulesFor('read', 'article');
// → [{ effect: 'allow', ... }, { effect: 'deny', matchCondition: {...} }]

// can() evaluates conditions and returns a boolean
const result = await guantr.can('read', ['article', { status: 'archived' }]);
// → false (deny condition matched)
```

## See also

- [`getRules()`](./getRules) — Retrieve all rules across all actions and resources.
- [`setRules()`](./setRules) — Set or replace rules.
- [`can()`](./can) — Evaluate rules against a specific resource instance.
