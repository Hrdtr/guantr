# API: Utilities

Guantr exports several utility functions that power the internal rule evaluation engine. These are available for users who need to evaluate rule conditions outside of the core `can`/`cannot` workflow — for example, when building custom permission checks, debugging rule logic, or integrating with external systems.

## Importing

All utilities are exported from the main `'guantr'` entry:

```ts
import {
  isConditionExpressionLike,
  isContextualOperand,
  KNOWN_OPERATORS,
  matchConditionExpression,
  matchRuleCondition,
  validateCondition,
} from 'guantr';
```

---

## `isContextualOperand`

Type guard that checks whether a value is a string referencing a context path (prefixed with `$ctx.`).

When writing rule conditions, you can reference values from the dynamic context using the `$ctx.` prefix (e.g., `$ctx.userId`). This function lets you programmatically detect such references.

### Signature

```ts
function isContextualOperand(path: unknown): path is string;
```

### Parameters

| Parameter | Type      | Description         |
| --------- | --------- | ------------------- |
| `path`    | `unknown` | The value to check. |

### Returns

- `boolean` — `true` if the value is a string starting with `$ctx.`, `false` otherwise. Acts as a TypeScript type guard, narrowing to `string`.

### Example

```ts
import { isContextualOperand } from 'guantr';

isContextualOperand('$ctx.userId'); // true
isContextualOperand('ctx.role'); // false
isContextualOperand('userId'); // false
isContextualOperand(42); // false
isContextualOperand(null); // false

// Type guard usage:
const operand: unknown = '$ctx.userId';
if (isContextualOperand(operand)) {
  // operand is now typed as `string`
  console.log(operand.replace('$ctx.', ''));
}
```

### Common Use Case

```ts
import { createGuantr, isContextualOperand } from 'guantr';

const guantr = await createGuantr({
  getContext: async () => ({ userId: 'abc123' }),
});

const rules = await guantr.getRules();
for (const rule of rules) {
  if (rule.condition) {
    for (const [field, expr] of Object.entries(rule.condition)) {
      if (Array.isArray(expr) && isContextualOperand(expr[1])) {
        console.log(`Rule for ${rule.resource}:${rule.action} uses context value: ${expr[1]}`);
      }
    }
  }
}
```

---

## `matchRuleCondition`

Evaluates a full rule condition object against a model (plain object). This is the same function used internally by `can`/`cannot` when checking resource-aware permissions.

### Signature

```ts
function matchRuleCondition<Model extends Record<string, unknown>>(
  model: Model,
  condition: NonNullable<GuantrRule['condition']>,
): boolean;
```

### Parameters

| Parameter   | Type                                    | Description                                                                                                          |
| ----------- | --------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `model`     | `Model extends Record<string, unknown>` | The plain object to evaluate the condition against (e.g., a resource instance).                                      |
| `condition` | `NonNullable<GuantrRule['condition']>`  | The condition object from a rule. Each key maps to either a condition expression array or a nested condition object. |

### Returns

- `boolean` — `true` if the model satisfies **all** conditions, `false` otherwise. Returns `false` if `model` is falsy.

### Throws

- `GuantrInvalidConditionOperatorError` — if an unknown operator is encountered.
- `TypeError` — if a condition value has an unexpected type.

### Example

```ts
import { matchRuleCondition } from 'guantr';
import type { GuantrRuleCondition } from 'guantr';

const condition: GuantrRuleCondition = {
  status: ['eq', 'published'],
  author: {
    role: ['in', ['editor', 'admin']],
  },
};

const post = { status: 'published', author: { role: 'editor' } };
matchRuleCondition(post, condition); // true

const draftPost = { status: 'draft', author: { role: 'editor' } };
matchRuleCondition(draftPost, condition); // false (status doesn't match)
```

### With Unknown Operators

```ts
import { matchRuleCondition, GuantrInvalidConditionOperatorError } from 'guantr';

try {
  // 'eql' is not a valid operator — throws immediately
  matchRuleCondition({ id: 1 }, { id: ['eql', 1] });
} catch (e) {
  if (e instanceof GuantrInvalidConditionOperatorError) {
    console.error('Unknown operator:', e.operator); // 'eql'
  }
}
```

---

## `matchConditionExpression`

Evaluates a single condition expression (a `[operator, operand, ?options]` tuple) against a value. This is the lowest-level evaluation function — `matchRuleCondition` delegates to it for each expression within a condition object.

### Signature

```ts
function matchConditionExpression(data: {
  value: unknown;
  expression: Extract<
    NonNullable<GuantrRule['condition']>[keyof NonNullable<GuantrRule['condition']>],
    Array<any>
  >;
}): boolean;
```

### Parameters

| Parameter         | Type      | Description                                                                          |
| ----------------- | --------- | ------------------------------------------------------------------------------------ |
| `data.value`      | `unknown` | The value to evaluate the condition against (e.g., a specific field from the model). |
| `data.expression` | `Array`   | A condition expression tuple in the form `[operator, operand, ?options]`.            |

### Returns

- `boolean` — `true` if the value satisfies the expression, `false` otherwise. Returns `false` if the expression is `null`, `undefined`, or has fewer than 2 elements.

### Throws

- `GuantrInvalidConditionOperatorError` — if the operator is not recognized.
- `TypeError` — if the value or operand type is invalid for the given operator.

### Example

```ts
import { matchConditionExpression } from 'guantr';

// Basic equality
matchConditionExpression({ value: 'hello', expression: ['eq', 'hello'] }); // true
matchConditionExpression({ value: 'hello', expression: ['eq', 'world'] }); // false

// Contains
matchConditionExpression({ value: 'hello world', expression: ['contains', 'world'] }); // true

// Greater than
matchConditionExpression({ value: 42, expression: ['gt', 10] }); // true

// Case-insensitive matching
matchConditionExpression({
  value: 'Hello',
  expression: ['eq', 'hello', { caseInsensitive: true }],
}); // true

// In array
matchConditionExpression({ value: 'admin', expression: ['in', ['admin', 'superadmin']] }); // true
```

### Using with Unknown Operators

```ts
import { matchConditionExpression, GuantrInvalidConditionOperatorError } from 'guantr';

// Unknown operator always throws immediately
try {
  matchConditionExpression({ value: 1, expression: ['unknownOp', 1] });
} catch (e) {
  if (e instanceof GuantrInvalidConditionOperatorError) {
    console.error('Unknown operator:', e.operator); // 'unknownOp'
  }
}
```

---

## `isConditionExpressionLike`

Type guard that checks whether a value is **structurally** a valid condition expression (an array with at least 2 elements where the first is a string).

This is a **structural check only** — the operator string is NOT validated against `KNOWN_OPERATORS`. Operator validation is handled by `validateCondition` (at definition time) and `matchConditionExpression` (at evaluation time).

See [Rule Validation](../guides/defining-rules/rule-validation) for a full explanation.

> **Renamed** from `isValidConditionExpression` in v2.0.0.

### Signature

```ts
function isConditionExpressionLike(
  maybeExpression: unknown,
): maybeExpression is GuantrRuleConditionExpression;
```

### Parameters

| Parameter         | Type      | Description         |
| ----------------- | --------- | ------------------- |
| `maybeExpression` | `unknown` | The value to check. |

### Returns

- `boolean` — `true` if the value is an array with at least 2 elements and the first element is a string. Acts as a TypeScript type guard, narrowing to `GuantrRuleConditionExpression`.

### Example

```ts
import { isConditionExpressionLike } from 'guantr';

isConditionExpressionLike(['eq', 'hello']); // true
isConditionExpressionLike(['unknownOp', 'foo']); // true (structural check only)
isConditionExpressionLike(null); // false
isConditionExpressionLike(['eq']); // false (too few elements)
isConditionExpressionLike([42, 'foo']); // false (operator not a string)
```

---

## `validateCondition`

Recursively validates a condition object, throwing `GuantrInvalidConditionError` on the first invalid expression encountered. This is the same function called internally by `setRules`.

### Signature

```ts
function validateCondition(condition: GuantrRule['condition'], _path?: string): void;
```

### Parameters

| Parameter   | Type                      | Description                                                                    |
| ----------- | ------------------------- | ------------------------------------------------------------------------------ |
| `condition` | `GuantrRule['condition']` | The condition object to validate. `null` and `undefined` are accepted (no-op). |
| `_path`     | `string` (optional)       | Dot-notation prefix for error messages. Used internally during recursion.      |

### Throws

- `GuantrInvalidConditionError` — if the condition is malformed, uses an unknown operator, or contains an invalid value type.

### Example

```ts
import { validateCondition } from 'guantr';
import { GuantrInvalidConditionError } from 'guantr';

try {
  validateCondition({ id: ['eql', 1] });
} catch (e) {
  if (e instanceof GuantrInvalidConditionError) {
    console.error(e.reason);
    // 'Unknown operator "eql" at "id". Valid operators: eq, in, ...'
  }
}
```

---

## `KNOWN_OPERATORS`

A `ReadonlySet<string>` containing all valid `ConditionOperator` values. Useful for custom validation or introspection.

```ts
import { KNOWN_OPERATORS } from 'guantr';

KNOWN_OPERATORS.has('eq'); // true
KNOWN_OPERATORS.has('eql'); // false
```

---

## Related

- [Condition Operators](../guides/defining-rules/condition-operators) — Reference for all available operators.
- [Rule Validation](../guides/defining-rules/rule-validation) — How Guantr validates conditions at definition and evaluation time.
- [Error Classes](./error-classes) — Documentation for error types.
