# Rule Validation

Guantr validates every rule condition at definition time to catch mistakes early. Invalid operators, malformed expressions, or unexpected value types are surfaced as thrown errors immediately — preventing the silent authorization failures that make bugs so hard to track down.

## Why This Matters

A typo like `'eql'` instead of `'eq'` in a rule condition should never result in a silent denial of access. When invalid conditions fail closed (return `false`), they produce **mysterious authorization bugs** that are extremely difficult to diagnose: a user can't perform an action, but no error is logged, no stack trace is produced, and the rule definition looks almost correct.

By **always validating** — throwing errors for invalid operators, malformed expressions, and unexpected value types — Guantr ensures that:

- **Bugs are caught at authoring time**, not at runtime. A failing test or a crash during development is far better than a silent production incident.
- **Rule definitions are self-documenting.** If it compiles and passes validation, the condition expresses the intent correctly.
- **Production systems fix rule definitions, not suppress errors.** The fail-closed approach encourages ignoring problems; always-throw forces them to be addressed.

> **History:** In v1.1.0, Guantr introduced an opt-in `strict` mode after a full minor version with `strict: true` as the default behavior. As of v2.0.0, the escape hatch has been removed — validation is always enabled and the `strict` option is gone.

## When Validation Happens

Guantr validates conditions at two distinct stages:

| Stage                                             | What's Checked                                               | Error Thrown                          |
| ------------------------------------------------- | ------------------------------------------------------------ | ------------------------------------- |
| **Definition time** (`setRules` / `createGuantr`) | Structure and operator validity of all condition expressions | `GuantrInvalidConditionError`         |
| **Evaluation time** (`can` / `cannot`)            | Operator validity (for rules loaded outside `setRules`)      | `GuantrInvalidConditionOperatorError` |

## 1. Definition-Time Validation (`setRules`)

Every rule passed to `setRules` (including the initial call within `createGuantr`) is recursively validated before being stored. The following checks are performed:

### a) Malformed Condition Expressions

Each condition expression must be an array with at least two elements where the first element is a string (the operator).

```ts
import { createGuantr, GuantrInvalidConditionError } from 'guantr';

// ❌ Expression with only one element
try {
  await createGuantr([
    { effect: 'allow', action: 'read', resource: 'post', condition: { id: ['eq'] as any } },
  ]);
} catch (e) {
  if (e instanceof GuantrInvalidConditionError) {
    console.error(e.reason);
    // 'Malformed condition expression at "id": must be [operator, operand, ?options] where operator is a string'
  }
}

// ❌ Non-string operator
try {
  await createGuantr([
    { effect: 'allow', action: 'read', resource: 'post', condition: { id: [42, 'foo'] as any } },
  ]);
} catch (e) {
  if (e instanceof GuantrInvalidConditionError) {
    console.error(e.reason);
    // 'Malformed condition expression at "id": must be [operator, operand, ?options] where operator is a string'
  }
}
```

### b) Unknown Operators

The operator string must be one of the recognized `ConditionOperator` values: `eq`, `in`, `contains`, `startsWith`, `endsWith`, `gt`, `gte`, `has`, `hasSome`, `hasEvery`, `some`, `every`, or `none`.

```ts
import { createGuantr, GuantrInvalidConditionError } from 'guantr';

// ❌ Typo: 'eql' instead of 'eq'
try {
  await createGuantr([
    { effect: 'allow', action: 'read', resource: 'post', condition: { id: ['eql', 1] } },
  ]);
} catch (e) {
  if (e instanceof GuantrInvalidConditionError) {
    console.error('Bad condition:', e.condition); // ['eql', 1]
    console.error('Reason:', e.reason);
    // 'Unknown operator "eql" at "id". Valid operators: eq, in, contains, ...'
  }
}
```

### c) Unknown Operators in Nested Conditions

Operators inside `some`, `every`, or `none` conditions are also validated recursively.

```ts
import { createGuantr, GuantrInvalidConditionError } from 'guantr';

// ❌ 'likee' is not a valid operator inside a `some` condition
try {
  await createGuantr([
    {
      effect: 'allow',
      action: 'read',
      resource: 'post',
      condition: {
        tags: ['some', { name: ['likee', 'typescript'] }],
      },
    },
  ]);
} catch (e) {
  if (e instanceof GuantrInvalidConditionError) {
    console.error(e.reason);
    // 'Unknown operator "likee" at "tags.name". Valid operators: eq, in, ...'
  }
}
```

### d) Invalid `$expr` Operators

If you use the `$expr` syntax (for evaluating array conditions), the nested expression is also validated.

```ts
import { createGuantr, GuantrInvalidConditionError } from 'guantr';

// ❌ invalid operator in $expr
try {
  await createGuantr([
    {
      effect: 'allow',
      action: 'read',
      resource: 'post',
      condition: {
        tags: {
          $expr: ['badOp', 'foo'] as any,
          length: ['gt', 0],
        },
      },
    },
  ]);
} catch (e) {
  if (e instanceof GuantrInvalidConditionError) {
    console.error(e.reason);
    // 'Unknown operator "badOp" at "tags.$expr". Valid operators: eq, in, ...'
  }
}
```

### e) Non-Array, Non-Object Condition Values

Every condition value must be either a condition expression array (`[operator, operand]`) or a nested condition object. Any other type (strings, numbers, booleans, etc.) is rejected.

```ts
import { createGuantr, GuantrInvalidConditionError } from 'guantr';

// ❌ Invalid condition value type
try {
  await createGuantr([
    { effect: 'allow', action: 'read', resource: 'post', condition: { id: 'invalid' as any } },
  ]);
} catch (e) {
  if (e instanceof GuantrInvalidConditionError) {
    console.error(e.reason);
    // 'Invalid condition value at "id": expected a condition expression array or a nested condition object, got string'
  }
}
```

## 2. Evaluation-Time Operator Checks (`can` / `cannot`)

If a condition somehow reaches evaluation with an unknown operator — for example, rules loaded from an external database that bypass `setRules` — `matchConditionExpression` throws a `GuantrInvalidConditionOperatorError` instead of silently returning `false`.

```ts
import { createGuantr, GuantrInvalidConditionOperatorError, Guantr } from 'guantr';
import { InMemoryStorage } from 'guantr/storage';

// Simulate loading raw rules from an external source that bypasses setRules
const storage = new InMemoryStorage();
await storage.setRules([
  {
    effect: 'allow',
    action: 'read',
    resource: 'post',
    condition: { id: ['unknownOp', 1] },
  },
]);

const guantr = new Guantr({ storage });

try {
  await guantr.can('read', ['post', { id: 1 }]);
} catch (e) {
  if (e instanceof GuantrInvalidConditionOperatorError) {
    console.error('Unknown operator encountered:', e.operator); // 'unknownOp'
  }
}
```

## 3. The Structural Check: `isConditionExpressionLike`

The `isConditionExpressionLike` utility (renamed from `isValidConditionExpression` in v2.0.0) performs a purely structural check — it verifies that a value looks like a condition expression without validating the operator. This is used internally for routing (determining whether a value is an expression or a nested condition) and is exported for custom tooling.

```ts
import { isConditionExpressionLike } from 'guantr';

// ✅ Structurally valid
isConditionExpressionLike(['eq', 'hello']); // true
isConditionExpressionLike(['in', ['a', 'b']]); // true
isConditionExpressionLike(['unknownOp', 'foo']); // true (structural check only — operator not validated)

// ❌ Structurally invalid
isConditionExpressionLike(null); // false
isConditionExpressionLike([]); // false
isConditionExpressionLike(['eq']); // false (too few elements)
isConditionExpressionLike([42, 'foo']); // false (operator not a string)
```

## 4. Using `validateCondition` Directly

The `validateCondition` function (the internal utility called by `setRules`) is exported from `'guantr'` for custom validation pipelines — for example, when loading rules from an external source and you want to validate them before storing.

```ts
import { validateCondition } from 'guantr';
import { GuantrInvalidConditionError } from 'guantr';

function validateRulesFromDatabase(rules: unknown[]) {
  for (const rule of rules as any[]) {
    if (rule.condition) {
      try {
        validateCondition(rule.condition);
      } catch (e) {
        if (e instanceof GuantrInvalidConditionError) {
          throw new Error(
            `Rule for "${rule.resource}:${rule.action}" has an invalid condition — ${e.reason}`,
          );
        }
      }
    }
  }
}
```

### `validateCondition` Reference

| Parameter   | Type                         | Description                                                                    |
| ----------- | ---------------------------- | ------------------------------------------------------------------------------ |
| `condition` | `GuantrAnyRule['condition']` | The condition object to validate. `null` and `undefined` are accepted (no-op). |
| `_path`     | `string` (optional)          | Dot-notation prefix for error messages. Used internally during recursion.      |

**Throws:** `GuantrInvalidConditionError` if the condition contains any malformed expression, unknown operator, or invalid value type.

## 5. The `KNOWN_OPERATORS` Set

The set of all valid operator strings is exported as `KNOWN_OPERATORS` from `'guantr'`. You can use it for custom validation or introspection.

```ts
import { KNOWN_OPERATORS } from 'guantr';

KNOWN_OPERATORS.has('eq'); // true
KNOWN_OPERATORS.has('eql'); // false
KNOWN_OPERATORS.has('like'); // false

// Iterate over all valid operators
console.log([...KNOWN_OPERATORS]);
// ['eq', 'in', 'contains', 'startsWith', 'endsWith', 'gt', 'gte',
//  'has', 'hasSome', 'hasEvery', 'some', 'every', 'none']
```

## Error Classes Summary

| Error                                 | Thrown By                                     | When                                                                             | Properties                                                               |
| ------------------------------------- | --------------------------------------------- | -------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| `GuantrInvalidConditionError`         | `setRules` / `createGuantr`                   | Malformed expression, unknown operator, or invalid value type at definition time | `condition` (the offending value), `reason` (human-readable description) |
| `GuantrInvalidConditionOperatorError` | `matchConditionExpression` / `can` / `cannot` | Unknown operator encountered during evaluation                                   | `operator` (the unrecognized operator string)                            |

Both error classes are exported from `'guantr'`. See the [Error Classes API reference](../../api/error-classes) for full details.

```ts
import { GuantrInvalidConditionError, GuantrInvalidConditionOperatorError } from 'guantr';
```

## Migration from v1.x

If you were using `strict: true` in v1.x, simply remove the option — the behavior is identical:

```diff
- const guantr = await createGuantr({ strict: true });
+ const guantr = await createGuantr();
```

If you were **not** using strict mode (the default in v1.x), your existing rules will now be validated at `setRules` time. This is a breaking change: any rule with an invalid operator or malformed condition that previously was silently stored will now throw `GuantrInvalidConditionError`. Treat any thrown errors as bugs in your rule definitions — they are existing silent failures being made visible.

### Quick Migration Steps

1. Run your test suite. Any `GuantrInvalidConditionError` failures indicate rule definitions with invalid operators or structures — fix them.
2. If you load rules from an external source (e.g., a database), either:
   - Validate them before passing to `setRules` using `validateCondition`, or
   - Ensure they only use valid `ConditionOperator` values.
3. Remove any `{ strict: true }` or `{ strict: false }` options from `createGuantr` or `new Guantr` calls.
