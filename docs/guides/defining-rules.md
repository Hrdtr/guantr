# Defining Rules in Guantr

Rules are the core of Guantr's authorization engine. They express what actions are permitted or forbidden on which resources, optionally gated by runtime conditions.

---

## The Structure of a Rule

Every rule is a `GuantrRule` object with these fields:

| Field            | Type                                    | Description                                           |
| ---------------- | --------------------------------------- | ----------------------------------------------------- |
| `effect`         | `'allow' \| 'deny'`                     | Whether the rule grants or revokes permission         |
| `action`         | `string`                                | A single operation (e.g. `'read'`, `'delete'`)        |
| `resource`       | `string`                                | The resource type key (e.g. `'post'`)                 |
| `matchCondition` | `MatchConditionFn \| Condition \| null` | Optional — a builder function or serialized condition |

When `matchCondition` is omitted or `null`, the rule applies **unconditionally** to all instances of that resource type.

### Typed Rules

When a `GuantrMeta` type is provided, `action`, `resource`, and `matchCondition` are narrowed:

```ts
type MyMeta = GuantrMeta<{
  post: { action: 'read' | 'edit'; model: { id: number; archived: boolean } };
}>;

// TypedGuantrRule: resource is 'post', action is 'read' | 'edit',
// matchCondition is scoped to the post model shape
type TypedGuantrRule = GuantrRule<MyMeta>;
```

---

## Setting Rules

Rules are set with `setRules()`. Every call **replaces all existing rules**. This method accepts either a callback or an array of rule objects.

### Callback Method

Pass an async (or sync) function that receives `allow` and `deny` helper functions:

```ts
await guantr.setRules((allow, deny) => {
  allow('read', 'article');
  deny('delete', 'article');
});
```

#### Callback Signature

```ts
type SetRulesCallback<Meta> = (
  allow: (action: string, resource: string | [string, matchCondition]) => void,
  deny: (action: string, resource: string | [string, matchCondition]) => void,
) => void | Promise<void>;
```

The `resource` argument can be:

- **A plain string** — creates an unconditional rule that applies to every instance of that resource type.
- **A tuple `[resourceKey, matchCondition]`** — creates a conditional rule. The `matchCondition` is either a builder function (`MatchConditionFn`) or a pre-serialized `Condition` object.

### Array Method

Pass an array of `GuantrRule` objects directly. This is the preferred approach when loading rules from a database or external source:

```ts
import { createGuantr } from 'guantr';
import type { GuantrRule } from 'guantr';

const rules: GuantrRule<MyMeta>[] = [
  { effect: 'allow', action: 'read', resource: 'article' },
  {
    effect: 'deny',
    action: 'delete',
    resource: 'article',
    matchCondition: ({ eq, resource, literal }) => eq(resource('status'), literal('published')),
  },
];

await guantr.setRules(rules);
```

#### How `matchCondition` Functions Are Processed

When a `matchCondition` is a function (either from the callback or array path), it is **immediately executed** at `setRules` time with a fresh `MatchConditionBuilder` instance. The returned `Condition` AST is stored — the function itself is never serialized or stored. This means:

1. Conditions are JSON-serializable from the moment `setRules` completes.
2. You can inspect stored rules with `getRules()` and see the full AST.
3. External systems can construct `Condition` objects directly without the builder.

---

## Unconditional vs Conditional Rules

### Unconditional Rules

An unconditional rule has no `matchCondition`. It applies to **every instance** of the resource type:

```ts
allow('read', 'post');
```

This grants read permission on every post, regardless of its properties.

```ts
deny('delete', 'post');
```

This **unconditionally denies** delete on every post. An unconditional deny is the strongest rule in the system — it causes an immediate `false` result, skipping all other rule evaluation.

### Conditional Rules

A conditional rule includes a `matchCondition` that is evaluated against the resource instance and context at check time:

```ts
allow('edit', ['post', ({ eq, resource, context }) => eq(resource('ownerId'), context('userId'))]);
```

This allows editing only when the post's `ownerId` matches the current user's `userId`.

```ts
deny('read', ['post', ({ eq, resource, literal }) => eq(resource('archived'), literal(true))]);
```

This denies reading posts that are archived.

---

## The Condition Builder DSL

Guantr's condition builder is a type-safe DSL for composing boolean expressions from resource fields, context values, and literals. The builder is documented exhaustively in the [Condition Operators Reference](/guides/defining-rules/condition-operators), covering value sources (`resource()`, `context()`, `literal()`), comparison operators (`eq`, `ne`, `gt`, `gte`, `lt`, `lte`), string operators (`contains`, `startsWith`, `endsWith`), array operators (`in`, `has`, `hasSome`, `hasEvery`), complex array operators (`some`, `every`, `none`), and logical operators (`and`, `or`, `not`).

---

## Rule Precedence

When Guantr evaluates a permission check, it follows a strict precedence order:

1. **No rules found** → `false`. Guantr is deny-by-default.
2. **Unconditional deny** → `false` immediately. An unconditional deny rule (no `matchCondition`) short-circuits all other evaluation. Even matching allow rules are ignored.
3. **Conditional deny match** → `false`. If any deny rule's condition evaluates to `true`, the result is `false`, even if allow rules also match.
4. **At least one allow matches** → `true`. This requires at least one allow rule (unconditional or conditional-matched) AND no matching deny rules.

Deny rules always take precedence over allow rules. A deny rule exists to revoke permission even when an allow rule would otherwise grant it.

```ts
await guantr.setRules((allow, deny) => {
  allow('read', 'post');
  deny('read', ['post', ({ eq, resource, literal }) => eq(resource('archived'), literal(true))]);
});

// archived: true → false (deny overrides the unconditional allow)
await guantr.can('read', ['post', { archived: true }]);

// archived: false → true (allow applies, deny condition doesn't match)
await guantr.can('read', ['post', { archived: false }]);
```

---

## Pre-Serialized Conditions

Conditions are JSON-serializable AST structures. You can build them independently with `createMatchConditionBuilder` or evaluate stored conditions with `evaluateCondition`. Pre-serialized `Condition` objects can be passed directly as a `matchCondition` value — Guantr skips the builder execution step and stores the AST directly.

For database-backed setups, use `serializeRules()` to convert function-based conditions in bulk before persisting to a database. See [Database-Backed Rule Management](/guides/database-backed-rules) and the [Utilities API reference](/api/utilities#serializerules) for the full workflow.

---

## Clearing Rules

Guantr does not have a dedicated "clear rules" method. To remove all rules, call `setRules` with an empty callback or empty array:

```ts
await guantr.setRules(() => {});
// or
await guantr.setRules([]);
```

Calling `setRules` also clears the internal cache.

---

## Inspecting Rules

### Get All Rules

```ts
const rules = await guantr.getRules();
```

Returns a read-only array of all stored `GuantrRule` objects with their serialized conditions.

### Query by Action and Resource

```ts
const rules = await guantr.relatedRulesFor('read', 'post');
```

Returns only the rules matching a specific action and resource key. This is a low-level query — conditions are **not** evaluated.

---

## Error Handling

### Circuit Breaker

If rule evaluation exceeds the configured `maxRuleIterations` (default: 1000), a `GuantrCircuitBreakerError` is thrown:

```ts
import { GuantrCircuitBreakerError } from 'guantr';

try {
  await guantr.can('read', ['post', post]);
} catch (err) {
  if (err instanceof GuantrCircuitBreakerError) {
    console.log(`Limit: ${err.limit}, Action: ${err.action}`);
  }
}
```

### Invalid Condition Keys

If a condition references a path that does not exist on the resource or context, a `GuantrInvalidConditionKeyError` is thrown at evaluation time:

```ts
import { GuantrInvalidConditionKeyError } from 'guantr';

// Throws if resource has no 'nonexistentField'
try {
  await guantr.can('read', ['post', post]);
} catch (err) {
  if (err instanceof GuantrInvalidConditionKeyError) {
    console.log(`Missing key: ${err.key}`);
  }
}
```

**Nullish opt-out:** If any operand in a condition is `null` or `undefined`, the key-existence check is skipped — this signals that the field is intentionally optional.
