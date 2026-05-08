# Guantr: Type-Safe Authorization for JavaScript

Guantr is a flexible, type-safe authorization library that defines and evaluates permission rules against resource instances with dynamic context. It is runtime-agnostic, framework-agnostic, and storage-agnostic — works in Node.js, Deno, Bun, edge functions, and the browser, at any scale.

---

## What is Guantr?

Guantr lets you model authorization as a set of **rules** — each pairing an action (`read`, `update`, `delete`) with a resource type (`post`, `comment`), optionally gated by a **condition** evaluated at runtime. Rules are defined once, then checked against concrete resource instances and dynamic context (like the current user).

```ts
await guantr.setRules((allow, deny) => {
  allow('read', 'post');
  deny('read', ['post', ({ eq, resource, literal }) => eq(resource('archived'), literal(true))]);
});
```

---

## Key Features

### Type Safety

Guantr uses TypeScript generics to narrow actions, resource keys, and condition paths at compile time. A misspelled action or a condition path that doesn't exist on your model is caught by the type checker.

```ts
type MyMeta = GuantrMeta<{
  post: { action: 'read' | 'edit'; model: { id: number; archived: boolean } };
}>;

const guantr = await createGuantr<MyMeta>();

// Type-safe: action must be 'read' | 'edit', resource must be 'post'
await guantr.can('read', ['post', { id: 1, archived: false }]);
```

### Condition Builder DSL

Conditions are composed with a type-safe DSL that produces JSON-serializable AST structures. The builder enforces type compatibility between operands — you can't accidentally compare a string field to a number.

```ts
allow('publish', [
  'article',
  ({ and, eq, gte, resource, literal }) =>
    and(eq(resource('status'), literal('approved')), gte(resource('score'), literal(80))),
]);
```

### Resource-Aware Checks

Unlike simple role-based systems, Guantr evaluates rules against **concrete resource instances**. A rule that allows "read" on posts doesn't automatically grant access to every post — conditions can gate access per instance.

```ts
const post = { id: 1, archived: true, ownerId: 'user-123' };
await guantr.cannot('read', ['post', post]); // true — denied because archived
```

### Dynamic Context

Rules can reference values resolved at check time — user IDs, roles, tenant IDs, request metadata. Context is resolved once per check and shared across batch evaluations.

```ts
const guantr = await createGuantr<MyMeta>({
  context: () => ({ userId: 'user-123' }),
});

await guantr.setRules((allow) => {
  allow('edit', [
    'post',
    ({ eq, resource, context }) => eq(resource('ownerId'), context('userId')),
  ]);
});
```

### Batch Checks and Abstract Checks

Check multiple permissions in one call, or quickly test whether an action is **ever** possible (for rendering UI elements).

```ts
await guantr.can.all([
  ['read', ['post', post]],
  ['edit', ['post', post]],
]);

await guantr.can.abstract('read', 'post'); // true if ANY allow rule exists
```

### Storage Agnostic

Rules are stored through a pluggable `Storage` interface. An in-memory storage ships by default, and you can implement adapters for PostgreSQL, Redis, or any backend.

---

## How Guantr Works

Guantr evaluates rules in a strict, predictable order for every permission check:

1. **Query rules** for the given action + resource pair.
2. **No rules found** → `false` (deny by default).
3. **Unconditional deny** (a deny rule with no conditions) → `false` immediately, regardless of any allow rules.
4. **For each remaining rule**, evaluate its `matchCondition` against the resource instance and context.
5. **Deny overrides allow** — if any matching deny rule exists, the result is `false`.
6. **At least one allow matches and no deny matches** → `true`.

Conditions are **serialized at definition time** (when `setRules` is called) and **evaluated at check time**. This decouples rule storage from rule execution — conditions can be stored as JSON in any database and reconstructed without re-evaluating builder functions.

---

## Why Choose Guantr?

- **Compile-time safety** — catches typos, wrong field names, and type mismatches before runtime.
- **Serializable conditions** — conditions are pure JSON ASTs, trivially stored in any database.
- **Runs everywhere** — works in any JavaScript runtime: Node.js, Deno, Bun, edge functions, and the browser. No framework or platform lock-in.
- **Early exit optimization** — unconditional denies short-circuit evaluation for predictable performance.
- **Caching built-in** — rule lookups and check results are cached with pluggable cache backends.
