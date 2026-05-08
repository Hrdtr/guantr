# Condition Operators — Complete Reference

Every `matchCondition` function receives a builder object (`MatchConditionBuilder`) with methods for constructing value references and composing them with operators. This page is the exhaustive reference for every method on that builder.

---

## Value Source Factories

Three factories create **value references** (`ValueRef`) — the operands consumed by all operators.

### `resource(path)` — Reference a field on the resource model

```ts
resource(path: string): ResourceRef
```

Produces a `ResourceRef`. The `path` uses dot notation for nested fields and `?` for optional fields. TypeScript enforces that `path` is a valid key path on the resource model type.

```ts
resource('status'); // top-level field
resource('author.name'); // nested field
resource('address?.city'); // optional nested field — short-circuits to undefined if nullish
```

**Serialized representation:**

```json
{ "type": "resource", "path": "status" }
{ "type": "resource", "path": "author.name" }
{ "type": "resource", "path": "address?.city" }
```

### `context(path)` — Reference a field from the evaluation context

```ts
context(path: string): ContextRef
```

Produces a `ContextRef`. Works identically to `resource()` but resolves values from the context object provided via `context`. TypeScript enforces that `path` is a valid key path on your context type.

```ts
context('userId');
context('user.role');
context('env?.region');
```

**Serialized representation:**

```json
{ "type": "context", "path": "userId" }
{ "type": "context", "path": "user.role" }
```

### `literal(value)` — Inline a constant value

```ts
literal<T>(value: T): LiteralRef<T>
```

Produces a `LiteralRef` wrapping any primitive or array value. The value is stored directly in the serialized AST.

```ts
literal('published'); // string
literal(42); // number
literal(true); // boolean
literal(null); // null
literal(undefined); // undefined
literal(['admin', 'editor']); // array
```

**Serialized representation:**

```json
{ "type": "literal", "value": "published" }
{ "type": "literal", "value": 42 }
{ "type": "literal", "value": true }
{ "type": "literal", "value": null }
{ "type": "literal", "value": ["admin", "editor"] }
```

---

## Comparison Operators

All comparison operators take two `ValueRef` operands. At runtime, values are resolved and compared using JavaScript's strict equality or `Number()` coercion.

### `eq(left, right, options?)` — Equality

```ts
eq<L extends ValueRef>(
  left: L,
  right: ValueRef & { readonly [ValueRefType]?: InferValueRef<L> | null | undefined },
  options?: Readonly<{ caseInsensitive?: boolean }>,
): Condition
```

Returns `true` when resolved values are strictly equal (`===`). When `caseInsensitive: true`, strings are compared case-insensitively (non-string values fall back to strict equality).

**Callback style:**

```ts
allow('read', [
  'post',
  ({ eq, resource, literal }) => eq(resource('status'), literal('published')),
]);
```

**Rule array style:**

```ts
{
  effect: 'allow',
  action: 'read',
  resource: 'post',
  matchCondition: ({ eq, resource, literal }) =>
    eq(resource('status'), literal('published')),
}
```

**Cross-source examples:**

```ts
eq(resource('id'), literal(1)); // resource ↔ literal
eq(resource('ownerId'), context('userId')); // resource ↔ context
eq(context('role'), literal('admin')); // context ↔ literal
eq(resource('a'), resource('b')); // resource ↔ resource
```

**Serialized JSON:**

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

With case-insensitive option:

```json
{
  "type": "condition",
  "node": {
    "type": "operator",
    "operator": "eq",
    "operands": [
      { "type": "resource", "path": "name" },
      { "type": "literal", "value": "hello" }
    ],
    "options": { "caseInsensitive": true }
  }
}
```

### `ne(left, right, options?)` — Not equal

```ts
ne<L extends ValueRef>(
  left: L,
  right: ValueRef & { readonly [ValueRefType]?: InferValueRef<L> | null | undefined },
  options?: Readonly<{ caseInsensitive?: boolean }>,
): Condition
```

Returns the negation of `eq` — `true` when resolved values are not strictly equal.

```ts
ne(resource('status'), literal('archived'));
ne(resource('role'), context('adminRole'), { caseInsensitive: true });
ne(resource('deletedAt'), literal(null)); // "is not null"
```

**Serialized JSON:**

```json
{
  "type": "condition",
  "node": {
    "type": "operator",
    "operator": "ne",
    "operands": [
      { "type": "resource", "path": "status" },
      { "type": "literal", "value": "archived" }
    ]
  }
}
```

### `gt(left, right)` — Greater than

```ts
gt(
  left: ValueRef & { readonly [ValueRefType]?: number | null | undefined },
  right: ValueRef & { readonly [ValueRefType]?: number | null | undefined },
): Condition
```

Both operands must carry a numeric phantom type. Runtime evaluation coerces both sides with `Number()` and returns `Number(left) > Number(right)`.

```ts
gt(resource('score'), literal(10));
gt(resource('priority'), context('minimumPriority'));
```

**Serialized JSON:**

```json
{
  "type": "condition",
  "node": {
    "type": "operator",
    "operator": "gt",
    "operands": [
      { "type": "resource", "path": "score" },
      { "type": "literal", "value": 10 }
    ]
  }
}
```

### `gte(left, right)` — Greater than or equal

```ts
gte(
  left: ValueRef & { readonly [ValueRefType]?: number | null | undefined },
  right: ValueRef & { readonly [ValueRefType]?: number | null | undefined },
): Condition
```

```ts
gte(resource('age'), literal(18));
gte(resource('balance'), literal(0));
```

### `lt(left, right)` — Less than

```ts
lt(
  left: ValueRef & { readonly [ValueRefType]?: number | null | undefined },
  right: ValueRef & { readonly [ValueRefType]?: number | null | undefined },
): Condition
```

```ts
lt(resource('priority'), literal(5));
lt(resource('timestamp'), context('deadline'));
```

### `lte(left, right)` — Less than or equal

```ts
lte(
  left: ValueRef & { readonly [ValueRefType]?: number | null | undefined },
  right: ValueRef & { readonly [ValueRefType]?: number | null | undefined },
): Condition
```

```ts
lte(resource('clearanceLevel'), context('userClearance'));
lte(resource('attempts'), literal(3));
```

---

## String Operators

String operators coerce both resolved values to strings (`String(left ?? '')` / `String(right ?? '')`) before comparison, so they safely handle `null` and `undefined` operands.

### `contains(str, substring, options?)` — String contains

```ts
contains(
  str: ValueRef & { readonly [ValueRefType]?: string | null | undefined },
  substring: ValueRef & { readonly [ValueRefType]?: string | null | undefined },
  options?: Readonly<{ caseInsensitive?: boolean }>,
): Condition
```

Returns `true` when `str` includes `substring`. When `caseInsensitive: true`, both sides are lowercased before checking.

```ts
contains(resource('title'), literal('report'));
contains(resource('email'), context('domain'), { caseInsensitive: true });
```

**Edge case:** a `null`/`undefined` left operand is coerced to the empty string `""`, so `contains(null, literal('x'))` evaluates to `false`.

**Serialized JSON:**

```json
{
  "type": "condition",
  "node": {
    "type": "operator",
    "operator": "contains",
    "operands": [
      { "type": "resource", "path": "title" },
      { "type": "literal", "value": "report" }
    ],
    "options": { "caseInsensitive": true }
  }
}
```

### `startsWith(str, prefix, options?)` — String starts with

```ts
startsWith(
  str: ValueRef & { readonly [ValueRefType]?: string | null | undefined },
  prefix: ValueRef & { readonly [ValueRefType]?: string | null | undefined },
  options?: Readonly<{ caseInsensitive?: boolean }>,
): Condition
```

```ts
startsWith(resource('sku'), literal('PROD-'));
startsWith(resource('email'), context('prefix'), { caseInsensitive: true });
```

**Edge case:** if the left operand is `null`/`undefined`, it coerces to `""`, making `startsWith(null, literal('x'))` → `false`. A `null` right operand coerces to `""`, and every string starts with the empty string, so `startsWith(..., literal(null))` → `true`.

**Serialized JSON:**

```json
{
  "type": "condition",
  "node": {
    "type": "operator",
    "operator": "startsWith",
    "operands": [
      { "type": "resource", "path": "sku" },
      { "type": "literal", "value": "PROD-" }
    ]
  }
}
```

### `endsWith(str, suffix, options?)` — String ends with

```ts
endsWith(
  str: ValueRef & { readonly [ValueRefType]?: string | null | undefined },
  suffix: ValueRef & { readonly [ValueRefType]?: string | null | undefined },
  options?: Readonly<{ caseInsensitive?: boolean }>,
): Condition
```

```ts
endsWith(resource('filename'), literal('.pdf'));
endsWith(resource('domain'), literal('.org'), { caseInsensitive: true });
```

**Edge case:** behavior for `null`/`undefined` operands mirrors `startsWith` — left coerces to `""`, right coerces to `""` (which every string ends with, so it returns `true`).

**Serialized JSON:**

```json
{
  "type": "condition",
  "node": {
    "type": "operator",
    "operator": "endsWith",
    "operands": [
      { "type": "resource", "path": "filename" },
      { "type": "literal", "value": ".pdf" }
    ]
  }
}
```

---

## Array Membership Operators

### `in(value, array, options?)` — Value is in array

```ts
in<V extends ValueRef>(
  value: V,
  array: ValueRef & { readonly [ValueRefType]?: readonly unknown[] },
  options?: Readonly<{ caseInsensitive?: boolean }>,
): Condition
```

Returns `true` when `value` is an element of `array`. If `array` resolves to a non-array value at runtime, returns `false`.

The `array` argument is type-checked to ensure it carries an array phantom type — passing a scalar field (e.g., `resource('status')`) to the array position is caught at compile time. However, element-type compatibility between `value` and `array` is not enforced at the type level. Unlike `has(array, value)` where the array unambiguously constrains the value type, `in(value, array)` has no clear direction: the value could be a narrow literal while the array is a broad field type, or the value could be a broad field while the array is a narrow literal array. Type mismatches are caught at runtime by `evaluateCondition`.

```ts
in(resource('role'), literal(['admin', 'editor']))
in(resource('category'), context('allowedCategories'), { caseInsensitive: true })
in(literal('tech'), resource('tags'))
```

**Serialized JSON:**

```json
{
  "type": "condition",
  "node": {
    "type": "operator",
    "operator": "in",
    "operands": [
      { "type": "resource", "path": "role" },
      { "type": "literal", "value": ["admin", "editor"] }
    ]
  }
}
```

### `has(array, value, options?)` — Array contains value

```ts
has<A extends ValueRef & { readonly [ValueRefType]?: unknown[] }>(
  array: A,
  value: ValueRef & { readonly [ValueRefType]?: ArrayElementType<A> },
  options?: Readonly<{ caseInsensitive?: boolean }>,
): Condition
```

Functional inverse of `in` — the operand order is swapped. Returns `false` if the first operand is not an array.

```ts
has(resource('tags'), literal('featured'));
has(resource('roles'), context('requiredRole'), { caseInsensitive: true });
```

**Serialized JSON:**

```json
{
  "type": "condition",
  "node": {
    "type": "operator",
    "operator": "has",
    "operands": [
      { "type": "resource", "path": "tags" },
      { "type": "literal", "value": "featured" }
    ]
  }
}
```

### `hasSome(array, values, options?)` — Array contains any of values

```ts
hasSome<A extends ValueRef & { readonly [ValueRefType]?: unknown[] }>(
  array: A,
  values: ValueRef & { readonly [ValueRefType]?: InferValueRef<A> },
  options?: Readonly<{ caseInsensitive?: boolean }>,
): Condition
```

Returns `true` when `array` contains at least one element from `values`. Both operands must resolve to arrays; returns `false` if either is not an array.

```ts
hasSome(resource('tags'), literal(['tech', 'gaming']));
hasSome(resource('permissions'), context('requiredPermissions'), { caseInsensitive: true });
```

**Serialized JSON:**

```json
{
  "type": "condition",
  "node": {
    "type": "operator",
    "operator": "hasSome",
    "operands": [
      { "type": "resource", "path": "tags" },
      { "type": "literal", "value": ["tech", "gaming"] }
    ]
  }
}
```

### `hasEvery(array, values, options?)` — Array contains all values

```ts
hasEvery<A extends ValueRef & { readonly [ValueRefType]?: unknown[] }>(
  array: A,
  values: ValueRef & { readonly [ValueRefType]?: InferValueRef<A> },
  options?: Readonly<{ caseInsensitive?: boolean }>,
): Condition
```

Returns `true` only when `array` contains **every** element from `values`. Returns `false` if either operand is not an array. An empty `values` array causes vacuous truth (returns `true`).

```ts
hasEvery(resource('permissions'), literal(['read', 'write']));
hasEvery(resource('tags'), literal(['tech', 'news']), { caseInsensitive: true });
hasEvery(resource('tags'), literal([])); // always true
```

**Serialized JSON:**

```json
{
  "type": "condition",
  "node": {
    "type": "operator",
    "operator": "hasEvery",
    "operands": [
      { "type": "resource", "path": "permissions" },
      { "type": "literal", "value": ["read", "write"] }
    ]
  }
}
```

---

## Complex Array Operators

These operators iterate over an array of **objects** and evaluate a nested condition against each element. Each provides a fresh builder scoped to the array element type.

### `some(array, condition)` — At least one element matches

```ts
some<A extends ValueRef, E extends Record<string, unknown>>(
  array: A & { readonly [ValueRefType]?: E[] },
  condition: MatchConditionFn<E, Context>,
): Condition
```

Returns `true` when at least one array element satisfies the nested condition. Returns `false` for empty arrays, non-array operands, or if no nested condition was provided.

```ts
some(resource('comments'), ({ eq, resource, context }) =>
  eq(resource('authorId'), context('userId')),
);
```

**Serialized JSON:**

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
          { "type": "resource", "path": "authorId" },
          { "type": "context", "path": "userId" }
        ]
      }
    }
  }
}
```

### `every(array, condition)` — All elements match

```ts
every<A extends ValueRef, E extends Record<string, unknown>>(
  array: A & { readonly [ValueRefType]?: E[] },
  condition: MatchConditionFn<E, Context>,
): Condition
```

Returns `true` when every array element satisfies the nested condition. Returns `true` for empty arrays (vacuous truth). If no nested condition is provided, returns `true` (all elements trivially satisfy nothing). Returns `false` for non-array operands.

```ts
every(resource('checks'), ({ eq, resource }) => eq(resource('status'), literal('passed')));
```

**Serialized JSON** — same structure as `some`, with `"operator": "every"`.

### `none(array, condition)` — No element matches

```ts
none<A extends ValueRef, E extends Record<string, unknown>>(
  array: A & { readonly [ValueRefType]?: E[] },
  condition: MatchConditionFn<E, Context>,
): Condition
```

Returns `true` when **no** array element satisfies the nested condition. Returns `true` for empty arrays. If no nested condition is provided, returns `true`. Returns `false` for non-array operands.

```ts
none(resource('issues'), ({ eq, resource }) => eq(resource('isBlocking'), literal(true)));
```

**Serialized JSON** — same structure as `some`, with `"operator": "none"`.

### Complex array operator summary

| Operator | Empty array | No nested condition | Non-array operand |
| -------- | ----------- | ------------------- | ----------------- |
| `some`   | `false`     | `false`             | `false`           |
| `every`  | `true`      | `true`              | `false`           |
| `none`   | `true`      | `true`              | `false`           |

Elements that are not objects (primitives) are treated as non-matching for nested conditions.

---

## Logical Operators

### `and(...conditions)` — Logical AND

```ts
and(...conditions: Condition[]): Condition
```

Returns `true` when **all** sub-conditions are satisfied. An empty call `and()` returns `true` (vacuous truth).

```ts
and(
  eq(resource('status'), literal('approved')),
  gte(resource('score'), literal(0)),
  not(eq(resource('archived'), literal(true))),
);
```

**Serialized JSON:**

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
            { "type": "literal", "value": "approved" }
          ]
        }
      },
      {
        "type": "condition",
        "node": {
          "type": "operator",
          "operator": "gte",
          "operands": [
            { "type": "resource", "path": "score" },
            { "type": "literal", "value": 0 }
          ]
        }
      },
      {
        "type": "condition",
        "node": {
          "type": "logical",
          "operator": "not",
          "operands": [
            {
              "type": "condition",
              "node": {
                "type": "operator",
                "operator": "eq",
                "operands": [
                  { "type": "resource", "path": "archived" },
                  { "type": "literal", "value": true }
                ]
              }
            }
          ]
        }
      }
    ]
  }
}
```

### `or(...conditions)` — Logical OR

```ts
or(...conditions: Condition[]): Condition
```

Returns `true` when **any** sub-condition is satisfied. An empty call `or()` returns `false`.

```ts
or(eq(resource('role'), literal('admin')), eq(resource('role'), literal('editor')));
```

### `not(condition)` — Logical NOT

```ts
not(condition: Condition): Condition
```

Returns the logical complement of the given condition. An accidental `not()` with no argument returns `true`.

```ts
not(eq(resource('deleted'), literal(true)));
not(and(eq(resource('status'), literal('draft')), eq(resource('ownerId'), context('userId'))));
```

**Serialized JSON:**

```json
{
  "type": "condition",
  "node": {
    "type": "logical",
    "operator": "not",
    "operands": [
      {
        "type": "condition",
        "node": {
          "type": "operator",
          "operator": "eq",
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

---

## Case-Insensitive Option

The following operators accept an optional third argument `{ caseInsensitive: true }`:

| Operator     | Behavior with `caseInsensitive: true`                                  |
| ------------ | ---------------------------------------------------------------------- |
| `eq`         | Compares `value.toLowerCase() === target.toLowerCase()` (strings only) |
| `ne`         | Negation of case-insensitive equality                                  |
| `contains`   | Both sides lowercased before `.includes()`                             |
| `startsWith` | Both sides lowercased before `.startsWith()`                           |
| `endsWith`   | Both sides lowercased before `.endsWith()`                             |
| `in`         | Each element lowercased before comparison                              |
| `has`        | Each element lowercased before comparison                              |
| `hasSome`    | Each element lowercased before comparison                              |
| `hasEvery`   | Each element lowercased before comparison                              |

When case-insensitive mode is applied to non-string values, it falls back to strict equality — no error is thrown. For example, `eq(literal(42), literal(42), { caseInsensitive: true })` evaluates to `true`.

The `gt`, `gte`, `lt`, `lte`, `some`, `every`, `none`, `and`, `or`, and `not` operators do **not** accept the case-insensitive option.

---

## Full Serialization Format Reference

Every condition built through the DSL serializes to a JSON-compatible `Condition` object.

### Top-level wrapper

```ts
interface Condition {
  readonly type: 'condition';
  readonly node: AstNode;
}
```

### AST Node types

```ts
type AstNode = OperatorNode | LogicalNode;
```

#### `OperatorNode` — leaf comparison/membership

```ts
interface OperatorNode {
  readonly type: 'operator';
  readonly operator: DslOperator;
  readonly operands: readonly ValueRef[];
  readonly options?: Readonly<{ caseInsensitive?: boolean }>;
  readonly condition?: Condition; // only for some/every/none
}
```

`DslOperator` is the union: `'eq' | 'ne' | 'gt' | 'gte' | 'lt' | 'lte' | 'contains' | 'startsWith' | 'endsWith' | 'in' | 'has' | 'hasSome' | 'hasEvery' | 'some' | 'every' | 'none'`.

#### `LogicalNode` — AND/OR/NOT combinator

```ts
interface LogicalNode {
  readonly type: 'logical';
  readonly operator: 'and' | 'or' | 'not';
  readonly operands: readonly Condition[];
}
```

### `ValueRef` types

```ts
type ValueRef = ResourceRef | ContextRef | LiteralRef;

interface ResourceRef {
  readonly type: 'resource';
  readonly path: string;
}

interface ContextRef {
  readonly type: 'context';
  readonly path: string;
}

interface LiteralRef<T = unknown> {
  readonly type: 'literal';
  readonly value: T;
}
```

### Complete serialized example

A condition defined as:

```ts
and(eq(resource('status'), literal('published')), not(eq(resource('archived'), literal(true))));
```

Serializes to:

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
          "type": "logical",
          "operator": "not",
          "operands": [
            {
              "type": "condition",
              "node": {
                "type": "operator",
                "operator": "eq",
                "operands": [
                  { "type": "resource", "path": "archived" },
                  { "type": "literal", "value": true }
                ]
              }
            }
          ]
        }
      }
    ]
  }
}
```

A `some` operator with nested condition:

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
          { "type": "resource", "path": "authorId" },
          { "type": "context", "path": "userId" }
        ]
      }
    }
  }
}
```
