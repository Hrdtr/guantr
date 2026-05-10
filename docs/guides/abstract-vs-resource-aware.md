---
description: 'Understand the difference between abstract and resource-aware permission checks in Guantr — when to use can.abstract vs can() for correct and performant authorization.'
---

# Abstract vs Resource-Aware Checks

Guantr provides two distinct families of permission-check methods. Understanding the difference is essential for building correct and performant authorization.

---

## The Two Families

### Abstract checks — `can.abstract` / `cannot.abstract`

An **abstract** check answers: _"Has any permission been granted at all for this action + resource type?"_

- Returns `true` if **any** `allow` rule exists for the given action and resource key.
- **Does not evaluate conditions** against a resource instance.
- **Ignores deny rules entirely** — a deny rule has no effect on the result.
- **Does not resolve `context`** — no context is needed.
- Results are cached by `can.abstract/<action>:<resourceKey>`.

```ts
guantr.can.abstract(action: string, resourceKey: string): Promise<boolean>
guantr.cannot.abstract(action: string, resourceKey: string): Promise<boolean>
```

```ts
const showEditButton = await guantr.can.abstract('update', 'post');
// true if ANY "allow update post" rule exists — regardless of conditions

// cannot.abstract = !can.abstract
const hideButton = await guantr.cannot.abstract('update', 'post');
```

**Key properties:**

- Fast — no object traversal, no condition evaluation, no context resolution.
- Single-dimension — only action + resource type matter.
- Best for: UI rendering hints (show/hide buttons, menu items, features).

### Resource-aware checks — `can` / `cannot`

A **resource-aware** check answers: _"Is this specific resource instance accessible?"_

- Evaluates every `matchCondition` on every matching rule against the provided resource instance.
- **Deny rules override allow rules** when their conditions match.
- Resolves `context` once per call (or once per batch).
- Results are cached by `can/<action>:<resourceKey>:<serializedInstance>:<serializedContext>`.

```ts
guantr.can(  action, [resourceKey: string, instance: ResourceModel]): Promise<boolean>
guantr.cannot(action, [resourceKey: string, instance: ResourceModel]): Promise<boolean>
```

```ts
const canEdit = await guantr.can('update', ['post', postInstance]);
// true only if an allow rule matches AND no deny rule matches this specific instance

// cannot = !can
const forbidden = await guantr.cannot('update', ['post', postInstance]);
```

**Evaluation algorithm (in order):**

1. Query all rules matching the action + resource key from storage.
2. If zero rules exist → `false`.
3. If any **unconditional deny** rule exists (`matchCondition` is `null`/`undefined` for a `deny` rule) → `false` (immediate early exit).
4. For each remaining rule, evaluate its `matchCondition` against the resource instance and context.
5. A matched allow rule contributes `true`; a matched deny rule contributes `false`.
6. Return `true` only if **at least one allow matched** AND **no deny matched**.

**Key properties:**

- Full evaluation — conditions are resolved, context is loaded, AST is walked.
- Deny-aware — deny rules always override.
- Instance-scoped — checks apply to a specific object, not just a type.
- Best for: data-layer enforcement (API guards, service-level authorization).

---

## Decision Guide

| Use case                                   | Method                           | Why                                     |
| ------------------------------------------ | -------------------------------- | --------------------------------------- |
| Show / hide a UI button or menu item       | `can.abstract`                   | Fast, no instance needed, ignore denies |
| Guard an API route — final access decision | `can` with instance              | Instance-level, deny-aware              |
| "Does user potentially have write access?" | `can.abstract('update', 'post')` | Abstract existence check                |
| "Can user update _this specific_ post?"    | `can('update', ['post', post])`  | Resource-aware, checks ownership        |
| Conditionally render a form section        | `can.abstract`                   | Low-cost UI hint                        |
| Prevent editing of published records       | `can` with instance + deny rule  | Deny overrides allow                    |
| List filtering (show only allowed items)   | `can` with each instance         | Each item evaluated individually        |

**Rule of thumb:** Use `can.abstract` at the UI/presentation layer for hints; use `can` with a resource instance at the data/API layer for enforcement.

---

## Complete Example

```ts
import { createGuantr } from 'guantr';
import type { GuantrMeta } from 'guantr';

type Post = {
  id: number;
  title: string;
  published: boolean;
  archived: boolean;
  authorId: number;
};

type MyMeta = GuantrMeta<
  {
    post: { action: 'read' | 'update' | 'delete'; model: Post };
  },
  { userId: number }
>;

const guantr = await createGuantr<MyMeta>({
  context: () => ({ userId: 1 }),
});

await guantr.setRules((allow, deny) => {
  // Anyone can potentially update a post
  allow('update', 'post');

  // But published posts are locked
  deny('update', ['post', ({ eq, resource, literal }) => eq(resource('published'), literal(true))]);

  // Only the author can update archived posts
  allow('update', [
    'post',
    ({ eq, resource, context, literal }) => eq(resource('authorId'), context('userId')),
  ]);
});

const draftPost: Post = {
  id: 1,
  title: 'Draft',
  published: false,
  archived: false,
  authorId: 1,
};

const publishedPost: Post = {
  id: 2,
  title: 'Live',
  published: true,
  archived: false,
  authorId: 1,
};

const archivedPost: Post = {
  id: 3,
  title: 'Old',
  published: false,
  archived: true,
  authorId: 2,
};

// ABSTRACT CHECKS — for UI rendering
await guantr.can.abstract('update', 'post');
// → true (an allow rule exists — show the Edit button)

await guantr.cannot.abstract('update', 'post');
// → false (an allow rule exists, deny rules are ignored)

// RESOURCE-AWARE CHECKS — for API enforcement
await guantr.can('update', ['post', draftPost]);
// → true (allow matches, not published)

await guantr.can('update', ['post', publishedPost]);
// → false (deny rule for published posts overrides allow)

await guantr.can('update', ['post', archivedPost]);
// → false (allow rule for owner matches, but authorId=2 !== userId=1)

//cannot is !can
await guantr.cannot('update', ['post', publishedPost]);
// → true
```

---

## Batch Checks: `can.all`, `can.any`, `cannot.all`, `cannot.any`

Batch methods accept an array of `[action, [resourceKey, instance]]` tuples. Context is resolved **once** and shared across all items.

### `can.all(checks)` — All must pass

Returns `true` if every check passes. Short-circuits on first `false`.

```ts
const canManage = await guantr.can.all([
  ['read', ['post', post]],
  ['update', ['post', post]],
  ['delete', ['post', post]],
]);
// true only if user can read AND update AND delete this specific post
```

### `can.any(checks)` — Any must pass

Returns `true` if at least one check passes. Short-circuits on first `true`.

```ts
const canInteract = await guantr.can.any([
  ['read', ['post', post]],
  ['update', ['post', post]],
]);
// true if user can read OR update this post
```

### `cannot.all(checks)` — All must be denied

Logical complement: `cannot.all = !can.any`.

```ts
const allForbidden = await guantr.cannot.all([
  ['read', ['post', post]],
  ['update', ['post', post]],
]);
// true if user can NEITHER read NOR update this post
```

### `cannot.any(checks)` — Any must be denied

Logical complement: `cannot.any = !can.all`.

```ts
const anyForbidden = await guantr.cannot.any([
  ['read', ['post', post]],
  ['update', ['post', post]],
]);
// true if user cannot read OR cannot update this post
```

| Method               | Equivalent         | Short-circuits on |
| -------------------- | ------------------ | ----------------- |
| `can.all(checks)`    | —                  | first `false`     |
| `can.any(checks)`    | —                  | first `true`      |
| `cannot.all(checks)` | `!can.any(checks)` | first `true`      |
| `cannot.any(checks)` | `!can.all(checks)` | first `false`     |

> **Note:** Batch methods support `can`/`cannot` but **not** abstract checks. All items in a batch are evaluated against resource instances — context is resolved once, and conditions are evaluated per-item.

---

## Migration from v1.x

In v1.x, `can` accepted a string resource key (no instance) as well as `[resourceKey, instance]`:

```ts
// v1.x — both signatures existed
await guantr.can('update', 'post'); // string overload
await guantr.can('update', ['post', post]); // tuple overload
```

The string overload was removed in v2.0 because it was ambiguous — it was unclear whether it should evaluate conditions or ignore them. The two families (`can`/`cannot` and `can.abstract`/`cannot.abstract`) make the intent explicit:

```ts
// ❌ v1.x — removed in v2.0.0
// await guantr.can('update', 'post');

// ✅ v2.0.0
await guantr.can.abstract('update', 'post'); // UI hints — ignores conditions/denies
await guantr.can('update', ['post', postInstance]); // access control — evaluates conditions
```
