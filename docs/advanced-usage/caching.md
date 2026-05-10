---
description: "Learn about Guantr's optional caching layer — how caching works, cache key patterns, invalidation strategies, custom cache implementations (Redis, LRU, TTL), and performance considerations."
---

# Advanced Usage: Caching

Guantr includes an optional caching layer to reduce redundant computations during permission checks. Understanding the cache mechanism helps you decide whether to use it, customize it, or disable it for your workload.

## How Caching Works

### Purpose

Caching avoids re-evaluating the same permission check multiple times. When the same `(action, resource, context)` combination is checked repeatedly, the result is served from the cache rather than fetching rules and evaluating conditions again.

### Integration via Storage

The cache is not a standalone component — it lives on the `Storage` adapter:

```ts
interface Storage {
  setRules: (rules: GuantrRule[]) => Promise<void>;
  getRules: () => Promise<GuantrRule[]>;
  queryRules: (action: string, resource: string) => Promise<GuantrRule[]>;
  cache?: {
    set: <T>(key: string, value: T) => Promise<void>;
    get: <T>(key: string) => Promise<T | undefined>;
    has: (key: string) => Promise<boolean>;
    clear: () => Promise<void>;
  };
}
```

If `cache` is present on the storage adapter, Guantr uses it. If absent, Guantr operates without caching — no error, no fallback, no warning.

### Default InMemoryStorage Cache

The default `InMemoryStorage` includes a cache backed by a `Map<string, unknown>`:

```ts
class InMemoryStorage implements Storage {
  private storage = {
    rules: new Map<string, Map<string, GuantrRule[]>>(),
    cache: new Map<string, unknown>(),
  };

  cache = {
    set: async <T>(key: string, value: T) => {
      this.storage.cache.set(key, value);
    },
    get: async <T>(key: string): Promise<T | undefined> => {
      return this.storage.cache.get(key) as T | undefined;
    },
    has: async (key: string) => {
      return this.storage.cache.has(key);
    },
    clear: async () => {
      this.storage.cache.clear();
    },
  };
}
```

## Cache Key Patterns

### Permission Check Results (`can` / `cannot`)

Keys follow the pattern:

```
can/${action}:${resourceKey}:${JSON.stringify(resourceInstance)}:${JSON.stringify(context)}
```

Example:

```
can/read:post:{"id":1,"status":"draft"}:{"userId":"123"}
```

The entire resource instance and context object are stringified into the key. This means caching is most effective when the same user checks the same resource repeatedly.

### Abstract Permission Checks (`can.abstract` / `cannot.abstract`)

Keys follow the pattern:

```
can.abstract/${action}:${resourceKey}
```

Example:

```
can.abstract/read:post
```

Abstract checks only verify that **any** allow rule exists for a given action+resource pair — no instance or conditions are evaluated. The cache key has no instance or context component.

### All Rules Cache (`getRules`)

A single key is used:

```
getRules
```

When `getRules()` is called, the entire rule set is cached under this fixed key.

## Cache Invalidation

### Automatic: `setRules()`

Calling `setRules()` clears the **entire** cache via `this._storage.cache?.clear()`. This happens in `Guantr.setRules()` at `src/index.ts:317`, before the new rules are written to storage.

```ts
async setRules(callbackOrRules) {
  // ... process rules ...
  await this._storage.cache?.clear();   // <-- full clear
  return this._storage.setRules(nextRules);
}
```

There is no key-level invalidation — it's all or nothing.

### Context Changes

The context object (from `context`) is hashed into cache keys. If the context changes between calls, different keys are produced, so stale results are naturally avoided. However, if your `context` returns the same object reference with mutated fields, the cache key won't change:

```ts
// BAD — shared mutable object
const ctx = { userId: '1' };
const guantr = await createGuantr({ context: () => ctx });
// Later: ctx.userId = '2' — cache key unchanged, stale results served

// GOOD — fresh object each call
const guantr = await createGuantr({ context: () => ({ userId: getCurrentUserId() }) });
```

### Manual Invalidation

If external state changes (e.g., user roles update in the database) and you need to clear the cache without calling `setRules`:

```ts
await storage.cache?.clear();
```

For more granular invalidation, you'd need a custom cache implementation that exposes key-level deletion.

## Cache Error Resilience

Cache operations are wrapped in try/catch blocks. **Cache errors are silently swallowed** — the operation continues as if the cache were absent:

```ts
// From src/index.ts — _can() method:
try {
  if (await this._storage.cache.has(cacheKey)) {
    cachedResult = await this._storage.cache.get<boolean>(cacheKey);
  }
} catch {
  cachedResult = undefined; // miss — proceed to evaluation
}

// ... evaluate ...

try {
  await this._storage.cache?.set(cacheKey, result);
} catch {
  // silently ignored, result is still returned
}
```

This means:

- A broken Redis connection won't crash your application.
- A full cache that throws on `set` won't prevent permission checks.
- A misbehaving `has` that throws will be treated as a cache miss.

## When Cache Is Absent

If your storage adapter has no `cache` property (or `cache` is `undefined`), Guantr works correctly without it:

- **`can()`**: Always evaluates conditions against the resource and context. Each call fetches rules from storage and evaluates from scratch.
- **`can.abstract()`**: Always queries storage for rule existence.
- **`getRules()`**: Always calls `storage.getRules()`.

No caching overhead means no memory usage, no eviction concerns, and guaranteed freshness — at the cost of repeated evaluation.

## Custom Cache Implementations

### Extending InMemoryStorage

The simplest customization — override just the cache behavior:

```ts
import { InMemoryStorage } from 'guantr/storage';
import type { Storage } from 'guantr/storage';

class LoggingStorage extends InMemoryStorage {
  override cache: Required<NonNullable<Storage['cache']>> = {
    set: async <T>(key: string, value: T) => {
      console.log(`[cache] SET ${key}`);
      await super.cache.set(key, value);
    },
    get: async <T>(key: string): Promise<T | undefined> => {
      const val = await super.cache.get<T>(key);
      console.log(`[cache] GET ${key} → ${val !== undefined ? 'HIT' : 'MISS'}`);
      return val;
    },
    has: async (key: string) => {
      const exists = await super.cache.has(key);
      console.log(`[cache] HAS ${key} → ${exists}`);
      return exists;
    },
    clear: async () => {
      console.log('[cache] CLEAR');
      await super.cache.clear();
    },
  };
}
```

Note: the `cache` property is typed as `Required<NonNullable<Storage['cache']>>` because when you override it, you must provide all four methods. TypeScript won't let you provide a partial implementation.

### TTL Cache with InMemoryStorage

```ts
class TtlCacheStorage extends InMemoryStorage {
  private ttl = 60_000; // 60 seconds

  override cache: Required<NonNullable<Storage['cache']>> = {
    set: async <T>(key: string, value: T) => {
      const entry = { value, expires: Date.now() + this.ttl };
      await super.cache.set(key, entry);
    },

    get: async <T>(key: string): Promise<T | undefined> => {
      const cached = await super.cache.get<{ value: T; expires: number }>(key);
      if (cached === undefined) return undefined;
      if (Date.now() > cached.expires) {
        // Lazy eviction — delete on read
        // super.cache doesn't expose delete, but InMemoryStorage's map does
        return undefined;
      }
      return cached.value;
    },

    has: async (key: string): Promise<boolean> => {
      const cached = await super.cache.get<{ value: unknown; expires: number }>(key);
      if (cached === undefined) return false;
      if (Date.now() > cached.expires) return false;
      return true;
    },

    clear: async () => {
      await super.cache.clear();
    },
  };
}
```

### External Cache (Redis)

```ts
import { createClient } from 'redis';
import { InMemoryStorage } from 'guantr/storage';
import type { Storage } from 'guantr/storage';

class RedisCacheStorage extends InMemoryStorage {
  private redis = createClient();

  constructor() {
    super();
    this.redis.connect().catch(console.error);
  }

  override cache: Required<NonNullable<Storage['cache']>> = {
    set: async <T>(key: string, value: T) => {
      try {
        await this.redis.set(`guantr:${key}`, JSON.stringify(value), {
          EX: 300, // 5 minute TTL
        });
      } catch {
        // Connection error — silently ignored by Guantr
      }
    },

    get: async <T>(key: string): Promise<T | undefined> => {
      try {
        const raw = await this.redis.get(`guantr:${key}`);
        return raw !== null ? (JSON.parse(raw) as T) : undefined;
      } catch {
        return undefined;
      }
    },

    has: async (key: string): Promise<boolean> => {
      try {
        return (await this.redis.exists(`guantr:${key}`)) === 1;
      } catch {
        return false;
      }
    },

    clear: async () => {
      try {
        // KEYS with prefix — not ideal for production, use SCAN for large datasets
        const keys = await this.redis.keys('guantr:*');
        if (keys.length > 0) {
          await this.redis.del(keys);
        }
      } catch {
        // ignored
      }
    },
  };
}
```

Key points for Redis-based caches:

- Prefix keys to avoid collisions (e.g., `guantr:`).
- Use `EX` / `PX` on `SET` for automatic TTL-based eviction rather than implementing it yourself.
- Always catch errors — the cache contract expects silent failure.
- `get` must return `undefined` for misses. Redis returns `null` for missing keys, so convert: `raw !== null ? parse(raw) : undefined`.

### LRU Cache with lru-cache

```ts
import { LRUCache } from 'lru-cache';
import { InMemoryStorage } from 'guantr/storage';
import type { Storage } from 'guantr/storage';

class LruCacheStorage extends InMemoryStorage {
  private lru = new LRUCache<string, unknown>({
    max: 1000, // max 1000 entries
    ttl: 1000 * 60 * 5, // 5 minutes
  });

  override cache: Required<NonNullable<Storage['cache']>> = {
    set: async <T>(key: string, value: T) => {
      this.lru.set(key, value);
    },

    get: async <T>(key: string): Promise<T | undefined> => {
      return this.lru.get(key) as T | undefined;
    },

    has: async (key: string): Promise<boolean> => {
      return this.lru.has(key);
    },

    clear: async () => {
      this.lru.clear();
    },
  };
}
```

## Performance Considerations

### When Caching Helps

- **High-frequency repeated checks**. If `can('read', 'post')` is called many times for the same resource instance by the same user (same context), caching eliminates redundant storage queries and condition evaluation.
- **Stable contexts**. If `context` returns the same logical context across many requests (e.g., a user session), cache hit rates will be high.
- **Expensive condition evaluation**. Complex nested `some`/`every` conditions benefit from being cached.

### When Caching Adds Overhead

- **Unique resource instances**. If every `can()` call involves a different resource instance (different primary key), the cache key includes the entire serialized instance, so every key is unique — zero cache hits, plus the cost of serializing and hashing.
- **Volatile contexts**. If `context` changes on every request, cache keys are always new.
- **Memory pressure**. The default in-memory `Map` cache grows unboundedly. In long-running processes with many unique `(action, resource, context)` combinations, this can lead to memory leaks. Use a TTL or LRU implementation to bound memory usage.

### Context Resolution

`context` is resolved:

- Once per `can()` / `cannot()` call.
- Once per `can.all()` / `can.any()` batch (shared across all items in the batch).

This means if you have an expensive `context` function (e.g., a database query), caching the resolved context at the application level (outside Guantr) may be more impactful than Guantr's internal cache. When using a plain object, context resolution is effectively free.

### Benchmarking Tip

To measure cache effectiveness, extend `InMemoryStorage` with hit/miss counters:

```ts
class InstrumentedCacheStorage extends InMemoryStorage {
  hits = 0;
  misses = 0;

  override cache: Required<NonNullable<Storage['cache']>> = {
    set: async <T>(key: string, value: T) => {
      await super.cache.set(key, value);
    },
    get: async <T>(key: string): Promise<T | undefined> => {
      const val = await super.cache.get<T>(key);
      val !== undefined ? this.hits++ : this.misses++;
      return val;
    },
    has: async (key: string) => {
      return super.cache.has(key);
    },
    clear: async () => {
      await super.cache.clear();
    },
  };

  get hitRate(): number {
    const total = this.hits + this.misses;
    return total === 0 ? 0 : this.hits / total;
  }
}

// After some usage:
console.log(`Cache hit rate: ${(storage.hitRate * 100).toFixed(1)}%`);
```

## Cache Contract Summary

| Rule                                          | Detail                                                 |
| --------------------------------------------- | ------------------------------------------------------ |
| `get` must return `undefined` for misses      | Not `null`, not `false` — `undefined`                  |
| `has` is **required** when cache is provided  | No fallback to `get`-then-check                        |
| All methods return `Promise`                  | Even if the underlying store is synchronous            |
| Errors are swallowed by Guantr                | Your adapter can throw, but Guantr will catch silently |
| `clear()` is called before every `setRules()` | Full invalidation, no key-level clearing               |
