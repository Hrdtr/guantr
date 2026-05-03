# Rules Condition Operators

Guantr's fine-grained control comes from its powerful **condition** logic within rules. Conditions are objects where keys map to resource properties, and values are **Condition Expressions**. The core of a condition expression is the **operator**, which defines the comparison logic.

Condition expressions typically follow the format `[operator, operand, options?]` as described in the [Defining Rules Guide](/guides/defining-rules.md). This page details each available operator.

## Available Operators

## Condition Options

Some operators accept an optional third element in the condition expression tuple: an **options object**. This is currently used to enable **case-insensitive** string comparisons.

```ts
// Options object shape
interface ConditionOptions {
  caseInsensitive?: boolean; // Default: false
}

// Usage: [operator, operand, { caseInsensitive: true }]
```

When `caseInsensitive` is `true`, string comparisons are performed in a case-insensitive manner (using `.toLowerCase()`). The following operators support this option:

- `eq`
- `in`
- `contains`
- `startsWith`
- `endsWith`
- `has`
- `hasSome`
- `hasEvery`

---

Here are the operators you can use in Guantr condition expressions:

---

### `eq`

- **Description:** Checks for strict equality (`===`) between the resource/context value and the operand.
- **Signature:** `['eq', operand, options?]`
- **Operand Type:** Any literal value (string, number, boolean, null, undefined).
- **Options:** `{ caseInsensitive?: boolean }` (Default: `false`)
- **Behavior:** Performs a strict equality check (`value === operand`). When `caseInsensitive` is `true` and both `value` and `operand` are strings, comparison is case-insensitive.
- **Examples:**

  ```ts
  // Allow if article status is exactly 'published'
  allow('read', ['article', { status: ['eq', 'published'] }]);

  // Allow if user ID matches a specific string
  allow('view', ['profile', { userId: ['eq', 'user-admin-123'] }]);

  // Allow if 'featured' flag is strictly true
  allow('display', ['product', { featured: ['eq', true] }]);

  // Check for null value
  allow('access', ['resource', { deletedAt: ['eq', null] }]);

  // Case-insensitive string comparison
  allow('read', ['document', { category: ['eq', 'Reports', { caseInsensitive: true }] }]);
  ```

---

### `in`

- **Description:** Checks if the resource/context value exists within the provided array operand (using strict equality `===` for comparison).
- **Signature:** `['in', operand, options?]`
- **Operand Type:** An array (`Array<any>`).
- **Options:** `{ caseInsensitive?: boolean }` (Default: `false`)
- **Behavior:** Returns `true` if the `operand` is an array and contains an element strictly equal to the `value`. Returns `false` if the `operand` is not an array or the `value` is not found. When `caseInsensitive` is `true` and `value` is a string, the comparison is case-insensitive.
- **Examples:**

  ```ts
  // Allow if user role is one of 'admin' or 'editor'
  allow('edit', ['settings', { userRole: ['in', ['admin', 'editor']] }]);

  // Allow if product category ID is in the allowed list
  allow('view', ['product', { categoryId: ['in', [10, 25, 42]] }]);

  // Case-insensitive membership check
  allow('access', ['feature', { code: ['in', ['ALPHA', 'BETA'], { caseInsensitive: true }] }]);

  // Edge Case: Value not found
  // { userRole: ['in', ['viewer']] } will be false if userRole is 'editor'

  // Edge Case: Operand is not an array
  // { userRole: ['in', 'admin'] } will always evaluate to false
  ```

---

### `contains`

- **Description:** Checks if the resource/context value (string) contains the operand (string) as a substring.
- **Signature:** `['contains', operand, options?]`
- **Operand Type:** `string`
- **Options:** `{ caseInsensitive?: boolean }` (Default: `false`)
- **Behavior:** Returns `true` if both `value` and `operand` are strings, and `value` includes `operand`. Case sensitivity depends on the `options`. Returns `false` if either `value` or `operand` is not a string.
- **Examples:**

  ```ts
  // Allow if document title contains "report" (case-sensitive)
  allow('download', ['document', { title: ['contains', 'report'] }]);

  // Allow if email contains "@example.com" (case-insensitive)
  allow('login', ['user', { email: ['contains', '@example.com', { caseInsensitive: true }] }]);

  // Edge Case: Value or Operand not a string
  // { title: ['contains', null] } -> false
  // { count: ['contains', 'report'] } // where count is number -> false
  ```

---

### `startsWith`

- **Description:** Checks if the resource/context value (string) starts with the operand (string).
- **Signature:** `['startsWith', operand, options?]`
- **Operand Type:** `string`
- **Options:** `{ caseInsensitive?: boolean }` (Default: `false`)
- **Behavior:** Returns `true` if both `value` and `operand` are strings, and `value` starts with `operand`. Case sensitivity depends on the `options`. Returns `false` if either is not a string.
- **Examples:**

  ```ts
  // Allow if product SKU starts with "PROD-"
  allow('manage', ['product', { sku: ['startsWith', 'PROD-'] }]);

  // Allow if username starts with "test_" (case-insensitive)
  allow('login', ['user', { username: ['startsWith', 'test_', { caseInsensitive: true }] }]);
  ```

---

### `endsWith`

- **Description:** Checks if the resource/context value (string) ends with the operand (string).
- **Signature:** `['endsWith', operand, options?]`
- **Operand Type:** `string`
- **Options:** `{ caseInsensitive?: boolean }` (Default: `false`)
- **Behavior:** Returns `true` if both `value` and `operand` are strings, and `value` ends with `operand`. Case sensitivity depends on the `options`. Returns `false` if either is not a string.
- **Examples:**

  ```ts
  // Allow if filename ends with ".pdf"
  allow('download', ['file', { filename: ['endsWith', '.pdf'] }]);

  // Allow if domain ends with ".org" (case-insensitive)
  allow('access', ['website', { domain: ['endsWith', '.org', { caseInsensitive: true }] }]);
  ```

---

### `gt`

- **Description:** Checks if the resource/context value is strictly greater than (`>`) the operand.
- **Signature:** `['gt', operand]`
- **Operand Type:** `number` or `string` (for lexical comparison).
- **Behavior:** Performs a `value > operand` comparison. Returns `false` if the types are incompatible for comparison (e.g., comparing a number to an object) or if the condition is not met.
- **Examples:**

  ```ts
  // Allow if comment score is greater than 10
  allow('upvote', ['comment', { score: ['gt', 10] }]);

  // Allow if version name is lexically greater than "v2.0"
  allow('deploy', ['release', { versionName: ['gt', 'v2.0'] }]);
  ```

---

### `gte`

- **Description:** Checks if the resource/context value is greater than or equal to (`>=`) the operand.
- **Signature:** `['gte', operand]`
- **Operand Type:** `number` or `string`.
- **Behavior:** Performs a `value >= operand` comparison. Returns `false` if types are incompatible or the condition is not met.
- **Examples:**

  ```ts
  // Allow if user age is 18 or older
  allow('register', ['user', { age: ['gte', 18] }]);

  // Allow if required clearance level is met or exceeded
  allow('access', ['document', { clearanceLevel: ['gte', '$ctx.userClearance'] }]);
  ```

---

### `has`

- **Description:** Checks if the resource/context value (an array) includes the operand (using strict equality `===`). Note: This checks `value.includes(operand)`.
- **Signature:** `['has', operand, options?]`
- **Operand Type:** Any literal value (string or number).
- **Options:** `{ caseInsensitive?: boolean }` (Default: `false`)
- **Behavior:** Returns `true` if the `value` is an array and contains an element strictly equal to the `operand`. Returns `false` if the `value` is not an array or the `operand` is not found within it. When `caseInsensitive` is `true` and `operand` is a string, the comparison is case-insensitive.
- **Examples:**

  ```ts
  // Allow if user's roles array includes 'admin'
  allow('access', ['adminPanel', { roles: ['has', 'admin'] }]);

  // Allow if article tags include 'featured'
  allow('promote', ['article', { tags: ['has', 'featured'] }]);

  // Case-insensitive array membership
  allow('access', ['adminPanel', { roles: ['has', 'Admin', { caseInsensitive: true }] }]);

  // Edge Case: Value is not an array
  // { roles: ['has', 'admin'] } -> false if roles is undefined or string
  ```

---

### `hasSome`

- **Description:** Checks if the resource/context value (an array) contains _at least one_ element that is also present in the operand (an array). Uses strict equality (`===`) for comparison.
- **Signature:** `['hasSome', operand, options?]`
- **Operand Type:** An array (`Array<any>`).
- **Options:** `{ caseInsensitive?: boolean }` (Default: `false`)
- **Behavior:** Returns `true` if both `value` and `operand` are arrays, and they share at least one common element. Returns `false` otherwise. When `caseInsensitive` is `true`, string elements are compared case-insensitively.
- **Examples:**

  ```ts
  // Allow if user belongs to at least one of the required groups
  allow('access', ['project', { userGroups: ['hasSome', ['engineering', 'product']] }]);

  // Allow if article has at least one of the specified tags
  allow('viewSpecial', ['article', { tags: ['hasSome', ['urgent', 'internal']] }]);

  // Case-insensitive overlap check
  allow('access', [
    'project',
    { userGroups: ['hasSome', ['Engineering', 'Product'], { caseInsensitive: true }] },
  ]);
  ```

---

### `hasEvery`

- **Description:** Checks if the resource/context value (an array) contains _all_ of the elements present in the operand (an array). Uses strict equality (`===`) for comparison.
- **Signature:** `['hasEvery', operand, options?]`
- **Operand Type:** An array (`Array<any>`).
- **Options:** `{ caseInsensitive?: boolean }` (Default: `false`)
- **Behavior:** Returns `true` if both `value` and `operand` are arrays, and every element in the `operand` is also present in the `value`. Returns `false` otherwise. Order doesn't matter. When `caseInsensitive` is `true`, string elements are compared case-insensitively.
- **Examples:**

  ```ts
  // Allow if user has all required permissions
  allow('deploy', ['service', { userPermissions: ['hasEvery', ['build', 'deploy', 'monitor']] }]);

  // Allow if product includes all necessary components
  allow('ship', ['product', { components: ['hasEvery', ['powerSupply', 'cpu', 'ram']] }]);

  // Case-insensitive full coverage check
  allow('deploy', [
    'service',
    { userPermissions: ['hasEvery', ['Build', 'Deploy'], { caseInsensitive: true }] },
  ]);
  ```

---

### `some`

- **Description:** Checks if the resource/context value (an array of objects) contains _at least one_ object that satisfies the nested condition object provided as the operand.
- **Signature:** `['some', operand]`
- **Operand Type:** A Guantr condition object (`GuantrRuleCondition`).
- **Behavior:** Iterates through the array `value`. For each object element, it evaluates the nested `operand` condition against that object. Returns `true` as soon as one element satisfies the condition. Returns `false` if `value` is not an array or if no element satisfies the condition.
- **Examples:**

  ```ts
  // Allow if article has at least one comment authored by the current user
  allow('moderate', [
    'article',
    {
      comments: ['some', { authorId: ['eq', '$ctx.userId'] }],
    },
  ]);

  // Allow if project has at least one task assigned to the user's team
  allow('view', [
    'project',
    {
      tasks: ['some', { teamId: ['in', '$ctx.userTeamIds'] }],
    },
  ]);
  ```

---

### `every`

- **Description:** Checks if _all_ objects within the resource/context value (an array of objects) satisfy the nested condition object provided as the operand.
- **Signature:** `['every', operand]`
- **Operand Type:** A Guantr condition object (`GuantrRuleCondition`).
- **Behavior:** Iterates through the array `value`. For each object element, it evaluates the nested `operand` condition against that object. Returns `true` only if _all_ elements satisfy the condition (or if the array is empty). Returns `false` if `value` is not an array or if even one element fails the condition.
- **Examples:**

  ```ts
  // Allow merging if all checks in the 'checks' array have status 'passed'
  allow('merge', [
    'pullRequest',
    {
      checks: ['every', { status: ['eq', 'passed'] }],
    },
  ]);

  // Allow process if all items in the batch are validated
  allow('process', [
    'batch',
    {
      items: ['every', { isValidated: ['eq', true] }],
    },
  ]);
  ```

---

### `none`

- **Description:** Checks if _none_ of the objects within the resource/context value (an array of objects) satisfy the nested condition object provided as the operand.
- **Signature:** `['none', operand]`
- **Operand Type:** A Guantr condition object (`GuantrRuleCondition`).
- **Behavior:** Iterates through the array `value`. For each object element, it evaluates the nested `operand` condition against that object. Returns `true` only if _no_ elements satisfy the condition (or if the array is empty). Returns `false` if `value` is not an array or if even one element satisfies the condition.
- **Examples:**

  ```ts
  // Allow publishing if there are no blocking issues in the 'issues' array
  allow('publish', [
    'release',
    {
      issues: ['none', { isBlocking: ['eq', true] }],
    },
  ]);

  // Allow user action if they have no overdue tasks
  allow('proceed', [
    'user',
    {
      tasks: ['none', { status: ['eq', 'overdue'] }],
    },
  ]);
  ```

---

## Nullish Checks

Guantr supports checking whether a value is `null` or `undefined` using the `eq` operator. This is useful for:

- **Soft-delete patterns**: checking if `deletedAt` is `null` (meaning the record is active).
- **Optional fields**: checking if an optional field has been set or is still empty.
- **Nullable relationships**: checking if a related resource has been unlinked.

**Examples:**

```ts
// Allow access only if the resource has NOT been deleted
allow('read', ['resource', { deletedAt: ['eq', null] }]);

// Allow if an optional moderation flag has not been set
allow('publish', ['article', { moderationFlag: ['eq', undefined] }]);

// Combining null checks with other conditions
allow('edit', [
  'article',
  {
    deletedAt: ['eq', null],
    status: ['eq', 'draft'],
  },
]);
```

> **Note:** When a value in the resource is `null` or `undefined`, comparison operators (`gt`, `gte`, `contains`, `startsWith`, `endsWith`) and array operators (`has`, `hasSome`, `hasEvery`) will return `false` rather than throwing an error. The `eq` operator is the primary way to explicitly match against `null`/`undefined`.

---

## Combining Array Expressions with Nested Conditions (`$expr`)

When a condition value is a plain object (not an array expression), Guantr interprets it as a **nested condition** — it recurses into the nested keys and matches them against the corresponding resource property. For example:

```ts
// nested condition: checks roles.length === 2
roles: {
  length: ['eq', 2],
}
```

However, array properties like `roles` often need both:

- A condition applied to the **array itself** (e.g., `['has', 'admin']` or `['some', { ... }]`)
- Nested conditions on **properties of the array** (e.g., `.length`)

This is where the **`$expr` key** comes in. Within a nested condition object, you can use `$expr` to specify a **condition expression** that is evaluated against the array (or object) itself, while the remaining keys are treated as nested conditions.

```ts
// Without $expr: only nested condition
{
  roles: {
    length: ['gte', 1], // checks roles.length >= 1
  }
}

// With $expr: combines array-level expression AND nested conditions
{
  roles: {
    length: ['gte', 1],                                    // nested condition on roles object
    $expr: ['some', { name: ['eq', 'admin'] }],             // array-level expression on roles array
  }
}
// Both must evaluate to true for the rule to match.
```

**How it works:**

1. `$expr` (if present) is extracted from the object and evaluated as a condition expression against the resource property value.
2. The remaining keys are evaluated as a nested condition against the resource property value.
3. Both results must be `true` for the overall condition to pass (AND logic).

**Real-world example:**

```ts
// Allow reading a user if they have exactly 2 roles,
// AND at least one of those roles is named 'User' (case-insensitive)
allow('read', [
  'user',
  {
    roles: {
      length: ['eq', 2],
      $expr: ['some', { name: ['eq', 'User', { caseInsensitive: true }] }],
    },
  },
]);
```

`$expr` works with any array-level operator (`some`, `every`, `none`, `has`, `hasSome`, `hasEvery`) and also works with non-array values. It's also compatible with `length` or any other nested property checks on the same resource field.

---

## Handling Negation (Why No `ne` or `nin`?)

You might notice the absence of direct negation operators like `ne` (not equal) or `nin` (not in array). This is intentional in Guantr's design philosophy.

**Rationale:** Access control logic is often easier to reason about when permissions are additive (`allow` rules) and explicit restrictions are used (`deny` rules). Relying heavily on negative conditions (`allow if X is NOT Y`) can sometimes lead to overly permissive states if not carefully managed.

**How to Achieve Negation:** Use `deny` rules.

- **Instead of:** `allow('action', ['resource', { property: ['ne', 'value'] }])` (Incorrect - 'ne' doesn't exist)
- **Do This:**

  ```ts
  // Broadly allow the action...
  allow('action', 'resource');
  // ...then explicitly deny it for the specific case.
  deny('action', ['resource', { property: ['eq', 'value'] }]);
  ```

- **Instead of:** `allow('action', ['resource', { property: ['nin', ['a', 'b']] }])` (Incorrect - 'nin' doesn't exist)
- **Do This:**
  ```ts
  // Broadly allow...
  allow('action', 'resource');
  // ...then deny for the specific values.
  deny('action', ['resource', { property: ['in', ['a', 'b']] }]);
  ```

This approach makes the restriction explicit and leverages Guantr's rule precedence (`deny` overrides `allow`).

## Conclusion

Guantr's condition operators provide a rich vocabulary for expressing complex authorization logic based on attributes and relationships. By understanding how each operator functions and how to combine them within condition objects, you can implement fine-grained and flexible access control tailored to your application's needs. Remember to handle negation using `deny` rules for clarity and safety.
