# Using Rules as Prisma Query Filters

This guide demonstrates how to convert Guantr v2 rule conditions into Prisma-compatible `where` clauses. This enables row-level security — fetching only the rows a user is allowed to see — using the same rules already defined for access control.

## Overview

In v2.0, every rule's `matchCondition` is serialized to a `Condition` AST at `setRules` time. When you call `relatedRulesFor()`, you get back raw rules where `matchCondition` is always `Condition | null | undefined` — never a function.

The transpiler walks the AST and maps each node to a Prisma filter. The result is a `where` clause you can pass directly to `prisma.post.findMany()`.

## Matching `can()` Semantics

Before writing the transpiler, you must understand the exact evaluation logic in `_evaluateCheck` (from `src/index.ts`):

```text
For each rule:
  unconditional allow          → allowed.push(true)
  conditional allow + matches  → allowed.push(true)
  conditional allow + no match → allowed.push(false)
  conditional deny  + matches  → denied.push(false)
  conditional deny  + no match → denied.push(true)

Return: allowed.includes(true) && !denied.includes(false)
```

Translated to SQL:

```sql
WHERE
  (unconditional_allow IS TRUE
    OR cond_allow_1_matches
    OR cond_allow_2_matches
    OR ...)
  AND NOT (cond_deny_1_matches)
  AND NOT (cond_deny_2_matches)
  AND NOT (...)
```

Key implication: if there is **no unconditional allow and no conditional allow rules at all**, the result is always `false` — even if deny clauses don't match. The OR clause is empty and `allowed.includes(true)` fails.

## Condition AST Recap

```ts
interface Condition {
  readonly type: 'condition';
  readonly node: AstNode;
}

interface OperatorNode {
  readonly type: 'operator';
  readonly operator: string;
  readonly operands: readonly ValueRef[];
  readonly options?: Readonly<{ caseInsensitive?: boolean }>;
  readonly condition?: Condition; // only on some/every/none
}

interface LogicalNode {
  readonly type: 'logical';
  readonly operator: 'and' | 'or' | 'not';
  readonly operands: readonly Condition[];
}

type ValueRef =
  | { type: 'resource'; path: string }
  | { type: 'context'; path: string }
  | { type: 'literal'; value: unknown };
```

## AST Transpiler

### Types

```ts
type OpNode = {
  type: 'operator';
  operator: string;
  operands: ReadonlyArray<ValRef>;
  options?: Readonly<{ caseInsensitive?: boolean }>;
  condition?: CondNode;
};

type LogNode = {
  type: 'logical';
  operator: string;
  operands: ReadonlyArray<CondNode>;
};

type Ast = OpNode | LogNode;

type ValRef = ResRef | CtxRef | LitRef;

type ResRef = { type: 'resource'; path: string };
type CtxRef = { type: 'context'; path: string };
type LitRef = { type: 'literal'; value: unknown };

type CondNode = { type: 'condition'; node: Ast };
```

### Visitor Dispatch

```ts
const visitNode = (node: Ast, context: Record<string, unknown>): Record<string, unknown> => {
  switch (node.type) {
    case 'operator':
      return visitOperatorNode(node, context);
    case 'logical':
      return visitLogicalNode(node, context);
    default:
      return {};
  }
};
```

### Resolve Value

```ts
const resolveValue = (ref: ValRef | undefined, context: Record<string, unknown>): unknown => {
  if (!ref) return undefined;
  switch (ref.type) {
    case 'literal':
      return ref.value;
    case 'context': {
      let current: unknown = context;
      for (const key of ref.path.split('.')) {
        if (current === null || current === undefined) return undefined;
        current = (current as Record<string, unknown>)[key];
      }
      return current;
    }
    case 'resource':
      return undefined;
  }
};
```

### Operator Node Transpiler

```ts
const visitOperatorNode = (
  node: OpNode,
  context: Record<string, unknown>,
): Record<string, unknown> => {
  const { operator, operands, options } = node;
  const left = operands[0] as ValRef | undefined;
  const right = operands[1] as ValRef | undefined;

  if (!left || left.type !== 'resource') return {};

  const field = left.path;
  const value = resolveValue(right, context);
  const clause: Record<string, unknown> = {};

  switch (operator) {
    case 'eq':
      clause[field] = { equals: value };
      break;
    case 'ne':
      clause[field] = { not: value };
      break;
    case 'gt':
      clause[field] = { gt: value };
      break;
    case 'gte':
      clause[field] = { gte: value };
      break;
    case 'lt':
      clause[field] = { lt: value };
      break;
    case 'lte':
      clause[field] = { lte: value };
      break;
    case 'contains':
      clause[field] = { contains: value };
      break;
    case 'startsWith':
      clause[field] = { startsWith: value };
      break;
    case 'endsWith':
      clause[field] = { endsWith: value };
      break;
    case 'in':
      clause[field] = { in: value };
      break;
    case 'has':
      clause[field] = { has: value };
      break;
    case 'hasSome':
      clause[field] = { hasSome: value };
      break;
    case 'hasEvery':
      clause[field] = { hasEvery: value };
      break;
    case 'some':
      if (node.condition) clause[field] = { some: visitNode(node.condition.node, context) };
      break;
    case 'every':
      if (node.condition) clause[field] = { every: visitNode(node.condition.node, context) };
      break;
    case 'none':
      if (node.condition) clause[field] = { none: visitNode(node.condition.node, context) };
      break;
    default:
      return {};
  }

  const STRING_OPS = new Set(['eq', 'ne', 'contains', 'startsWith', 'endsWith']);
  const fieldClause = clause[field];
  if (
    options?.caseInsensitive &&
    STRING_OPS.has(operator) &&
    fieldClause &&
    typeof fieldClause === 'object'
  ) {
    (fieldClause as Record<string, unknown>).mode = 'insensitive';
  }

  return clause;
};
```

### Logical Node Transpiler

```ts
const visitLogicalNode = (
  node: LogNode,
  context: Record<string, unknown>,
): Record<string, unknown> => {
  const subClauses = node.operands.map((op) => visitNode(op.node, context));

  switch (node.operator) {
    case 'and':
      return { AND: subClauses };
    case 'or':
      return { OR: subClauses };
    case 'not':
      return { NOT: subClauses[0] ?? {} };
    default:
      return {};
  }
};
```

### Entry Point

```ts
const toPrismaWhereClause = (
  matchCondition: Condition | CondNode | null | undefined,
  context: Record<string, unknown>,
): Record<string, unknown> => {
  if (
    !matchCondition ||
    typeof matchCondition !== 'object' ||
    !('node' in (matchCondition as Record<string, unknown>))
  ) {
    return {};
  }
  return visitNode((matchCondition as CondNode).node, context);
};
```

## Complete Rule-to-Prisma Filter

```ts
const SENTINEL_FALSE: Record<string, unknown> = { __guantr_no_match: true };

const rulesToPrismaWhere = (
  rules: ReadonlyArray<GuantrRule<Meta>>,
  context: Record<string, unknown>,
): Record<string, unknown> | null => {
  if (rules.length === 0) return SENTINEL_FALSE;

  if (rules.some((r) => r.matchCondition == null && r.effect === 'deny')) {
    return SENTINEL_FALSE;
  }

  const hasUnconditionalAllow = rules.some((r) => r.matchCondition == null && r.effect === 'allow');

  type Clause = Record<string, unknown>;
  const OR: Clause[] = [];
  const AND: Clause[] = [];

  for (const rule of rules) {
    if (!rule.matchCondition) continue;

    const mc = rule.matchCondition as Condition | CondNode | null | undefined;
    const clause = toPrismaWhereClause(mc, context);

    if (Object.keys(clause).length === 0) continue;

    if (rule.effect === 'deny') {
      AND.push({ NOT: clause });
    } else {
      OR.push(clause);
    }
  }

  if (OR.length === 0) {
    if (hasUnconditionalAllow) {
      if (AND.length === 0) return null;
      return { AND };
    }
    return SENTINEL_FALSE;
  }

  const result: Record<string, unknown> = { OR };
  if (AND.length > 0) result.AND = AND;
  return result;
};
```

## Example Usage

```ts
import { createGuantr } from 'guantr';
import { rulesToPrismaWhere } from './prisma-filter';

// 1. Set up rules
const guantr = await createGuantr({
  storage: myStorage,
  context: () => ({ userId: 'user-123' }),
});

await guantr.setRules((allow, deny) => {
  // Allow reading published, non-archived posts
  allow('read', [
    'post',
    ({ and, eq, resource, literal }) =>
      and(eq(resource('status'), literal('published')), eq(resource('deleted'), literal(false))),
  ]);
  // Allow reading own posts regardless
  allow('read', [
    'post',
    ({ eq, resource, context }) => eq(resource('authorId'), context('userId')),
  ]);
  // Deny reading restricted posts
  deny('read', ['post', ({ eq, resource, literal }) => eq(resource('restricted'), literal(true))]);
});

// 2. In a route handler — build the auth filter
async function listPosts(userId: string) {
  const rules = await guantr.relatedRulesFor('read', 'post');
  const context = { userId };

  const authWhere = rulesToPrismaWhere(rules, context);

  // 3. Handle sentinel (no rows match)
  if (authWhere === null) {
    // All rows pass the allow gate and no denies block → no filter needed
    return prisma.post.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  if (authWhere.__guantr_no_match) {
    // No rows can pass → return empty
    return [];
  }

  // 4. Execute query with auth filter
  return prisma.post.findMany({
    where: authWhere,
    orderBy: { createdAt: 'desc' },
  });

  // 5. Combine with business filters
  // const results = await prisma.post.findMany({
  //   where: {
  //     AND: [authWhere, { authorId: userId }, { createdAt: { gte: startOfMonth } }],
  //   },
  // });
}
```

## Semantic Behavior Matrix

| Rules present                            | `can()` result            | Prisma filter                      |
| ---------------------------------------- | ------------------------- | ---------------------------------- |
| No rules                                 | `false` (all)             | `SENTINEL_FALSE` → `[]`            |
| Unconditional deny                       | `false` (all, early exit) | `SENTINEL_FALSE` → `[]`            |
| Unconditional allow only                 | `true` (all)              | `null` → no filter                 |
| Unconditional allow + conditional denies | depends on deny match     | `{ AND: [{NOT: deny1}, ...] }`     |
| Conditional allows only                  | depends on match          | `{ OR: [allow1, ...] }`            |
| Conditional allows + denies              | depends on both           | `{ OR: [...], AND: [{NOT: ...}] }` |
| Conditional denies only (no allows)      | `false` (all)             | `SENTINEL_FALSE` → `[]`            |

## Operator → Prisma Mapping

| AST Operator     | Prisma Filter                        |
| ---------------- | ------------------------------------ |
| `eq`             | `{ field: { equals: value } }`       |
| `ne`             | `{ field: { not: value } }`          |
| `gt`             | `{ field: { gt: value } }`           |
| `gte`            | `{ field: { gte: value } }`          |
| `lt`             | `{ field: { lt: value } }`           |
| `lte`            | `{ field: { lte: value } }`          |
| `contains`       | `{ field: { contains: value } }`     |
| `startsWith`     | `{ field: { startsWith: value } }`   |
| `endsWith`       | `{ field: { endsWith: value } }`     |
| `in`             | `{ field: { in: value } }`           |
| `has`            | `{ field: { has: value } }`          |
| `hasSome`        | `{ field: { hasSome: value } }`      |
| `hasEvery`       | `{ field: { hasEvery: value } }`     |
| `some` + nested  | `{ field: { some: nestedClause } }`  |
| `every` + nested | `{ field: { every: nestedClause } }` |
| `none` + nested  | `{ field: { none: nestedClause } }`  |
| `and`            | `{ AND: [subClauses] }`              |
| `or`             | `{ OR: [subClauses] }`               |
| `not`            | `{ NOT: subClause }`                 |

With `{ caseInsensitive: true }`, append `mode: 'insensitive'` (PostgreSQL / MongoDB only).

> **Note:** Only the following operators accept `caseInsensitive` via the builder DSL: `contains`, `startsWith`, `endsWith`, `in`, `has`, `hasSome`, `hasEvery`. Comparison operators (`eq`, `ne`, `gt`, `gte`, `lt`, `lte`) do not. The AST _can_ carry `caseInsensitive` on any operator node (e.g., if hand-crafted), so the transpiler checks for it unconditionally.

## Limitations

### Context References

Context refs (`{ type: 'context', path: '...' }`) must be resolved before transpilation. Pass them as the `context` parameter. The transpiler cannot handle context refs that appear as **left** operands — the left operand must always be a `resource` ref so it becomes the Prisma field name.

### `ne` and Null Handling

Prisma's `{ field: { not: value } }` excludes `null` values. Guantr's `ne` uses `!==` which treats `null !== 'value'` as `true`. If your data contains null fields, use the expanded form:

```ts
// Instead of: { status: { not: 'draft' } }
// Use: { NOT: { status: { equals: 'draft' } } }
```

Or update the transpiler's `ne` handler to use this form by default.

### Scalar vs. Relation Fields

`has`/`hasSome`/`hasEvery` work on scalar list fields (`String[]`, `Int[]`). `some`/`every`/`none` work on relation fields. The AST doesn't distinguish these — ensure your schema aligns.

### Non-Transpilable Conditions

The transpiler can only handle conditions where the **first operand** is a `resource` ref. Conditions like `eq(context('userId'), resource('ownerId'))` (context ref as left operand) cannot be transpiled because there's no Prisma field to map to. These rules are silently skipped.
