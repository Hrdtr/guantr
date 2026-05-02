# Advanced Usage: Caching

Guantr incorporates an optional caching layer to enhance performance, particularly when dealing with context resolution or repeated permission checks. Understanding and potentially customizing this cache can be beneficial in high-throughput applications.

## How Caching Works

- **Purpose:** Caching aims to reduce redundant computations by storing the results of certain operations, such as resolving contextual operands or the outcomes of specific `can`/`cannot` checks.
- **Integration:** The caching mechanism is integrated as an optional part of the `Storage` interface. Any storage adapter provided to `createGuantr` _can_ include a `cache` property implementing methods for setting (`set`), getting (`get`), checking existence (`has`), and clearing (`clear`) cache entries.
- **Default Behavior:** Guantr's default `InMemoryStorage` includes a basic, in-memory cache implementation using a simple JavaScript `Map`. This provides caching out-of-the-box without external dependencies but lacks persistence or advanced eviction strategies (like TTL or LRU).

## Custom Cache Implementation

If the default in-memory cache isn't sufficient (e.g., you need persistence, shared caching via Redis/Memcached, or specific eviction policies like Time-To-Live (TTL) or Least Recently Used (LRU)), you have two main options:

1.  **Implement a Custom Storage Adapter:** Create a class that fully implements the `Storage` interface from `guantr/storage`. Optionally provide a `cache` implementation (e.g., backed by Redis) only if you need caching.
2.  **Extend `InMemoryStorage`:** If you only need to modify the caching behavior of the default storage, you can extend `InMemoryStorage` and, if desired, override its optional `cache` property.

### Example: Extending InMemoryStorage with Custom Logic

Here’s how you might extend `InMemoryStorage` to add simple logging to the cache methods, demonstrating the override points:

```ts
import { InMemoryStorage } from 'guantr/storage';
import type { Storage } from 'guantr/storage'; // Import the interface type

// Ensure GuantrMeta is defined if you use typed Guantr
// import type { GuantrMeta } from 'guantr';
// import { createGuantr } from 'guantr';

class LoggingCacheStorage extends InMemoryStorage {
  // Override the 'cache' property defined in the Storage interface
  override cache: Required<NonNullable<Storage['cache']>> = {
    // Use the parent class's underlying map for storage
    // Or replace with your own Map, Redis client, etc.

    async set<T>(key: string, value: T): Promise<void> {
      console.log(`CACHE SET: Key="${key}"`);
      // Call the original implementation to actually store the value
      await super.cache.set(key, value);
    },

    async get<T>(key: string): Promise<T | null | undefined> {
      console.log(`CACHE GET: Key="${key}"`);
      // Call the original implementation to retrieve the value
      const value = await super.cache.get<T>(key);
      console.log(`CACHE HIT : Key="${key}"`, value !== undefined && value !== null);
      return value;
    },

    async has(key: string): Promise<boolean> {
      console.log(`CACHE HAS: Key="${key}"`);
      // Call the original implementation
      return super.cache.has ? await super.cache.has(key) : false; // Default InMemoryStorage might not have 'has' explicitly separate from get
    },

    async clear(): Promise<void> {
      console.log('CACHE CLEAR: Clearing all cache entries');
      // Call the original implementation
      await super.cache.clear();
    },
  };
}

// --- Usage ---
async function initialize() {
  const customStorage = new LoggingCacheStorage();
  // Pass the custom storage instance during initialization
  // const guantr = await createGuantr<MyMeta>({ storage: customStorage });

  // Now, Guantr operations that use the cache will trigger the console logs
  // await guantr.can(...); // Might trigger get/set depending on internal logic
}

initialize();
```

**Explanation:**

- We extend `InMemoryStorage`.
- We use `override cache: Required<NonNullable<Storage['cache']>>` to explicitly override the optional `cache` property defined in the `Storage` interface, ensuring we provide all required cache methods (`set`, `get`, `clear`, and `has`).
- Inside our custom methods (`set`, `get`, `has`, `clear`), we add `console.log` statements.
- We still call `super.cache.set/get/has/clear` to leverage the base class's actual storage mechanism (the `Map`). In a more complex scenario (like adding TTL), you would replace these calls with your custom storage and retrieval logic.
- Finally, an instance of `LoggingCacheStorage` is passed to `createGuantr`.

## Important Considerations

- **Eviction Policies (TTL, LRU):** Guantr itself **does not** implement cache eviction logic like Time-To-Live (TTL) or Least Recently Used (LRU). If you need such policies, they must be implemented within your custom `cache` methods in your storage adapter.
- **Cache Invalidation:** Be mindful of cache invalidation. If underlying rules or context data changes frequently, a long-lived cache might serve stale permissions. When `setRules` is called, Guantr clears **all** cache entries via `this._storage.cache?.clear()` (see [`Guantr.prototype.setRules` in `src/index.ts`](https://github.com/hrdtr/guantr/blob/main/src/index.ts)). Guantr uses cache keys prefixed with `can/` (for permission check results) and `applyContextualOperands/` (for resolved condition operands). No key-level invalidation is performed — the entire cache is purged on every `setRules` call. External context changes that do not pass through `setRules` might therefore require manual cache clearing via `storage.cache.clear()`, or more granular removal if your adapter supports it.
- **Interface Compliance:** Ensure your custom `cache` implementation adheres to the method signatures defined in the `Storage['cache']` interface.

By understanding Guantr's caching mechanism and how to customize it via the storage adapter, you can optimize permission check performance for your specific application needs.
