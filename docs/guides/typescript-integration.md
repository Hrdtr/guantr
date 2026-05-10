---
description: 'TypeScript integration guide — use GuantrMeta to anchor the type system with compile-time validation of actions, resource keys, model properties, and context fields.'
---

# TypeScript Integration with `GuantrMeta`

Guantr is built TypeScript-first. The `GuantrMeta` type anchors the entire type system, providing compile-time validation of every action name, resource key, model property path, and context field across the full API surface — rule definition, builder DSL, and permission checks.

## Core Concepts

```text
GuantrMeta<ResourceMap, Context>
            ↑             ↑
    What resources       Who is asking
    exist & their shape  (user, session, env)
```

Every type flows from these two definitions. Once you declare a `Meta` type and pass it to `createGuantr<Meta>()`, the entire instance is fully typed.

---

## Step 1: Define the Resource Map

Each entry maps a **resource key** (a string like `'post'` or `'comment'`) to the actions it supports and the shape of its runtime instance.

```ts
import type { GuantrResourceMap } from 'guantr';

interface PostModel {
  id: number;
  title: string;
  status: 'draft' | 'published' | 'archived';
  authorId: number;
  tags: string[];
  viewCount: number;
}

interface CommentModel {
  id: number;
  postId: number;
  authorId: number;
  body: string;
  approved: boolean;
}

interface ProjectModel {
  id: string;
  name: string;
  orgId: string;
  ownerId: string;
  teamIds: string[];
  archived: boolean;
}

type ResourceMap = GuantrResourceMap<{
  post: {
    action: 'read' | 'create' | 'update' | 'delete' | 'publish';
    model: PostModel;
  };
  comment: {
    action: 'read' | 'create' | 'delete';
    model: CommentModel;
  };
  project: {
    action: 'view' | 'edit' | 'delete' | 'manage';
    model: ProjectModel;
  };
}>;
```

- The `action` union defines every possible action string for that resource.
- The `model` type is the shape of the instance you pass to `guantr.can()` at check time.
- Use `Record<string, unknown>` or `{}` for resources that have no instance data (e.g. dashboard pages).

---

## Step 2: Define the Context

The context type describes the shape returned by `context`. This is typically the current user or request metadata.

```ts
interface AppContext {
  userId: number | null;
  role: 'admin' | 'editor' | 'viewer';
  orgId: string | null;
  permissions: string[];
}
```

---

## Step 3: Define `GuantrMeta`

```ts
import type { GuantrMeta } from 'guantr';

type MyMeta = GuantrMeta<ResourceMap, AppContext>;
```

If you omit `Context`, it defaults to `Record<string, unknown>`:

```ts
type NoContextMeta = GuantrMeta<ResourceMap>;
```

---

## Step 4: Create a Typed Instance

```ts
import { createGuantr } from 'guantr';

const guantr = await createGuantr<MyMeta>({
  context: async (): Promise<AppContext> => {
    const user = await fetchCurrentUser();
    return {
      userId: user?.id ?? null,
      role: user?.role ?? 'viewer',
      orgId: user?.orgId ?? null,
      permissions: user?.permissions ?? [],
    };
  },
});
```

The `context` type is inferred from `MyMeta` — the compiler enforces the correct shape. If the provided `context` value (whether a plain object or function return) has `{ userId: string }` but your `Context` expects `{ userId: number | null }`, you get a type error.

You can also create an instance without options and call `setRules` later:

```ts
const guantr = await createGuantr<MyMeta>();
```

---

## Type Safety in `setRules` — Callback Style

The `allow` and `deny` helpers inside the callback are typed per-resource-key:

```ts
await guantr.setRules((allow, deny) => {
  // ✅ 'read' is a valid action for 'post'
  allow('read', 'post');

  // ✅ 'publish' is a valid action for 'post'
  // ✅ 'status' is a valid property on PostModel
  allow('publish', [
    'post',
    ({ eq, resource, literal }) => eq(resource('status'), literal('published')),
  ]);

  // ✅ Context fields are type-checked
  allow('update', [
    'post',
    ({ eq, resource, context }) => eq(resource('authorId'), context('userId')),
  ]);

  // ✅ Resource and context paths validated separately
  deny('read', [
    'post',
    ({ eq, resource, literal, context }) => eq(resource('status'), literal('archived')),
  ]);

  // ── Compile-time errors ──────────────────────────────────

  // ❌ TypeScript error: '"manage"' is not assignable to
  //    '"read" | "create" | "update" | "delete" | "publish"'
  // allow('manage', 'post');

  // ❌ TypeScript error: '"unknownRes"' is not a valid resource key
  // allow('read', 'unknownRes');

  // ❌ TypeScript error: '"ownerId"' does not exist on PostModel
  // allow('read', ['post', ({ eq, resource, literal }) =>
  //   eq(resource('ownerId'), literal(1))
  // ]);

  // ❌ TypeScript error: Context path '"userEmail"' is invalid
  // allow('read', ['post', ({ eq, resource, context }) =>
  //   eq(resource('authorId'), context('userEmail'))
  // ]);
});
```

### Action Narrowing Per Resource

The action type is narrowed to the specific resource key in the first argument. A builder closure for `'comment'` only accepts `'comment'` actions:

```ts
await guantr.setRules((allow) => {
  // ✅ 'read' is valid for 'comment'
  allow('read', 'comment');

  // ❌ TypeScript error: '"publish"' is not a valid action for 'comment'
  // (publish is only defined for 'post')
  // allow('publish', 'comment');
});
```

### Conditional vs Unconditional

The `allow`/`deny` second argument can be a **plain string** (unconditional) or a **tuple** `[resourceKey, matchConditionFn]` (conditional):

```ts
await guantr.setRules((allow, deny) => {
  // Unconditional — allow all
  allow('read', 'post');

  // Conditional — matchCondition function
  allow('read', [
    'post',
    ({ eq, resource, literal }) => eq(resource('status'), literal('published')),
  ]);
});
```

Accepted types for the second argument:

- `string` → unconditional rule
- `[string, MatchConditionFn<Model, Context> | Condition]` → conditional rule

---

## Type Safety in `setRules` — Array Style

Direct rule arrays use the `GuantrRule<Meta>` type:

```ts
import type { GuantrRule } from 'guantr';

const rules: GuantrRule<MyMeta>[] = [
  // ✅ Unconditional allow
  { effect: 'allow', action: 'read', resource: 'post' },

  // ✅ Conditional allow with typed builder
  {
    effect: 'allow',
    action: 'update',
    resource: 'post',
    matchCondition: ({ eq, resource, context }) => eq(resource('authorId'), context('userId')),
  },

  // ✅ Conditional deny
  {
    effect: 'deny',
    action: 'read',
    resource: 'post',
    matchCondition: ({ eq, resource, literal }) => eq(resource('status'), literal('archived')),
  },

  // ── Compile-time errors ──────────────────────────────────

  // ❌ TypeScript error: '"manage"' is not an action for 'post'
  // { effect: 'allow', action: 'manage', resource: 'post' },

  // ❌ TypeScript error: '"unknown"' is not a valid resource key
  // { effect: 'allow', action: 'read', resource: 'unknown' },

  // ❌ TypeScript error: '"ownerId"' not on PostModel
  // {
  //   effect: 'allow',
  //   action: 'read',
  //   resource: 'post',
  //   matchCondition: ({ eq, resource, literal }) =>
  //     eq(resource('ownerId'), literal(1))
  // },
];

await guantr.setRules(rules);
```

When the array is not explicitly typed as `GuantrRule<MyMeta>[]`, inference still works as long as `Meta` is passed to `createGuantr`. Inlining the array directly to `createGuantr` or `setRules` is fully type-safe:

```ts
const guantr = await createGuantr<MyMeta>([
  { effect: 'allow', action: 'read', resource: 'post' },
  {
    effect: 'deny',
    action: 'read',
    resource: 'post',
    matchCondition: ({ eq, resource, literal }) => eq(resource('status'), literal('archived')),
  },
]);
```

---

## Type Safety in Permission Checks

### `guantr.can()` and `guantr.cannot()`

Both accept `(action, [resourceKey, resourceInstance])` and are fully typed:

```ts
const post: PostModel = {
  id: 1,
  title: 'Hello',
  status: 'published',
  authorId: 42,
  tags: ['dev'],
  viewCount: 100,
};

const comment: CommentModel = {
  id: 1,
  postId: 1,
  authorId: 42,
  body: 'Nice!',
  approved: true,
};

// ✅ Correct: action + resource key match, instance shape matches
const canRead = await guantr.can('read', ['post', post]);
const canDelete = await guantr.cannot('delete', ['comment', comment]);

// ── Compile-time errors ──────────────────────────────────

// ❌ TypeScript error: '"manage"' is not an action for 'post'
// await guantr.can('manage', ['post', post]);

// ❌ TypeScript error: 'comment' is not a valid resource key for PostModel
// await guantr.can('read', ['comment', post]);

// ❌ TypeScript error: PostModel is not assignable to CommentModel
// await guantr.can('read', ['comment', post]);
```

### `guantr.can.abstract()` and `guantr.cannot.abstract()`

Abstract checks accept `(action, resourceKey)` — **no instance needed**. They return `true` if any `allow` rule exists for that pair (deny rules and conditions are ignored):

```ts
// ✅ Correct: action matches resource key
const canReadPosts = await guantr.can.abstract('read', 'post');
const cannotDelete = await guantr.cannot.abstract('delete', 'post');

// ❌ TypeScript error: '"manage"' not valid for 'post'
// await guantr.can.abstract('manage', 'post');

// ❌ TypeScript error: '"page"' is not a resource key
// await guantr.can.abstract('read', 'page');
```

### Batch Checks: `can.all`, `can.any`, `cannot.all`, `cannot.any`

Each check item is a tuple of `[action, [resourceKey, resourceInstance]]`:

```ts
// ✅ All checks must pass
const canManagePost = await guantr.can.all([
  ['read', ['post', post]],
  ['update', ['post', post]],
  ['delete', ['post', post]],
]);

// ✅ At least one check must pass
const canInteract = await guantr.can.any([
  ['read', ['post', post]],
  ['read', ['comment', comment]],
  ['create', ['comment', comment]],
]);

// ✅ Negated: true when all checks are denied
const cannotManage = await guantr.cannot.all([
  ['delete', ['post', post]],
  ['publish', ['post', post]],
]);

// ❌ TypeScript error: '"moderate"' is not an action for 'comment'
// await guantr.can.all([
//   ['read', ['post', post]],
//   ['moderate', ['comment', comment]],
// ]);
```

Batch methods resolve `context` once and share the result across all checks. `can.all` short-circuits on the first `false`, `can.any` short-circuits on the first `true`.

---

## Builder DSL Type Enforcement

The builder methods enforce operand type compatibility. The compiler catches mismatches between resource, context, and literal operand types.

### Comparison Operators (`eq`, `ne`, `gt`, `gte`, `lt`, `lte`)

```ts
// ✅ eq/ne: same type on both sides (or nullish right operand)
eq(resource('authorId'), context('userId')); // number vs number ✓
eq(resource('status'), literal('published')); // string vs string ✓
eq(resource('authorId'), literal(null)); // number vs null ✓

// ❌ Type error: string vs number
// eq(resource('title'), literal(42));

// ✅ gt/gte/lt/lte: both sides numeric
gt(resource('viewCount'), literal(100)); // number vs number ✓
```

### String Operators (`contains`, `startsWith`, `endsWith`)

```ts
// ✅ Both operands must be string-compatible
contains(resource('title'), literal('hello'), { caseInsensitive: true });

// ❌ Type error: numeric field used as string
// startsWith(resource('viewCount'), literal('1'));
```

### Array Operators (`in`, `has`, `hasSome`, `hasEvery`)

```ts
// ✅ has: array has element
has(resource('tags'), literal('dev'));

// ✅ hasSome: array has at least one of given values
hasSome(resource('tags'), literal(['dev', 'ops']));

// ✅ in: value is in array — context array of numbers
in(context('userId'), literal([1, 2, 3]));

// ❌ Type error: checking string against number array
// in(context('userId'), literal(['admin', 'editor']));
```

### Complex Array Operators (`some`, `every`, `none`)

The nested builder function inside `some`/`every`/`none` has its `resource()` scoped to the **element** of the array:

```ts
// ✅ resource('approved') refers to a CommentModel field
some(resource('comments'), ({ eq, resource }) => eq(resource('approved'), literal(true)));

// ❌ Type error: 'ownerId' is not a field on CommentModel
// some(resource('comments'), ({ eq, resource }) =>
//   eq(resource('ownerId'), literal(1))
// );
```

### Logical Operators (`and`, `or`, `not`)

```ts
// ✅ Compose conditions
and(eq(resource('status'), literal('published')), gt(resource('viewCount'), literal(10)));

or(eq(context('role'), literal('admin')), eq(context('role'), literal('editor')));

not(eq(resource('status'), literal('archived')));
```

---

## Summary: What TypeScript Catches at Compile Time

| Error Category                | Example                                                   | Caught By                |
| ----------------------------- | --------------------------------------------------------- | ------------------------ |
| Invalid action name           | `allow('manage', 'post')`                                 | Action union             |
| Invalid resource key          | `allow('read', 'unknownRes')`                             | Resource map keys        |
| Invalid model property        | `eq(resource('ownerId'), ...)`                            | `LeafKeys<Model>`        |
| Invalid context property      | `context('userEmail')`                                    | `LeafKeys<Context>`      |
| Type mismatch in operator     | `eq(resource('title'), literal(42))`                      | Phantom `[ValueRefType]` |
| Wrong model for resource key  | `can('read', ['post', comment])`                          | Generic constraint       |
| Wrong action for resource key | `can('publish', ['comment', c])`                          | Action union per key     |
| Array element type mismatch   | `some(resource('tags'), ...)` where element is wrong type | Generic inference        |

The builder DSL is **executed once at rule-definition time** and serialized to an AST. The compiler validates every path and type at that point. Runtime evaluation uses the serialized AST against the live resource instance and context.
