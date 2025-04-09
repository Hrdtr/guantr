# Performance Considerations

Guantr is designed to be flexible and powerful, but like any system component, its performance can be influenced by various factors, especially under load. Understanding these factors can help you optimize your Guantr setup for demanding applications.

## Factors Affecting Performance

Several key areas contribute to the overall performance of Guantr's permission checks (`can`/`cannot` calls):

1.  **Number of Rules:**
    * **Impact:** The total number of rules stored can affect the performance of `queryRules` (fetching relevant rules) and potentially the number of rules Guantr needs to iterate through during evaluation.
    * **Details:** While Guantr attempts to fetch only relevant rules via `storage.queryRules(action, resource)`, if that method is inefficient (see Storage Adapter below) or if many rules match a specific action/resource pair, processing time can increase.

2.  **Complexity of Conditions:**
    * **Impact:** The structure and operators used within your rule `condition` objects directly impact CPU usage during evaluation.
    * **Details:** Evaluating simple equality checks (`['eq', value]`) is very fast. However, more complex operations like string matching (`contains`, `startsWith`, `endsWith`), numerical comparisons (`gt`, `gte`), or especially array operations (`in`, `has`, `hasSome`, `hasEvery`) require more computation. Nested conditions and operators like `some`, `every`, `none` that iterate over arrays of objects can be significantly more CPU-intensive, especially with large arrays.

3.  **`getContext` Speed:**
    * **Impact:** The time taken by your `getContext` function directly adds latency to any permission check that uses `$ctx` operands.
    * **Details:** If `getContext` performs slow operations like database queries, external API calls, or complex computations *every time it's called*, this can become a major bottleneck. As discussed in the [Using Context Effectively](/guides/context-usage.md) guide, this function might be called whenever a context-dependent rule is evaluated (though internal caching might reduce redundant calls for the same check).

4.  **Storage Adapter Choice & `queryRules` Efficiency:**
    * **Impact:** Both the underlying storage technology (in-memory, Redis, PostgreSQL, etc.) and the implementation quality of the storage adapter significantly affect performance.
    * **Details:**
        * **Latency:** Accessing `InMemoryStorage` is extremely fast. Network latency affects Redis/remote DBs. Disk I/O affects local databases like SQLite.
        * **`queryRules` Implementation:** This is CRITICAL. The `Storage` interface requires a `queryRules(action, resource)` method. Adapters that efficiently filter rules *at the data source* (e.g., using SQL `WHERE` clauses with database indexes, like the SQLite and Prisma examples) will vastly outperform adapters that fetch *all* rules and filter them in application memory (like the basic LocalStorage and Redis examples) when dealing with a large total number of rules.

5.  **Caching Effectiveness:**
    * **Impact:** The optional caching layer (`storage.cache`) can significantly reduce latency for repeated checks or context resolutions.
    * **Details:** An effective cache (good hit rate, fast backend like Redis or in-memory Map) mitigates the cost of re-running `can`/`cannot` logic or re-resolving `$ctx` operands for identical inputs. However, caching adds its own overhead (checking the cache, serialization) and requires careful consideration of invalidation. See the [Caching Guide](/advanced-usage/caching.md).

## Optimization Tips

Based on the factors above, here are tips for optimizing Guantr performance:

1.  **Optimize Rule Definitions:**
    * **Keep Conditions Simple:** For frequently checked permissions, use the simplest possible conditions. Avoid complex array operations (`some`, `every`, etc.) on large data sets within conditions if possible.
    * **Minimize Rule Count (Selectively):** While Guantr aims to query only relevant rules, reducing the *total* number of rules can help, especially if your `queryRules` implementation isn't highly optimized. Consolidate rules where logical.
    * **Leverage `deny`:** Use specific `deny` rules to restrict access rather than overly complex negative conditions in `allow` rules.

2.  **Optimize `getContext`:**
    * **Fetch Data Once:** In web frameworks, fetch user/session data once per request (e.g., in auth middleware) and have `getContext` simply return this pre-fetched object. Avoid database calls or heavy computation *inside* `getContext`.
    * **Keep Context Small:** Only include data in the context object that is actually needed for rule evaluation.

3.  **Optimize Storage:**
    * **Choose Appropriate Adapter:** Select a storage backend suitable for your scale and persistence needs (e.g., `InMemoryStorage` for transient rules, Redis for shared cache/rules, a database for robust persistence).
    * **Implement `queryRules` Efficiently:** If using a custom or database adapter, ensure `queryRules(action, resource)` filters data *at the source* using appropriate indexes (e.g., a database index on `action` and `resource` columns). Avoid loading all rules into memory for filtering.

4.  **Utilize Caching:**
    * **Enable Caching:** Implement the `storage.cache` interface, especially if `getContext` performs I/O or if the same permission checks are common.
    * **Choose Fast Backend:** Use an efficient cache backend (in-memory Map for single instance, Redis/Memcached for distributed).
    * **Consider Invalidation:** Ensure your caching strategy includes appropriate invalidation (e.g., clear cache when rules change via `setRules`).

5.  **Profile:**
    * Measure performance in your specific application under realistic load. Identify bottlenecks using profiling tools to focus your optimization efforts where they matter most.

## Conclusion

Guantr's performance depends on a combination of factors related to rule definition, context handling, storage interaction, and caching. By understanding these elements and applying targeted optimizations—particularly ensuring efficient `getContext` calls and an optimized `queryRules` implementation in your storage adapter—you can ensure Guantr runs efficiently even in demanding scenarios.
