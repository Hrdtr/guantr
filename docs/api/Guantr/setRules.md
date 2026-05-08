# API: `Guantr.prototype.setRules`

The `setRules` method **replaces all previously stored rules** with a new rule set. It supports two call styles: a direct array of `GuantrRule` objects, or a callback function that receives `allow`/`deny` helper functions for defining rules programmatically.

## Signatures

### 1. Array overload

```ts
async setRules(rules: GuantrRule<Meta>[]): Promise<void>;
```

### 2. Callback overload

```ts
async setRules(callback: SetRulesCallback<Meta>): Promise<void>;
```

## Callback Signature

```ts
type SetRulesCallback<Meta> = (
  allow: (action: string, resource: string | [string, MatchConditionFn | Condition | null]) => void,
  deny: (action: string, resource: string | [string, MatchConditionFn | Condition | null]) => void,
) => void | Promise<void>;
```

### `allow(action, resource)`

Registers a rule with `effect: 'allow'`.

### `deny(action, resource)`

Registers a rule with `effect: 'deny'`.

### `resource` argument types

The second argument to `allow`/`deny` can be:

| Form                         | Example                                                       | Resulting rule                                        |
| ---------------------------- | ------------------------------------------------------------- | ----------------------------------------------------- |
| `string`                     | `allow('read', 'post')`                                       | Unconditional allow (`matchCondition` is `undefined`) |
| `[string, MatchConditionFn]` | `allow('edit', ['post', ({ eq, resource, context }) => ...])` | Conditional allow (function executed, AST stored)     |
| `[string, Condition]`        | `deny('read', ['post', preBuiltCondition])`                   | Conditional deny (pre-built `Condition` stored as-is) |
| `[string, null]`             | `allow('read', ['post', null])`                               | Unconditional allow (same as plain string)            |

## `matchCondition` types

When providing rules via the array form or the tuple form in a callback, `matchCondition` accepts three kinds of values:

### `MatchConditionFn` — Builder function

```ts
type MatchConditionFn<Model, Context> = (
  builder: MatchConditionBuilder<Model, Context>,
) => Condition;
```

A function that receives a `MatchConditionBuilder` and returns a serialized `Condition`. The function is **executed immediately** at rule-set time, and only the resulting AST is stored. This means the condition is evaluated once at definition time, not re-created per check.

### `Condition` — Pre-built AST

A serialized condition object produced by a `MatchConditionBuilder`. Stored as-is without re-execution.

### `null` — Unconditional

Equivalent to omitting `matchCondition`. The rule applies regardless of resource context.

## Important behaviors

- **Replacement, not append.** Calling `setRules` replaces **all** previously stored rules. To add rules incrementally, retrieve existing rules with `getRules()`, combine them, and set again.
- **Clears cache.** The entire storage cache is cleared before new rules are written. Any previous `can`/`can.abstract` results are purged.
- **Builder functions execute immediately.** Any `MatchConditionFn` provided in a rule or callback is called synchronously during `setRules`. The returned `Condition` object is serialized and stored.
- **Nullish matchCondition is unconditional.** Both `null` and `undefined` are treated as "no condition."
- **Empty array / empty callback.** Clears all rules (no rules → all `can()` calls return `false`).

## Examples

### Callback style

```ts
await guantr.setRules(async (allow, deny) => {
  // Unconditional allows
  allow('read', 'article');
  allow('list', 'article');

  // Conditional allow — only the author can edit
  allow('edit', [
    'article',
    ({ eq, resource, context }) => eq(resource('ownerId'), context('userId')),
  ]);

  // Conditional deny — no one can read archived articles
  deny('read', [
    'article',
    ({ eq, resource, literal }) => eq(resource('status'), literal('archived')),
  ]);

  // Deny with logical AND — complex condition
  deny('delete', [
    'article',
    ({ and, eq, resource, literal }) =>
      and(eq(resource('status'), literal('published')), eq(resource('locked'), literal(true))),
  ]);
});
```

### Array style

```ts
import type { GuantrRule } from 'guantr';

const rules: GuantrRule<MyMeta>[] = [
  { effect: 'allow', action: 'read', resource: 'article' },
  { effect: 'allow', action: 'list', resource: 'article' },
  {
    effect: 'deny',
    action: 'read',
    resource: 'article',
    matchCondition: ({ eq, resource, literal }) => eq(resource('status'), literal('archived')),
  },
  {
    effect: 'allow',
    action: 'edit',
    resource: 'article',
    matchCondition: ({ eq, resource, context }) => eq(resource('ownerId'), context('userId')),
  },
];

await guantr.setRules(rules);
```

### Clear all rules

```ts
await guantr.setRules([]);

// Equivalent:
await guantr.setRules(() => {});
```

All subsequent `can()` calls will return `false`.

### Pre-built Condition object

```ts
import { createMatchConditionBuilder } from 'guantr';

const builder = createMatchConditionBuilder<Article, MyContext>();
const isOwner = builder.eq(builder.resource('ownerId'), builder.context('userId'));

await guantr.setRules([
  { effect: 'allow', action: 'edit', resource: 'article', matchCondition: isOwner },
]);
```

### Using null matchCondition in array style

```ts
await guantr.setRules([
  { effect: 'allow', action: 'read', resource: 'post', matchCondition: null },
]);
// Same as: { effect: 'allow', action: 'read', resource: 'post' }
```

## Rule evaluation priority

When `can()` evaluates rules, deny rules take priority over allow rules:

1. **No rules** → `false`
2. **Unconditional deny** (`matchCondition` is `null`/`undefined`, `effect: 'deny'`) → immediate `false` (early exit)
3. **Deny condition matches** → `false` (deny overrides allow)
4. **At least one allow matches AND no deny matches** → `true`

## See also

- [`getRules()`](./getRules) — Retrieve currently stored rules.
- [`relatedRulesFor()`](./relatedRulesFor) — Query rules for a specific action/resource pair.
- [`can()`](./can) — Evaluate rules against a resource instance.
