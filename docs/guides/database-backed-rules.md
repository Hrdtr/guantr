# Database-Backed Rule Management

## Why Database-Backed Rules?

Guantr's default `InMemoryStorage` keeps rules in process memory. You call `setRules()` on startup and rules stay there until the process exits. This is simple but comes with tradeoffs:

|                        | `setRules()` + InMemoryStorage | Database-Backed                   |
| ---------------------- | ------------------------------ | --------------------------------- |
| **Persistence**        | Lost on restart                | Survives restarts and deploys     |
| **Rule changes**       | Requires code deploy           | Update database rows              |
| **Admin UI**           | Not possible                   | Any DB client can manage rules    |
| **Horizontal scaling** | Each process re-registers      | All read from one source          |
| **Per-user rules**     | Impractical                    | Adapter filters in SQL            |
| **Audit trail**        | None                           | DB audit logs / migration history |
| **Setup complexity**   | None                           | Migration + adapter required      |

### Drawbacks

- **Infrastructure**: You need a database and a migration step.
- **Latency**: Every `can()` call queries the database. Mitigate with [caching](/advanced-usage/caching).
- **Ownership**: You're responsible for the table schema and data integrity.

## How It Works

Two phases, decoupled:

```text
SEED (migration, runs once)
─────────────────────────────
  rules/catalog.ts          serializeRules()
  (function conditions)  ───►  Condition AST (JSON-safe)
                                      │
                                      ▼
                              INSERT INTO rules

RUNTIME (every request)
───────────────────────
  request  ─►  storage.queryRules(action, resource)
                    │
                    │  SELECT … FROM rules WHERE …
                    ▼
              GuantrRule[] (with Condition objects)
                    │
                    ▼
              evaluateCondition(…)  →  true / false
```

Rules are defined **once** in code, serialized **once** into the database, and queried **on every request**. The database is the source of truth — no `setRules()` call at runtime.

## When to Use Each Approach

**Use in-memory + `setRules()` when:**

- Your rule set is small and static
- You're building a prototype or CLI tool
- You run a single process
- You want zero setup overhead

**Use database-backed when:**

- Rules must survive restarts and deploys
- Non-engineers manage permissions through an admin panel
- You have per-user or per-tenant permission sets
- Multiple services share the same rules
- You need an audit trail

## Wiring: Per-Request Guantr Setup

Create a new Guantr instance per request, scoped to the authenticated user. The storage adapter receives the user identity so it can filter rules accordingly.

```ts
import { createGuantr } from 'guantr';

async function getGuantrForRequest(request: { user: { id: string; orgId: string } }) {
  return createGuantr<AppMeta>({
    storage: new AppStorage(db, () => request.user.id),
    context: () => ({
      userId: request.user.id,
      orgId: request.user.orgId,
    }),
  });
}
```

## Example: Simple Persistent Storage

Rules are global (same for everyone), stored in a flat table. This already beats in-memory: rules survive restarts and can be updated with a SQL query instead of a code deploy.

### Schema

```sql
CREATE TABLE rules (
  id             SERIAL PRIMARY KEY,
  action         TEXT NOT NULL,
  resource       TEXT NOT NULL,
  effect         TEXT NOT NULL CHECK (effect IN ('allow', 'deny')),
  matchCondition JSONB
);
CREATE INDEX idx_rules_lookup ON rules (action, resource);
```

### Catalog and Migration

```ts
// rules/catalog.ts
import type { GuantrRule, GuantrMeta, GuantrResourceMap } from 'guantr';

type ResourceMap = GuantrResourceMap<{
  article: {
    action: 'read' | 'publish';
    model: { id: number; status: string; authorId: string };
  };
}>;
type Context = { userId: string };
export type AppMeta = GuantrMeta<ResourceMap, Context>;

export const rules: GuantrRule<AppMeta>[] = [
  { resource: 'article', action: 'read', effect: 'allow' },
  {
    resource: 'article',
    action: 'publish',
    effect: 'allow',
    matchCondition: ({ eq, resource, context }) => eq(resource('authorId'), context('userId')),
  },
];
```

```ts
// migrations/002_seed_rules.ts
import { serializeRules } from 'guantr';
import { rules, AppMeta } from '../rules/catalog';

export async function up(db: Database) {
  const serialized = serializeRules<AppMeta>(rules);

  for (const rule of serialized) {
    await db.sql`
      INSERT INTO rules (action, resource, effect, matchCondition)
      VALUES (${rule.action}, ${rule.resource}, ${rule.effect},
              ${rule.matchCondition ? JSON.stringify(rule.matchCondition) : null})
    `;
  }
}
```

### Adapter

The adapter is a thin query layer over the `rules` table. See [Custom Storage Adapter](/advanced-usage/custom-storage-adapter) for complete implementations in SQLite, Prisma, and Drizzle.

```ts
class PostgresStorage implements Storage {
  constructor(private db: Database) {}

  async queryRules(action: string, resource: string): Promise<GuantrRule[]> {
    const rows = await this.db.sql`
      SELECT action, resource, effect, matchCondition
      FROM rules WHERE action = ${action} AND resource = ${resource}
    `;
    return rows.map((r) => ({
      action: r.action,
      resource: r.resource,
      effect: r.effect,
      matchCondition: r.matchCondition as GuantrRule['matchCondition'],
    }));
  }

  async getRules(): Promise<GuantrRule[]> {
    const rows = await this.db.sql`
      SELECT action, resource, effect, matchCondition FROM rules
    `;
    return rows.map((r) => ({
      action: r.action,
      resource: r.resource,
      effect: r.effect,
      matchCondition: r.matchCondition as GuantrRule['matchCondition'],
    }));
  }

  async setRules(rules: GuantrRule[]): Promise<void> {
    await this.db.transaction(async (tx) => {
      await tx.sql`DELETE FROM rules`;
      for (const rule of rules) {
        await tx.sql`
          INSERT INTO rules (action, resource, effect, matchCondition)
          VALUES (${rule.action}, ${rule.resource}, ${rule.effect},
                  ${rule.matchCondition ? JSON.stringify(rule.matchCondition) : null})
        `;
      }
    });
  }
}
```

---

## Example: Multi-Tenant with User and Role Assignments

When each user has a different set of permissions, rules are **assigned** to users or roles through junction tables. The catalog is seeded once. The admin panel manages assignments.

### Schema

```sql
CREATE TABLE rules (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action          TEXT NOT NULL,
  resource        TEXT NOT NULL,
  effect          TEXT NOT NULL CHECK (effect IN ('allow', 'deny')),
  matchCondition  JSONB
);

CREATE TABLE users ( id UUID PRIMARY KEY DEFAULT gen_random_uuid() );
CREATE TABLE roles ( id UUID PRIMARY KEY DEFAULT gen_random_uuid(), name TEXT NOT NULL UNIQUE );

CREATE TABLE role_rules (
  role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  rule_id UUID NOT NULL REFERENCES rules(id) ON DELETE CASCADE,
  PRIMARY KEY (role_id, rule_id)
);
CREATE TABLE user_roles (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  PRIMARY KEY (user_id, role_id)
);
CREATE TABLE user_rules (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  rule_id UUID NOT NULL REFERENCES rules(id) ON DELETE CASCADE,
  PRIMARY KEY (user_id, rule_id)
);

CREATE INDEX idx_rules_lookup ON rules (action, resource);
```

A user's effective permissions are the union of direct assignments (`user_rules`) and role-inherited ones (`user_roles` → `role_rules`).

### Catalog and Migration

Same `serializeRules()` approach as the simple example above. Insert the catalog into `rules`, then your admin panel populates the junction tables.

### Adapter

The key difference from the simple adapter: `queryRules()` and `getRules()` join through the junction tables to return only rules assigned to the current user. The adapter constructor takes a `getCurrentUserId` function to scope queries.

```ts
class ScopedStorage implements Storage {
  constructor(
    private db: Database,
    private getCurrentUserId: () => string,
  ) {}

  async queryRules(action: string, resource: string): Promise<GuantrRule[]> {
    const userId = this.getCurrentUserId();
    const rows = await this.db.sql`
      SELECT DISTINCT r.action, r.resource, r.effect, r.matchCondition
      FROM rules r
      WHERE r.action = ${action} AND r.resource = ${resource}
        AND (
          r.id IN (SELECT rule_id FROM user_rules WHERE user_id = ${userId})
          OR r.id IN (
            SELECT rr.rule_id FROM role_rules rr
            JOIN user_roles ur ON ur.role_id = rr.role_id
            WHERE ur.user_id = ${userId}
          )
        )
    `;
    return rows.map((r) => ({
      action: r.action,
      resource: r.resource,
      effect: r.effect,
      matchCondition: r.matchCondition as GuantrRule['matchCondition'],
    }));
  }

  async getRules(): Promise<GuantrRule[]> {
    const userId = this.getCurrentUserId();
    const rows = await this.db.sql`
      SELECT DISTINCT r.action, r.resource, r.effect, r.matchCondition
      FROM rules r
      WHERE r.id IN (SELECT rule_id FROM user_rules WHERE user_id = ${userId})
         OR r.id IN (
           SELECT rr.rule_id FROM role_rules rr
           JOIN user_roles ur ON ur.role_id = rr.role_id
           WHERE ur.user_id = ${userId}
         )
    `;
    return rows.map((r) => ({
      action: r.action,
      resource: r.resource,
      effect: r.effect,
      matchCondition: r.matchCondition as GuantrRule['matchCondition'],
    }));
  }

  async setRules(_rules: GuantrRule[]): Promise<void> {
    throw new Error('Use assignRuleToUser() or assignRuleToRole().');
  }

  async assignRuleToUser(userId: string, ruleId: string): Promise<void> {
    await this.db.sql`
      INSERT INTO user_rules (user_id, rule_id) VALUES (${userId}, ${ruleId})
      ON CONFLICT DO NOTHING
    `;
  }
}
```

---

## `serializeRules` and `deserializeRules`

These utilities bridge TypeScript rule definitions and database rows.

| Utility              | Direction                        | Use case                                              |
| -------------------- | -------------------------------- | ----------------------------------------------------- |
| `serializeRules()`   | Function → JSON-safe `Condition` | Seed the rule catalog during a migration              |
| `deserializeRules()` | `Condition` → Function           | Reload DB rules for `setRules()` (admin preview/edit) |

```ts
import { serializeRules, deserializeRules } from 'guantr';

// Seed
const forDb = serializeRules<AppMeta>(myRules);
await db.insert(forDb);

// Reload and edit
const fromDb = await db.select('SELECT * FROM rules');
const editable = deserializeRules<AppMeta>(fromDb);
await guantr.setRules(editable);
```

## Related

- **[Custom Storage Adapter](/advanced-usage/custom-storage-adapter)** — Complete adapter implementations (SQLite, Prisma, Drizzle).
- **[Utilities](/api/utilities#serializerules)** — `serializeRules` / `deserializeRules` API reference.
- **[Caching](/advanced-usage/caching)** — Add a cache layer to reduce database load.
