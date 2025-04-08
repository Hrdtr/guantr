# Using Context Effectively in Guantr

Guantr's authorization decisions often need to consider more than just the properties of the resource being accessed. They might depend on *who* is making the request, *when* they are making it, or other environmental factors. This dynamic information is provided to Guantr through **Context**.

## What is Context?

Context is an object containing data relevant to the current permission check, made available during rule evaluation. It typically includes information about the user performing the action (like their ID, roles, or department) but can also contain environmental data (like IP address, time of day, etc.).

Context allows you to implement:

* **Attribute-Based Access Control (ABAC):** Rules depend on user attributes (e.g., allow if `$ctx.userRole` is 'admin').
* **Relationship-Based Access Control (ReBAC):** Rules depend on the relationship between the user and the resource (e.g., allow if `resource.ownerId` equals `$ctx.userId`).
* **Environment-Based Rules:** Rules depend on context like location or time (e.g., deny if `$ctx.ipAddress` is outside a specific range).

## Providing Context: The `getContext` Function

You supply context to Guantr by providing an asynchronous `getContext` function within the options object when calling `createGuantr`.

**Signature:**

```ts
interface GuantrOptions<Context extends Record<string, unknown>> {
  // ... other options like storage ...
  getContext?: () => Context | PromiseLike<Context>;
}
```

This function takes no arguments and should return (or resolve with) an object matching the `Context` type defined in your `GuantrMeta` (if using TypeScript).

### Common `getContext` Patterns

**Pattern 1: Request-Scoped Context (Most Common)**

In web applications (Express, NestJS, Next.js, Koa, etc.), authorization checks usually happen within the scope of an incoming request. The most common pattern is to:

1.  Authenticate the user and fetch their data (e.g., in middleware) *before* the permission check.
2.  Attach user data to the request object (e.g., `request.user`).
3.  Initialize Guantr *within the request handler or a request-scoped service*.
4.  Provide a `getContext` function that simply reads the user data from the request object.

```ts
// --- Conceptual Express.js Example ---
import { createGuantr } from 'guantr';
import type { Request, Response, NextFunction } from 'express';
// Assume MyMeta and MyContext are defined, matching req.user structure
// Assume authMiddleware populates req.user

async function permissionCheckMiddleware(req: Request, res: Response, next: NextFunction) {

  // Initialize Guantr *per request*
  const guantr = await createGuantr<MyMeta, MyContext>({
    // getContext simply returns user data already attached to the request
    getContext: () => {
      // Ensure the returned shape matches MyContext
      return req.user || { userId: null, roles: [] }; // Provide default if user might be undefined
    },
    // storage: provide your persistent storage adapter here
  });

  // Perform permission check
  const articleId = req.params.id;
  const article = await fetchArticle(articleId); // Fetch resource if needed for conditions

  if (await guantr.cannot('edit', ['article', article])) {
     return res.status(403).send('Forbidden');
  }

  next(); // Permission granted, proceed to next handler
}

app.post('/articles/:id', authMiddleware, permissionCheckMiddleware, (req, res) => {
  // Main route logic here...
});
```

**Pattern 2: Asynchronous Context Fetching**

If user/session data isn't readily available when `getContext` is called, the function can perform asynchronous operations.

```ts
import { createGuantr } from 'guantr';
import { getSessionData } from './sessionStore'; // Assume async function

const guantr = await createGuantr<MyMeta, MyContext>({
  getContext: async (): Promise<MyContext> => {
    try {
      // Fetch required data only when context is needed
      const session = await getSessionData();
      return {
        userId: session?.userId ?? null,
        userRoles: session?.roles ?? [],
        // Potentially more async calls if needed
      };
    } catch (error) {
      console.error("Error fetching context:", error);
      // Return a default/unauthenticated context on error
      return { userId: null, userRoles: [] };
    }
  }
});
```

**Pattern 3: Static Context**

Less common, but if the context is fixed for the lifetime of the Guantr instance, you can return a static object.

```ts
const guantr = await createGuantr({
  // Context is fixed for this instance
  getContext: () => ({
    systemRole: 'batch-processor',
    processId: 'proc-123'
  })
});
```

## Using Context in Rules: The `$ctx` Prefix

Inside your rule conditions, you access properties from the context object using the `$ctx.` prefix within the *operand* part of a condition expression (`[operator, operand]`).

* **Accessing Properties:** Use dot notation for nested properties (e.g., `$ctx.user.id`, `$ctx.session.ip`). Guantr uses the `getContextValue` utility internally to resolve these paths.
* **Type Safety:** If using `GuantrMeta`, TypeScript will validate that the properties you access via `$ctx.` exist on your defined `Context` type.

```ts
await guantr.setRules<MyAppMeta>(async (allow, deny) => {

  // Example 1: Ownership check (ReBAC pattern)
  allow('edit', ['article', {
    authorId: ['eq', '$ctx.userId'] // Compare article's authorId to context's userId
  }]);

  // Example 2: Role check
  allow('access', ['adminPanel', {
    requiredRole: ['in', '$ctx.userRoles'] // Check if requiredRole is in user's roles array from context
  }]);

  // Example 3: Combining resource and context attributes
  allow('publish', ['article', {
    status: ['eq', 'approved'],       // Resource attribute check
    authorId: ['eq', '$ctx.userId']  // Context attribute check
  }]);

  // Example 4: Using context with other operators
  allow('view', ['report', {
    minAccessLevel: ['lte', '$ctx.userClearanceLevel'] // Compare using 'lte'
  }]);

  // Example 5: Nested context properties
  allow('debug', ['system', {
    environment: ['eq', '$ctx.env.name'] // Accessing nested property
  }]);
});
```

## Performance Implications

The `getContext` function might be called whenever Guantr needs to evaluate a rule condition that uses a `$ctx.` operand. If not internally cached by Guantr for a specific check, it could potentially be called multiple times during the resolution of a single `can`/`cannot` request if many rules reference context.

**Therefore, it's crucial that your `getContext` function is efficient.**

* **Slow `getContext` = Slow Checks:** If `getContext` performs slow operations (like database queries or external API calls), every permission check relying on context will inherit that latency.
* **Recommendation: Fetch Once Per Request:** In web frameworks, the best practice is usually to fetch user/session data *once* early in the request lifecycle (e.g., in authentication middleware) and attach it to the request object. Your `getContext` function should then simply *read* this pre-fetched data, making it very fast.
* **Caching within `getContext`:** If you absolutely must fetch data within `getContext`, consider implementing caching *within* that function (using application-level caching like Redis, Memcached, or a simple in-memory cache with TTL) to avoid refetching the same data repeatedly across different permission checks *within the same request* (if Guantr instance lives for the request).
* **Guantr's Internal Cache:** Guantr's own optional caching mechanism (part of the Storage interface) primarily helps cache the *results* of permission checks or resolved operands. While it might reduce the *number* of times `getContext` is called for identical checks, it won't speed up the execution *of* `getContext` itself if it's inherently slow.

## Conclusion

Context is a fundamental feature in Guantr that enables dynamic and fine-grained authorization based on user identity, relationships, and environmental factors. By implementing the `getContext` function efficiently (preferably accessing pre-fetched, request-scoped data) and utilizing the `$ctx.` prefix correctly in your rule conditions, you can build powerful and flexible access control systems. Always be mindful of the performance implications of your `getContext` implementation.
