# Advanced Usage: Strict Mode

> Since v1.1.0

Guantr's **strict mode** changes how condition validation errors are handled. By default, Guantr uses a _fail-closed_ approach: if a condition expression contains an unknown operator or is otherwise malformed, the permission check silently returns `false` (denying access) rather than crashing. Strict mode flips this to _fail-fast_: problems are surfaced as thrown errors the moment they are encountered, making bugs impossible to ignore.

## Why Strict Mode Exists

The default fail-closed behavior is a safe choice for production systems that need resilience against unexpected data. However, it comes with a trade-off: invalid conditions silently deny access, meaning a typo in an operator name (`'eql'` instead of `'eq'`) can cause subtle authorization bugs that are very difficult to track down.

Strict mode is the solution for environments where you want guarantees:

- **At rule definition time** (`setRules`) — the entire rule set is validated upfront so bad conditions never enter storage.
- **At evaluation time** (`can`/`cannot`) — if an invalid operator somehow reaches evaluation, an error is thrown rather than silently returning `false`.

This makes strict mode particularly valuable in:

- **Tests** — catch authoring mistakes immediately, not as mysterious `cannot` failures.
- **Development / CI** — validate your rule definitions early in the development cycle.
- **Production** (optional) — once your rules are known-good, you can keep strict mode enabled for maximum confidence.

## Enabling Strict Mode

Pass `strict: true` in the options object to `createGuantr` (or the `Guantr` constructor):

```ts
import { createGuantr } from 'guantr';

const guantr = await createGuantr({ strict: true });
```

You can combine it with other options:

```ts
import { createGuantr } from 'guantr';
import type { MyMeta, MyContext } from './types';

const guantr = await createGuantr<MyMeta, MyContext>(
  async (allow, deny) => {
    allow('read', 'article');
    allow('edit', ['article', { ownerId: ['eq', '$ctx.userId'] }]);
  },
  {
    strict: true,
    getContext: async () => ({ userId: currentUser.id }),
  },
);
```

## What Changes with `strict: true`

### 1. Rule Definition Validation (`setRules`)

When you call `setRules` (including the initial call inside `createGuantr`), every condition in every rule is recursively validated. If any condition expression:

- is not a valid `[operator, operand, ?options]` tuple, **or**
- uses an operator string that is not a recognized `ConditionOperator`,

then a `GuantrInvalidConditionError` is thrown **before** the rules are stored.

```ts
import { createGuantr, GuantrInvalidConditionError } from 'guantr';

try {
  const guantr = await createGuantr(
    [
      // 'eql' is not a valid operator — strict mode will catch this immediately
      { effect: 'allow', action: 'read', resource: 'post', condition: { id: ['eql', 1] } },
    ],
    { strict: true },
  );
} catch (e) {
  if (e instanceof GuantrInvalidConditionError) {
    console.error('Bad condition:', e.condition);
    // { condition: ['eql', 1] }
    console.error('Reason:', e.reason);
    // 'Unknown operator "eql" at "id". Valid operators: eq, in, contains, ...'
  }
}
```

Without strict mode this rule would be stored silently and every `can('read', 'post', ...)` check would return `false` — with no indication of why.

### 2. Evaluation-time Operator Checks (`matchConditionExpression`)

Even if a condition somehow reaches the evaluation stage with an unknown operator, strict mode makes the internal `matchConditionExpression` utility throw a `GuantrInvalidConditionOperatorError` instead of returning `false`.

```ts
import { GuantrInvalidConditionOperatorError } from 'guantr';

// Internal — you wouldn't normally call matchConditionExpression directly,
// but any can/cannot call that hits an invalid operator will surface this error.
try {
  await guantr.can('read', ['post', { id: 99 }]);
} catch (e) {
  if (e instanceof GuantrInvalidConditionOperatorError) {
    console.error('Unknown operator encountered at evaluation time:', e.operator);
  }
}
```

### 3. `isValidConditionExpression` Tightening

The exported `isValidConditionExpression` utility accepts an optional second argument `strict`. When `strict` is `true`, it additionally checks that the operator string is a member of `KNOWN_OPERATORS`:

```ts
import { isValidConditionExpression } from 'guantr/utils';

isValidConditionExpression(['eq', 'hello']); // true  (default — structural check only)
isValidConditionExpression(['unknownOp', 'hello']); // true  (default — passes structural check)
isValidConditionExpression(['unknownOp', 'hello'], true); // false (strict — operator not recognized)
isValidConditionExpression(['eq', 'hello'], true); // true
```

## The Error Classes

Both error classes are exported from `'guantr'`:

```ts
import { GuantrInvalidConditionError, GuantrInvalidConditionOperatorError } from 'guantr';
```

See the [Errors API reference](../api/error-classes) for the full class specifications.

## Using Strict Mode in Tests

Strict mode is especially powerful in your test suite. Enable it globally so any rule-authoring mistake is caught as a hard failure rather than a silent wrong answer:

```ts
// test/setup.ts  (Vitest / Jest global setup)
import { createGuantr } from 'guantr';

export async function createTestGuantr(rules: Parameters<typeof createGuantr>[0]) {
  return createGuantr(rules, { strict: true });
}
```

Then in individual test files:

```ts
import { describe, it, expect } from 'vitest';
import { GuantrInvalidConditionError } from 'guantr';
import { createTestGuantr } from '../setup';

describe('article permissions', () => {
  it('allows reading public articles', async () => {
    const guantr = await createTestGuantr(async (allow) => {
      allow('read', ['article', { status: ['eq', 'published'] }]);
    });

    expect(await guantr.can('read', ['article', { status: 'published' }])).toBe(true);
    expect(await guantr.can('read', ['article', { status: 'draft' }])).toBe(false);
  });

  it('rejects rules with invalid operators at definition time', async () => {
    await expect(
      createTestGuantr([
        { effect: 'allow', action: 'read', resource: 'article', condition: { id: ['typo', 1] } },
      ]),
    ).rejects.toThrow(GuantrInvalidConditionError);
  });
});
```

## Migration Path

The default is `strict: false` — there are **no breaking changes** from version before 1.1.0. However, we recommend enabling `strict: true` as soon as possible to ensure your rule definitions are thoroughly validated. Here is a recommended adoption path:

| Stage     | Recommendation                                                                                                                                              |
| --------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Start** | Enable `strict: true` in your test suite only. Fix any `GuantrInvalidConditionError` failures that surface.                                                 |
| **Next**  | Enable `strict: true` in your development / local environment as well.                                                                                      |
| **Later** | Once your rule definitions are thoroughly validated, enable `strict: true` in production too, or keep `false` if you prefer resilient fail-closed behavior. |

The key insight is that you can run your existing test suite with `strict: true` and treat any thrown errors as bugs in your rule definitions — they are not newly introduced behavioral changes, they are existing silent failures being made visible.

## Quick Reference

| Feature                                    | `strict: false` (default)       | `strict: true`                                 |
| ------------------------------------------ | ------------------------------- | ---------------------------------------------- |
| Unknown operator at evaluation             | Returns `false` (denies access) | Throws `GuantrInvalidConditionOperatorError`   |
| Malformed condition at `setRules`          | Stored silently                 | Throws `GuantrInvalidConditionError`           |
| `isValidConditionExpression(expr, strict)` | Structural check only           | Also checks operator against `KNOWN_OPERATORS` |
| Breaking change?                           | —                               | No (opt-in)                                    |
