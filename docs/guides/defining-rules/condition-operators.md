# Rules Condition Operators

Guantr's fine-grained control comes from its powerful **condition** logic within rules. Conditions are objects where keys map to resource properties, and values are **Condition Expressions**. The core of a condition expression is the **operator**, which defines the comparison logic.

Condition expressions typically follow the format `[operator, operand, options?]` as described in the [Defining Rules Guide](/guides/defining-rules.md). This page details each available operator.

## Available Operators

Here are the operators you can use in Guantr condition expressions:

---

### `eq`

* **Description:** Checks for strict equality (`===`) between the resource/context value and the operand.
* **Signature:** `['eq', operand]`
* **Operand Type:** Any literal value (string, number, boolean, null, undefined).
* **Behavior:** Performs a strict equality check (`value === operand`).
* **Examples:**
    ```ts
    // Allow if article status is exactly 'published'
    allow('read', ['article', { status: ['eq', 'published'] }]);

    // Allow if user ID matches a specific string
    allow('view', ['profile', { userId: ['eq', 'user-admin-123'] }]);

    // Allow if 'featured' flag is strictly true
    allow('display', ['product', { featured: ['eq', true] }]);

    // Check for null value
    allow('access', ['resource', { deletedAt: ['eq', null] }]);
    ```

---

### `in`

* **Description:** Checks if the resource/context value exists within the provided array operand (using strict equality `===` for comparison).
* **Signature:** `['in', operand]`
* **Operand Type:** An array (`Array<any>`).
* **Behavior:** Returns `true` if the `operand` is an array and contains an element strictly equal to the `value`. Returns `false` if the `operand` is not an array or the `value` is not found.
* **Examples:**
    ```ts
    // Allow if user role is one of 'admin' or 'editor'
    allow('edit', ['settings', { userRole: ['in', ['admin', 'editor']] }]);

    // Allow if product category ID is in the allowed list
    allow('view', ['product', { categoryId: ['in', [10, 25, 42]] }]);

    // Edge Case: Value not found
    // { userRole: ['in', ['viewer']] } will be false if userRole is 'editor'

    // Edge Case: Operand is not an array
    // { userRole: ['in', 'admin'] } will always evaluate to false
    ```

---

### `contains`

* **Description:** Checks if the resource/context value (string) contains the operand (string) as a substring.
* **Signature:** `['contains', operand, options?]`
* **Operand Type:** `string`
* **Options:** `{ caseInsensitive?: boolean }` (Default: `false`)
* **Behavior:** Returns `true` if both `value` and `operand` are strings, and `value` includes `operand`. Case sensitivity depends on the `options`. Returns `false` if either `value` or `operand` is not a string.
* **Examples:**
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

* **Description:** Checks if the resource/context value (string) starts with the operand (string).
* **Signature:** `['startsWith', operand, options?]`
* **Operand Type:** `string`
* **Options:** `{ caseInsensitive?: boolean }` (Default: `false`)
* **Behavior:** Returns `true` if both `value` and `operand` are strings, and `value` starts with `operand`. Case sensitivity depends on the `options`. Returns `false` if either is not a string.
* **Examples:**
    ```ts
    // Allow if product SKU starts with "PROD-"
    allow('manage', ['product', { sku: ['startsWith', 'PROD-'] }]);

    // Allow if username starts with "test_" (case-insensitive)
    allow('login', ['user', { username: ['startsWith', 'test_', { caseInsensitive: true }] }]);
    ```

---

### `endsWith`

* **Description:** Checks if the resource/context value (string) ends with the operand (string).
* **Signature:** `['endsWith', operand, options?]`
* **Operand Type:** `string`
* **Options:** `{ caseInsensitive?: boolean }` (Default: `false`)
* **Behavior:** Returns `true` if both `value` and `operand` are strings, and `value` ends with `operand`. Case sensitivity depends on the `options`. Returns `false` if either is not a string.
* **Examples:**
    ```ts
    // Allow if filename ends with ".pdf"
    allow('download', ['file', { filename: ['endsWith', '.pdf'] }]);

    // Allow if domain ends with ".org" (case-insensitive)
    allow('access', ['website', { domain: ['endsWith', '.org', { caseInsensitive: true }] }]);
    ```

---

### `gt`

* **Description:** Checks if the resource/context value is strictly greater than (`>`) the operand.
* **Signature:** `['gt', operand]`
* **Operand Type:** `number` or `string` (for lexical comparison).
* **Behavior:** Performs a `value > operand` comparison. Returns `false` if the types are incompatible for comparison (e.g., comparing a number to an object) or if the condition is not met.
* **Examples:**
    ```ts
    // Allow if comment score is greater than 10
    allow('upvote', ['comment', { score: ['gt', 10] }]);

    // Allow if version name is lexically greater than "v2.0"
    allow('deploy', ['release', { versionName: ['gt', 'v2.0'] }]);
    ```

---

### `gte`

* **Description:** Checks if the resource/context value is greater than or equal to (`>=`) the operand.
* **Signature:** `['gte', operand]`
* **Operand Type:** `number` or `string`.
* **Behavior:** Performs a `value >= operand` comparison. Returns `false` if types are incompatible or the condition is not met.
* **Examples:**
    ```ts
    // Allow if user age is 18 or older
    allow('register', ['user', { age: ['gte', 18] }]);

    // Allow if required clearance level is met or exceeded
    allow('access', ['document', { clearanceLevel: ['gte', '$ctx.userClearance'] }]);
    ```

---

### `has`

* **Description:** Checks if the resource/context value (an array) includes the operand (using strict equality `===`). Note: This checks `value.includes(operand)`.
* **Signature:** `['has', operand]`
* **Operand Type:** Any literal value.
* **Behavior:** Returns `true` if the `value` is an array and contains an element strictly equal to the `operand`. Returns `false` if the `value` is not an array or the `operand` is not found within it.
* **Examples:**
    ```ts
    // Allow if user's roles array includes 'admin'
    allow('access', ['adminPanel', { roles: ['has', 'admin'] }]);

    // Allow if article tags include 'featured'
    allow('promote', ['article', { tags: ['has', 'featured'] }]);

    // Edge Case: Value is not an array
    // { roles: ['has', 'admin'] } -> false if roles is undefined or string
    ```

---

### `hasSome`

* **Description:** Checks if the resource/context value (an array) contains *at least one* element that is also present in the operand (an array). Uses strict equality (`===`) for comparison.
* **Signature:** `['hasSome', operand]`
* **Operand Type:** An array (`Array<any>`).
* **Behavior:** Returns `true` if both `value` and `operand` are arrays, and they share at least one common element. Returns `false` otherwise.
* **Examples:**
    ```ts
    // Allow if user belongs to at least one of the required groups
    allow('access', ['project', { userGroups: ['hasSome', ['engineering', 'product']] }]);

    // Allow if article has at least one of the specified tags
    allow('viewSpecial', ['article', { tags: ['hasSome', ['urgent', 'internal']] }]);
    ```

---

### `hasEvery`

* **Description:** Checks if the resource/context value (an array) contains *all* of the elements present in the operand (an array). Uses strict equality (`===`) for comparison.
* **Signature:** `['hasEvery', operand]`
* **Operand Type:** An array (`Array<any>`).
* **Behavior:** Returns `true` if both `value` and `operand` are arrays, and every element in the `operand` is also present in the `value`. Returns `false` otherwise. Order doesn't matter.
* **Examples:**
    ```ts
    // Allow if user has all required permissions
    allow('deploy', ['service', { userPermissions: ['hasEvery', ['build', 'deploy', 'monitor']] }]);

    // Allow if product includes all necessary components
    allow('ship', ['product', { components: ['hasEvery', ['powerSupply', 'cpu', 'ram']] }]);
    ```

---

### `some`

* **Description:** Checks if the resource/context value (an array of objects) contains *at least one* object that satisfies the nested condition object provided as the operand.
* **Signature:** `['some', operand]`
* **Operand Type:** A Guantr condition object (`GuantrRuleCondition`).
* **Behavior:** Iterates through the array `value`. For each object element, it evaluates the nested `operand` condition against that object. Returns `true` as soon as one element satisfies the condition. Returns `false` if `value` is not an array or if no element satisfies the condition.
* **Examples:**
    ```ts
    // Allow if article has at least one comment authored by the current user
    allow('moderate', ['article', {
      comments: ['some', { authorId: ['eq', '$ctx.userId'] }]
    }]);

    // Allow if project has at least one task assigned to the user's team
    allow('view', ['project', {
      tasks: ['some', { teamId: ['in', '$ctx.userTeamIds'] }]
    }]);
    ```

---

### `every`

* **Description:** Checks if *all* objects within the resource/context value (an array of objects) satisfy the nested condition object provided as the operand.
* **Signature:** `['every', operand]`
* **Operand Type:** A Guantr condition object (`GuantrRuleCondition`).
* **Behavior:** Iterates through the array `value`. For each object element, it evaluates the nested `operand` condition against that object. Returns `true` only if *all* elements satisfy the condition (or if the array is empty). Returns `false` if `value` is not an array or if even one element fails the condition.
* **Examples:**
    ```ts
    // Allow merging if all checks in the 'checks' array have status 'passed'
    allow('merge', ['pullRequest', {
      checks: ['every', { status: ['eq', 'passed'] }]
    }]);

    // Allow process if all items in the batch are validated
    allow('process', ['batch', {
      items: ['every', { isValidated: ['eq', true] }]
    }]);
    ```

---

### `none`

* **Description:** Checks if *none* of the objects within the resource/context value (an array of objects) satisfy the nested condition object provided as the operand.
* **Signature:** `['none', operand]`
* **Operand Type:** A Guantr condition object (`GuantrRuleCondition`).
* **Behavior:** Iterates through the array `value`. For each object element, it evaluates the nested `operand` condition against that object. Returns `true` only if *no* elements satisfy the condition (or if the array is empty). Returns `false` if `value` is not an array or if even one element satisfies the condition.
* **Examples:**
    ```ts
    // Allow publishing if there are no blocking issues in the 'issues' array
    allow('publish', ['release', {
      issues: ['none', { isBlocking: ['eq', true] }]
    }]);

    // Allow user action if they have no overdue tasks
    allow('proceed', ['user', {
      tasks: ['none', { status: ['eq', 'overdue'] }]
    }]);
    ```

---

## Handling Negation (Why No `ne` or `nin`?)

You might notice the absence of direct negation operators like `ne` (not equal) or `nin` (not in array). This is intentional in Guantr's design philosophy.

**Rationale:** Access control logic is often easier to reason about when permissions are additive (`allow` rules) and explicit restrictions are used (`deny` rules). Relying heavily on negative conditions (`allow if X is NOT Y`) can sometimes lead to overly permissive states if not carefully managed.

**How to Achieve Negation:** Use `deny` rules.

* **Instead of:** `allow('action', ['resource', { property: ['ne', 'value'] }])` (Incorrect - 'ne' doesn't exist)
* **Do This:**
    ```ts
    // Broadly allow the action...
    allow('action', 'resource');
    // ...then explicitly deny it for the specific case.
    deny('action', ['resource', { property: ['eq', 'value'] }]);
    ```

* **Instead of:** `allow('action', ['resource', { property: ['nin', ['a', 'b']] }])` (Incorrect - 'nin' doesn't exist)
* **Do This:**
    ```ts
    // Broadly allow...
    allow('action', 'resource');
    // ...then deny for the specific values.
    deny('action', ['resource', { property: ['in', ['a', 'b']] }]);
    ```

This approach makes the restriction explicit and leverages Guantr's rule precedence (`deny` overrides `allow`).

## Conclusion

Guantr's condition operators provide a rich vocabulary for expressing complex authorization logic based on attributes and relationships. By understanding how each operator functions and how to combine them within condition objects, you can implement fine-grained and flexible access control tailored to your application's needs. Remember to handle negation using `deny` rules for clarity and safety.
