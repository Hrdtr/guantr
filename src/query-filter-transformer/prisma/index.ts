import type { GuantrAnyCondition, GuantrAnyConditionExpression, GuantrAnyPermission } from "../../types";
import { isValidConditionExpression } from "../../utils";

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
        case 'equals': {
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
      clause[key] = 'length' in rest ? {
          ...(rest.length['1'] === 0 ? { none: {} } : { some: {} }),
          ...($expr ? toPrismaWhereClause({[key]: $expr})[key] : {}),
        } : toPrismaWhereClause(nestedConditionOrExpression);
    }
  };
  
  for (const [key, nestedConditionOrExpression] of Object.entries(condition ?? {})) {
    processCondition(key, nestedConditionOrExpression);
  }

  return clause;
}

/**
 * Constructs a Prisma query based on the provided permissions.
 *
 * @param {GuantrAnyPermission[]} permissions - Array of permissions to build the query from
 */
export const prisma = (permissions: GuantrAnyPermission[]) => {
  const query = {
    OR: undefined as Record<string, any>[] | undefined,
    AND: undefined as Record<string, any>[] | undefined,
  }
  for (const permission of permissions) {
    if (permission.condition) {
      if (permission.inverted) {
        query.AND = query.AND ?? []
        query.AND?.push({ NOT: toPrismaWhereClause(permission.condition) })
      } else {
        query.OR = query.OR ?? []
        query.OR?.push(toPrismaWhereClause(permission.condition))
      }
    }
  }

  return query
}
