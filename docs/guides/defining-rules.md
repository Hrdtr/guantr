# Defining Rules in Guantr

Rules are the core of Guantr's authorization logic. They define what specific actions users are permitted (`allow`) or explicitly forbidden (`deny`) to perform on resources within your application. Defining these rules accurately, based on the Guantr API, is essential for robust access control.

## The Structure of a Rule (`GuantrAnyRule`)

Internally, every rule in Guantr follows the `GuantrAnyRule` structure defined in the types:

1.  **`effect`**: `'allow'` | `'deny'` - Determines if the rule grants or revokes permission.
2.  **`action`**: `string` - The **single** operation being attempted (e.g., `'read'`, `'update'`, `'publish'`).
3.  **`resource`**: `string` - The *type* or *key* identifying the resource (e.g., `'article'`, `'user'`).
4.  **`condition`**: `GuantrAnyRuleCondition | null` - An optional object specifying conditions that must be met for the rule to apply. This enables attribute-based and context-aware checks. If `null`, the rule applies based only on action and resource type.



## Methods for Setting Rules

Guantr uses the `setRules` method to define permissions, replacing any existing rules. You can provide rules in two ways:

### 1. Using the Callback Function

This method is often the simplest for defining rules directly within your code, offering good readability and type safety, especially with TypeScript `GuantrMeta`. You pass an asynchronous function to `setRules` that receives `allow` and `deny` helper functions.

**Callback Signature:**

The `allow` and `deny` functions accept:

`(action: string, resource: string | [resourceKey: string, condition: GuantrRuleCondition | null])`

* `action`: A **single string** naming the action (e.g., `'create'`).
* `resource`:
    * A `string` (e.g., `'article'`) defines a rule for that resource type *without conditions*.
    * A tuple `[resourceKey: string, condition: GuantrRuleCondition | null]` (e.g., `['article', { status: ['eq', 'draft'] }]`) defines a rule for the `resourceKey` that applies only if the `condition` evaluates to true against the resource instance.


**Example:**

```ts
import { createGuantr } from 'guantr';
// Assuming GuantrMeta is defined elsewhere for type safety
// import type { GuantrMeta } from './guantr-meta';

// const guantr = await createGuantr<GuantrMeta>();
const guantr = await createGuantr(); // Without specific Meta

await guantr.setRules((allow, deny) => {
  // Allow reading any 'article'
  allow('read', 'article');

  // Allow creating 'article' if its status is 'draft'
  allow('create', ['article', { status: ['eq', 'draft'] }]);
  // Allow updating 'article' if its status is 'draft'
  allow('update', ['article', { status: ['eq', 'draft'] }]);
   // Allow deleting 'article' if its status is 'draft'
  allow('delete', ['article', { status: ['eq', 'draft'] }]);

  // Explicitly deny deleting 'article' if it's 'published'
  deny('delete', ['article', { status: ['eq', 'published'] }]);

  // Allow reading 'user' profiles
  allow('read', 'user');

  // Deny reading 'user' profiles if they are private
  // (Negation like "ownerId != context.userId" is handled by a separate 'deny' rule)
  deny('read', ['user', { private: ['eq', true] }]);
  // Allow reading a user's own private profile (overrides the general deny above)
  allow('read', ['user', { private: ['eq', true], ownerId: ['eq', '$ctx.userId'] }]);
});
```

### 2. Using a Direct Array of Rule Objects

You can also provide an array of rule objects directly to `setRules`. Each object must conform to the `GuantrRule` (or `GuantrAnyRule`) structure. While the callback might be simpler for direct definition, **passing an array provides more flexibility, allowing you to preprocess, generate, or fetch rules from external sources before applying them.**

```ts
import { createGuantr } from 'guantr';
import type { GuantrRule } from 'guantr'; // Or GuantrAnyRule if not using Meta

const guantr = await createGuantr();

// Define types for demonstration if not using GuantrMeta
type Action = 'read' | 'create' | 'update' | 'delete';
type ResourceKey = 'article' | 'user';
type Article = { id: number; status: 'draft' | 'published'; ownerId: string };
type User = { id: string; private: boolean; ownerId: string };
type Context = { userId: string };

const rules: GuantrRule</*Meta substitute*/ { ResourceMap: { article: { action: Action, model: Article }, user: { action: Action, model: User } }, Context: Context }>[] = [
  { effect: 'allow', action: 'read', resource: 'article', condition: null },
  { effect: 'allow', action: 'create', resource: 'article', condition: { status: ['eq', 'draft'] } },
  { effect: 'allow', action: 'update', resource: 'article', condition: { status: ['eq', 'draft'] } },
  { effect: 'allow', action: 'delete', resource: 'article', condition: { status: ['eq', 'draft'] } },
  { effect: 'deny', action: 'delete', resource: 'article', condition: { status: ['eq', 'published'] } },
  { effect: 'allow', action: 'read', resource: 'user', condition: null },
  { effect: 'deny', action: 'read', resource: 'user', condition: { private: ['eq', true] } },
  { effect: 'allow', action: 'read', resource: 'user', condition: { private: ['eq', true], ownerId: ['eq', '$ctx.userId'] } },
];

await guantr.setRules(rules);
```

## Defining Actions

Actions are **single strings** representing operations (e.g., `'view'`, `'edit'`, `'assignRole'`). If you need to allow multiple related actions under similar conditions, define separate rules for each action.

## Defining Resource Keys

Resource keys are strings identifying the *type* of resource (e.g., `'article'`, `'comment'`). They link actions to the models and conditions defined in your `GuantrMeta` (if using TypeScript) and are used in rule definitions.

## Defining Conditions (`GuantrRuleCondition`)

Conditions enable fine-grained control by evaluating rules against resource instance properties and/or the current context.

* **Structure:** A condition is an object where keys map to properties of the resource model.
* **Values (Condition Expressions):** The value for each key must be a **Condition Expression** or a nested condition object.
* **Condition Expression Format:** A Condition Expression is an array: `[operator, operand, options?]`.
    * `operator`: A string specifying the comparison logic. See the table below for available operators.
    * `operand`: The value to compare against. Can be a literal or a string starting with `$ctx.` to use a context value.
    * `options`: (Optional) An object for operator-specific behavior (e.g., `caseInsensitive`).

**Available Condition Operators:**

Guantr provides a specific set of operators. Note that direct negation operators (like `ne`, `nin`) are *not* included; negation logic should be implemented using `deny` rules.

| Operator       | Description                                   | Example Expression                        |
| :------------- | :-------------------------------------------- | :---------------------------------------- |
| `eq`           | Equal                                         | `status: ['eq', 'active']`                |
| `in`           | Value is in array                             | `role: ['in', ['admin', 'moderator']]`   |
| `contains`     | String contains substring                     | `title: ['contains', 'urgent']`           |
| `startsWith`   | String starts with substring                  | `sku: ['startsWith', 'PROD-']`           |
| `endsWith`     | String ends with substring                    | `email: ['endsWith', '@example.com']`     |
| `gt`           | Greater than                                  | `priority: ['gt', 5]`                     |
| `gte`          | Greater than or equal to                      | `score: ['gte', 100]`                     |
| `has`          | Array contains element                        | `flags: ['has', 'verified']`              |
| `hasSome`      | Array contains *any* element from list        | `groups: ['hasSome', ['beta', 'dev']]`    |
| `hasEvery`     | Array contains *all* elements from list       | `permissions: ['hasEvery', ['read', 'write']]` |
| `some`         | Array of objects has *some* matching object   | `comments: ['some', { authorId: ['eq', '$ctx.userId'] }]` |
| `every`        | Array of objects, *all* objects match         | `tasks: ['every', { completed: ['eq', true] }]` |
| `none`         | Array of objects, *none* of the objects match | `errors: ['none', { severity: ['eq', 'critical'] }]` |

* **Nested Conditions:** Condition objects can be nested to check properties of nested objects within your resource model.

* **Contextual Operands (`$ctx.`):** Use `$ctx.` within the `operand` to compare against values from the Guantr context provided during initialization.

    ```ts
    // Example using context
    allow('edit', ['article', { ownerId: ['eq', '$ctx.userId'] }]);
    ```

## Rule Precedence and Negation

Rule evaluation follows two key principles:

1.  **`deny` rules always override `allow` rules.** If any matching `deny` rule applies, permission is refused, even if an `allow` rule also matches.
2.  **Handle Negation with `deny`:** Because operators like `ne` (not equals) or `nin` (not in) are not provided, you should achieve negation by defining specific `deny` rules. For instance, instead of `allow('read', ['article', { status: ['ne', 'archived'] }])`, you would use `allow('read', 'article')` combined with `deny('read', ['article', { status: ['eq', 'archived'] }])`.

By using single-string actions, the correct condition operators, and the appropriate method for setting rules (`callback` or `array`), you can accurately define your application's authorization logic with Guantr.
