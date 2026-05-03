# API: Utilities

Guantr exports several utility functions that power the internal rule evaluation engine. These are available for users who need to evaluate rule conditions outside of the core `can`/`cannot` workflow — for example, when building custom permission checks, debugging rule logic, or integrating with external systems.

## Importing

```ts
import { isContextualOperand, matchConditionExpression, matchRuleCondition } from 'guantr';
```

---

## `isContextualOperand`

Type guard that checks whether a value is a string referencing a context path (prefixed with `$ctx.` or `ctx.`).

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

- `boolean` — `true` if the value is a string starting with `$ctx.` or `ctx.`, `false` otherwise. Acts as a TypeScript type guard, narrowing to `string`.

### Example

```ts
import { isContextualOperand } from 'guantr';

isContextualOperand('$ctx.userId'); // true
isContextualOperand('ctx.role'); // true
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
  condition: NonNullable<GuantrAnyRule['condition']>,
  strict?: boolean,
): boolean;
```

### Parameters

| Parameter   | Type                                      | Description                                                                                                                |
| ----------- | ----------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `model`     | `Model extends Record<string, unknown>`   | The plain object to evaluate the condition against (e.g., a resource instance).                                            |
| `condition` | `NonNullable<GuantrAnyRule['condition']>` | The condition object from a rule. Each key maps to either a condition expression array or a nested condition object.       |
| `strict`    | `boolean`                                 | When `true`, unrecognized operators cause `GuantrInvalidConditionOperatorError` to be thrown instead of returning `false`. |

### Returns

- `boolean` — `true` if the model satisfies **all** conditions, `false` otherwise. Returns `false` if `model` is falsy.

### Throws

- `GuantrInvalidConditionOperatorError` — if `strict` is `true` and an unknown operator is encountered.
- `TypeError` — if a condition value has an unexpected type.

### Example

```ts
import { matchRuleCondition } from 'guantr';
import type { GuantrAnyRuleCondition } from 'guantr';

const condition: GuantrAnyRuleCondition = {
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

### With Strict Mode

```ts
import { matchRuleCondition, GuantrInvalidConditionOperatorError } from 'guantr';

try {
  // 'eql' is not a valid operator — only throws in strict mode
  matchRuleCondition({ id: 1 }, { id: ['eql', 1] }, true);
} catch (e) {
  if (e instanceof GuantrInvalidConditionOperatorError) {
    console.error('Unknown operator:', e.operator); // 'eql'
  }
}

// Without strict mode, unknown operators silently return false
matchRuleCondition({ id: 1 }, { id: ['eql', 1] }); // false (no error thrown)
```

---

## `matchConditionExpression`

Evaluates a single condition expression (a `[operator, operand, ?options]` tuple) against a value. This is the lowest-level evaluation function — `matchRuleCondition` delegates to it for each expression within a condition object.

### Signature

```ts
function matchConditionExpression(data: {
  value: unknown;
  expression: Extract<
    NonNullable<GuantrAnyRule['condition']>[keyof NonNullable<GuantrAnyRule['condition']>],
    Array<any>
  >;
  strict?: boolean;
}): boolean;
```

### Parameters

| Parameter         | Type      | Description                                                                                                                |
| ----------------- | --------- | -------------------------------------------------------------------------------------------------------------------------- |
| `data.value`      | `unknown` | The value to evaluate the condition against (e.g., a specific field from the model).                                       |
| `data.expression` | `Array`   | A condition expression tuple in the form `[operator, operand, ?options]`.                                                  |
| `data.strict`     | `boolean` | When `true`, unrecognized operators cause `GuantrInvalidConditionOperatorError` to be thrown instead of returning `false`. |

### Returns

- `boolean` — `true` if the value satisfies the expression, `false` otherwise. Returns `false` if the expression is `null`, `undefined`, or has fewer than 2 elements.

### Throws

- `GuantrInvalidConditionOperatorError` — if `strict` is `true` and the operator is not recognized.
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

### Using with Strict Mode

```ts
import { matchConditionExpression, GuantrInvalidConditionOperatorError } from 'guantr';

// Without strict: unknown operator silently returns false
matchConditionExpression({ value: 1, expression: ['unknownOp', 1] }); // false

// With strict: throws immediately
try {
  matchConditionExpression({ value: 1, expression: ['unknownOp', 1], strict: true });
} catch (e) {
  if (e instanceof GuantrInvalidConditionOperatorError) {
    console.error('Unknown operator:', e.operator); // 'unknownOp'
  }
}
```

---

## Related

- [Condition Operators](../guides/defining-rules/condition-operators) — Reference for all available operators.
- [Strict Mode](../advanced-usage/strict-mode) — How strict mode affects evaluation behavior.
- [Error Classes](./error-classes) — Documentation for the error types thrown in strict mode.
