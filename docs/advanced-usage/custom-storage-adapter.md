# Advanced Usage: Custom Storage Adapter

By default, Guantr uses `InMemoryStorage` to store permission rules. For persistent rules or sharing rules across multiple application instances, implement a custom storage adapter.

> **Want the bigger picture?** This page covers the `Storage` interface contract and adapter implementations. For the _why_ and real-world patterns — persisting rules across restarts, per-user permission sets, multi-tenant setups — see the [Database-Backed Rule Management](/guides/database-backed-rules) guide.

## The `Storage` Interface

```ts
import type { Storage } from 'guantr/storage';
import type { GuantrRule } from 'guantr';
```

### Required Methods

| Method       | Signature                                                     | Description                                                                                                                                           |
| ------------ | ------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `setRules`   | `(rules: GuantrRule[]) => Promise<void>`                      | Atomically replaces **all** stored rules. The adapter should clear existing rules, then insert the new set.                                           |
| `getRules`   | `() => Promise<GuantrRule[]>`                                 | Returns **all** stored rules.                                                                                                                         |
| `queryRules` | `(action: string, resource: string) => Promise<GuantrRule[]>` | Returns rules matching a specific action and resource key. Filter at the storage layer — returning all rules and filtering in JS defeats the purpose. |

### Optional Cache

```ts
cache?: {
  set: <T>(key: string, value: T) => Promise<void>;
  get: <T>(key: string) => Promise<T | undefined>;  // undefined for misses
  has: (key: string) => Promise<boolean>;            // REQUIRED when cache is provided
  clear: () => Promise<void>;
}
```

The `cache` contract is strict: `get` **must** return `undefined` for misses (never `null`), and `has` is **required** — there is no fallback `get`-then-check behavior. See the [Caching guide](/advanced-usage/caching) for details.

## Condition Serialization

Rules carry a `matchCondition` field that is either a function (at definition time) or a serialized `Condition` AST (at storage time). During `setRules()`, every function-based `matchCondition` is executed with a builder and replaced by the resulting `Condition` object. When you later call `getRules()` or `queryRules()`, `matchCondition` will be `Condition | null | undefined` — **never a function**.

The `Condition` type and its AST nodes (`OperatorNode`, `LogicalNode`, `ValueRef`) are plain JSON-serializable objects. See [Utilities > Condition Types](/api/utilities#condition-types) for the full type reference and JSON format examples.

### Key points for adapter authors

- Store `matchCondition` as a JSON string (`JSON.stringify` on write, `JSON.parse` on read) or use a native JSON column type (`jsonb`, `Json`).
- `null` conditions mean the rule is unconditional. Store as SQL `NULL`, never the string `"null"`.
- Context references (`{ "type": "context", "path": "..." }`) are stored as-is. Context is resolved at evaluation time, not storage time.
- The AST is minimal — `options` and nested `condition` fields are only present when set.

## InMemoryStorage Behavior

Guantr's default `InMemoryStorage` uses a two-level `Map` index:

```text
Map<action, Map<resource, GuantrRule[]>>
```

- **Constructor** takes no arguments.
- **`setRules`** clears the entire map, then populates it rule by rule. Rules for the same `(action, resource)` pair are appended to an array.
- **`getRules`** iterates over both map levels and collects all rules into a flat array.
- **`queryRules`** performs a direct `Map.get(action)?.get(resource)` lookup — O(1) after the first map level.
- **Cache** is a separate `Map<string, unknown>` with `set`, `get`, `has`, and `clear` methods. Same strict contract as the `Storage` interface.

This structure is the reference implementation. Your custom adapter should produce identical results but may use any backing store.

## Example Implementations

### SQLite (better-sqlite3)

```ts
import Database from 'better-sqlite3';
import type { GuantrRule } from 'guantr';
import type { Storage } from 'guantr/storage';

const db = new Database(':memory:');
db.exec(`
  CREATE TABLE IF NOT EXISTS rules (
    id       INTEGER PRIMARY KEY AUTOINCREMENT,
    action   TEXT NOT NULL,
    resource TEXT NOT NULL,
    effect   TEXT NOT NULL CHECK (effect IN ('allow', 'deny')),
    matchCondition TEXT,
  );
  CREATE INDEX IF NOT EXISTS idx_rules_lookup ON rules(action, resource);
`);

const insertStmt = db.prepare(
  'INSERT INTO rules (action, resource, effect, matchCondition) VALUES (?, ?, ?, ?)',
);
const clearStmt = db.prepare('DELETE FROM rules');
const getAllStmt = db.prepare('SELECT action, resource, effect, matchCondition FROM rules');
const queryStmt = db.prepare(
  'SELECT action, resource, effect, matchCondition FROM rules WHERE action = ? AND resource = ?',
);

class SQLiteStorage implements Storage {
  async setRules(rules: GuantrRule[]): Promise<void> {
    db.transaction((ruleList: GuantrRule[]) => {
      clearStmt.run();
      for (const rule of ruleList) {
        insertStmt.run(
          rule.action,
          rule.resource,
          rule.effect,
          rule.matchCondition ? JSON.stringify(rule.matchCondition) : null,
        );
      }
    })(rules);
  }

  async getRules(): Promise<GuantrRule[]> {
    const rows = getAllStmt.all() as Array<{
      action: string;
      resource: string;
      effect: 'allow' | 'deny';
      matchCondition: string | null;
    }>;
    return rows.map((row) => ({
      ...row,
      matchCondition: row.matchCondition ? JSON.parse(row.matchCondition) : null,
    }));
  }

  async queryRules(action: string, resource: string): Promise<GuantrRule[]> {
    const rows = queryStmt.all(action, resource) as Array<{
      action: string;
      resource: string;
      effect: 'allow' | 'deny';
      matchCondition: string | null;
    }>;
    return rows.map((row) => ({
      ...row,
      matchCondition: row.matchCondition ? JSON.parse(row.matchCondition) : null,
    }));
  }
}
```

Key points:

- `matchCondition` is stored as a JSON string (`JSON.stringify` on write, `JSON.parse` on read).
- `null` conditions are stored as SQL `NULL` — never as the string `"null"`.
- The `queryRules` method uses a prepared statement with indexed columns for fast lookups.

### Prisma

**Schema:**

```prisma
model Rule {
  id             Int    `@id` `@default`(autoincrement())
  action         String
  resource       String
  effect         String
  matchCondition Json?

  @@index([action, resource])
}
```

**Adapter:**

```ts
import { PrismaClient } from '@prisma/client';
import type { GuantrRule } from 'guantr';
import type { Storage } from 'guantr/storage';

const prisma = new PrismaClient();

class PrismaStorage implements Storage {
  async setRules(rules: GuantrRule[]): Promise<void> {
    await prisma.$transaction(async (tx) => {
      await tx.rule.deleteMany();
      if (rules.length > 0) {
        await tx.rule.createMany({
          data: rules.map((rule) => ({
            action: rule.action,
            resource: rule.resource,
            effect: rule.effect,
            matchCondition: rule.matchCondition ?? null,
          })),
        });
      }
    });
  }

  async getRules(): Promise<GuantrRule[]> {
    const rows = await prisma.rule.findMany();
    return rows.map((row) => ({
      effect: row.effect as 'allow' | 'deny',
      action: row.action,
      resource: row.resource,
      matchCondition: row.matchCondition as GuantrRule['matchCondition'],
    }));
  }

  async queryRules(action: string, resource: string): Promise<GuantrRule[]> {
    const rows = await prisma.rule.findMany({
      where: { action, resource },
    });
    return rows.map((row) => ({
      effect: row.effect as 'allow' | 'deny',
      action: row.action,
      resource: row.resource,
      matchCondition: row.matchCondition as GuantrRule['matchCondition'],
    }));
  }
}
```

With Prisma, the `Json` column type handles serialization automatically. The condition AST contains plain objects without class instances, so Prisma's JSON round-trip preserves them intact.

### PostgreSQL (Drizzle ORM)

```ts
import { eq, and as sqlAnd, serial } from 'drizzle-orm';
import { pgTable, text, jsonb } from 'drizzle-orm/pg-core';
import { drizzle } from 'drizzle-orm/node-postgres';
import type { GuantrRule } from 'guantr';
import type { Storage } from 'guantr/storage';

const rulesTable = pgTable('rules', {
  id: serial('id').primaryKey(),
  action: text('action').notNull(),
  resource: text('resource').notNull(),
  effect: text('effect', { enum: ['allow', 'deny'] }).notNull(),
  matchCondition: jsonb('match_condition'),
});

const db = drizzle(pool, { schema: { rules: rulesTable } });

class DrizzleStorage implements Storage {
  async setRules(rules: GuantrRule[]): Promise<void> {
    await db.transaction(async (tx) => {
      await tx.delete(rulesTable);
      if (rules.length > 0) {
        await tx.insert(rulesTable).values(
          rules.map((r) => ({
            action: r.action,
            resource: r.resource,
            effect: r.effect,
            matchCondition: r.matchCondition ?? null,
          })),
        );
      }
    });
  }

  async getRules(): Promise<GuantrRule[]> {
    const rows = await db.select().from(rulesTable);
    return rows.map((r) => ({
      effect: r.effect as 'allow' | 'deny',
      action: r.action,
      resource: r.resource,
      matchCondition: r.matchCondition as GuantrRule['matchCondition'],
    }));
  }

  async queryRules(action: string, resource: string): Promise<GuantrRule[]> {
    const rows = await db
      .select()
      .from(rulesTable)
      .where(sqlAnd(eq(rulesTable.action, action), eq(rulesTable.resource, resource)));
    return rows.map((r) => ({
      effect: r.effect as 'allow' | 'deny',
      action: r.action,
      resource: r.resource,
      matchCondition: r.matchCondition as GuantrRule['matchCondition'],
    }));
  }
}
```

## Error Handling

- **`setRules` failures**: Surfaced to the caller. If your adapter writes rules partially before failing, the next `queryRules`/`getRules` call may return an inconsistent set. Use database transactions to ensure atomicity.
- **`getRules` / `queryRules` failures**: Surfaced directly. Ensure your adapter returns `[]` (not throws) when no rules match — `queryRules` should return an empty array for queries that find nothing.
- **JSON parse failures**: If `JSON.parse` throws on a corrupted `matchCondition` column, it will propagate up. Consider wrapping in a try/catch and discarding malformed rows, or running data integrity checks after migrations.

## Usage

### With `setRules()` at startup

```ts
import { createGuantr } from 'guantr';

const storage = new MyCustomStorage();
const guantr = await createGuantr({
  storage,
  context: () => ({ userId: '123' }),
});

await guantr.setRules((allow, deny) => {
  allow('read', [
    'post',
    ({ eq, resource, literal }) => eq(resource('status'), literal('published')),
  ]);
});

const canRead = await guantr.can('read', ['post', { id: 1, status: 'published' }]);
```

### With pre-seeded database (no `setRules()` needed)

When rules are already persisted in the database (e.g., from a migration using `serializeRules()`), the storage adapter serves them directly via `queryRules()`. No `setRules()` call is needed at runtime. See the [Database-Backed Rule Management](/guides/database-backed-rules) guide for the full pattern.

```ts
import { createGuantr } from 'guantr';

const storage = new PostgresStorage(sql); // queryRules reads from seeded rows
const guantr = await createGuantr<AppMeta>({
  storage,
  context: () => ({ userId: request.user.id }),
});

const ok = await guantr.can('read', ['post', post]);
```

## Migration from v1.x

In v1.x, conditions were stored as tuple expressions on a `condition` field:

```ts
{ effect: 'allow', action: 'read', resource: 'post', condition: { status: ['eq', 'draft'] } }
```

In v2.0, the field is renamed to `matchCondition` and conditions use the builder DSL, producing a `Condition` AST:

```ts
{
  effect: 'allow', action: 'read', resource: 'post',
  matchCondition: { type: 'condition', node: { type: 'operator', operator: 'eq', operands: [...] } }
}
```

If you're migrating a v1.x storage adapter, ensure you:

- Rename `condition` → `matchCondition` in your schema and queries.
- Convert legacy tuple expressions to the v2 `Condition` AST format.
- Remove `clearRules` — use `setRules([])` instead.
- Make `cache.has` required if you provide a `cache` property.
- See the full [Migration Guide](/guides/migration-v1-to-v2) for all breaking changes.
