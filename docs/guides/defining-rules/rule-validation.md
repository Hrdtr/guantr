# Rule Validation

Guantr v2 uses a **type-safe builder DSL** for conditions, which catches most errors at **compile time**. This page documents the remaining validation that occurs at runtime.

---

## Compile-Time Safety (TypeScript)

The builder DSL leverages TypeScript's type system to catch errors before your code runs:

- **Resource field names** — `resource('typo')` will not compile if `typo` is not a valid key on the resource model. The `LeafKeys` utility type resolves all valid dot-path keys (up to 5 levels deep) from your model type.
- **Context field names** — `context('badKey')` is similarly validated against your context type.
- **Operand type compatibility** — `eq(resource('status'), literal(42))` will error if `status` is `string`. Operators enforce phantom type constraints via `InferValueRef`.
- **Operator existence** — only methods defined on `MatchConditionBuilder` are valid. Calling a misspelled operator like `eqql()` is a compile-time error.

This eliminates the runtime operator validation (`GuantrInvalidConditionOperatorError`, `validateCondition`, `KNOWN_OPERATORS`) that existed in v1.x.

---

## Runtime Validation

Two categories of validation remain — they cannot be statically verified because they depend on actual data at evaluation time.

### Key-Existence Checks

When `evaluateCondition()` resolves a `resource` or `context` value reference, it walks the object tree by splitting the path on `.` and accessing each segment:

**Operation:**

1. If any intermediate value is `null`/`undefined`, the traversal stops and returns `undefined` (no throw for paths with `?` syntax).
2. If an intermediate value is a primitive (not an object), a `GuantrInvalidConditionKeyError` is thrown.
3. If the target key does not exist on the object (`!(key in record)`) **and** no nullish opt-out is active, a `GuantrInvalidConditionKeyError` is thrown.

```ts
import { GuantrInvalidConditionKeyError } from 'guantr';

const guantr = await createGuantr({ storage: myStorage });

// Rule references 'titel' but the resource has 'title'
await guantr.setRules([
  {
    effect: 'allow',
    action: 'read',
    resource: 'post',
    matchCondition: {
      type: 'condition',
      node: {
        type: 'operator',
        operator: 'eq',
        operands: [
          { type: 'resource', path: 'titel' }, // typo!
          { type: 'literal', value: 'Hello' },
        ],
      },
    },
  },
]);

try {
  await guantr.can('read', ['post', { title: 'Hello' }]);
} catch (e) {
  if (e instanceof GuantrInvalidConditionKeyError) {
    console.log(e.key); // 'titel'
    console.log(e.name); // 'GuantrInvalidConditionKeyError'
    // Message: [guantr] Invalid condition key: "titel" does not exist
    //          on the resource instance. If this key is intentionally
    //          optional, use an explicit nullish operand to opt out.
  }
}
```

Key-existence checks apply to both `resource` and `context` references:

```ts
// Also throws if 'nonexistent' is not on the context object:
eq(resource('id'), context('nonexistent'));
```

### Optional Path Syntax

Paths can use `?` to mark optional segments — the traversal silently returns `undefined` when a `null`/`undefined` intermediate is encountered. The `?` syntax on the final segment also prevents `GuantrInvalidConditionKeyError` when the key is absent:

```ts
// No error if `author` is null/undefined — returns undefined
eq(resource('author?.name'), literal('Alice'));

// Also works on final segment (key may be absent)
eq(resource('optionalField?'), literal('test'));
```

### Nullish Opt-Out Mechanism

When any operand in an `OperatorNode` is an explicit `null` or `undefined` literal, the key-existence check is **skipped** for the entire condition. This signals that the developer intentionally handles sparse objects where keys may be absent.

**How it works** — before evaluating an operator node, `evaluateCondition` inspects all operands. If any operand has `type: 'literal'` and `value === null` or `value === undefined`, the `skipKeyCheck` flag is set to `true`. Missing keys then return `undefined` instead of throwing.

```ts
// ✅ No error even if 'optionalField' doesn't exist on the resource
eq(resource('optionalField'), literal(undefined));

// ✅ Also works with null (any literal null/undefined in the operand list)
ne(resource('optionalField'), literal(null));

// ❌ Still throws — no nullish literal in this operator node
eq(resource('missingField'), literal('some value'));
```

**Scope** — the opt-out applies per-operator-node. A condition like the following throws because the second `eq` branch has no nullish literal:

```ts
or(
  eq(resource('missingA'), literal(null)), // opt-out active here
  eq(resource('missingB'), literal('test')), // no opt-out → throws
);
```

### Circuit Breaker

To prevent infinite loops or runaway evaluation caused by misconfigured storage adapters that return enormous rule sets, `_evaluateCheck` tracks the number of rule iterations and throws `GuantrCircuitBreakerError` when the limit is exceeded.

**Mechanism:**

- A counter increments for every rule inspected during a `can`/`cannot` call.
- When `iterationCount > maxRuleIterations`, the error is thrown immediately.
- The default limit is **1000**. You can configure it via `maxRuleIterations` in `GuantrOptions`.

```ts
import { GuantrCircuitBreakerError } from 'guantr';

const guantr = await createGuantr({ maxRuleIterations: 500 });

try {
  await guantr.can('read', ['post', postInstance]);
} catch (e) {
  if (e instanceof GuantrCircuitBreakerError) {
    console.log(e.action); // 'read'
    console.log(e.resource); // 'post'
    console.log(e.limit); // 500
    // Message: [guantr] Circuit breaker tripped: rule iteration limit
    //          (500) exceeded while evaluating action "read" on resource
    //          "post". Consider reducing the number of rules or increasing
    //          the `maxRuleIterations` option.
  }
}
```

**Validation of `maxRuleIterations`:**

- Must be a positive integer.
- Values that are not integers or less than 1 throw `TypeError` at construction time (not at evaluation time).

```ts
// ❌ TypeError: maxRuleIterations must be a positive integer
const guantr = new Guantr({ maxRuleIterations: 0 });
```

---

## Error Reference

| Error Class                      | When                                                                                                             | Properties                                            | Import                   |
| -------------------------------- | ---------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- | ------------------------ |
| `GuantrCircuitBreakerError`      | Rule iteration count exceeds `maxRuleIterations` during a `can`/`cannot` check                                   | `action: string`, `resource: string`, `limit: number` | Exported from `'guantr'` |
| `GuantrInvalidConditionKeyError` | A referenced key does not exist on the resource or context at evaluation time (and no nullish opt-out is active) | `key: string`                                         | Exported from `'guantr'` |

Both extend `Error` and carry a `.name` property matching the class name.

---

## Migration from v1.x

In v1.x, conditions used tuple expressions and required explicit validation:

- `validateCondition()` validated condition tuples against `KNOWN_OPERATORS` at definition time.
- `GuantrInvalidConditionError` was thrown for structural issues in condition tuples.
- `GuantrInvalidConditionOperatorError` was thrown at evaluation time for unknown operators.
- The `{ strict: true/false }` option controlled whether validation ran at all (default `false`).

**In v2.0 all of these are removed.** The builder DSL catches invalid operators and type mismatches at compile time. The only remaining runtime validations handle structural issues that can only be detected with actual data:

- `GuantrInvalidConditionKeyError` — key existence on the runtime object.
- `GuantrCircuitBreakerError` — excessive rule iteration count.

The following v1.x exports no longer exist:

- `GuantrInvalidConditionError`
- `GuantrInvalidConditionOperatorError`
- `validateCondition`
- `KNOWN_OPERATORS`
- `isConditionExpressionLike`
