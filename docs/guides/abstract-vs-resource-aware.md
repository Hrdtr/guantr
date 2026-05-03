# Concepts: Abstract vs Resource-Aware Checks

Guantr provides two distinct families of permission-check methods. Understanding when to use each is key to building correct and well-structured authorization logic.

## The Two Families

### Abstract checks — `can.abstract` / `cannot.abstract`

An _abstract_ check answers: **"has any permission been granted at all for this action + resource type?"**

- Returns `true` if **any** `allow` rule exists for the given action and resource key.
- **Does not evaluate conditions** against a resource instance.
- **Does not evaluate deny rules**.

```ts
const showEditButton = await guantr.can.abstract('update', 'post');
// true if ANY "allow update post" rule exists — regardless of conditions
```

### Resource-aware checks — `can` / `cannot`

A _resource-aware_ check answers: **"is this specific resource instance accessible?"**

- Evaluates every condition on every matching rule against the provided resource instance.
- **Deny rules always override allow rules** when their conditions match.

```ts
const canEdit = await guantr.can('update', ['post', postInstance]);
// true only if an allow rule matches AND no deny rule matches this specific instance
```

## When to Use Which

| Use case                                                                                      | Method                           |
| --------------------------------------------------------------------------------------------- | -------------------------------- |
| Show / hide a UI element (button, menu item) based on whether the action is _possible at all_ | `can.abstract`                   |
| Guard an API route or server action — final access decision                                   | `can` with instance              |
| Conditionally render a form section                                                           | `can.abstract` (low-cost)        |
| Determine if a user may edit _this specific record_                                           | `can` with instance              |
| "Does this user have _any_ write access?"                                                     | `can.abstract('update', 'post')` |

> **Rule of thumb:** Use `can.abstract` at the UI layer for hints; use `can` with a resource instance at the data/API layer for enforcement.

## Example: Blog Application

```ts
// Rules defined for the current user:
await guantr.setRules((allow, deny) => {
  allow('update', 'post'); // can update posts...
  deny('update', ['post', { published: ['eq', true] }]); // ...but not published ones
});

const draftPost = { id: 1, published: false, title: 'Draft' };
const publishedPost = { id: 2, published: true, title: 'Live' };

// Abstract check — answers "should we show the Edit button at all?"
await guantr.can.abstract('update', 'post');
// -> true (an allow rule exists — show the edit button in the UI)

// Resource-aware check — answers "can this specific post be edited?"
await guantr.can('update', ['post', draftPost]);
// -> true  (allow matches, deny does not)

await guantr.can('update', ['post', publishedPost]);
// -> false (allow matches, but deny also matches — deny wins)
```

## Why the String Overload of `can()` is Deprecated

Prior to v1.1.0, calling `can('update', 'post')` (string-mode) silently performed an abstract check. This was easy to misuse — developers could accidentally rely on it for access control decisions while it was actually just checking for rule existence.

In v1.1.0:

- `can(action, 'resourceKey')` is **deprecated** and emits a `console.warn` in non-production environments.
- Use `can.abstract(action, 'resourceKey')` for the same behaviour with explicit intent.
- Use `can(action, ['resourceKey', instance])` for full evaluation.

```ts
// v1.0.x — ambiguous
await guantr.can('update', 'post'); // ❌ deprecated

// v1.1.0 — explicit intent
await guantr.can.abstract('update', 'post'); // ✅ UI hints
await guantr.can('update', ['post', post]); // ✅ access control
```

## Dev-Mode Warnings

The deprecation warning is emitted once per unique `action + resource` pair and is suppressed in production environments (`process.env.NODE_ENV === 'production'`).

You can also disable it manually:

```ts
import { Guantr } from 'guantr';
Guantr.devWarnings = false;
```
