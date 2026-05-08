# API: Error Classes

Guantr exports two error classes that extend the built-in `Error` class and carry extra metadata for programmatic inspection and error handling.

## Importing

```ts
import { GuantrCircuitBreakerError, GuantrInvalidConditionKeyError } from 'guantr';
```

---

## `GuantrCircuitBreakerError`

Thrown by `can`/`cannot` (and their batch variants) when the number of rules evaluated for a single permission check exceeds the configured `maxRuleIterations` limit.

### Constructor

```ts
class GuantrCircuitBreakerError extends Error {
  constructor(action: string, resource: string, limit: number);
}
```

### Properties

| Property   | Type     | Description                                                          |
| ---------- | -------- | -------------------------------------------------------------------- |
| `name`     | `string` | Always `"GuantrCircuitBreakerError"`                                 |
| `message`  | `string` | Human-readable description including the action, resource, and limit |
| `action`   | `string` | The action being checked when the circuit breaker tripped            |
| `resource` | `string` | The resource key being checked                                       |
| `limit`    | `number` | The configured `maxRuleIterations` value that was exceeded           |

### When it is thrown

- A `can`/`cannot` call iterates through more rules than the `maxRuleIterations` configured for the instance.
- This is a safety mechanism: rule evaluation should be bounded. If you have enough rules to trip the breaker, consider restructuring your rule set or increasing the limit.

### Tuning the limit

```ts
const guantr = await createGuantr({
  maxRuleIterations: 5000, // default is 1000
});
```

The limit is validated at construction time — it must be a **positive integer**. Non-integer, zero, or negative values throw `TypeError`:

```ts
new Guantr({ maxRuleIterations: 0 }); // TypeError
new Guantr({ maxRuleIterations: 1.5 }); // TypeError
new Guantr({ maxRuleIterations: -1 }); // TypeError
```

### Example

```ts
import { createGuantr, GuantrCircuitBreakerError } from 'guantr';

const guantr = await createGuantr({ maxRuleIterations: 100 });

// Create many rules to trip the breaker
const rules = [];
for (let i = 0; i < 150; i++) {
  rules.push({
    effect: 'allow',
    action: 'read',
    resource: 'post',
    matchCondition: ({ eq, resource, literal }) => eq(resource('id'), literal(i)),
  });
}
await guantr.setRules(rules);

try {
  await guantr.can('read', ['post', { id: 1 }]);
} catch (e) {
  if (e instanceof GuantrCircuitBreakerError) {
    console.error(e.name); // 'GuantrCircuitBreakerError'
    console.error(e.action); // 'read'
    console.error(e.resource); // 'post'
    console.error(e.limit); // 100
  }
}
```

---

## `GuantrInvalidConditionKeyError`

Thrown by the condition evaluator when a condition references a key that does not exist on the resource instance or context object being evaluated.

### Constructor

```ts
class GuantrInvalidConditionKeyError extends Error {
  constructor(key: string);
}
```

### Properties

| Property  | Type     | Description                                                  |
| --------- | -------- | ------------------------------------------------------------ |
| `name`    | `string` | Always `"GuantrInvalidConditionKeyError"`                    |
| `message` | `string` | Human-readable description including the missing key         |
| `key`     | `string` | The key that does not exist on the resource model or context |

### When it is thrown

- A rule condition references a field path that does not exist on the resource instance at evaluation time.
- This catches typos and misconfigured conditions that would otherwise silently return `false`.
- Optional path segments (using `?` suffix, e.g. `resource('optional?.field')`) are **exempt** from this check — they silently return `undefined` instead of throwing.

### Opt-out for nullable/sparse objects

If a field may legitimately be absent on some resource instances (sparse data, optional fields), use an explicit `null` or `undefined` literal as one of the operands in the condition expression. When the evaluator detects a nullish literal operand, it skips the key-existence check and treats missing keys as `undefined`:

```ts
// Without opt-out — throws if 'optionalField' is missing
matchCondition: ({ eq, resource, literal }) => eq(resource('optionalField'), literal('someValue'));

// With opt-out — key check is skipped; missing key → undefined → inequality → false
matchCondition: ({ eq, resource, literal }) => eq(resource('optionalField'), literal(undefined));
```

Any `null` or `undefined` literal in any operand position triggers the opt-out for **all** operands in that expression.

### Optional path segments

```ts
// The '?' in the path makes this segment optional
// If 'profile' doesn't exist, returns undefined instead of throwing
matchCondition: ({ eq, resource, literal }) => eq(resource('profile?.bio'), literal('Hello'));
```

### Example

```ts
import { createGuantr, GuantrInvalidConditionKeyError } from 'guantr';

const guantr = await createGuantr();
await guantr.setRules([
  {
    effect: 'allow',
    action: 'read',
    resource: 'post',
    matchCondition: ({ eq, resource, literal }) => eq(resource('titel'), literal('Hello')), // typo: should be 'title'
  },
]);

try {
  await guantr.can('read', ['post', { title: 'Hello' }]);
} catch (e) {
  if (e instanceof GuantrInvalidConditionKeyError) {
    console.error('Missing key:', e.key); // 'titel'
  }
}
```

### Using pre-built Condition objects

The error applies regardless of whether the condition was built from a function or constructed manually as a JSON-serializable `Condition`:

```ts
import { evaluateCondition, GuantrInvalidConditionKeyError } from 'guantr';

const condition = {
  type: 'condition' as const,
  node: {
    type: 'operator' as const,
    operator: 'eq' as const,
    operands: [
      { type: 'resource' as const, path: 'nonExistent' },
      { type: 'literal' as const, value: 'test' },
    ],
  },
};

try {
  evaluateCondition(condition, { actualField: 'test' }, {});
} catch (e) {
  if (e instanceof GuantrInvalidConditionKeyError) {
    console.error(e.key); // 'nonExistent'
  }
}
```

---

## Inheritance

Both error classes extend `Error`, so standard error handling patterns work:

```ts
try {
  // ...
} catch (e) {
  if (e instanceof GuantrCircuitBreakerError) {
    // Handle circuit breaker
  } else if (e instanceof GuantrInvalidConditionKeyError) {
    // Handle invalid key
  } else {
    // Handle other errors
  }
}
```

## See also

- [`can()`](./Guantr/can) — Permission checking (where these errors are thrown).
- [`evaluateCondition()`](./utilities#evaluatecondition) — Standalone condition evaluation.
- [Condition Builder guide](../../guides/condition-builder) — Building safe conditions.
