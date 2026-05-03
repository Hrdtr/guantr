# API: Error Classes

Guantr exports two error classes that are thrown when [strict mode](../advanced-usage/strict-mode) is enabled. Both extend the built-in `Error` class and carry extra metadata so you can programmatically inspect what went wrong.

## Importing

```ts
import { GuantrInvalidConditionError, GuantrInvalidConditionOperatorError } from 'guantr';
```

---

## `GuantrInvalidConditionOperatorError`

Thrown by `matchConditionExpression` (and therefore surfaced through `can`/`cannot`) when an operator string that does not match any known `ConditionOperator` value is encountered **at evaluation time**, and the Guantr instance was created with `strict: true`.

### Class Definition

```ts
class GuantrInvalidConditionOperatorError extends Error {
  /** The unrecognized operator string that caused the error. */
  operator: string;

  constructor(operator: string);
}
```

### Properties

| Property   | Type     | Description                                                                      |
| ---------- | -------- | -------------------------------------------------------------------------------- |
| `name`     | `string` | Always `"GuantrInvalidConditionOperatorError"`.                                  |
| `message`  | `string` | Human-readable description including the bad operator and a hint about `strict`. |
| `operator` | `string` | The unrecognized operator string that triggered the error.                       |

### When It Is Thrown

- A rule condition expression has been stored whose first element is not a recognized `ConditionOperator`.
- The Guantr instance has `strict: true`.
- `can` / `cannot` is called and evaluation reaches that expression.

> **Note:** With `strict: true`, `setRules` validates rules upfront via `validateConditionForStrict`, so this error is most likely to occur when rules are loaded from an external source (e.g., a database) and bypass the definition-time check.

### Example

```ts
import { createGuantr, GuantrInvalidConditionOperatorError } from 'guantr';

const guantr = await createGuantr({ strict: true });

// Manually set raw rules that bypass TypeScript typing (e.g., loaded from DB)
await (guantr as any).setRules([
  { effect: 'allow', action: 'read', resource: 'post', condition: { id: ['unknownOp', 1] } },
]);

try {
  await guantr.can('read', ['post', { id: 1 }]);
} catch (e) {
  if (e instanceof GuantrInvalidConditionOperatorError) {
    console.error('Unknown operator:', e.operator); // 'unknownOp'
  }
}
```

---

## `GuantrInvalidConditionError`

Thrown by `setRules` when a rule condition fails structural or operator validation **at definition time**, and the Guantr instance was created with `strict: true`.

Validation is performed recursively by the internal `validateConditionForStrict` utility, which is also exported from `'guantr/utils'` for use in custom validation pipelines.

### Class Definition

```ts
class GuantrInvalidConditionError extends Error {
  /** The condition value (expression or nested object) that failed validation. */
  condition: unknown;
  /** A human-readable description of why the condition is invalid. */
  reason: string;

  constructor(condition: unknown, reason: string);
}
```

### Properties

| Property    | Type      | Description                                                                                                                     |
| ----------- | --------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `name`      | `string`  | Always `"GuantrInvalidConditionError"`.                                                                                         |
| `message`   | `string`  | `"[guantr] Invalid condition: "` followed by `reason`.                                                                          |
| `condition` | `unknown` | The offending condition expression or nested condition object.                                                                  |
| `reason`    | `string`  | Dot-notation path and description of the specific problem, e.g. `Unknown operator "eql" at "id". Valid operators: eq, in, ...`. |

### When It Is Thrown

`setRules` (called directly or via `createGuantr`) throws this error when any of the following are true for a condition with `strict: true`:

1. A condition expression array has fewer than two elements, or its first element is not a `string`.
2. A condition expression's operator is not present in `KNOWN_OPERATORS`.
3. A non-array, non-plain-object value appears where a condition expression or nested condition object is expected.

The `reason` string always includes the dot-notation path to the offending field (e.g., `"tags.$expr"` or `"author.role"`) to help you pinpoint the problem quickly.

### Examples

**Unknown operator**

```ts
import { createGuantr, GuantrInvalidConditionError } from 'guantr';

try {
  await createGuantr(
    [{ effect: 'allow', action: 'read', resource: 'post', condition: { id: ['eql', 1] } }],
    { strict: true },
  );
} catch (e) {
  if (e instanceof GuantrInvalidConditionError) {
    console.error(e.condition); // ['eql', 1]
    console.error(e.reason);
    // 'Unknown operator "eql" at "id". Valid operators: eq, in, contains, ...'
  }
}
```

**Malformed expression (missing operand)**

```ts
try {
  await createGuantr(
    // Condition expression has only one element — malformed
    [{ effect: 'allow', action: 'read', resource: 'post', condition: { id: ['eq'] as any } }],
    { strict: true },
  );
} catch (e) {
  if (e instanceof GuantrInvalidConditionError) {
    console.error(e.reason);
    // 'Malformed condition expression at "id": must be [operator, operand, ?options] where operator is a string'
  }
}
```

**Nested condition (via `some`/`every`/`none`)**

```ts
try {
  await createGuantr(
    [
      {
        effect: 'allow',
        action: 'read',
        resource: 'post',
        condition: {
          tags: ['some', { name: ['likee', 'typescript'] }], // 'likee' is not valid
        },
      },
    ],
    { strict: true },
  );
} catch (e) {
  if (e instanceof GuantrInvalidConditionError) {
    console.error(e.reason);
    // 'Unknown operator "likee" at "tags.name". Valid operators: eq, in, ...'
  }
}
```

---

## `KNOWN_OPERATORS` and `validateConditionForStrict`

Two additional utilities are exported from `'guantr/utils'` and are useful when building custom validation tooling or middleware:

```ts
import { KNOWN_OPERATORS, validateConditionForStrict } from 'guantr/utils';
```

### `KNOWN_OPERATORS`

A `ReadonlySet<string>` containing all valid `ConditionOperator` values:

```ts
// 'eq' | 'in' | 'contains' | 'startsWith' | 'endsWith' |
// 'gt' | 'gte' | 'has' | 'hasSome' | 'hasEvery' |
// 'some' | 'every' | 'none'
KNOWN_OPERATORS.has('eq'); // true
KNOWN_OPERATORS.has('unknownOp'); // false
```

### `validateConditionForStrict(condition, path?)`

Recursively validates a condition object. Throws `GuantrInvalidConditionError` on the first invalid expression encountered. This is the same function called internally by `setRules` in strict mode.

```ts
import { validateConditionForStrict } from 'guantr/utils';
import { GuantrInvalidConditionError } from 'guantr';

function validateRulesFromDatabase(rules: unknown[]) {
  for (const rule of rules as any[]) {
    if (rule.condition) {
      try {
        validateConditionForStrict(rule.condition);
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

| Parameter   | Type                         | Description                                                                                             |
| ----------- | ---------------------------- | ------------------------------------------------------------------------------------------------------- |
| `condition` | `GuantrAnyRule['condition']` | The condition object to validate (`null` and `undefined` are no-ops).                                   |
| `_path`     | `string` (optional)          | Dot-notation prefix for error messages. Used internally during recursion; you rarely need to pass this. |
