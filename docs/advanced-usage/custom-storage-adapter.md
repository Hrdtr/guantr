# Advanced Usage: Custom Storage Adapter

By default, Guantr uses `InMemoryStorage`to store permission rules. This is convenient for getting started and for scenarios where rules don't need to persist beyond the application's runtime. However, for persistent rules or sharing rules across multiple application instances, you'll need a custom storage adapter.

## The `Storage` Interface

To create a custom adapter, you need to implement the `Storage` interface defined in `guantr/storage/types`. This interface mandates several asynchronous methods for rule management and includes an optional property for caching.

**Required Methods:**

* `setRules(rules: GuantrAnyRule[]): Promise<void>`: Replaces all existing rules with the provided array. Should handle storing the rules persistently.
* `getRules(): Promise<GuantrAnyRule[]>`: Retrieves all currently stored rules.
* `queryRules(action: string, resource: string): Promise<GuantrAnyRule[]>`: Retrieves only the rules matching a specific action and resource key. Implementing this efficiently (filtering at the source) is crucial for performance with large rule sets.
* `clearRules(): Promise<void>`: Deletes all stored rules.

**Optional Property:**

* `cache?: { set, get, has, clear }`: An optional object implementing caching logic. See the [Caching Guide](./caching.md) for details.

## Example Implementations

Here are examples using common storage solutions. Remember to add appropriate error handling for production environments.

### Browser LocalStorage

This adapter is suitable for client-side browser applications where rule persistence per user session is sufficient.

**Note:** LocalStorage has size limits and stores data as strings.

```ts
import type { GuantrAnyRule } from 'guantr';
import type { Storage } from 'guantr/storage';

const STORAGE_KEY = 'guantr_rules';

class LocalStorageAdapter implements Storage {
  async setRules(rules: GuantrAnyRule[]): Promise<void> {
    try {
      // Store the entire rules array as a single stringified entry
      localStorage.setItem(STORAGE_KEY, JSON.stringify(rules));
    } catch (error) {
      console.error("Error setting Guantr rules in LocalStorage:", error);
      // Handle potential errors (e.g., storage quota exceeded)
    }
  }

  async getRules(): Promise<GuantrAnyRule[]> {
    try {
      const storedRules = localStorage.getItem(STORAGE_KEY);
      return storedRules ? JSON.parse(storedRules) : [];
    } catch (error) {
      console.error("Error getting Guantr rules from LocalStorage:", error);
      return []; // Return empty array on error
    }
  }

  // Note: This queryRules implementation fetches all rules and filters locally.
  // This can be inefficient for very large rule sets compared to DB filtering.
  async queryRules(action: string, resource: string): Promise<GuantrAnyRule[]> {
    const allRules = await this.getRules();
    return allRules.filter(rule => rule.action === action && rule.resource === resource);
  }

  async clearRules(): Promise<void> {
    localStorage.removeItem(STORAGE_KEY);
  }

  // cache?: Storage['cache']; // Optional: Implement cache if needed
}
```

### Redis

Uses `ioredis` (or a similar client) to store rules in Redis, suitable for shared state between server instances.

```ts
import type { GuantrAnyRule } from 'guantr';
import type { Storage } from 'guantr/storage';
import Redis from 'ioredis'; // Assuming ioredis client

const redisClient = new Redis(/* Redis connection options */);
const REDIS_KEY = 'guantr_rules';

class RedisStorage implements Storage {
  async setRules(rules: GuantrAnyRule[]): Promise<void> {
    // Overwrite existing key with the new set of rules
    await redisClient.set(REDIS_KEY, JSON.stringify(rules));
  }

  async getRules(): Promise<GuantrAnyRule[]> {
    const storedRules = await redisClient.get(REDIS_KEY);
    return storedRules ? JSON.parse(storedRules) : [];
  }

  // Note: This queryRules implementation fetches all rules and filters locally.
  // Consider alternative Redis structures (e.g., sets per action/resource)
  // for more efficient querying with very large rule sets.
  async queryRules(action: string, resource: string): Promise<GuantrAnyRule[]> {
    const allRules = await this.getRules();
    return allRules.filter(rule => rule.action === action && rule.resource === resource);
  }

  async clearRules(): Promise<void> {
    await redisClient.del(REDIS_KEY);
  }

  // cache?: Storage['cache']; // Optional: Implement cache using Redis commands
}
```

### SQLite (using `better-sqlite3` or `Bun.sqlite`)

Stores rules in a structured SQLite database table.

```ts
// Assumes using better-sqlite3 or Bun.sqlite's similar API
// import Database from 'better-sqlite3';
// const db = new Database('guantr.db'); OR import { Database } from 'bun:sqlite'; const db = new Database(...);

// --- Database Setup ---
db.exec(`
  CREATE TABLE IF NOT EXISTS rules (
    action TEXT NOT NULL,
    resource TEXT NOT NULL,
    condition TEXT, -- Store JSON as TEXT
    effect TEXT NOT NULL CHECK(effect IN ('allow', 'deny')),
    PRIMARY KEY (action, resource, condition, effect) -- Example PK
  );
`);
db.exec(`CREATE INDEX IF NOT EXISTS idx_rules_action_resource ON rules (action, resource);`);

// --- Prepared Statements ---
const insertStmt = db.prepare<[string, string, string | null, string]>(
  'INSERT OR REPLACE INTO rules (action, resource, condition, effect) VALUES (?, ?, ?, ?)'
);
const queryStmt = db.prepare<[string, string]>(
  'SELECT action, resource, condition, effect FROM rules WHERE action = ? AND resource = ?'
);
const getAllStmt = db.prepare('SELECT action, resource, condition, effect FROM rules');
const clearStmt = db.prepare('DELETE FROM rules');


// --- Storage Class ---
class SQLiteStorage implements Storage {
  async setRules(rules: GuantrAnyRule[]): Promise<void> {
    // Use a transaction for bulk insert/replace
    db.transaction((ruleList: GuantrAnyRule[]) => {
      clearStmt.run(); // Clear existing rules first
      for (const rule of ruleList) {
        insertStmt.run(
          rule.action,
          rule.resource,
          rule.condition ? JSON.stringify(rule.condition) : null,
          rule.effect
        );
      }
    })(rules);
  }

  async getRules(): Promise<GuantrAnyRule[]> {
    const rows = getAllStmt.all() as Array<{ action: string, resource: string, condition: string | null, effect: 'allow' | 'deny' }>;
    return rows.map(row => ({
      ...row,
      condition: row.condition ? JSON.parse(row.condition) : null,
    }));
  }

  async queryRules(action: string, resource: string): Promise<GuantrAnyRule[]> {
    // This query efficiently filters at the database level
    const rows = queryStmt.all(action, resource) as Array<{ action: string, resource: string, condition: string | null, effect: 'allow' | 'deny' }>;
     return rows.map(row => ({
      ...row,
      condition: row.condition ? JSON.parse(row.condition) : null,
    }));
  }

  async clearRules(): Promise<void> {
    clearStmt.run();
  }

  // cache?: Storage['cache']; // Optional: Could implement cache using another table or external cache
}
```

### Prisma

Uses Prisma ORM for type-safe database interactions.

```prisma
// schema.prisma

model Rule {
  id        Int     @id @default(autoincrement())
  resource  String
  action    String
  condition Json? // Prisma supports JSON type
  effect    String  // Could use an Enum here

  @@index([resource, action])
}
```

```ts
import type { GuantrAnyRule } from 'guantr';
import type { Storage } from 'guantr/storage';
import { PrismaClient, Prisma } from '@prisma/client'; // Import Prisma types if needed

const prisma = new PrismaClient();

class PrismaStorage implements Storage {
  async setRules(rules: GuantrAnyRule[]): Promise<void> {
    // Use Prisma transaction API for atomicity
    await prisma.$transaction(async (tx) => {
      await tx.rule.deleteMany(); // Clear existing rules

      if (rules.length > 0) {
        // Prepare data for createMany, ensuring compatibility
        const dataToCreate = rules.map(rule => ({
          action: rule.action,
          resource: rule.resource,
          // Prisma handles JSON serialization for the 'condition' field
          condition: rule.condition as Prisma.JsonValue ?? Prisma.DbNull,
          effect: rule.effect,
        }));
        await tx.rule.createMany({ data: dataToCreate });
      }
    });
  }

  async getRules(): Promise<GuantrAnyRule[]> {
    const rules = await prisma.rule.findMany();
    // Map Prisma result to GuantrAnyRule, handling potential null condition
    return rules.map(rule => ({
      ...rule,
      condition: rule.condition as GuantrAnyRuleCondition | null, // Cast JsonValue back
    }));
  }

  async queryRules(action: string, resource: string): Promise<GuantrAnyRule[]> {
    // Efficiently filters at the database level
    const rules = await prisma.rule.findMany({
      where: { action, resource }
    });
     return rules.map(rule => ({
      ...rule,
      condition: rule.condition as GuantrAnyRuleCondition | null,
    }));
  }

  async clearRules(): Promise<void> {
    await prisma.rule.deleteMany();
  }

  // cache?: Storage['cache']; // Optional: Implement cache if needed
}
```

## Using the Custom Adapter

Once your adapter is implemented, simply pass an instance of it to `createGuantr` in the options:

```ts
import { createGuantr } from 'guantr';
// Assuming MyMeta and MyLocalStorageAdapter are defined
// import type { MyMeta } from './meta';
// import { MyLocalStorageAdapter } from './localstorage-adapter';

async function initializeGuantr() {
  const customStorage = new MyLocalStorageAdapter();
  // Or new RedisStorage(), new SQLiteStorage(), new PrismaStorage()

  const guantr = await createGuantr</* MyMeta */>({
    storage: customStorage,
    // getContext function if needed
  });

  // Guantr instance now uses your custom storage
  // await guantr.setRules(...);
  // const canAccess = await guantr.can(...);
}

initializeGuantr();
```

By implementing a custom storage adapter, you gain control over how and where Guantr rules are stored, enabling persistence, sharing, and integration with various backend systems. Remember to consider the efficiency of your `queryRules` implementation for optimal performance.
