# API: Utilities

Guantr exports utility functions and types for building and evaluating conditions outside the core `can`/`cannot` workflow.

## Importing

```ts
import {
  createMatchConditionBuilder,
  evaluateCondition,
  serializeRules,
  deserializeRules,
} from 'guantr';

import type {
  Condition,
  MatchConditionBuilder,
  MatchConditionFn,
  ResourceRef,
  ContextRef,
  LiteralRef,
  ValueRef,
  InferValueRef,
  ArrayElementType,
  OperatorNode,
  LogicalNode,
  AstNode,
} from 'guantr';
```

---

## `createMatchConditionBuilder`

Creates a new `MatchConditionBuilder` instance for composing typed conditions. The returned builder is a plain object whose methods produce typed `ValueRef` objects carrying phantom type information, enabling type-safe operand pairing at compile time while keeping the runtime objects fully JSON-serializable.

### Signature

```ts
function createMatchConditionBuilder<
  Model extends Record<string, unknown> = Record<string, unknown>,
  Context extends Record<string, unknown> = Record<string, unknown>,
>(): MatchConditionBuilder<Model, Context>;
```

### Generics

- **`Model`**: The TypeScript type of the resource model. Used to infer field types for `resource()`, enabling type-safe comparisons. Defaults to `Record<string, unknown>`.
- **`Context`**: The TypeScript type of the evaluation context. Used to infer field types for `context()`. Defaults to `Record<string, unknown>`.

### Returns

A `MatchConditionBuilder<Model, Context>` instance with the following methods:

#### Value-source factories

| Method           | Signature                                          | Returns         | Description                                 |
| ---------------- | -------------------------------------------------- | --------------- | ------------------------------------------- |
| `resource(path)` | `(path: LeafKeys<Model>) => ResourceRef<Model>`    | `ResourceRef`   | Reference a field on the resource model     |
| `context(path)`  | `(path: LeafKeys<Context>) => ContextRef<Context>` | `ContextRef`    | Reference a field on the evaluation context |
| `literal(value)` | `<T>(value: T) => LiteralRef<T>`                   | `LiteralRef<T>` | Inline literal value                        |

#### Comparison operators

| Operator           | Signature                                           | Description              |
| ------------------ | --------------------------------------------------- | ------------------------ |
| `eq(left, right)`  | `(ValueRef, ValueRef) => Condition`                 | Equal to                 |
| `ne(left, right)`  | `(ValueRef, ValueRef) => Condition`                 | Not equal to             |
| `gt(left, right)`  | `(numeric ValueRef, numeric ValueRef) => Condition` | Greater than             |
| `gte(left, right)` | `(numeric ValueRef, numeric ValueRef) => Condition` | Greater than or equal to |
| `lt(left, right)`  | `(numeric ValueRef, numeric ValueRef) => Condition` | Less than                |
| `lte(left, right)` | `(numeric ValueRef, numeric ValueRef) => Condition` | Less than or equal to    |

#### String operators

| Operator                             | Signature                                                                         | Description                |
| ------------------------------------ | --------------------------------------------------------------------------------- | -------------------------- |
| `contains(str, substring, options?)` | `(string ValueRef, string ValueRef, { caseInsensitive?: boolean }?) => Condition` | `str` contains `substring` |
| `startsWith(str, prefix, options?)`  | `(string ValueRef, string ValueRef, { caseInsensitive?: boolean }?) => Condition` | `str` starts with `prefix` |
| `endsWith(str, suffix, options?)`    | `(string ValueRef, string ValueRef, { caseInsensitive?: boolean }?) => Condition` | `str` ends with `suffix`   |

All string operators accept an optional `{ caseInsensitive: true }` option.

#### Array membership operators

| Operator                            | Signature                                                                       | Description                                                                                                          |
| ----------------------------------- | ------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `in(value, array, options?)`        | `(ValueRef, array ValueRef, { caseInsensitive?: boolean }?) => Condition`       | `value` is an element of `array`. Array position is type-checked; element-type compatibility is verified at runtime. |
| `has(array, value, options?)`       | `(array ValueRef, ValueRef, { caseInsensitive?: boolean }?) => Condition`       | `array` contains `value`                                                                                             |
| `hasSome(array, values, options?)`  | `(array ValueRef, array ValueRef, { caseInsensitive?: boolean }?) => Condition` | `array` contains at least one of `values`                                                                            |
| `hasEvery(array, values, options?)` | `(array ValueRef, array ValueRef, { caseInsensitive?: boolean }?) => Condition` | `array` contains all of `values`                                                                                     |

All array membership operators accept an optional `{ caseInsensitive: true }` option.

#### Complex array operators

| Operator           | Signature                                         | Description                                         |
| ------------------ | ------------------------------------------------- | --------------------------------------------------- |
| `some(array, fn)`  | `(array ValueRef, MatchConditionFn) => Condition` | At least one element satisfies the nested condition |
| `every(array, fn)` | `(array ValueRef, MatchConditionFn) => Condition` | Every element satisfies the nested condition        |
| `none(array, fn)`  | `(array ValueRef, MatchConditionFn) => Condition` | No element satisfies the nested condition           |

The callback `fn` receives a scoped builder where `resource()` references fields of the **array element**, not the parent resource.

#### Logical operators

| Operator             | Signature                       | Description                              |
| -------------------- | ------------------------------- | ---------------------------------------- |
| `and(...conditions)` | `(...Condition[]) => Condition` | All conditions must be satisfied         |
| `or(...conditions)`  | `(...Condition[]) => Condition` | At least one condition must be satisfied |
| `not(condition)`     | `(Condition) => Condition`      | Negates the condition                    |

### Example

```ts
import { createMatchConditionBuilder } from 'guantr';

interface Article {
  id: number;
  status: 'draft' | 'published' | 'archived';
  title: string;
  ownerId: string;
  tags: string[];
  comments: Array<{ approved: boolean; text: string }>;
}

interface MyContext {
  userId: string;
  role: 'admin' | 'editor' | 'viewer';
}

const builder = createMatchConditionBuilder<Article, MyContext>();

// Simple comparison
const isPublished = builder.eq(builder.resource('status'), builder.literal('published'));

// Logical AND with not
const isActiveAndNotArchived = builder.and(
  builder.eq(builder.resource('status'), builder.literal('published')),
  builder.not(builder.eq(builder.resource('status'), builder.literal('archived'))),
);

// Owner check (context vs resource)
const isOwner = builder.eq(builder.resource('ownerId'), builder.context('userId'));

// Case-insensitive string match
const titleContains = builder.contains(builder.resource('title'), builder.literal('hello'), {
  caseInsensitive: true,
});

// Array membership
const hasTag = builder.has(builder.resource('tags'), builder.literal('featured'));

// Complex array: check if any comment is approved
const hasApprovedComment = builder.some(builder.resource('comments'), ({ eq, resource, literal }) =>
  eq(resource('approved'), literal(true)),
);

// Complex nested: owner AND (published OR has approved comments)
const canManage = builder.and(
  builder.eq(builder.resource('ownerId'), builder.context('userId')),
  builder.or(isPublished, hasApprovedComment),
);

// The result is a JSON-serializable Condition object
console.log(JSON.stringify(canManage, null, 2));
```

---

## `evaluateCondition`

Evaluates a serialized `Condition` AST against a resource instance and context object. This is the same runtime engine used internally by `can`/`cannot`.

### Signature

```ts
function evaluateCondition(
  condition: Condition,
  resource: Record<string, unknown>,
  context: Record<string, unknown>,
): boolean;
```

### Parameters

| Parameter   | Type                      | Description                               |
| ----------- | ------------------------- | ----------------------------------------- |
| `condition` | `Condition`               | The serialized condition AST to evaluate  |
| `resource`  | `Record<string, unknown>` | The resource instance to evaluate against |
| `context`   | `Record<string, unknown>` | The evaluation context                    |

### Returns

- `boolean` — `true` if the condition is satisfied, `false` otherwise.

This is a **synchronous** function.

### Throws

- `GuantrInvalidConditionKeyError` — When a referenced field does not exist on the resource or context and no nullish opt-out is present.

### Example

```ts
import { evaluateCondition } from 'guantr';
import type { Condition } from 'guantr';

const condition: Condition = {
  type: 'condition',
  node: {
    type: 'operator',
    operator: 'eq',
    operands: [
      { type: 'resource', path: 'status' },
      { type: 'literal', value: 'published' },
    ],
  },
};

const post = { id: 1, status: 'published', title: 'Hello' };
console.log(evaluateCondition(condition, post, {})); // true

const draft = { id: 2, status: 'draft', title: 'WIP' };
console.log(evaluateCondition(condition, draft, {})); // false
```

### With logical operators

```ts
const andCondition: Condition = {
  type: 'condition',
  node: {
    type: 'logical',
    operator: 'and',
    operands: [
      {
        type: 'condition',
        node: {
          type: 'operator',
          operator: 'eq',
          operands: [
            { type: 'resource', path: 'status' },
            { type: 'literal', value: 'published' },
          ],
        },
      },
      {
        type: 'condition',
        node: {
          type: 'operator',
          operator: 'eq',
          operands: [
            { type: 'resource', path: 'ownerId' },
            { type: 'context', path: 'userId' },
          ],
        },
      },
    ],
  },
};

const post = { id: 1, status: 'published', ownerId: 'user-1' };
const context = { userId: 'user-1' };
console.log(evaluateCondition(andCondition, post, context)); // true
```

---

## `serializeRules`

Converts function-based `matchCondition` entries in a rules array into serializable `Condition` AST objects. This is the same logic used internally by `setRules()` but exposed as a standalone utility.

Use this when you want to seed rules into a custom storage backend (database, key-value store, etc.) without creating a `Guantr` instance or calling `setRules` at runtime.

### Signature

```ts
function serializeRules<Meta extends GuantrMeta<GuantrResourceMap> | undefined = undefined>(
  rules: readonly GuantrRule<Meta>[],
): GuantrRule<Meta>[];
```

### Generic

- **`Meta`**: The `GuantrMeta` type describing the resource map and context. Must be provided explicitly when using typed rules to preserve type information.

### Parameters

| Parameter | Type                          | Description                                                                     |
| --------- | ----------------------------- | ------------------------------------------------------------------------------- |
| `rules`   | `readonly GuantrRule<Meta>[]` | Array of rules, potentially containing function-based `matchCondition` entries. |

### Returns

A new array where every function-based `matchCondition` has been converted to a `Condition` AST object. Rules with non-function conditions (`Condition`, `null`, or `undefined`) are passed through unchanged.

### Example — Basic

```ts
import { serializeRules } from 'guantr';
import type { GuantrRule, GuantrMeta, GuantrResourceMap } from 'guantr';

type Post = { id: number; status: string; archived: boolean };
type ResourceMap = GuantrResourceMap<{ post: { action: 'read' | 'update'; model: Post } }>;
type Meta = GuantrMeta<ResourceMap>;

const rules: GuantrRule<Meta>[] = [
  { resource: 'post', action: 'read', effect: 'allow' },
  {
    resource: 'post',
    action: 'update',
    effect: 'allow',
    matchCondition: ({ eq, resource, context }) => eq(resource('id'), context('userId')),
  },
];

// Convert function-based conditions to serializable Condition objects
const serialized = serializeRules<Meta>(rules);
// serialized[1].matchCondition is now a Condition object, not a function
// Safe to JSON.stringify and store in a database

// Persist to database
await db.rules.insertMany(
  serialized.map((r) => ({
    action: r.action,
    resource: r.resource,
    effect: r.effect,
    condition: JSON.stringify(r.matchCondition ?? null),
  })),
);
```

### Example — Database seeding

```ts
import { serializeRules } from 'guantr';

// Rules defined in a source file (e.g., rules.ts)
export const appRules: GuantrRule<AppMeta>[] = [
  { resource: 'post', action: 'read', effect: 'allow' },
  {
    resource: 'post',
    action: 'delete',
    effect: 'deny',
    matchCondition: ({ eq, resource, context }) => eq(resource('ownerId'), context('userId')),
  },
];

// In a migration script:
async function seed() {
  const serialized = serializeRules<AppMeta>(appRules);
  for (const rule of serialized) {
    await db.insert('rules', {
      action: rule.action,
      resource: rule.resource,
      effect: rule.effect,
      match_condition: JSON.stringify(rule.matchCondition ?? null),
    });
  }
}
```

### How it works

1. Iterates over each rule in the input array.
2. If `matchCondition` is a function, executes it with a `MatchConditionBuilder` and replaces it with the returned `Condition` AST.
3. If `matchCondition` is `null`, `undefined`, or already a `Condition` object, leaves it unchanged.
4. Returns a new array — the original array is **not** mutated.

---

## `deserializeRules`

Wraps `Condition` objects in a rules array back into function form. This is the inverse of `serializeRules`.

Use this when you load rules from an external store (database, cache, etc.) and want to feed them into `setRules` using either the array or callback form.

### Signature

```ts
function deserializeRules<Meta extends GuantrMeta<GuantrResourceMap> | undefined = undefined>(
  rules: readonly GuantrRule<Meta>[],
): GuantrRule<Meta>[];
```

### Generic

- **`Meta`**: The `GuantrMeta` type describing the resource map and context. Must be provided explicitly when using typed rules.

### Parameters

| Parameter | Type                          | Description                                                        |
| --------- | ----------------------------- | ------------------------------------------------------------------ |
| `rules`   | `readonly GuantrRule<Meta>[]` | Array of rules containing `Condition` objects in `matchCondition`. |

### Returns

A new array where every non-function `matchCondition` has been wrapped as a function. Rules with `null`, `undefined`, or already-function `matchCondition` are passed through unchanged.

### Example

```ts
import { deserializeRules } from 'guantr';

// Rules loaded from a database — matchCondition is a parsed Condition object
const rows = await db.query('SELECT * FROM rules');
const rulesFromDb: GuantrRule<Meta>[] = rows.map((r) => ({
  action: r.action,
  resource: r.resource,
  effect: r.effect,
  matchCondition: JSON.parse(r.match_condition ?? null),
}));

// Wrap Condition objects as functions for setRules
const deserialized = deserializeRules<Meta>(rulesFromDb);
await guantr.setRules(deserialized);
```

### Example — Full round-trip

```ts
import { serializeRules, deserializeRules } from 'guantr';

// 1. Define rules in code
const rules: GuantrRule<Meta>[] = [
  { resource: 'post', action: 'read', effect: 'allow' },
  {
    resource: 'post',
    action: 'delete',
    effect: 'deny',
    matchCondition: ({ eq, resource, literal }) => eq(resource('archived'), literal(true)),
  },
];

// 2. Serialize before persisting
const serialized = serializeRules<Meta>(rules);

// 3. Persist to database
const json = JSON.stringify(serialized);
await db.insert('rules', { body: json });

// 4. Later: load from database and deserialize
const fromDb = JSON.parse(await db.select('rules'));
const deserialized = deserializeRules<Meta>(fromDb);

// 5. Register with Guantr
await guantr.setRules(deserialized);
```

### How it works

1. Iterates over each rule in the input array.
2. If `matchCondition` is a `Condition` object (not `null`, `undefined`, or a function), wraps it in a function that returns the condition directly.
3. The wrapped function accepts a `MatchConditionBuilder` (ignoring it) and returns the original `Condition`.
4. Returns a new array — the original array is **not** mutated.

---

## Condition Types

Guantr exports all the types that compose the condition system. These are useful for type-safe manipulation of condition data, custom tooling, or serialization/deserialization scenarios.

### `Condition`

```ts
interface Condition {
  readonly type: 'condition';
  readonly node: AstNode;
}
```

The top-level wrapper around every condition AST. Returned by all builder methods and stored in `GuantrRule.matchCondition`.

### `MatchConditionBuilder<Model, Context>`

```ts
interface MatchConditionBuilder<
  Model extends Record<string, unknown>,
  Context extends Record<string, unknown>,
> {
  resource<P extends LeafKeys<Model>>(path: P): ResourceRef<Model, P>;
  context<P extends LeafKeys<Context>>(path: P): ContextRef<Context, P>;
  literal<T>(value: T): LiteralRef<T>;
  eq(...): Condition;
  ne(...): Condition;
  gt(...): Condition;
  gte(...): Condition;
  lt(...): Condition;
  lte(...): Condition;
  contains(...): Condition;
  startsWith(...): Condition;
  endsWith(...): Condition;
  in(...): Condition;
  has(...): Condition;
  hasSome(...): Condition;
  hasEvery(...): Condition;
  some(...): Condition;
  every(...): Condition;
  none(...): Condition;
  and(...conditions: Condition[]): Condition;
  or(...conditions: Condition[]): Condition;
  not(condition: Condition): Condition;
}
```

The builder object passed to `matchCondition` functions. Created by `createMatchConditionBuilder()` or provided automatically in rule callbacks.

### `MatchConditionFn<Model, Context>`

```ts
type MatchConditionFn<
  Model extends Record<string, unknown> = Record<string, unknown>,
  Context extends Record<string, unknown> = Record<string, unknown>,
> = (builder: MatchConditionBuilder<Model, Context>) => Condition;
```

The user-facing function signature for defining a `matchCondition` on a rule.

### `ResourceRef<Model, Path>`

```ts
interface ResourceRef<Model extends Record<string, unknown>, P extends string = string> {
  readonly type: 'resource';
  readonly path: P;
}
```

References a field on the resource model. Created by `builder.resource('fieldName')`.

### `ContextRef<Context, Path>`

```ts
interface ContextRef<Context extends Record<string, unknown>, P extends string = string> {
  readonly type: 'context';
  readonly path: P;
}
```

References a field on the evaluation context. Created by `builder.context('fieldName')`.

### `LiteralRef<T>`

```ts
interface LiteralRef<T = unknown> {
  readonly type: 'literal';
  readonly value: T;
}
```

An inline literal value. Created by `builder.literal(value)`.

### `ValueRef`

```ts
type ValueRef = ResourceRef | ContextRef | LiteralRef;
```

Union of all value-reference variants. Used as operand types for operators.

### `InferValueRef<R>`

```ts
type InferValueRef<R extends ValueRef> = /* extracted phantom type */;
```

Extracts the value type carried by a `ValueRef`'s phantom type parameter. Useful for type-level reasoning about condition operands.

### `ArrayElementType<R>`

```ts
type ArrayElementType<R extends ValueRef> = /* element type or never */;
```

Extracts the element type from a `ValueRef` whose phantom type is an array. Returns `never` if the phantom type is not an array.

### `OperatorNode`

```ts
interface OperatorNode {
  readonly type: 'operator';
  readonly operator:
    | 'eq'
    | 'ne'
    | 'gt'
    | 'gte'
    | 'lt'
    | 'lte'
    | 'contains'
    | 'startsWith'
    | 'endsWith'
    | 'in'
    | 'has'
    | 'hasSome'
    | 'hasEvery'
    | 'some'
    | 'every'
    | 'none';
  readonly operands: readonly ValueRef[];
  readonly options?: Readonly<{ caseInsensitive?: boolean }>;
  readonly condition?: Condition; // For some/every/none
}
```

An AST node for a comparison or membership check. Serialized as `{ "type": "operator", "operator": "eq", "operands": [...] }`.

### `LogicalNode`

```ts
interface LogicalNode {
  readonly type: 'logical';
  readonly operator: 'and' | 'or' | 'not';
  readonly operands: readonly Condition[];
}
```

An AST node for logical combination of child conditions.

### `AstNode`

```ts
type AstNode = OperatorNode | LogicalNode;
```

Discriminated union of all AST node variants.

---

## See also

- [`matchCondition` in setRules](./Guantr/setRules) — Using the builder in rule definitions.
- [`can()`](./Guantr/can) — Permission checking (uses these utilities internally).
- [Custom Storage Adapter](/advanced-usage/custom-storage-adapter) — Persisting serialized rules in a database.
- [Error Classes](./error-classes) — `GuantrInvalidConditionKeyError` thrown by `evaluateCondition`.
