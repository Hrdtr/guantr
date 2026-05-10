---
description: 'Quick start guide for Guantr — install the library, define permission rules, and perform authorization checks with code examples.'
---

# Quick Start

This guide walks through installing Guantr, defining your first permission rules, and performing authorization checks.

---

## Installation

```sh
# ✨ Auto-detect
npx nypm install guantr

# npm
npm install guantr

# yarn
yarn add guantr

# pnpm
pnpm add guantr

# bun
bun install guantr

# deno
deno install npm:guantr
```

---

## Import

```ts
import { createGuantr } from 'guantr';
import type { GuantrMeta, GuantrRule } from 'guantr';
```

---

## Define Your Meta Type

For TypeScript projects, define a `GuantrMeta` type that describes your resources, their allowed actions, model shapes, and context:

```ts
type MyMeta = GuantrMeta<
  {
    post: {
      action: 'read' | 'edit' | 'delete';
      model: { id: number; archived: boolean; ownerId: string };
    };
    comment: {
      action: 'read' | 'create';
      model: { id: number; postId: number };
    };
  },
  { userId: string | null }
>;
```

The resource map defines which actions are valid for each resource type and the shape of the model you'll pass to `can()` / `cannot()`. The second type parameter defines the evaluation context shape available to conditions.

---

## Create an Instance

### Bare Instance

```ts
const guantr = await createGuantr();
```

### Typed Instance

```ts
const guantr = await createGuantr<MyMeta>();
```

### With Dynamic Context

```ts
const guantr = await createGuantr<MyMeta>({
  context: async () => {
    const user = await getCurrentUser();
    return { userId: user?.id ?? null };
  },
});
```

### With Initial Rules

You can pass rules directly to the factory:

```ts
const guantr = await createGuantr<MyMeta>(async (allow, deny) => {
  allow('read', 'post');
  deny('delete', ['post', ({ eq, resource, literal }) => eq(resource('archived'), literal(true))]);
});
```

---

## Set Rules

Rules are defined with `setRules()`, which **replaces all existing rules** each time it's called.

### Callback Style

The callback receives `allow` and `deny` helper functions:

```ts
await guantr.setRules((allow, deny) => {
  // Unconditional: any post can be read
  allow('read', 'post');

  // Conditional: deny reading archived posts
  deny('read', ['post', ({ eq, resource, literal }) => eq(resource('archived'), literal(true))]);

  // Context-aware: allow editing only own posts
  allow('edit', [
    'post',
    ({ eq, resource, context }) => eq(resource('ownerId'), context('userId')),
  ]);

  // Unconditional deny blocks everything — takes absolute precedence
  deny('delete', 'post');
});
```

### Array Style

Pass an array of `GuantrRule` objects — useful for loading rules from a database:

```ts
import type { GuantrRule } from 'guantr';

const rules: GuantrRule<MyMeta>[] = [
  { effect: 'allow', action: 'read', resource: 'post' },
  {
    effect: 'deny',
    action: 'read',
    resource: 'post',
    matchCondition: ({ eq, resource, literal }) => eq(resource('archived'), literal(true)),
  },
  {
    effect: 'allow',
    action: 'edit',
    resource: 'post',
    matchCondition: ({ eq, resource, context }) => eq(resource('ownerId'), context('userId')),
  },
  { effect: 'deny', action: 'delete', resource: 'post' },
];

await guantr.setRules(rules);
```

---

## Check Permissions

### Resource-Aware Check

Evaluates all matching rules, including conditions and deny rules, against a concrete resource instance:

```ts
const post = { id: 1, archived: true, ownerId: 'user-abc' };

await guantr.can('read', ['post', post]); // false — denied (archived)
await guantr.cannot('read', ['post', post]); // true — equivalent to !can
```

### Abstract Check

Checks whether **any allow rule** exists for the action + resource pair, ignoring conditions and deny rules. Useful for rendering UI:

```ts
await guantr.can.abstract('read', 'post'); // true — at least one allow rule exists
await guantr.cannot.abstract('delete', 'comment'); // true — no allow rule exists
```

### Batch Checks

Check multiple permissions in a single call. Context is resolved once and shared across all checks:

```ts
await guantr.can.all([
  ['read', ['post', post]],
  ['edit', ['post', post]],
  ['delete', ['post', post]],
]);
// → false (delete is unconditionally denied)

await guantr.can.any([
  ['read', ['post', post]],
  ['edit', ['post', post]],
]);
// → true (at least one passes)
```

`cannot.all()` and `cannot.any()` provide the logical negations:

```ts
await guantr.cannot.all(checks); // → true when NONE of the checks pass
await guantr.cannot.any(checks); // → true when at least ONE of the checks fails
```

---

## Next Steps

- **[Defining Rules](./guides/defining-rules)** — rule structure, condition builder DSL, precedence rules.
- **[Condition Operators](./guides/defining-rules/condition-operators)** — complete reference of all DSL operators.
- **[Abstract vs Resource-Aware](./guides/abstract-vs-resource-aware)** — when to use each check style.
- **[Context Usage](./guides/context-usage)** — dynamic context patterns.
- **[TypeScript Integration](./guides/typescript-integration)** — advanced type patterns.
- **[Migration from v1](./guides/migration-v1-to-v2)** — upgrading from the legacy tuple-based condition syntax.
