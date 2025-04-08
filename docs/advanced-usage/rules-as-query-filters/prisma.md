# Using Rules as Prisma Query Filters

This guide demonstrates how to convert Guantr rules into Prisma-compatible `where` clauses. This is useful when applying authorization logic directly at the database level using the same rules already defined for access control.

## Overview

You will create a function that accepts an array of rules and produces a Prisma `where` filter that can be passed into your queries.

## Prisma Transformer

Create a function named `prisma` that accepts a list of rules and produces a Prisma `where` clause.

```ts
export const prisma = (rules: GuantrAnyRule[]) => {
  const query = {
    OR: [] as Record<string, any>[],
    AND: [] as Record<string, any>[],
  }

  for (const rule of rules) {
    if (!rule.condition) continue

    const clause = toPrismaWhereClause(rule.condition)

    if (rule.effect === 'deny') {
      query.AND.push({ NOT: clause })
    } else {
      query.OR.push(clause)
    }
  }

  if (query.OR.length === 0) delete query.OR
  if (query.AND.length === 0) delete query.AND

  return query
}
```

## Condition Transformer

Create a helper `toPrismaWhereClause` to handle the condition object recursively.

```ts
/**
 * Converts a GuantrAnyPermission condition object to a Prisma where clause.
 *
 * @param {GuantrAnyPermission['condition']} condition - The condition object to convert.
 */
const toPrismaWhereClause = (condition: GuantrAnyPermission['condition']) => {
  const clause = {} as Record<string, any>;

  const processCondition = (key: string, nestedConditionOrExpression: GuantrAnyConditionExpression | GuantrAnyCondition) => {
    if (isValidConditionExpression(nestedConditionOrExpression)) {
      const [operator, operand, options] = nestedConditionOrExpression;
      switch (operator) {
        case 'eq': {
          clause[key] = { equals: operand, ...options };
          break;
        }
        case 'in': {
          clause[key] = { in: operand, ...options };
          break;
        }
        case 'contains': {
          clause[key] = { contains: operand, ...options };
          break;
        }
        case 'startsWith': {
          clause[key] = { startsWith: operand, ...options };
          break;
        }
        case 'endsWith': {
          clause[key] = { endsWith: operand, ...options };
          break;
        }
        case 'gt': {
          clause[key] = { gt: operand };
          break;
        }
        case 'gte': {
          clause[key] = { gte: operand };
          break;
        }
        case 'has': {
          clause[key] = { has: operand, ...options };
          break;
        }
        case 'hasSome': {
          clause[key] = { hasSome: operand, ...options };
          break;
        }
        case 'hasEvery': {
          clause[key] = { hasEvery: operand, ...options };
          break;
        }
        case 'some': {
          clause[key] = { some: toPrismaWhereClause(operand as never) };
          break;
        }
        case 'every': {
          clause[key] = { every: toPrismaWhereClause(operand as never) };
          break;
        }
        default: {
          throw new Error(`Unsupported operator: ${operator}`);
        }
      }
    } else if (typeof nestedConditionOrExpression === 'object') {
      const { $expr, ...rest } = nestedConditionOrExpression
      clause[key] = 'length' in rest
        ? {
            /**
             * When there is condition to checking length of an array,
             * we only able to generate Prisma where clause for `some` and `none` operators
             * to check if the array is empty for now.
             */
            ...(typeof rest.length[1] === 'number' && rest.length[1] < 1 ? { none: {} } : { some: {} }),
            ...($expr ? toPrismaWhereClause({[key]: $expr})[key] : {}),
          }
        : toPrismaWhereClause(nestedConditionOrExpression);
    }
  };

  for (const [key, nestedConditionOrExpression] of Object.entries(condition ?? {})) {
    processCondition(key, nestedConditionOrExpression);
  }

  return clause;
}
```

## Utility

Use this type guard to differentiate condition expressions:

```ts
export const isValidConditionExpression = (maybeExpression: unknown): maybeExpression is GuantrAnyRuleConditionExpression =>
  Array.isArray(maybeExpression) && maybeExpression.length >= 2 && typeof maybeExpression[0] === 'string'
```

## Example

```ts
// We use applyConditionContextualOperands here to get the actual contextual operands value
const rules = guantr.getRelatedRules('read', 'post', { applyConditionContextualOperands: true })
const where = prisma(rules)
// Result:
// {
//   OR: [{ published: { equals: true } }],
//   AND: [{ NOT: { tags: { none: {}, has: 'banned' } } }]
// }
const posts = await prisma.post.findFirst({ where })
// Combining with other filters:
// const posts = await prisma.post.findMany({ where: { AND: [where, { published: true }] } })
```

## Notes

- `effect: "deny"` rules are applied as `AND NOT` blocks
- All condition parsing is recursive and operator-driven
- Complex array filters and nested objects are supported

### Limitations

- Output types are `Record<string, any>`.
- Array length filters (e.g. `length[1] < 1`) are only can be interpreted as empty/non-empty checks and currently mapped to `some` or `none`.

This structure gives you full control to enforce rule-based authorization at the database level using Prisma’s native capabilities.
