import type { GuantrAnyPermission } from "../../types";

const toPrismaWhereClause = (condition: GuantrAnyPermission['condition']) => {
  const clause = {} as Record<string, any>;
  for (const [key, value] of Object.entries(condition ?? {})) {
    if (Array.isArray(value) && value.length >= 2) {
      const path = key.split('.');
      let currentObj = clause;
      for (let i = 0; i < path.length - 1; i++) {
        const segment = path[i];
        currentObj[segment] = currentObj[segment] || {};
        currentObj = currentObj[segment];
      }
      // eslint-disable-next-line unicorn/prefer-at
      currentObj[path[path.length - 1]] = {
        [value[0]]: value[0] === 'some' || value[0] === 'every' ? toPrismaWhereClause(value[1]) : value[1],
        ...(value[2] && value[2].caseInsensitive ? { mode: 'insensitive' } : {})
      };
    } else {
      clause[key] = value;
    }
  }

  return clause;
}

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
