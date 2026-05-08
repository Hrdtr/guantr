# Using Context Effectively in Guantr

Authorization decisions often depend on **who** is making the request, **when**, and other environmental factors. Guantr provides this dynamic information through **Context**.

---

## What is Context?

Context is an object containing data relevant to the current permission check, made available during rule evaluation. It typically includes information about the user performing the action (ID, roles, department) but can also hold environmental data (IP address, time of day, feature flags).

Context enables three common authorization patterns:

- **Attribute-Based Access Control (ABAC):** Rules depend on user attributes — e.g. allow if `context('role')` is `'admin'`.
- **Relationship-Based Access Control (ReBAC):** Rules depend on the relationship between user and resource — e.g. allow if `resource.ownerId === context('userId')`.
- **Environment-Based Rules:** Rules depend on location, time, or other request-scoped data.

---

## Providing Context: `context`

You supply context via the `context` option in `GuantrOptions`. It accepts either a static context object or a function that returns the context (optionally async):

```ts
interface GuantrOptions<Context extends Record<string, unknown>> {
  context?: Context | (() => Context | PromiseLike<Context>);
}
```

When you pass a plain object, Guantr wraps it internally as `() => Promise.resolve(obj)` — the context is still resolved on every check, but the value remains the same.

If omitted, Guantr uses `() => Promise.resolve({})` — an empty context.

### Pattern 1: Request-Scoped (most common in web apps)

In web applications, authorization checks happen within the scope of an incoming request. The typical flow:

1. Authenticate the user early in the request lifecycle.
2. Attach user data to a request-scoped container.
3. Create a new `Guantr` instance per-request, providing a `context` that reads from that container.

```ts
import { createGuantr } from 'guantr';

// Per-request setup — extract user data from the request container.
async function getGuantrForRequest(request: { user?: { id: number; role: string } }) {
  return createGuantr<MyMeta>({
    context: () => ({
      userId: request.user?.id ?? null,
      role: request.user?.role ?? 'viewer',
    }),
  });
}
```

### Pattern 2: Asynchronous Context Fetching

When user/session data must be fetched on demand (e.g. from a session store):

```ts
const guantr = await createGuantr<MyMeta>({
  context: async () => {
    try {
      const session = await getSessionData();
      return {
        userId: session?.userId ?? null,
        userRoles: session?.roles ?? [],
      };
    } catch {
      // Graceful fallback — unauthenticated context
      return { userId: null, userRoles: [] };
    }
  },
});
```

### Pattern 3: Static / Long-Lived Context

When the context is fixed for the lifetime of the Guantr instance (e.g. background workers, CLI tools), pass a plain object:

```ts
const guantr = await createGuantr<MyMeta>({
  context: {
    systemRole: 'batch-processor',
    processId: 'proc-123',
  },
});
```

---

## Using Context in Rules: `context()` Builder Method

Inside rule conditions, access context properties via the builder's `context()` method — the counterpart to `resource()`:

```ts
await guantr.setRules((allow, deny) => {
  // Ownership check (ReBAC pattern)
  allow('edit', [
    'article',
    ({ eq, resource, context }) => eq(resource('authorId'), context('userId')),
  ]);

  // Role-based access
  allow('access', [
    'adminPanel',
    ({ in: inOp, context, literal }) => inOp(context('role'), literal(['admin', 'superadmin'])),
  ]);

  // Combining resource and context attributes
  allow('publish', [
    'article',
    ({ and, eq, resource, context, literal }) =>
      and(eq(resource('status'), literal('approved')), eq(resource('authorId'), context('userId'))),
  ]);

  // Numeric comparison with context
  allow('view', [
    'report',
    ({ gte, resource, context }) => gte(resource('minAccessLevel'), context('userClearanceLevel')),
  ]);

  // Nested context properties
  allow('debug', [
    'system',
    ({ eq, resource, context }) => eq(resource('environment'), context('env.name')),
  ]);
});
```

Context values can appear anywhere a value reference is accepted — as either operand of any operator:

```ts
// Context on either side of a comparison
eq(context('role'), resource('requiredRole'));
gt(resource('minLevel'), context('userLevel'));
has(resource('teams'), context('userTeam'));
in(context('department'), resource('allowedDepartments'));
```

---

## Type Safety

When you define a `Context` type in `GuantrMeta`, TypeScript validates:

- **Field name existence** — `context('typo')` will not compile if `typo` is not a key on your context type.
- **Field type compatibility** — `eq(resource('score'), context('userId'))` will error at compile time if `userId` is `string` and `score` is `number`.
- **Nested paths** — `context('user.role')` resolves the type of `role` through nested object types (up to 5 levels deep).

```ts
type MyContext = {
  userId: number;
  role: 'admin' | 'editor' | 'viewer';
  permissions: string[];
  org: { id: number; name: string };
};

type MyMeta = GuantrMeta<
  {
    article: { action: 'edit'; model: Article };
  },
  MyContext
>;

// ✅ OK — both are string
eq(resource('authorName'), context('org.name'));

// ❌ TypeScript error — context('badKey') does not exist on MyContext
// eq(resource('authorName'), context('badKey'))
```

---

## Performance Implications

### Single call per check

`context` is resolved **once** per `can`/`cannot` invocation. For single resource checks this means:

```ts
// context resolved 1 time
await guantr.can('read', ['post', postInstance]);
```

### Batch check context sharing

For batch checks (`can.all`, `can.any`, `cannot.all`, `cannot.any`), context is resolved **once** and shared across all items:

```ts
// context resolved exactly 1 time
const canManage = await guantr.can.all([
  ['read', ['post', post]],
  ['update', ['post', post]],
  ['delete', ['post', post]],
]);
```

All three checks share the same context snapshot.

### Context with caching

When the storage adapter provides a cache layer, `can` results are cached using a key derived from the action, resource type, resource instance, and **the serialized context**. This means different contexts produce different cache entries, and the same context + resource combination reuses the cached result:

```ts
// Context is JSON-stringified and included in the cache key:
// can/read:post:{"id":1,...}:{"userId":1,"role":"admin"}
```

### Recommendations

- **Fetch user/session data once** early in the request lifecycle and make `context` a simple read from a pre-populated container.
- **Keep `context` lightweight** — avoid database queries, API calls, or heavy computation inside it. If fetching is unavoidable, implement internal caching.
- **Be mindful of promise resolution** — when using a function, `context` can return a `PromiseLike<Context>`, so it runs on the async path and contributes to the latency of every permission check. A synchronous `() => ({ userId: 1 })` or a plain object `{ userId: 1 }` is ideal when the data is already available.

---

## Context and Abstract Checks

`can.abstract` and `cannot.abstract` do **not** resolve `context`. They only check for the existence of `allow` rules by action and resource key — no conditions are evaluated and no context is needed:

```ts
// context is NOT resolved
const showButton = await guantr.can.abstract('edit', 'article');
```
