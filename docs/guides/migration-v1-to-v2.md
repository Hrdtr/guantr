# Migration Guide: v1.x to v2.0

Guantr v2.0 introduces a redesigned condition system built around a **type-safe builder DSL** and replaces the legacy tuple-based condition expressions. This guide walks through every breaking change.

---

## Breaking Changes at a Glance

| v1.x                                        | v2.0                                                |
| ------------------------------------------- | --------------------------------------------------- |
| `can`/`cannot` in `setRules` callback       | `allow`/`deny` in `setRules` callback               |
| Tuple conditions `{ field: ['eq', value] }` | Builder DSL `eq(resource('field'), literal(value))` |
| `$ctx.field` as string operand              | `context('field')` via builder                      |
| `can('read', 'post')` string overload       | `can.abstract('read', 'post')`                      |
| `condition` on rule objects                 | `matchCondition` on rule objects                    |
| `getContext` option                         | `context` — accepts plain object **or** function    |
| `createGuantr<Meta, Context>()`             | `createGuantr<Meta>()` (Context in Meta)            |
| `{ strict: true }` option                   | Removed                                             |
| `clearRules()` on storage                   | Removed (use `setRules([])`)                        |
| `cache.has` optional                        | `cache.has` required                                |
| `relatedRulesFor` with options              | Removed, context resolved at eval time              |
| Various utility types/functions             | Replaced by builder DSL + `Condition`               |

---

## 1. Rule Callback: `can`/`cannot` → `allow`/`deny`

The `setRules` callback parameters have been renamed to clearly communicate that they **define rules**, not evaluate permissions.

```diff
  await guantr.setRules((allow, deny) => {
-   can('read', 'post');
+   allow('read', 'post');

-   cannot('read', ['post', { archived: ['eq', true] }]);
+   deny('read', ['post', ({ eq, resource, literal }) =>
+     eq(resource('archived'), literal(true))
+   ]);
  });
```

---

## 2. Conditions: Tuple Expressions → Builder DSL

This is the largest change. v1.x conditions were expressed as nested object/tuple structures:

```ts
{ field: [operator, operand, options?] }
```

v2.0 replaces these with a **type-safe builder DSL** that provides compile-time validation of every field path, context path, operator, and operand type.

### 2a. Unconditional Rules (No Change)

```ts
// v1.x and v2.0 — identical
allow('read', 'post');
```

### 2b. Simple Equality

```diff
  // v1.x
- allow('read', ['post', { status: ['eq', 'draft'] }]);

  // v2.0
+ allow('read', ['post', ({ eq, resource, literal }) =>
+   eq(resource('status'), literal('draft'))
+ ]);
```

### 2c. Negated Equality (`ne` — new in v2.0)

```diff
+ // v2.0 only — ne is new
+ deny('read', ['post', ({ ne, resource, literal }) =>
+   ne(resource('status'), literal('draft'))
+ ]);
```

In v1.x, negation required a separate `deny` rule with `eq`.

### 2d. Context Values — `$ctx.field` → `context('field')`

```diff
  // v1.x — $ctx. prefix as a magic string operand
- allow('edit', ['post', { ownerId: ['eq', '$ctx.userId'] }]);

  // v2.0 — explicit context() builder method, type-checked
+ allow('edit', ['post', ({ eq, resource, context }) =>
+   eq(resource('ownerId'), context('userId'))
+ ]);
```

The `$ctx.` prefix parsing is gone. The builder's `context()` method is typed against your `Context` type, catching typos at compile time.

### 2e. Comparison Operators (`gt`, `gte`, `lt`, `lte`)

```diff
  // v1.x
- allow('view', ['post', { score: ['gt', 10] }]);

  // v2.0
+ allow('view', ['post', ({ gt, resource, literal }) =>
+   gt(resource('score'), literal(10))
+ ]);
```

`lt` and `lte` are **new in v2.0**. v1.x only had `gt` and `gte`.

```ts
// v2.0 only
allow('view', ['post', ({ lt, resource, literal }) => lt(resource('viewCount'), literal(500))]);
allow('view', ['post', ({ lte, resource, literal }) => lte(resource('viewCount'), literal(500))]);
```

### 2f. Array Membership Operators (`in`, `has`, `hasSome`, `hasEvery`)

```diff
  // v1.x
- allow('view', ['post', { tags: ['has', 'featured'] }]);
- allow('view', ['post', { tags: ['hasSome', ['urgent', 'internal']] }]);
- allow('view', ['post', { tags: ['hasEvery', ['build', 'deploy']] }]);
- allow('view', ['post', { role: ['in', ['admin', 'editor']] }]);

  // v2.0
+ allow('view', ['post', ({ has, resource, literal }) =>
+   has(resource('tags'), literal('featured'))
+ ]);
+ allow('view', ['post', ({ hasSome, resource, literal }) =>
+   hasSome(resource('tags'), literal(['urgent', 'internal']))
+ ]);
+ allow('view', ['post', ({ hasEvery, resource, literal }) =>
+   hasEvery(resource('tags'), literal(['build', 'deploy']))
+ ]);
+ allow('view', ['post', ({ in: inOp, resource, literal }) =>
+   inOp(resource('role'), literal(['admin', 'editor']))
+ ]);
```

> **Note:** Since `in` is a reserved word in JavaScript, destructure it with an alias: `{ in: inOp }`.

### 2g. String Operators (`contains`, `startsWith`, `endsWith`)

```diff
  // v1.x
- allow('view', ['post', {
-   title: ['contains', 'report', { caseInsensitive: true }],
- }]);

  // v2.0
+ allow('view', ['post', ({ contains, resource, literal }) =>
+   contains(resource('title'), literal('report'), { caseInsensitive: true })
+ ]);
```

### 2h. Complex Array Operators (`some`, `every`, `none`)

```diff
  // v1.x — nested condition object
- allow('moderate', ['post', {
-   comments: ['some', { approved: ['eq', true] }],
- }]);

  // v2.0 — nested builder function (resource() scoped to array element)
+ allow('moderate', ['post', ({ some, resource }) =>
+   some(resource('comments'), ({ eq, resource, literal }) =>
+     eq(resource('approved'), literal(true))
+   )
+ ]);
```

The nested callback for `some`/`every`/`none` receives a builder where `resource()` references fields of the **array element**, not the outer resource.

### 2i. Logical Operators (`and`, `or`, `not` — new in v2.0)

Logical operators did not exist in v1.x. You had to use multiple rules to approximate AND logic and separate `deny` rules for NOT logic.

```ts
// v2.0 — compose multiple conditions into one rule
allow('publish', [
  'post',
  ({ and, eq, resource, literal }) =>
    and(eq(resource('status'), literal('approved')), eq(resource('deleted'), literal(false))),
]);

// v2.0 — negation
allow('view', [
  'post',
  ({ and, not, eq, resource, literal }) =>
    and(not(eq(resource('status'), literal('archived'))), eq(resource('deleted'), literal(false))),
]);

// v2.0 — alternatives
allow('read', [
  'post',
  ({ or, eq, resource, literal }) =>
    or(eq(resource('status'), literal('published')), eq(resource('status'), literal('draft'))),
]);
```

### 2j. Case-Insensitive Comparison

```diff
  // v1.x — caseInsensitive in third tuple position
- allow('read', ['post', { name: ['eq', 'hello', { caseInsensitive: true }] }]);

  // v2.0 — options object as third argument to the operator method
+ allow('read', ['post', ({ eq, resource, literal }) =>
+   eq(resource('name'), literal('hello'), { caseInsensitive: true })
+ ]);
```

---

## 3. Rule Objects: `condition` → `matchCondition`

The field name on `GuantrRule` has been renamed. The value uses the same builder function.

```diff
  const rules: GuantrRule<MyMeta>[] = [
    { effect: 'allow', action: 'read', resource: 'post' },
    {
      effect: 'deny',
      action: 'read',
      resource: 'post',
-     condition: { archived: ['eq', true] },
+     matchCondition: ({ eq, resource, literal }) =>
+       eq(resource('archived'), literal(true)),
    },
  ];
```

### Using Pre-Serialized Conditions

If you need to store conditions externally (database, config file), you can use the serialized `Condition` AST directly:

```ts
import { createMatchConditionBuilder } from 'guantr';
import type { Condition } from 'guantr';

// Build conditions imperatively
const b = createMatchConditionBuilder();
const serializedCondition: Condition = b.and(
  b.eq(b.resource('status'), b.literal('published')),
  b.not(b.eq(b.resource('archived'), b.literal(true))),
);

const rules: GuantrRule<MyMeta>[] = [
  {
    effect: 'allow',
    action: 'read',
    resource: 'post',
    matchCondition: serializedCondition, // pre-serialized AST
  },
];
```

---

## 4. Permission Checks: String Overload → `can.abstract`

```diff
  // v1.x — string overload for abstract check (removed)
- await guantr.can('read', 'post');
- await guantr.cannot('read', 'post');

  // v2.0 — explicit abstract checks
+ await guantr.can.abstract('read', 'post');
+ await guantr.cannot.abstract('read', 'post');

  // v2.0 — full evaluation (same as v1.x tuple form)
+ await guantr.can('read', ['post', postInstance]);
+ await guantr.cannot('read', ['post', postInstance]);
```

---

## 5. Type System Changes

### `GuantrMeta` Context Type Parameter

```diff
  // v1.x — Context was the second generic on createGuantr
- type MyMeta = GuantrMeta<MyResourceMap>;
- const guantr = await createGuantr<MyMeta, MyContext>({
-   getContext: () => ({ userId: 1 }),
- });

  // v2.0 — Context is a type parameter of GuantrMeta itself
+ type MyMeta = GuantrMeta<MyResourceMap, MyContext>;
+ const guantr = await createGuantr<MyMeta>({
+   context: () => ({ userId: 1 }),
+ });
```

### `GuantrOptions.getContext` → `context` (renamed, accepts object)

The `getContext` option has been renamed to `context` and **now accepts both** a plain context object and a function (optionally async):

```diff
  // v1.x — getContext was always a function
- const guantr = await createGuantr<MyMeta>({
-   getContext: () => ({ userId: 1 }),
- });

  // v2.0 — context can be a function (same as before)
+ const guantr = await createGuantr<MyMeta>({
+   context: () => ({ userId: 1 }),
+ });

  // v2.0 — context can also be a plain object (new!)
+ const guantr = await createGuantr<MyMeta>({
+   context: { userId: 1, role: 'admin' },
+ });
```

When a plain object is passed, Guantr wraps it internally as `() => Promise.resolve(obj)` — the context is still resolved on every `can`/`cannot` check, but the value remains the same static object.

**Migration rule:** Replace all `getContext:` with `context:`. If you were already using a synchronous function `() => ({...})`, consider replacing it with a plain object for clarity.

```ts
// Before
getContext: () => ({ userId: 1, role: 'editor' })

// After — function still works
context: () => ({ userId: 1, role: 'editor' })

// After — plain object (simpler when static)
context: { userId: 1, role: 'editor' }
```

### Removed Types

The following types no longer exist. The builder DSL eliminates the need for most of them:

| Removed Type                          | Replacement                                         |
| ------------------------------------- | --------------------------------------------------- |
| `GuantrRuleCondition`                 | Use `MatchConditionFn` or `Condition`               |
| `GuantrRuleConditionExpression`       | Use builder methods (`eq`, `in`, etc.)              |
| `ConditionOperator`                   | Inferred from builder method names                  |
| `ConditionOptions`                    | Inline options object (`{ caseInsensitive: true }`) |
| `GuantrInvalidConditionError`         | Builder catches errors at compile time              |
| `GuantrInvalidConditionOperatorError` | Builder catches errors at compile time              |

**New/retained types:**

| Type                                    | Purpose                                                                      |
| --------------------------------------- | ---------------------------------------------------------------------------- |
| `GuantrMeta<ResourceMap, Context>`      | Central meta type (Context now inside)                                       |
| `GuantrRule<Meta>`                      | Rule with typed `matchCondition`                                             |
| `GuantrOptions<Context>`                | Options type (`getContext` renamed to `context`, accepts object or function) |
| `MatchConditionFn<Model, Context>`      | Builder function signature                                                   |
| `MatchConditionBuilder<Model, Context>` | Builder interface                                                            |
| `Condition`                             | Serialized condition AST                                                     |
| `GuantrCircuitBreakerError`             | Circuit breaker error (retained)                                             |
| `GuantrInvalidConditionKeyError`        | Invalid key at eval time (retained)                                          |
| `evaluateCondition`                     | Evaluates a Condition AST                                                    |
| `createMatchConditionBuilder`           | Creates a builder instance                                                   |

---

## 6. Storage Interface Changes

```diff
  // v1.x
  interface Storage {
    setRules: (rules: GuantrRule[]) => Promise<void>;
    getRules: () => Promise<GuantrRule[]>;
    queryRules: (action: string, resource: string) => Promise<GuantrRule[]>;
-   clearRules: () => Promise<void>;  // Removed
    cache?: {
      set: <T>(key: string, value: T) => Promise<void>;
      get: <T>(key: string) => Promise<T | undefined>;
-     has?: (key: string) => Promise<boolean>;  // Optional
+     has: (key: string) => Promise<boolean>;   // Required when cache provided
      clear: () => Promise<void>;
    };
  }
```

- **`clearRules` removed**: Use `guantr.setRules([])` or `guantr.setRules(() => {})` to clear all rules. The storage adapter only needs `setRules`, `getRules`, and `queryRules`.
- **`cache.has` is now required**: If your storage provides a `cache` object, it **must** include `has`. The library calls `has` before `get` and does not fall back to checking `get` results.
- **`cache.get` must return `undefined`** for cache misses, not `null`.

---

## 7. Condition Serialization Format (Custom Storage)

v2.0 stores conditions as JSON-compatible AST objects. When implementing a custom storage adapter, `matchCondition` values use this structure:

**Operator Node** (leaf comparison):

```json
{
  "type": "condition",
  "node": {
    "type": "operator",
    "operator": "eq",
    "operands": [
      { "type": "resource", "path": "status" },
      { "type": "literal", "value": "published" }
    ]
  }
}
```

**Logical Node** (AND/OR/NOT):

```json
{
  "type": "condition",
  "node": {
    "type": "logical",
    "operator": "and",
    "operands": [
      {
        "type": "condition",
        "node": {
          "type": "operator",
          "operator": "eq",
          "operands": [
            { "type": "resource", "path": "status" },
            { "type": "literal", "value": "published" }
          ]
        }
      },
      {
        "type": "condition",
        "node": {
          "type": "operator",
          "operator": "ne",
          "operands": [
            { "type": "resource", "path": "deleted" },
            { "type": "literal", "value": true }
          ]
        }
      }
    ]
  }
}
```

**Context Reference:**

```json
{ "type": "context", "path": "userId" }
```

**Nested Operators** (`some`, `every`, `none`):

```json
{
  "type": "condition",
  "node": {
    "type": "operator",
    "operator": "some",
    "operands": [{ "type": "resource", "path": "comments" }],
    "condition": {
      "type": "condition",
      "node": {
        "type": "operator",
        "operator": "eq",
        "operands": [
          { "type": "resource", "path": "approved" },
          { "type": "literal", "value": true }
        ]
      }
    }
  }
}
```

Operand types: `"resource"`, `"context"`, `"literal"`.

---

## 8. Removed Options and Utilities

### Removed Options

- **`{ strict: true/false }`** — Validation is always enabled. Remove this option from all `GuantrOptions` objects.
- **`relatedRulesFor(action, resource, { applyConditionContextualOperands: true })`** — Context values are resolved at evaluation time, not query time. Remove the options argument; `relatedRulesFor` accepts only `(action, resource)`.

### Removed Utility Functions

| v1.x Utility                 | Replacement                                           |
| ---------------------------- | ----------------------------------------------------- |
| `matchConditionExpression`   | Removed entirely — use `evaluateCondition`            |
| `matchRuleCondition`         | Removed — use `evaluateCondition`                     |
| `validateCondition`          | Builder enforces correctness at compile time          |
| `conditionHandlers`          | Evaluation logic is internal                          |
| `getContextValue`            | Built into `evaluateCondition`                        |
| `validateValueType`          | Builder enforces correctness at compile time          |
| `isContextualOperand`        | Use `context()` in builder                            |
| `isConditionExpressionLike`  | Conditions are builder objects, not tuple expressions |
| `KNOWN_OPERATORS`            | Operators are builder method names                    |
| `isValidConditionExpression` | Build-time validation via TypeScript                  |

### New Utilities

| Utility                                        | Purpose                              |
| ---------------------------------------------- | ------------------------------------ |
| `createMatchConditionBuilder()`                | Create a standalone builder instance |
| `evaluateCondition(condition, model, context)` | Evaluate a serialized Condition AST  |

---

## Migration Checklist

1. **Rename callback params**: `can` → `allow`, `cannot` → `deny` in all `setRules` callbacks.
2. **Convert tuple conditions to builder DSL**: Replace `{ field: ['op', value] }` with builder methods.
3. **Replace `$ctx.field` with `context('field')`**: Remove all magic string prefixes.
4. **Rename `condition` → `matchCondition`**: In all `GuantrRule` objects.
5. **Replace `can('action', 'resource')` with `can.abstract('action', 'resource')`**: String overload no longer exists.
6. **Move Context into `GuantrMeta`**: `GuantrMeta<ResourceMap, Context>` instead of passing Context to `createGuantr` directly.
7. **Rename `getContext` → `context`**: Replace `getContext:` with `context:` in all `GuantrOptions` objects. If your context is static, use a plain object instead of a function.
8. **Remove `clearRules` from storage adapters**: Implementations only need `setRules`, `getRules`, `queryRules`.
9. **Add `has` to cache implementations**: If you provide `cache`, you must implement `has`.
10. **Remove `{ strict: true }` options**: Delete them from all `GuantrOptions` objects.
11. **Remove `applyConditionContextualOperands` from `relatedRulesFor` calls**: Accept only `(action, resource)`.
12. **Remove imports of removed types**: `GuantrRuleCondition`, `ConditionOperator`, `ConditionOptions`, etc.
13. **Update serialization logic**: If you serialize rules to a database, the format has changed from tuple conditions to AST nodes.
